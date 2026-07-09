import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function getSessionId(): string {
  let id = localStorage.getItem('refi_session_id');
  if (!id) {
    id = 'ses_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    localStorage.setItem('refi_session_id', id);
  }
  return id;
}
