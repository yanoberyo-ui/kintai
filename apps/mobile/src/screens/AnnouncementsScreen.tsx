import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { spacing } from '../theme';

export default function AnnouncementsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        タイムライン
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        実装予定
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
  },
});
