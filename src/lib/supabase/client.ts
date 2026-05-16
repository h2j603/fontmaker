// Supabase client scaffold. The MVP single-user core persists to localStorage
// and does NOT use Supabase. This module is the wiring point for the Phase 5
// collaboration layer (realtime, presence, soft locks). It intentionally has
// no @supabase/supabase-js dependency yet to keep the single-user bundle lean.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export function getSupabaseConfig() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase가 설정되지 않았습니다. 협업 기능은 Phase 5에서 활성화됩니다. .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.',
    );
  }
  return { url: url!, anonKey: anonKey! };
}
