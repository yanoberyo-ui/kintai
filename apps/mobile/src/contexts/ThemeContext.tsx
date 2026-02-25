import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ColorScheme } from '../theme';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  colors: ColorScheme;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');

  // テーマモードを設定から読み込み
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(savedMode => {
      if (savedMode) {
        setThemeModeState(savedMode as ThemeMode);
      }
    });
  }, []);

  // 時間帯による自動切り替え（17:00-6:00はダークモード）
  const [autoIsDark, setAutoIsDark] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      setAutoIsDark(hour >= 17 || hour < 6);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // 1分ごとにチェック

    return () => clearInterval(interval);
  }, []);

  // 実際のダークモード状態を計算
  const isDark =
    themeMode === 'dark'
      ? true
      : themeMode === 'light'
      ? false
      : autoIsDark; // autoの場合は時間帯で判定

  const colors = isDark ? darkColors : lightColors;

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
