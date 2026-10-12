import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/**
 * DB tests run against any Postgres 15+ server with PostGIS installed.
 * TEST_DATABASE_URL must point at a database the user can CREATE DATABASE from,
 * e.g. postgres://postgres:postgres@localhost:54322/postgres (Supabase local).
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL;
let TEST_DB = 'masar_test';

const root = path.resolve(__dirname, '..');

function testUrl() {
  const url = new URL(ADMIN_URL!);
  url.pathname = `/${TEST_DB}`;
  return url.toString();
}

/** Each test file uses its own database so files can run in parallel. */
export async function resetTestDatabase(name: string) {
  TEST_DB = `masar_test_${name}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
    [TEST_DB],
  );
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.query(`alter database ${TEST_DB} set search_path = public, extensions`);
  await admin.end();

  const db = await connect();
  await db.query(readFileSync(path.join(root, 'tests/sql/supabase_shim.sql'), 'utf8'));
  const migrations = readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) {
    await db.query(readFileSync(path.join(root, 'migrations', file), 'utf8'));
  }
  await db.query(readFileSync(path.join(root, 'seed.sql'), 'utf8'));
  await db.end();
}

export async function connect() {
  const client = new Client({ connectionString: testUrl() });
  await client.connect();
  return client;
}

/** Switch a connection to act as an API user (anon when userId is null). Lasts until `reset role`. */
export async function actAs(client: Client, userId: string | null) {
  await client.query('reset role');
  if (userId) {
    await client.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await client.query('set role authenticated');
  } else {
    await client.query(`select set_config('request.jwt.claims', '', false)`);
    await client.query('set role anon');
  }
}

export async function actAsAdmin(client: Client) {
  await client.query('reset role');
  await client.query(`select set_config('request.jwt.claims', '', false)`);
}

let userCounter = 0;

/** Creates an auth user (and, through the trigger, a profile). */
export async function createUser(client: Client, name = 'Test User') {
  userCounter += 1;
  const { rows } = await client.query<{ id: string }>(
    `insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), $1, jsonb_build_object('full_name', $2::text))
     returning id`,
    [`test${Date.now()}_${userCounter}@masar.test`, name],
  );
  return rows[0].id;
}

type EventOverrides = Partial<{
  capacity: number;
  approval_mode: 'auto' | 'manual';
  status: string;
  start_in_days: number;
  price_egp: number;
  category: string;
  city: string;
  lng: number;
  lat: number;
  title: string;
}>;

/** Inserts a published event as the given host (bypasses RLS — run as admin). */
export async function createEvent(client: Client, hostId: string, o: EventOverrides = {}) {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.events (host_id, title, category, city, meeting_point, start_at,
       duration_minutes, capacity, approval_mode, status, price_egp)
     values ($1, $2, $3::event_category, $4,
       st_point($5, $6, 4326)::geography,
       now() + make_interval(days => $7), 120, $8, $9::approval_mode, $10::event_status, $11)
     returning id`,
    [
      hostId,
      o.title ?? 'Test walk',
      o.category ?? 'heritage_walk',
      o.city ?? 'cairo',
      o.lng ?? 31.24,
      o.lat ?? 30.05,
      o.start_in_days ?? 3,
      o.capacity ?? 10,
      o.approval_mode ?? 'auto',
      o.status ?? 'published',
      o.price_egp ?? 0,
    ],
  );
  return rows[0].id;
}

/** Returns the Postgres error message of a failing promise (or null if it resolved). */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
