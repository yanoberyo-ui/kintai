import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Input, Button } from '../components';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('ログイン失敗', error.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>FDGroup勤怠管理</Text>
        <Text style={styles.subtitle}>ネイティブアプリ版</Text>
        
        <Input
          label="メールアドレス"
          value={email}
          onChangeText={setEmail}
          placeholder="example@fdgroup.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <Input
          label="パスワード"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        
        <Button
          title="ログイン"
          onPress={handleLogin}
          loading={loading}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
    color: '#6b7280',
  },
});
