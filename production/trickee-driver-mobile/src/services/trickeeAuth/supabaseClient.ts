import {createClient, type Session} from '@supabase/supabase-js';

import {env, isSupabaseConfigured} from '../../config/env';

const supabase = isSupabaseConfigured() ? createClient(env.supabaseUrl, env.supabaseAnonKey) : null;

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase mobile auth is not configured.');
  }
  const {data, error} = await supabase.auth.signInWithPassword({email, password});
  if (error) {
    throw error;
  }
  return data.session;
}

export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }
  const {data} = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken() {
  return (await getSession())?.access_token;
}
