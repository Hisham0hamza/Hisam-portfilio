import { z } from 'zod';

import { toRpcFilters, type SearchContext, type SearchFilters } from '@/features/search/filters';
import { unwrap } from '@/lib/errors';
import { uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';

import {
  EVENT_DETAIL_SELECT,
  EVENT_LIST_SELECT,
  citySchema,
  eventDetailSchema,
  eventListItemSchema,
  eventSummarySchema,
  toPointWkt,
  type EventFormValues,
  type EventStatus,
} from './schemas';

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
export async function searchEvents(filters: SearchFilters, ctx: SearchContext) {
  const payload = toRpcFilters(filters, ctx);
  const data = unwrap(await supabase.rpc('search_events', { filters: payload }));
  const rows = z.array(eventSummarySchema).parse(data ?? []);
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function getCities() {
  const data = unwrap(await supabase.from('cities').select('slug, name_en, name_ar').order('sort_order'));
  return z.array(citySchema).parse(data);
}

// ---------------------------------------------------------------------------
// Event page
// ---------------------------------------------------------------------------
export async function getEvent(id: string) {
  const data = unwrap(
    await supabase
      .from('events')
      .select(EVENT_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle(),
  );
  if (!data) return null;
  const event = eventDetailSchema.parse(data);
  event.photos.sort((a, b) => a.sort_order - b.sort_order);
  event.stops.sort((a, b) => a.sort_order - b.sort_order);
  return event;
}

const attendeeSchema = z.object({ user_id: z.string(), name: z.string(), avatar_url: z.string().nullable() });
export type Attendee = z.infer<typeof attendeeSchema>;

export async function getAttendees(eventId: string) {
  const data = unwrap(await supabase.rpc('event_attendees', { p_event_id: eventId }));
  return z.array(attendeeSchema).parse(data ?? []);
}

// ---------------------------------------------------------------------------
// Hosting
// ---------------------------------------------------------------------------
export async function getHostedEvents(hostId: string, statuses?: EventStatus[]) {
  let q = supabase.from('events').select(EVENT_LIST_SELECT).eq('host_id', hostId).order('start_at', { ascending: false });
  if (statuses) q = q.in('status', statuses);
  return z.array(eventListItemSchema).parse(unwrap(await q));
}

async function resolvePhoto(userId: string, photo: { uri: string; remote: boolean }) {
  return photo.remote ? photo.uri : uploadImage('event-photos', userId, photo.uri);
}

/**
 * Creates or updates an event with its photos and route stops.
 * Local photos are compressed and uploaded first; stops and gallery are replaced wholesale.
 */
export async function saveEvent(params: {
  id?: string;
  hostId: string;
  values: EventFormValues;
  status: EventStatus;
}) {
  const { id, hostId, values: v, status } = params;

  const coverUrl = v.cover ? await resolvePhoto(hostId, v.cover) : null;
  const galleryUrls = await Promise.all(v.gallery.map((p) => resolvePhoto(hostId, p)));

  const row = {
    title: v.title,
    description: v.description,
    category: v.category,
    city: v.city,
    area: v.area || null,
    meeting_point: toPointWkt(v.meetingPoint!),
    meeting_address: v.meetingAddress,
    start_at: v.startAt.toISOString(),
    end_at: v.endAt ? v.endAt.toISOString() : null,
    duration_minutes: v.durationMinutes,
    difficulty: v.difficulty,
    distance_km: v.distanceKm,
    price_egp: v.priceEgp,
    includes: v.includes || null,
    capacity: v.capacity,
    languages: v.languages,
    women_only: v.womenOnly,
    family_friendly: v.familyFriendly,
    what_to_bring: v.whatToBring || null,
    cancellation_policy: v.cancellationPolicy || null,
    approval_mode: v.approvalMode,
    status,
    cover_url: coverUrl,
  };

  let eventId = id;
  if (eventId) {
    unwrap(await supabase.from('events').update(row).eq('id', eventId).select('id').single());
  } else {
    const created = unwrap(await supabase.from('events').insert({ ...row, host_id: hostId }).select('id').single());
    eventId = (created as { id: string }).id;
  }

  unwrap(await supabase.from('event_stops').delete().eq('event_id', eventId));
  if (v.stops.length) {
    unwrap(
      await supabase.from('event_stops').insert(
        v.stops.map((s, i) => ({
          event_id: eventId,
          name: s.name,
          location: toPointWkt({ lat: s.lat, lng: s.lng }),
          sort_order: i + 1,
        })),
      ),
    );
  }

  unwrap(await supabase.from('event_photos').delete().eq('event_id', eventId));
  if (galleryUrls.length) {
    unwrap(
      await supabase
        .from('event_photos')
        .insert(galleryUrls.map((url, i) => ({ event_id: eventId, url, sort_order: i + 1 }))),
    );
  }

  return eventId!;
}

export async function cancelEvent(eventId: string) {
  unwrap(await supabase.rpc('cancel_event', { p_event_id: eventId }));
}

export async function completeEvent(eventId: string) {
  unwrap(await supabase.rpc('complete_event', { p_event_id: eventId }));
}

export async function deleteDraft(eventId: string) {
  unwrap(await supabase.from('events').delete().eq('id', eventId).eq('status', 'draft'));
}
