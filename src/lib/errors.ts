// Maps Supabase / RPC errors to translation keys under `errors.*`.

export const RPC_ERROR_CODES = [
  'event_full',
  'already_applied',
  'not_allowed',
  'own_event',
  'event_not_open',
  'event_started',
  'event_closed',
  'not_authenticated',
  'not_host',
  'not_pending',
  'not_cancellable',
  'too_early',
  'start_in_past',
  'not_found',
] as const;
export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];
export type ErrorKey = `errors.${RpcErrorCode}` | 'errors.generic' | 'errors.network' | 'errors.capacity_below_booked';

export class AppError extends Error {
  constructor(
    public readonly key: ErrorKey,
    message?: string,
  ) {
    super(message ?? key);
  }
}

export function errorKey(error: unknown): ErrorKey {
  if (error instanceof AppError) return error.key;
  const message = (error as { message?: string } | null)?.message ?? '';
  const code = RPC_ERROR_CODES.find((c) => message === c || message.includes(c));
  if (code) return `errors.${code}`;
  if (message.includes('events_not_overbooked')) return 'errors.capacity_below_booked';
  if (/network|fetch|timed? ?out/i.test(message)) return 'errors.network';
  return 'errors.generic';
}

/** Throws a PostgREST error (if any) so TanStack Query sees it. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
