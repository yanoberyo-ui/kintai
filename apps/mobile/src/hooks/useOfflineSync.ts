import { useEffect } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getOfflineQueue, clearOfflineQueue } from '../services/offlineStorage';
import { supabase } from '../services/supabase';

export function useOfflineSync() {
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (isConnected) {
      syncOfflineData();
    }
  }, [isConnected]);

  const syncOfflineData = async () => {
    const queue = await getOfflineQueue();

    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} offline records...`);

    for (const action of queue) {
      try {
        if (action.type === 'clock_in') {
          await supabase.from('attendances').insert(action.data);
        } else if (action.type === 'clock_out') {
          const { id, ...updateData } = action.data;
          await supabase.from('attendances').update(updateData).eq('id', id);
        }
        // 他のアクションタイプも処理
      } catch (error) {
        console.error('Sync error:', error);
      }
    }

    await clearOfflineQueue();
    console.log('Offline sync completed');
  };
}
