import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://mfjlzfygvsbbrmqzbvqm.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mamx6ZnlndnNiYnJtcXpidnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODY0NDMsImV4cCI6MjA5Njc2MjQ0M30.H9H0-lXm9WautQEGUpOh9GGzVNYgxxHbkFxyFMQP_5o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
