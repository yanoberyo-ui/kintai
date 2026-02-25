import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getBackgroundColor = () => {
    if (variant === 'primary') return isDark ? colors.primary : '#111827';
    if (variant === 'danger') return colors.danger;
    return colors.secondary;
  };

  const getTextColor = () => {
    if (variant === 'primary') return isDark ? '#111827' : '#FFFFFF';
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
