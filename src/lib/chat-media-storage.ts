import { getStorageInstance } from './firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a media file to Firebase Storage for chat use
 * Returns the public download URL
 */
export async function uploadChatMedia(
  file: File,
  brandId: string,
  userId: string
): Promise<string> {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  const timestamp = Date.now();
  // Sanitize filename but keep extension
  const nameParts = file.name.split('.');
  const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
  const nameBase = nameParts.join('.');
  const sanitizedFileName = `${nameBase.replace(/[^a-zA-Z0-9.-]/g, '_')}${extension}`;

  const storagePath = `chat_media/${brandId}/${userId}/${timestamp}_${sanitizedFileName}`;
  
  // Use direct storage instance to avoid Proxy issues
  const storage = getStorageInstance();
  const storageRef = ref(storage, storagePath);
  
  // Upload the file
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: 'public, max-age=31536000', // Cache for 1 year
  });
  
  // Get the download URL
  const downloadURL = await getDownloadURL(storageRef);
  
  return downloadURL;
}

/**
 * Uploads multiple media files in parallel
 * Returns an array of {url, type, fileName, mimeType} objects
 */
export async function uploadMultipleChatMedia(
  files: { file: File; type: 'image' | 'video' | 'pdf' | 'audio' }[],
  brandId: string,
  userId: string
): Promise<Array<{ url: string; type: string; fileName: string; mimeType: string }>> {
  const uploadPromises = files.map(async ({ file, type }) => {
    const url = await uploadChatMedia(file, brandId, userId);
    return {
      url,
      type,
      fileName: file.name,
      mimeType: file.type,
    };
  });
  
  return Promise.all(uploadPromises);
}

/**
 * Uploads a base64 data URL to Firebase Storage
 * Returns the public download URL, or the original URL if not a data URL
 */
export async function uploadDataUrlToStorage(
  dataUrl: string,
  brandId: string,
  purpose: 'source' | 'fusion' | 'mask'
): Promise<string> {
  // If it's already a URL (not a data URL), return as-is
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);

  // Extract mime type from data URL
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const extension = mimeType.split('/')[1] || 'png';

  const storagePath = `campaign_images/${brandId}/${purpose}/${timestamp}_${randomId}.${extension}`;

  const storage = getStorageInstance();
  const storageRef = ref(storage, storagePath);

  // Upload the data URL
  await uploadString(storageRef, dataUrl, 'data_url', {
    contentType: mimeType,
    cacheControl: 'public, max-age=31536000',
  });

  // Get the download URL
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;
}

/**
 * Uploads multiple base64 data URLs to Firebase Storage in parallel
 * Returns an array of download URLs
 */
export async function uploadDataUrlsToStorage(
  dataUrls: string[],
  brandId: string,
  purpose: 'source' | 'fusion' | 'mask'
): Promise<string[]> {
  const uploadPromises = dataUrls.map(url => uploadDataUrlToStorage(url, brandId, purpose));
  return Promise.all(uploadPromises);
}
