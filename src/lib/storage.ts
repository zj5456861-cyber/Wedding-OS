import { supabase } from './supabase'

const BUCKET = 'wedding-os-v03'

export function avatarPath(coupleId: string, userId: string): string {
  return `${coupleId}/avatars/${userId}.png`
}

export function coverPath(coupleId: string): string {
  return `${coupleId}/covers/cover.png`
}

// 中心正方形裁剪 + 缩放（头像/封面）
export async function cropSquare(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.floor((bitmap.width - side) / 2)
  const sy = Math.floor((bitmap.height - side) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片处理失败'))), 'image/png'),
  )
  bitmap.close()
  return blob
}

export async function uploadAvatar(
  coupleId: string,
  userId: string,
  file: File,
): Promise<string> {
  const blob = await cropSquare(file, 256)
  const path = avatarPath(coupleId, userId)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) throw error
  return path
}

export async function uploadCover(coupleId: string, file: File): Promise<string> {
  const blob = await cropSquare(file, 800)
  const path = coverPath(coupleId)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) throw error
  return path
}

export async function setCoverUrl(coupleId: string, path: string): Promise<void> {
  const { error } = await supabase.from('couples').update({ cover_url: path }).eq('id', coupleId)
  if (error) throw error
}

export async function getSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}
