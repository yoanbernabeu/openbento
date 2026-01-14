/**
 * Generate the complete App.tsx for the exported project
 */

import { SiteData } from '../../../../types';
import { ImageMap } from '../../imageExtractor';
import { WEBP_CONVERTIBLE_REGEX, VIDEO_REGEX } from '../../helpers';
import { generateImports } from './imports';
import { generateTypes } from './types';
import { generateSocialPlatformsConfig } from './socialPlatforms';
import { generateTiltHook, generateAnalyticsHook } from './hooks';
import { generateBlockComponent } from './blockComponent';
import {
  generateDesktopLayout,
  generateMobileLayout,
  generateMobileLayoutHelper,
  generateFooter,
  generateBackgroundBlur,
} from './layouts';

export const generateAppTsx = (data: SiteData, imageMap: ImageMap, siteId?: string): string => {
  const { profile, blocks } = data;
  const avatarSrc = imageMap['profile_avatar'] || profile.avatarUrl;

  // Avatar style configuration
  const avatarStyle = profile.avatarStyle || {
    shape: 'rounded',
    shadow: true,
    border: true,
    borderColor: '#ffffff',
    borderWidth: 4,
  };
  const avatarRadius =
    avatarStyle.shape === 'circle' ? '9999px' : avatarStyle.shape === 'square' ? '0' : '1.5rem';
  const avatarShadow = avatarStyle.shadow !== false ? '0 25px 50px -12px rgba(0,0,0,0.15)' : 'none';
  const avatarBorder =
    avatarStyle.border !== false
      ? `${avatarStyle.borderWidth || 4}px solid ${avatarStyle.borderColor || '#ffffff'}`
      : 'none';

  // Background style
  const bgStyle = profile.backgroundImage
    ? `{ backgroundImage: "url('${profile.backgroundImage}')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }`
    : `{ backgroundColor: '${profile.backgroundColor || '#f8fafc'}' }`;

  // Generate JSON data for blocks and profile
  const blocksJson = JSON.stringify(
    blocks.map((b) => ({
      ...b,
      imageUrl: b.imageUrl && imageMap[`block_${b.id}`] ? imageMap[`block_${b.id}`] : b.imageUrl,
    }))
  );

  const profileJson = JSON.stringify({
    ...profile,
    avatarUrl: avatarSrc,
  });

  // Layout parameters
  const layoutParams = {
    avatarRadius,
    avatarShadow,
    avatarBorder,
    bgStyle,
    showSocialInHeader: !!profile.showSocialInHeader,
    hasSocialAccounts: !!(profile.socialAccounts && profile.socialAccounts.length > 0),
    showBranding: profile.showBranding !== false,
    backgroundBlur: profile.backgroundBlur,
    backgroundImage: profile.backgroundImage,
  };

  // Site ID for analytics (use provided siteId or fallback)
  const analyticsId = data.profile.analytics?.enabled ? siteId || 'default' : '';

  // Assemble the complete App.tsx
  return `${generateImports()}
${generateTypes()}
${generateSocialPlatformsConfig()}
${generateTiltHook()}
${generateBlockComponent()}

// Profile data
const profile = ${profileJson}
const blocks: BlockData[] = ${blocksJson}

// Patterns for file type detection
const WEBP_CONVERTIBLE_REGEX = /${WEBP_CONVERTIBLE_REGEX.source}/i
const VIDEO_REGEX = /${VIDEO_REGEX.source}/i

// Helper to get WebP URL for convertible formats (png, jpg, jpeg only)
const getWebpUrl = (url: string | undefined): string | null => {
  if (!url || !url.startsWith('/assets/')) return null
  if (!WEBP_CONVERTIBLE_REGEX.test(url)) return null
  return url.replace(WEBP_CONVERTIBLE_REGEX, '.webp')
}

// Pre-compute URLs and flags (avoids regex on every render)
const avatarWebpUrl = getWebpUrl(profile.avatarUrl)
const blockWebpUrls: Record<string, string | null> = {}
const blockIsVideo: Record<string, boolean> = {}
blocks.forEach(b => {
  blockWebpUrls[b.id] = getWebpUrl(b.imageUrl)
  blockIsVideo[b.id] = b.imageUrl ? VIDEO_REGEX.test(b.imageUrl) : false
})
${generateAnalyticsHook(analyticsId)}
${generateMobileLayoutHelper()}
// Sort blocks for mobile
const sortedBlocks = [...blocks].sort((a, b) => {
  const aRow = a.gridRow ?? 999
  const bRow = b.gridRow ?? 999
  const aCol = a.gridColumn ?? 999
  const bCol = b.gridColumn ?? 999
  if (aRow !== bRow) return aRow - bRow
  return aCol - bCol
})

export default function App() {
  useAnalytics()

  const avatarStyle = { borderRadius: '${avatarRadius}', boxShadow: '${avatarShadow}', border: '${avatarBorder}' }
  const bgStyle: React.CSSProperties = ${bgStyle}

  return (
    <div className="min-h-screen font-sans" style={bgStyle}>
      ${generateBackgroundBlur(profile.backgroundImage, profile.backgroundBlur)}
      <div className="relative z-10">
${generateDesktopLayout(layoutParams)}

${generateMobileLayout(layoutParams)}

${generateFooter(layoutParams.showBranding)}
      </div>
    </div>
  )
}
`;
};
