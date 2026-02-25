import { useEffect, useState } from 'react';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState('');

  useEffect(() => {
    if (!user) return;

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        setExpoPushToken(token);
        
        // トークンをSupabaseに保存（オプション）
        // user_push_tokensテーブルが必要
        // await supabase
        //   .from('user_push_tokens')
        //   .upsert({
        //     user_id: user.id,
        //     push_token: token,
        //     updated_at: new Date().toISOString(),
        //   });
      }
    });
  }, [user]);

  return { expoPushToken };
}
