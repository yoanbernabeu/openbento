/**
 * Extract base64 images from site data and prepare them for the zip
 */

import JSZip from 'jszip';
import { SiteData } from '../../types';
import { base64ToBlob, base64ToWebP, getExtensionFromBase64, isWebpConvertible } from './helpers';

export interface ImageMap {
  [key: string]: string;
}

/**
 * Extract all base64 images from SiteData and add them to a zip folder
 * Returns a mapping from image keys to their new paths
 * Also generates WebP versions for better compression
 */
export async function extractImages(data: SiteData, assetsFolder: JSZip | null): Promise<ImageMap> {
  const imageMap: ImageMap = {};
  const webpConversions: Promise<void>[] = [];

  // Extract avatar if it's a base64 image
  if (data.profile.avatarUrl?.startsWith('data:image')) {
    const blob = base64ToBlob(data.profile.avatarUrl);
    if (blob && assetsFolder) {
      const ext = getExtensionFromBase64(data.profile.avatarUrl);
      assetsFolder.file(`avatar.${ext}`, blob);
      imageMap['profile_avatar'] = `/assets/avatar.${ext}`;

      // Only convert raster formats to WebP (skip svg, gif, webp)
      if (isWebpConvertible(ext)) {
        webpConversions.push(
          base64ToWebP(data.profile.avatarUrl).then((webpBlob) => {
            if (webpBlob) {
              assetsFolder.file('avatar.webp', webpBlob);
            }
          })
        );
      }
    }
  }

  // Extract block images
  for (const block of data.blocks) {
    if (block.imageUrl?.startsWith('data:image')) {
      const blob = base64ToBlob(block.imageUrl);
      if (blob && assetsFolder) {
        const ext = getExtensionFromBase64(block.imageUrl);
        const filename = `block-${block.id}.${ext}`;
        assetsFolder.file(filename, blob);
        imageMap[`block_${block.id}`] = `/assets/${filename}`;

        // Only convert raster formats to WebP (skip svg, gif, webp)
        if (isWebpConvertible(ext)) {
          webpConversions.push(
            base64ToWebP(block.imageUrl).then((webpBlob) => {
              if (webpBlob) {
                assetsFolder.file(`block-${block.id}.webp`, webpBlob);
              }
            })
          );
        }
      }
    }
  }

  // Wait for all WebP conversions to complete in parallel
  await Promise.all(webpConversions);

  return imageMap;
}
