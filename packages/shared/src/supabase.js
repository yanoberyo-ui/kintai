// Web用 Supabase クライアント
// 注: 現段階ではapps/web/src/utils/supabase.jsを直接使用
// 将来的にWeb/Mobile共通化する際にここを使う
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient(url, anonKey) {
  if (!url || !anonKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(url, anonKey);
}
