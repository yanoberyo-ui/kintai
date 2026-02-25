import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../theme';
import { useAuth } from '../hooks/useAuth';

export default function MoreScreen() {
  const { colors } = useTheme();
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'settings', label: '⚙️ 設定', onPress: () => {} },
    { id: 'pomodoro', label: '🍅 Pomodoro', onPress: () => {} },
    { id: 'ranking', label: '🏆 ランキング', onPress: () => {} },
    { id: 'reservations', label: '📅 予約', onPress: () => {} },
    { id: 'logout', label: '🚪 ログアウト', onPress: signOut, isDanger: true },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        その他
      </Text>

      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              }
            ]}
            onPress={item.onPress}
          >
            <Text
              style={[
                styles.menuLabel,
                { color: item.isDanger ? colors.danger : colors.text.primary }
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  menuContainer: {
    gap: spacing.sm,
  },
  menuItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
