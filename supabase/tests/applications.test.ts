import type { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_URL,
  actAs,
  actAsAdmin,
  connect,
  createEvent,
  createUser,
  errorOf,
  resetTestDatabase,
} from './helpers';

type App = { id: string; status: string; event_id: string; user_id: string };

describe.skipIf(!ADMIN_URL)('applications & capacity', () => {
  let db: Client;
  let host: string;
  let walkerA: string;
  let walkerB: string;
  let walkerC: string;

  const apply = async (userId: string, eventId: string, message: string | null = null) => {
    await actAs(db, userId);
    try {
      const { rows } = await db.query<App>('select * from public.apply_to_event($1, $2)', [eventId, message]);
      return rows[0];
    } finally {
      await actAsAdmin(db);
    }
  };

  const asUser = async <T>(userId: string, sql: string, params: unknown[] = []) => {
    await actAs(db, userId);
    try {
      return (await db.query(sql, params)).rows as T[];
    } finally {
      await actAsAdmin(db);
    }
  };

  const approvedCount = async (eventId: string) =>
    (await db.query<{ approved_count: number }>('select approved_count from events where id = $1', [eventId]))
      .rows[0].approved_count;

  beforeAll(async () => {
    await resetTestDatabase('applications');
    db = await connect();
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await actAsAdmin(db);
    host = await createUser(db, 'Host');
    walkerA = await createUser(db, 'Walker A');
    walkerB = await createUser(db, 'Walker B');
    walkerC = await createUser(db, 'Walker C');
  });

  describe('applying', () => {
    it('auto-approves on auto-accept events and counts the seat', async () => {
      const event = await createEvent(db, host, { approval_mode: 'auto', capacity: 5 });
      const app = await apply(walkerA, event, 'Hi!');
      expect(app.status).toBe('approved');
      expect(await approvedCount(event)).toBe(1);
    });

    it('leaves applications pending on manual events', async () => {
      const event = await createEvent(db, host, { approval_mode: 'manual' });
      const app = await apply(walkerA, event);
      expect(app.status).toBe('pending');
      expect(await approvedCount(event)).toBe(0);
    });

    it('rejects a second application from the same user', async () => {
      const event = await createEvent(db, host);
      await apply(walkerA, event);
      expect(await errorOf(apply(walkerA, event))).toBe('already_applied');
    });

    it('does not let hosts apply to their own event', async () => {
      const event = await createEvent(db, host);
      expect(await errorOf(apply(host, event))).toBe('own_event');
    });

    it('refuses drafts and anonymous users', async () => {
      const draft = await createEvent(db, host, { status: 'draft' });
      expect(await errorOf(apply(walkerA, draft))).toBe('event_not_open');

      const event = await createEvent(db, host);
      await actAs(db, null);
      const err = await errorOf(db.query('select public.apply_to_event($1)', [event]));
      await actAsAdmin(db);
      expect(err).toMatch(/permission denied/);
    });

    it('refuses events that already started', async () => {
      const event = await createEvent(db, host);
      await db.query(`update events set start_at = now() - interval '1 hour' where id = $1`, [event]);
      expect(await errorOf(apply(walkerA, event))).toBe('event_started');
    });
  });

  describe('capacity', () => {
    it('refuses to overbook an auto-accept event', async () => {
      const event = await createEvent(db, host, { capacity: 2 });
      await apply(walkerA, event);
      await apply(walkerB, event);
      expect(await errorOf(apply(walkerC, event))).toBe('event_full');
      expect(await approvedCount(event)).toBe(2);
    });

    it('refuses host approvals beyond capacity', async () => {
      const event = await createEvent(db, host, { capacity: 1, approval_mode: 'manual' });
      const a = await apply(walkerA, event);
      const b = await apply(walkerB, event);

      await asUser(host, 'select public.decide_application($1, true)', [a.id]);
      await actAs(db, host);
      const err = await errorOf(db.query('select public.decide_application($1, true)', [b.id]));
      await actAsAdmin(db);
      expect(err).toBe('event_full');
      expect(await approvedCount(event)).toBe(1);
    });

    it('enforces capacity even for direct (service role) writes', async () => {
      const event = await createEvent(db, host, { capacity: 1 });
      await apply(walkerA, event);
      const err = await errorOf(
        db.query(`insert into applications (event_id, user_id, status) values ($1, $2, 'approved')`, [event, walkerB]),
      );
      expect(err).toBe('event_full');
    });

    it('never overbooks under concurrent applications', async () => {
      const event = await createEvent(db, host, { capacity: 1 });
      const c1 = await connect();
      const c2 = await connect();
      try {
        await actAs(c1, walkerA);
        await actAs(c2, walkerB);
        await c1.query('begin');
        await c1.query('select public.apply_to_event($1)', [event]); // holds the event lock
        const second = errorOf(c2.query('select public.apply_to_event($1)', [event])); // blocks
        await new Promise((r) => setTimeout(r, 200));
        await c1.query('commit');
        expect(await second).toBe('event_full');
        expect(await approvedCount(event)).toBe(1);
      } finally {
        await c1.end();
        await c2.end();
      }
    });

    it('keeps capacity under many parallel applicants', async () => {
      const event = await createEvent(db, host, { capacity: 3 });
      const users: string[] = [];
      for (let i = 0; i < 8; i++) users.push(await createUser(db, `Rush ${i}`));
      const clients = await Promise.all(users.map(() => connect()));
      try {
        await Promise.all(clients.map((c, i) => actAs(c, users[i])));
        const results = await Promise.all(
          clients.map((c) => errorOf(c.query('select public.apply_to_event($1)', [event]))),
        );
        expect(results.filter((r) => r === null)).toHaveLength(3);
        expect(results.filter((r) => r === 'event_full')).toHaveLength(5);
        expect(await approvedCount(event)).toBe(3);
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
    });

    it('frees the seat when a walker cancels, and allows re-applying', async () => {
      const event = await createEvent(db, host, { capacity: 1 });
      await apply(walkerA, event);
      expect(await errorOf(apply(walkerB, event))).toBe('event_full');

      await asUser(walkerA, 'select public.cancel_application($1)', [event]);
      expect(await approvedCount(event)).toBe(0);

      expect((await apply(walkerB, event)).status).toBe('approved');
      expect(await errorOf(apply(walkerA, event))).toBe('event_full');
    });

    it('does not let the host shrink capacity below approved seats', async () => {
      const event = await createEvent(db, host, { capacity: 2 });
      await apply(walkerA, event);
      await apply(walkerB, event);
      await actAs(db, host);
      const err = await errorOf(db.query('update events set capacity = 1 where id = $1', [event]));
      await actAsAdmin(db);
      expect(err).toMatch(/events_not_overbooked/);
    });
  });

  describe('host decisions', () => {
    it('only the host can approve or reject', async () => {
      const event = await createEvent(db, host, { approval_mode: 'manual' });
      const app = await apply(walkerA, event);
      await actAs(db, walkerB);
      const err = await errorOf(db.query('select public.decide_application($1, true)', [app.id]));
      await actAsAdmin(db);
      expect(err).toBe('not_host');

      const [rejected] = await asUser<App>(host, 'select * from public.decide_application($1, false)', [app.id]);
      expect(rejected.status).toBe('rejected');
      expect(await errorOf(apply(walkerA, event))).toBe('not_allowed');
    });

    it('marks attendance only from shortly before the start', async () => {
      const event = await createEvent(db, host, { start_in_days: 3 });
      const app = await apply(walkerA, event);
      await actAs(db, host);
      expect(await errorOf(db.query('select public.mark_attendance($1, true)', [app.id]))).toBe('too_early');
      await actAsAdmin(db);

      await db.query(`update events set start_at = now() - interval '1 hour' where id = $1`, [event]);
      const [attended] = await asUser<App>(host, 'select * from public.mark_attendance($1, true)', [app.id]);
      expect(attended.status).toBe('attended');
      expect(await approvedCount(event)).toBe(1); // attended still occupies the seat
      const [noShow] = await asUser<App>(host, 'select * from public.mark_attendance($1, false)', [app.id]);
      expect(noShow.status).toBe('no_show');
    });
  });

  describe('row level security', () => {
    it('blocks direct inserts and updates of applications', async () => {
      const event = await createEvent(db, host);
      await actAs(db, walkerA);
      expect(
        await errorOf(db.query(`insert into applications (event_id, user_id) values ($1, $2)`, [event, walkerA])),
      ).toMatch(/permission denied/);
      await actAsAdmin(db);

      const app = await apply(walkerA, event);
      await actAs(db, walkerA);
      expect(
        await errorOf(db.query(`update applications set status = 'attended' where id = $1`, [app.id])),
      ).toMatch(/permission denied/);
      await actAsAdmin(db);
    });

    it('shows walkers their own applications and hosts the ones to their events', async () => {
      const event = await createEvent(db, host);
      await apply(walkerA, event);
      await apply(walkerB, event);

      const forA = await asUser<App>(walkerA, 'select * from applications where event_id = $1', [event]);
      expect(forA.map((a) => a.user_id)).toEqual([walkerA]);
      const forHost = await asUser<App>(host, 'select * from applications where event_id = $1', [event]);
      expect(forHost).toHaveLength(2);
      const forC = await asUser<App>(walkerC, 'select * from applications where event_id = $1', [event]);
      expect(forC).toHaveLength(0);
    });

    it('prevents users from verifying themselves', async () => {
      await actAs(db, walkerA);
      const err = await errorOf(db.query('update profiles set host_verified = true where id = $1', [walkerA]));
      await actAsAdmin(db);
      expect(err).toMatch(/permission denied/);
    });

    it('prevents editing other hosts’ events', async () => {
      const event = await createEvent(db, host);
      const rows = await asUser(walkerA, `update events set title = 'hacked' where id = $1 returning id`, [event]);
      expect(rows).toHaveLength(0);
    });

    it('lets anyone list approved attendees without seeing applications', async () => {
      const event = await createEvent(db, host);
      await apply(walkerA, event);
      await actAs(db, null);
      const { rows } = await db.query('select * from public.event_attendees($1)', [event]);
      const { rows: apps } = await db.query('select * from applications where event_id = $1', [event]);
      await actAsAdmin(db);
      expect(rows).toHaveLength(1);
      expect(apps).toHaveLength(0);
    });
  });

  describe('reviews', () => {
    const review = (userId: string, eventId: string, rating = 5) =>
      asUser(userId, `insert into reviews (event_id, reviewer_id, host_id, rating) values ($1, $2, $2, $3) returning *`, [
        eventId,
        userId,
        rating,
      ]);

    it('only attendees of completed events can review, and the host is set from the event', async () => {
      const event = await createEvent(db, host);
      await apply(walkerA, event);

      // Not completed yet.
      expect(await errorOf(review(walkerA, event))).toMatch(/row-level security/);

      await db.query(`update events set start_at = now() - interval '3 hours' where id = $1`, [event]);
      await db.query(`update events set status = 'completed' where id = $1`, [event]);

      // Never applied.
      expect(await errorOf(review(walkerB, event))).toMatch(/row-level security/);

      const [row] = (await review(walkerA, event, 4)) as { host_id: string; rating: number }[];
      expect(row.host_id).toBe(host); // spoofed host_id was overwritten
      expect(row.rating).toBe(4);
    });

    it('excludes no-shows from reviewing', async () => {
      const event = await createEvent(db, host);
      const app = await apply(walkerA, event);
      await db.query(`update events set start_at = now() - interval '3 hours' where id = $1`, [event]);
      await asUser(host, 'select public.mark_attendance($1, false)', [app.id]);
      await db.query(`update events set status = 'completed' where id = $1`, [event]);
      expect(await errorOf(review(walkerA, event))).toMatch(/row-level security/);
    });
  });

  describe('notifications outbox', () => {
    const notificationsFor = async (userId: string, eventId: string) =>
      (
        await db.query<{ type: string }>(
          'select type from notifications where user_id = $1 and event_id = $2 order by created_at',
          [userId, eventId],
        )
      ).rows.map((r) => r.type);

    it('notifies the host of applications and the walker of decisions', async () => {
      const event = await createEvent(db, host, { approval_mode: 'manual' });
      const app = await apply(walkerA, event);
      expect(await notificationsFor(host, event)).toEqual(['application_received']);
      await asUser(host, 'select public.decide_application($1, true)', [app.id]);
      expect(await notificationsFor(walkerA, event)).toEqual(['application_approved']);
    });

    it('notifies applicants when the event is cancelled', async () => {
      const event = await createEvent(db, host);
      await apply(walkerA, event);
      await asUser(host, 'select public.cancel_event($1)', [event]);
      expect(await notificationsFor(walkerA, event)).toEqual(['event_cancelled']);
    });

    it('enqueues each reminder only once', async () => {
      const event = await createEvent(db, host);
      await db.query(`update events set start_at = now() + interval '20 hours' where id = $1`, [event]);
      await apply(walkerA, event);
      await db.query('select public.enqueue_event_reminders()');
      await db.query('select public.enqueue_event_reminders()');
      expect(await notificationsFor(walkerA, event)).toEqual(['event_reminder_24h']);

      await db.query(`update events set start_at = now() + interval '90 minutes' where id = $1`, [event]);
      await db.query('select public.enqueue_event_reminders()');
      expect(await notificationsFor(walkerA, event)).toEqual(['event_reminder_24h', 'event_reminder_2h']);
    });
  });
});
