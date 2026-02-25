import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

export async function uploadAvatar(userId: string, imageUri: string) {
  try {
    // 画像をBase64に変換
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    // Base64をArrayBufferに変換
    const arrayBuffer = base64ToArrayBuffer(base64);

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('user-images')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
      });

    if (error) throw error;

    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('user-images')
      .getPublicUrl(filePath);

    // ユーザープロフィールを更新
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
