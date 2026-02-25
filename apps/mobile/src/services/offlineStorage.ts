import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@offline_queue';

export interface OfflineAction {
  type: string;
  data: any;
  timestamp: string;
}

export async function addToOfflineQueue(action: OfflineAction) {
  try {
    const queue = await getOfflineQueue();
    queue.push(action);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to add to offline queue:', error);
  }
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('Failed to get offline queue:', error);
    return [];
  }
}

export async function clearOfflineQueue() {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear offline queue:', error);
  }
}
