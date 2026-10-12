import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export const emailSchema = z.email();
export const passwordSchema = z.string().min(8);
/** Egyptian mobile numbers in E.164, e.g. +201001234567. */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);

/** Normalises 01xxxxxxxxx / 201xxxxxxxxx / +201xxxxxxxxx to E.164 (defaults to Egypt). */
export function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  return `+20${digits}`;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: Linking.createURL('auth/callback') },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function sendPhoneOtp(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function exchangeCodeFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  return false;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await exchangeCodeFromUrl(result.url);
    return true;
  }
  return false;
}
