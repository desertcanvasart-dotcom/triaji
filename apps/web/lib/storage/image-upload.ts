/**
 * Image Upload for Triage Sessions
 *
 * Compression happens here in the browser — it cuts what we send over the wire
 * and is cheap on the client. The upload itself goes through our own API, which
 * holds the service-role key: session-images is a private bucket of patient
 * photos, and uploading direct from the browser would have needed a storage
 * policy open to the public anon key.
 */

export interface UploadedImage {
  url: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}

// Mirrored server-side in /api/patient/session-image — these checks are for a
// quick, localised error, not a guarantee.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB

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

  const body = new FormData();
  body.append('file', processedFile);
  body.append('session_id', sessionId);

  let res: Response;
  try {
    res = await fetch('/api/patient/session-image', { method: 'POST', body });
  } catch {
    throw new Error('حدث خطأ في رفع الصورة، حاول مرة أخرى');
  }

  const data = (await res.json().catch(() => null)) as
    | { success?: boolean; error?: string; url?: string; publicUrl?: string | null }
    | null;

  if (!res.ok || !data?.success || !data.url) {
    // The route localises its own errors; fall back if it said nothing useful.
    throw new Error(data?.error ?? 'حدث خطأ في رفع الصورة، حاول مرة أخرى');
  }

  return {
    url: data.url,
    publicUrl: data.publicUrl ?? '',
    mimeType: processedFile.type,
    sizeBytes: processedFile.size,
  };
}
