/**
 * Helper functions for the export service
 */

// Formats that benefit from WebP conversion (raster, non-animated)
// Note: 'jpeg' is normalized to 'jpg' by getExtensionFromBase64
export const WEBP_CONVERTIBLE_EXTENSIONS = ['png', 'jpg'] as const;

// Regex pattern for WebP-convertible files (matches .png, .jpg, .jpeg)
export const WEBP_CONVERTIBLE_REGEX = /\.(png|jpe?g)$/i;

// Regex pattern for video files
export const VIDEO_REGEX = /\.(mp4|webm|ogg|mov)$/i;

/**
 * Check if an extension is convertible to WebP
 */
export function isWebpConvertible(ext: string): boolean {
  return (WEBP_CONVERTIBLE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Get file extension from a base64 data URL based on MIME type
 */
export function getExtensionFromBase64(base64: string): string {
  const mimeMatch = base64.match(/data:image\/([^;]+);/);
  if (!mimeMatch) return 'png';
  const mime = mimeMatch[1].toLowerCase();
  if (mime === 'jpeg') return 'jpg';
  if (mime === 'svg+xml') return 'svg';
  return mime;
}

/**
 * Convert a base64 data URL to a Blob
 */
export function base64ToBlob(base64: string): Blob | null {
  try {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Convert a base64 image to WebP format using Canvas API
 * Returns a Blob in WebP format with quality optimization
 */
export async function base64ToWebP(base64: string, quality = 0.8): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(null);
      img.src = base64;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (value: string | undefined | null): string => {
  if (!value) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};
