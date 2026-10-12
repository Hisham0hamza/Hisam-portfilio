// Which "apply" action the event page should offer. Mirrors the rules enforced by
// apply_to_event / cancel_application in the database (the DB stays the source of truth).

import type { ApplicationStatus, EventStatus } from '@/features/events/schemas';

export type ApplyState =
  | 'own_event'
  | 'closed' // draft / cancelled / completed
  | 'started'
  | 'can_apply'
  | 'can_reapply'
  | 'full'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'attended'
  | 'no_show';

export type ApplyStateInput = {
  event: { status: EventStatus; start_at: string; capacity: number; approved_count: number; host_id: string };
  application: { status: ApplicationStatus } | null;
  userId: string | null;
  now?: Date;
};

export function seatsLeft(capacity: number, approvedCount: number) {
  return Math.max(capacity - approvedCount, 0);
}

export function applyState({ event, application, userId, now = new Date() }: ApplyStateInput): ApplyState {
  if (userId && event.host_id === userId) return 'own_event';

  // An existing application always wins, so walkers can see their status on past events too.
  switch (application?.status) {
    case 'pending':
    case 'approved':
    case 'rejected':
    case 'attended':
    case 'no_show':
      return application.status;
  }

  if (event.status !== 'published') return 'closed';
  if (new Date(event.start_at) <= now) return 'started';
  if (seatsLeft(event.capacity, event.approved_count) === 0) return 'full';
  return application?.status === 'cancelled' ? 'can_reapply' : 'can_apply';
}

/** Walkers may cancel pending/approved applications until the event starts. */
export function canCancel(state: ApplyState, startAt: string, now = new Date()) {
  return (state === 'pending' || state === 'approved') && new Date(startAt) > now;
}
