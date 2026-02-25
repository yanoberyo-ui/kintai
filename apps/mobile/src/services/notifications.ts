import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// 通知ハンドラーはApp.tsxで設定されます

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Note: projectId will be needed for EAS Build
    // token = (await Notifications.getExpoPushTokenAsync({
    //   projectId: Constants.expoConfig.extra.eas.projectId,
    // })).data;
    
    // For now, just get device push token
    token = (await Notifications.getDevicePushTokenAsync()).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function scheduleClockInReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '出勤打刻のお知らせ',
      body: '本日の出勤打刻をお忘れなく！',
      data: { screen: 'Home' },
    },
    trigger: {
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

export async function scheduleClockOutReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '退勤打刻のお知らせ',
      body: '本日の退勤打刻をお忘れなく！',
      data: { screen: 'Home' },
    },
    trigger: {
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });
}

export async function sendLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
}
