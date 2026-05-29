declare const process: {env: Record<string, string | undefined>};

const runtimeEnv = typeof process !== 'undefined' && process.env ? process.env : {};

export const env = {
  backendUrl: (runtimeEnv.TRICKEE_BACKEND_URL || 'http://10.0.2.2:8000/api/v1').replace(/\/$/, ''),
  supabaseUrl: runtimeEnv.TRICKEE_SUPABASE_URL || '',
  supabaseAnonKey: runtimeEnv.TRICKEE_SUPABASE_ANON_KEY || '',
  locationIntervalMs: Number(runtimeEnv.TRICKEE_LOCATION_INTERVAL_MS || 30000),
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
