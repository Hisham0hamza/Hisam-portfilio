import { z } from 'zod';

import { unwrap } from '@/lib/errors';
import { uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  languages: z.array(z.string()),
  interests: z.array(z.string()),
  is_host: z.boolean(),
  host_verified: z.boolean(),
  created_at: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileStatsSchema = z.object({
  events_attended: z.number(),
  events_hosted: z.number(),
  rating_avg: z.union([z.number(), z.string(), z.null()]).transform((v) => (v === null ? null : Number(v))),
  rating_count: z.number(),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;

export async function getProfile(id: string) {
  const data = unwrap(
    await supabase
      .from('profiles')
      .select('id, name, avatar_url, bio, city, languages, interests, is_host, host_verified, created_at')
      .eq('id', id)
      .maybeSingle(),
  );
  return data ? profileSchema.parse(data) : null;
}

export async function getProfileStats(id: string) {
  const data = unwrap(await supabase.rpc('profile_stats', { p_user_id: id }));
  const row = Array.isArray(data) ? data[0] : data;
  return profileStatsSchema.parse(row ?? { events_attended: 0, events_hosted: 0, rating_avg: null, rating_count: 0 });
}

export const INTERESTS = [
  'heritage',
  'architecture',
  'history',
  'hiking',
  'nature',
  'photography',
  'food',
  'culture',
  'desert',
  'camping',
  'stargazing',
  'sea',
] as const;

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'too_short').max(80, 'too_long'),
  bio: z.string().trim().max(1000, 'too_long'),
  city: z.string().nullable(),
  languages: z.array(z.string()),
  interests: z.array(z.string()).max(12),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export async function updateProfile(id: string, values: ProfileFormValues, avatarUri?: string | null) {
  const avatar_url = avatarUri ? await uploadImage('avatars', id, avatarUri, 600) : undefined;
  unwrap(
    await supabase
      .from('profiles')
      .update({
        name: values.name,
        bio: values.bio || null,
        city: values.city,
        languages: values.languages,
        interests: values.interests,
        ...(avatar_url ? { avatar_url } : {}),
      })
      .eq('id', id),
  );
}
