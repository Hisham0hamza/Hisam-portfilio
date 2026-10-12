import { describe, expect, it } from 'vitest';

import { applyState, canCancel, seatsLeft, type ApplyStateInput } from './logic';

const now = new Date('2026-10-12T10:00:00Z');
const future = '2026-10-15T10:00:00Z';
const past = '2026-10-10T10:00:00Z';

const base = (over: Partial<ApplyStateInput['event']> = {}, app: ApplyStateInput['application'] = null) =>
  applyState({
    event: { status: 'published', start_at: future, capacity: 10, approved_count: 3, host_id: 'host', ...over },
    application: app,
    userId: 'me',
    now,
  });

describe('seatsLeft', () => {
  it('never goes below zero', () => {
    expect(seatsLeft(10, 3)).toBe(7);
    expect(seatsLeft(5, 5)).toBe(0);
    expect(seatsLeft(5, 7)).toBe(0);
  });
});

describe('applyState', () => {
  it('lets walkers apply to open events', () => {
    expect(base()).toBe('can_apply');
  });

  it('marks full events', () => {
    expect(base({ approved_count: 10 })).toBe('full');
  });

  it('recognises the host', () => {
    expect(applyState({ event: { status: 'published', start_at: future, capacity: 1, approved_count: 0, host_id: 'me' }, application: null, userId: 'me', now })).toBe('own_event');
  });

  it('closes drafts, cancelled and completed events', () => {
    expect(base({ status: 'cancelled' })).toBe('closed');
    expect(base({ status: 'completed' })).toBe('closed');
    expect(base({ status: 'draft' })).toBe('closed');
  });

  it('closes events that already started', () => {
    expect(base({ start_at: past })).toBe('started');
  });

  it('shows the current application status', () => {
    expect(base({}, { status: 'pending' })).toBe('pending');
    expect(base({ approved_count: 10 }, { status: 'approved' })).toBe('approved');
    expect(base({}, { status: 'rejected' })).toBe('rejected');
    expect(base({ status: 'completed', start_at: past }, { status: 'attended' })).toBe('attended');
  });

  it('allows re-applying after cancelling, unless the event filled up', () => {
    expect(base({}, { status: 'cancelled' })).toBe('can_reapply');
    expect(base({ approved_count: 10 }, { status: 'cancelled' })).toBe('full');
  });

  it('works for signed-out visitors', () => {
    expect(applyState({ event: { status: 'published', start_at: future, capacity: 2, approved_count: 0, host_id: 'h' }, application: null, userId: null, now })).toBe('can_apply');
  });
});

describe('canCancel', () => {
  it('allows cancelling pending/approved before the start only', () => {
    expect(canCancel('pending', future, now)).toBe(true);
    expect(canCancel('approved', future, now)).toBe(true);
    expect(canCancel('approved', past, now)).toBe(false);
    expect(canCancel('rejected', future, now)).toBe(false);
  });
});
