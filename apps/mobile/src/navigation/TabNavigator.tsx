import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TodoScreen from '../screens/TodoScreen';
import MoreScreen from '../screens/MoreScreen';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

function TabIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Calendar: '📅',
    Todo: '✅',
    More: '•••',
  };

  return <Text style={{ fontSize: 24 }}>{icons[name]}</Text>;
}

export default function TabNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          backgroundColor: isDark ? colors.card : colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: isDark ? colors.card : colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'ホーム',
          tabBarIcon: () => <TabIcon name="Home" />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'カレンダー',
          tabBarIcon: () => <TabIcon name="Calendar" />,
        }}
      />
      <Tab.Screen
        name="Todo"
        component={TodoScreen}
        options={{
          title: 'TODO',
          tabBarIcon: () => <TabIcon name="Todo" />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'その他',
          tabBarIcon: () => <TabIcon name="More" />,
        }}
      />
    </Tab.Navigator>
  );
}
