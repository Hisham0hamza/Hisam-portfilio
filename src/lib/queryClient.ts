import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        // Don't retry RLS / validation errors — only transient failures.
        const msg = (error as Error)?.message ?? '';
        if (/permission|violates|invalid|not_found|ZodError/i.test(msg)) return false;
        return count < 2;
      },
    },
  },
});

export const queryKeys = {
  cities: ['cities'] as const,
  search: (payload: unknown) => ['events', 'search', payload] as const,
  event: (id: string) => ['event', id] as const,
  attendees: (id: string) => ['event', id, 'attendees'] as const,
  eventReviews: (id: string) => ['event', id, 'reviews'] as const,
  myApplication: (id: string, userId: string | undefined) => ['event', id, 'myApplication', userId] as const,
  applicants: (id: string) => ['event', id, 'applicants'] as const,
  canReview: (id: string, userId: string | undefined) => ['event', id, 'canReview', userId] as const,
  myReview: (id: string, userId: string | undefined) => ['event', id, 'myReview', userId] as const,
  trips: (userId: string) => ['me', userId, 'trips'] as const,
  saved: (userId: string) => ['me', userId, 'saved'] as const,
  hosted: (userId: string) => ['me', userId, 'hosted'] as const,
  pendingCounts: (userId: string) => ['me', userId, 'pendingCounts'] as const,
  profile: (id: string) => ['profile', id] as const,
  profileStats: (id: string) => ['profile', id, 'stats'] as const,
  hostReviews: (id: string) => ['profile', id, 'reviews'] as const,
  profileHosted: (id: string) => ['profile', id, 'hosted'] as const,
};
