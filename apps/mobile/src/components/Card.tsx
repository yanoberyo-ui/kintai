import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: isDark ? '#000' : '#000',
      },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
