import { z } from 'zod';

import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import * as demo from '@/features/demo/api';
import { env } from '@/lib/env';

export const reviewSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  created_at: z.string(),
  reviewer: z.object({ id: z.string(), name: z.string(), avatar_url: z.string().nullable() }),
  event: z.object({ id: z.string(), title: z.string() }).nullable().optional(),
});
export type Review = z.infer<typeof reviewSchema>;

const REVIEW_SELECT =
  'id, event_id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( id, name, avatar_url ), event:events ( id, title )';

export async function getEventReviews(eventId: string) {
  if (env.isDemo) return demo.getEventReviews(eventId);
  const data = unwrap(
    await supabase.from('reviews').select(REVIEW_SELECT).eq('event_id', eventId).order('created_at', { ascending: false }),
  );
  return z.array(reviewSchema).parse(data);
}

export async function getHostReviews(hostId: string) {
  if (env.isDemo) return demo.getHostReviews(hostId);
  const data = unwrap(
    await supabase
      .from('reviews')
      .select(REVIEW_SELECT)
      .eq('host_id', hostId)
      .order('created_at', { ascending: false })
      .limit(30),
  );
  return z.array(reviewSchema).parse(data);
}

export async function canReview(eventId: string) {
  if (env.isDemo) return demo.canReview(eventId);
  return Boolean(unwrap(await supabase.rpc('can_review', { p_event_id: eventId })));
}

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, 'rating_required').max(5),
  comment: z.string().trim().max(2000, 'too_long'),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export async function getMyReview(eventId: string, reviewerId: string) {
  if (env.isDemo) return demo.getMyReview(eventId, reviewerId);
  const data = unwrap(
    await supabase.from('reviews').select(REVIEW_SELECT).eq('event_id', eventId).eq('reviewer_id', reviewerId).maybeSingle(),
  );
  return data ? reviewSchema.parse(data) : null;
}

export async function submitReview(eventId: string, reviewerId: string, values: ReviewFormValues, existingId?: string) {
  if (env.isDemo) return demo.submitReview(eventId, reviewerId, values, existingId);
  const fields = { rating: values.rating, comment: values.comment || null };
  if (existingId) {
    unwrap(await supabase.from('reviews').update(fields).eq('id', existingId));
    return;
  }
  unwrap(
    await supabase.from('reviews').insert({
      event_id: eventId,
      reviewer_id: reviewerId,
      host_id: reviewerId, // replaced with the event's host by the reviews_set_host trigger
      ...fields,
    }),
  );
}
