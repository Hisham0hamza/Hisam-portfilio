import { z } from 'zod';

import { EVENT_LIST_SELECT, eventListItemSchema } from '@/features/events/schemas';
import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export async function getSavedEvents(userId: string) {
  const data = unwrap(
    await supabase
      .from('saved_events')
      .select(`event_id, created_at, event:events ( ${EVENT_LIST_SELECT} )`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
  return z
    .array(z.object({ event_id: z.string(), created_at: z.string(), event: eventListItemSchema.nullable() }))
    .parse(data)
    .flatMap((r) => (r.event ? [r.event] : []));
}

export async function setSaved(userId: string, eventId: string, saved: boolean) {
  if (saved) {
    unwrap(
      await supabase
        .from('saved_events')
        .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true }),
    );
  } else {
    unwrap(await supabase.from('saved_events').delete().eq('user_id', userId).eq('event_id', eventId));
  }
}
