import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  EXPO_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  EXPO_PUBLIC_SHARE_BASE_URL: z.string().optional(),
  EXPO_PUBLIC_EAS_PROJECT_ID: z.string().optional(),
});

// Expo inlines EXPO_PUBLIC_* only when accessed statically, so list them explicitly.
const parsed = schema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || undefined,
  EXPO_PUBLIC_SHARE_BASE_URL: process.env.EXPO_PUBLIC_SHARE_BASE_URL || undefined,
  EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
});

if (!parsed.success) {
  console.error(
    'Missing or invalid environment variables. Copy .env.example to .env and fill it in.',
    parsed.error.issues,
  );
}

export const env = {
  supabaseUrl: parsed.data?.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  supabaseAnonKey: parsed.data?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'missing-anon-key',
  mapboxToken: parsed.data?.EXPO_PUBLIC_MAPBOX_TOKEN,
  shareBaseUrl: parsed.data?.EXPO_PUBLIC_SHARE_BASE_URL,
  easProjectId: parsed.data?.EXPO_PUBLIC_EAS_PROJECT_ID,
  isConfigured: parsed.success,
};
