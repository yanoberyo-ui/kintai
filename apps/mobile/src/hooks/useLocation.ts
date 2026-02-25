import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = async () => {
    setLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', '位置情報へのアクセス許可が必要です');
      setLoading(false);
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(location);
      setLoading(false);
      return location;
    } catch (error) {
      Alert.alert('エラー', '位置情報の取得に失敗しました');
      setLoading(false);
      return null;
    }
  };

  return { location, loading, getCurrentLocation };
}
