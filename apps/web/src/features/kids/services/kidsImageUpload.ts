import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, storage } from '../../../lib/firebase'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])
const MAX_BYTES = 5 * 1024 * 1024
const MAX_DIMENSION = 4096

async function dimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function hasValidSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (file.type === 'image/png')
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
}

export async function uploadKidsCardImage(householdId: string, assetId: string, file: File) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to upload an image.')
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowedTypes.has(file.type) || !allowedExtensions.has(extension))
    throw new Error('Επιλέξτε εικόνα JPEG, PNG ή WebP.')
  if (file.size <= 0 || file.size > MAX_BYTES)
    throw new Error('Η εικόνα πρέπει να είναι μικρότερη από 5 MB.')
  if (!(await hasValidSignature(file)))
    throw new Error('Το περιεχόμενο της εικόνας δεν είναι έγκυρο.')
  const size = await dimensions(file)
  if (
    size.width <= 0 ||
    size.height <= 0 ||
    size.width > MAX_DIMENSION ||
    size.height > MAX_DIMENSION
  )
    throw new Error('Η εικόνα πρέπει να είναι έως 4096 × 4096 pixels.')
  const storagePath = 'kids/' + householdId + '/cards/' + assetId
  const snapshot = await uploadBytes(ref(storage, storagePath), file, {
    contentType: file.type,
    customMetadata: { householdId, ownerUid: uid },
  })
  return {
    assetId,
    storagePath,
    downloadUrl: await getDownloadURL(snapshot.ref),
    mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
    size: file.size,
    ...size,
  }
}
