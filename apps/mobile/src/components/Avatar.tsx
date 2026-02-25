import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export default function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size / 2.5 }]}>{getInitials(name)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});
