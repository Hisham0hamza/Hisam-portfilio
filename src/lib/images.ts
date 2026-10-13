import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { env } from './env';
import { supabase } from './supabase';

export type PickedImage = { uri: string; width: number; height: number };
export type Bucket = 'avatars' | 'event-photos';

export async function pickImages({ multiple = false, limit = 1 } = {}): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? limit : 1,
    allowsEditing: !multiple,
    aspect: multiple ? undefined : [4, 3],
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Resizes to at most `maxSize` px on the long edge and re-encodes as JPEG (~70% quality). */
export async function compressImage(uri: string, maxSize = 1600) {
  const context = ImageManipulator.manipulate(uri);
  const probe = await context.renderAsync();
  const { width, height } = probe;
  if (Math.max(width, height) > maxSize) {
    context.resize(width >= height ? { width: maxSize } : { height: maxSize });
  }
  const image = await context.renderAsync();
  return image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
}

/** Compresses then uploads an image to `<bucket>/<userId>/<random>.jpg`; returns its public URL. */
export async function uploadImage(bucket: Bucket, userId: string, uri: string, maxSize = 1600) {
  // Demo images live in browser storage, so keep them small.
  const compressed = await compressImage(uri, env.isDemo ? Math.min(maxSize, 900) : maxSize);
  if (!compressed.base64) throw new Error('compression_failed');
  // Demo mode keeps images inline (stored with the demo data in the browser).
  if (env.isDemo) return `data:image/jpeg;base64,${compressed.base64}`;
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, decode(compressed.base64), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
