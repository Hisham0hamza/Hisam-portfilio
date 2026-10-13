import { z } from 'zod';

import { EVENT_LIST_SELECT, applicationStatusSchema, eventListItemSchema } from '@/features/events/schemas';
import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import * as demo from '@/features/demo/api';
import { env } from '@/lib/env';

export const applicationSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  user_id: z.string(),
  status: applicationStatusSchema,
  message: z.string().nullable(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
});
export type Application = z.infer<typeof applicationSchema>;

export async function getMyApplication(eventId: string, userId: string) {
  if (env.isDemo) return demo.getMyApplication(eventId, userId);
  const data = unwrap(
    await supabase
      .from('applications')
      .select('id, event_id, user_id, status, message, created_at, decided_at')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
  );
  return data ? applicationSchema.parse(data) : null;
}

export async function applyToEvent(eventId: string, message: string | null) {
  if (env.isDemo) return demo.applyToEvent(eventId, message);
  return applicationSchema.parse(
    unwrap(await supabase.rpc('apply_to_event', { p_event_id: eventId, p_message: message })),
  );
}

export async function cancelApplication(eventId: string) {
  if (env.isDemo) return demo.cancelApplication(eventId);
  return applicationSchema.parse(unwrap(await supabase.rpc('cancel_application', { p_event_id: eventId })));
}

export async function decideApplication(applicationId: string, approve: boolean) {
  if (env.isDemo) return demo.decideApplication(applicationId, approve);
  return applicationSchema.parse(
    unwrap(await supabase.rpc('decide_application', { p_application_id: applicationId, p_approve: approve })),
  );
}

export async function markAttendance(applicationId: string, attended: boolean) {
  if (env.isDemo) return demo.markAttendance(applicationId, attended);
  return applicationSchema.parse(
    unwrap(await supabase.rpc('mark_attendance', { p_application_id: applicationId, p_attended: attended })),
  );
}

// Host view: applicants with their profiles.
export const applicantSchema = applicationSchema.extend({
  user: z.object({
    id: z.string(),
    name: z.string(),
    avatar_url: z.string().nullable(),
    city: z.string().nullable(),
  }),
});
export type Applicant = z.infer<typeof applicantSchema>;

export async function getApplicants(eventId: string) {
  if (env.isDemo) return demo.getApplicants(eventId);
  const data = unwrap(
    await supabase
      .from('applications')
      .select('id, event_id, user_id, status, message, created_at, decided_at, user:profiles!applications_user_id_fkey ( id, name, avatar_url, city )')
      .eq('event_id', eventId)
      .order('created_at'),
  );
  return z.array(applicantSchema).parse(data);
}

// Walker view: "My Trips".
export const tripSchema = applicationSchema.extend({ event: eventListItemSchema });
export type Trip = z.infer<typeof tripSchema>;

export async function getMyTrips(userId: string) {
  if (env.isDemo) return demo.getMyTrips(userId);
  const data = unwrap(
    await supabase
      .from('applications')
      .select(`id, event_id, user_id, status, message, created_at, decided_at, event:events ( ${EVENT_LIST_SELECT} )`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
  return z.array(tripSchema).parse(data);
}

/** Pending application counts per hosted event (badge on the Host tab). */
export async function getPendingCounts(eventIds: string[]) {
  if (env.isDemo) return demo.getPendingCounts(eventIds);
  if (!eventIds.length) return {} as Record<string, number>;
  const data = unwrap(
    await supabase.from('applications').select('event_id').in('event_id', eventIds).eq('status', 'pending'),
  ) as { event_id: string }[];
  return data.reduce<Record<string, number>>((acc, r) => {
    acc[r.event_id] = (acc[r.event_id] ?? 0) + 1;
    return acc;
  }, {});
}
