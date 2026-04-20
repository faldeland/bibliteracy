/**
 * True when both public Supabase env vars are present. The app gracefully
 * falls back to a localStorage-backed offline mode otherwise, so the grid
 * is fully usable in development without provisioning a backend.
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
