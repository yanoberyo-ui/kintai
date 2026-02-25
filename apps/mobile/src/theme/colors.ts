export const lightColors = {
  primary: '#111827',      // Gray 900
  secondary: '#6B7280',    // Gray 500
  background: '#F9FAFB',   // Gray 50
  card: '#FFFFFF',
  border: '#E5E7EB',       // Gray 200
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
  },
  success: '#10B981',      // Green 500
  warning: '#F59E0B',      // Amber 500
  danger: '#EF4444',       // Red 500
  info: '#3B82F6',         // Blue 500
};

export const darkColors = {
  primary: '#FFFFFF',
  secondary: '#9CA3AF',    // Gray 400
  background: '#111827',   // Gray 900
  card: '#1F2937',         // Gray 800
  border: '#374151',       // Gray 700
  text: {
    primary: '#FFFFFF',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
  },
  success: '#34D399',      // Green 400
  warning: '#FBBF24',      // Amber 400
  danger: '#F87171',       // Red 400
  info: '#60A5FA',         // Blue 400
};

export type ColorScheme = typeof lightColors;
