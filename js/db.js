import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { toast } from './ui.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// So'rovni bajarib, xatoni toast qilib ko'rsatadi va tashlaydi
export async function run(query) {
  const { data, error } = await query;
  if (error) {
    console.error(error);
    toast('Xatolik: ' + error.message, 'error');
    throw error;
  }
  return data;
}
