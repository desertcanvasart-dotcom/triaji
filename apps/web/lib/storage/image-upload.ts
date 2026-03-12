/**
 * Image Upload for Triage Sessions
 * Client-side upload to Supabase Storage with compression.
 */

import { createBrowserClient } from '@triaji/shared/supabase';

export interface UploadedImage {
  url: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB
const BUCKET = 'session-images';

/**
 * Compress an image using Canvas API if it exceeds threshold.
 */
async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale down to max 1600px on longest side
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Upload a session image to Supabase Storage.
 * Validates type and size, compresses if needed.
 */
export async function uploadSessionImage(
  file: File,
  sessionId: string
): Promise<UploadedImage> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('يُسمح فقط بصور JPEG أو PNG أو WEBP');
  }

  // Validate file size
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('الصورة أكبر من 10 ميجابايت، من فضلك اختر صورة أصغر');
  }

  // Compress if needed
  const processedFile = await compressImage(file);

  // Generate storage path
  const ext = processedFile.type === 'image/png' ? 'png' : processedFile.type === 'image/webp' ? 'webp' : 'jpg';
  const randomId = Math.random().toString(36).slice(2, 10);
  const path = `${sessionId}/${Date.now()}-${randomId}.${ext}`;

  const supabase = createBrowserClient();

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, processedFile, {
      contentType: processedFile.type,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error('حدث خطأ في رفع الصورة، حاول مرة أخرى');
  }

  // Get a signed URL (1 hour expiry)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (signedError || !signedData?.signedUrl) {
    throw new Error('حدث خطأ في رفع الصورة، حاول مرة أخرى');
  }

  return {
    url: path,
    publicUrl: signedData.signedUrl,
    mimeType: processedFile.type,
    sizeBytes: processedFile.size,
  };
}
