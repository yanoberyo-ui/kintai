import { StatusBar } from 'expo-status-bar';
import { useRef, useEffect } from 'react';
import Constants from 'expo-constants';
import AppNavigator from './src/navigation/AppNavigator';
import { useOfflineSync } from './src/hooks/useOfflineSync';

// Expo Goでは通知機能が制限されているため、開発ビルドでのみ有効化
const isExpoGo = Constants.appOwnership === 'expo';

export default function App() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // オフライン同期を有効化
  useOfflineSync();

  useEffect(() => {
    // Expo Goでは通知機能をスキップ
    if (isExpoGo) {
      console.log('Push notifications are not fully supported in Expo Go');
      return;
    }

    // 開発ビルドでのみ通知リスナーを設定
    const setupNotifications = async () => {
      try {
        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        // 通知受信時のリスナー
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
          console.log('Notification received:', notification);
        });

        // 通知タップ時のリスナー
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
          console.log('Notification response:', response);
          const screen = response.notification.request.content.data.screen;
          // 画面遷移ロジックはNavigationRefを使用して実装可能
        });
      } catch (error) {
        console.error('Failed to setup notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      if (notificationListener.current) {
        import('expo-notifications').then(({ default: Notifications }) => {
          Notifications.removeNotificationSubscription(notificationListener.current);
        });
      }
      if (responseListener.current) {
        import('expo-notifications').then(({ default: Notifications }) => {
          Notifications.removeNotificationSubscription(responseListener.current);
        });
      }
    };
  }, []);

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}
