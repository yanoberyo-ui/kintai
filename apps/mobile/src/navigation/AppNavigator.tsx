import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuth } from '../hooks/useAuth';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function AppNavigatorContent() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <ThemeProvider>
      <AppNavigatorContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
