// Masar — delivers the notifications outbox as Expo push notifications.
// Invoked every minute by pg_cron (see supabase/cron.sql) with the service role key.
//
// Deploy: supabase functions deploy send-push

import { createClient } from 'npm:@supabase/supabase-js@2';

type Notification = {
  id: string;
  user_id: string;
  event_id: string | null;
  type: string;
  data: Record<string, unknown>;
};

type Token = { token: string; user_id: string; locale: string | null };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

const templates: Record<'en' | 'ar', Record<string, (d: Record<string, unknown>) => [string, string]>> = {
  en: {
    application_received: (d) =>
      d.auto_approved
        ? ['New walker joined', `${d.applicant_name ?? 'Someone'} joined "${d.event_title}".`]
        : ['New application', `${d.applicant_name ?? 'Someone'} wants to join "${d.event_title}".`],
    application_approved: (d) => ['You’re in! 🎉', `Your spot on "${d.event_title}" is confirmed.`],
    application_rejected: (d) => ['Application update', `The host couldn’t accept you for "${d.event_title}".`],
    event_reminder_24h: (d) => ['Tomorrow', `"${d.event_title}" starts in about 24 hours.`],
    event_reminder_2h: (d) => ['Starting soon', `"${d.event_title}" starts in about 2 hours. See you there!`],
    event_cancelled: (d) => ['Event cancelled', `"${d.event_title}" has been cancelled by the host.`],
  },
  ar: {
    application_received: (d) =>
      d.auto_approved
        ? ['مشارك جديد', `${d.applicant_name ?? 'شخص ما'} انضم إلى "${d.event_title}".`]
        : ['طلب انضمام جديد', `${d.applicant_name ?? 'شخص ما'} يريد الانضمام إلى "${d.event_title}".`],
    application_approved: (d) => ['تم قبولك! 🎉', `تم تأكيد مكانك في "${d.event_title}".`],
    application_rejected: (d) => ['تحديث على طلبك', `لم يتمكن المنظم من قبولك في "${d.event_title}".`],
    event_reminder_24h: (d) => ['غداً', `"${d.event_title}" يبدأ بعد حوالي ٢٤ ساعة.`],
    event_reminder_2h: (d) => ['قريباً', `"${d.event_title}" يبدأ بعد حوالي ساعتين. نراك هناك!`],
    event_cancelled: (d) => ['تم إلغاء الفعالية', `قام المنظم بإلغاء "${d.event_title}".`],
  },
};

function render(n: Notification, locale: string | null): [string, string] {
  const lang = locale?.startsWith('ar') ? 'ar' : 'en';
  const fn = templates[lang][n.type];
  return fn ? fn(n.data ?? {}) : ['Masar', String(n.data?.event_title ?? '')];
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, user_id, event_id, type, data')
    .is('sent_at', null)
    .order('created_at')
    .limit(500);
  if (error) return new Response(error.message, { status: 500 });
  if (!pending?.length) return Response.json({ sent: 0 });

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: tokens } = await supabase.from('push_tokens').select('token, user_id, locale').in('user_id', userIds);
  const byUser = new Map<string, Token[]>();
  for (const t of (tokens ?? []) as Token[]) {
    byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);
  }

  const messages: { to: string; title: string; body: string; data: Record<string, unknown>; sound: 'default' }[] = [];
  for (const n of pending as Notification[]) {
    for (const t of byUser.get(n.user_id) ?? []) {
      const [title, body] = render(n, t.locale);
      messages.push({
        to: t.token,
        title,
        body,
        sound: 'default',
        data: { type: n.type, eventId: n.event_id, url: n.event_id ? `masar://event/${n.event_id}` : undefined },
      });
    }
  }

  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    json.data?.forEach((ticket, idx) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        deadTokens.push(chunk[idx].to);
      }
    });
  }

  if (deadTokens.length) await supabase.from('push_tokens').delete().in('token', deadTokens);
  // Mark everything we processed as sent (users without devices simply have nothing to receive).
  await supabase
    .from('notifications')
    .update({ sent_at: new Date().toISOString() })
    .in(
      'id',
      pending.map((n) => n.id),
    );

  return Response.json({ sent: messages.length, notifications: pending.length });
});
