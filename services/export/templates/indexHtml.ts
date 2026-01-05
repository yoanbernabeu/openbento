/**
 * Generate index.html for exported project with OpenGraph meta tags
 */

import type { UserProfile } from '../../../types';
import { escapeHtml } from '../helpers';

/**
 * Generate meta tags for social sharing (OpenGraph & Twitter Cards)
 */
const generateMetaTags = (profile: UserProfile): string => {
  const og = profile.openGraph || {};

  // Use OpenGraph values with fallbacks to profile data
  const title = og.title || profile.name;
  const description = og.description || profile.bio;
  const siteName = og.siteName || profile.name;
  const image = og.image || profile.avatarUrl;
  const url = og.url; // Optional - can be set via env var
  const twitterCard = og.twitterCard || 'summary_large_image';

  // Warn about data URLs in comments (social platforms don't support them)
  const imageWarning =
    image?.startsWith('data:')
      ? '\n    <!-- WARNING: OG image is a data URL. Social platforms require publicly accessible URLs. -->'
      : '';

  const tags: string[] = [];

  // Primary meta tags
  if (description) {
    tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
  }

  // OpenGraph tags
  tags.push(`<meta property="og:type" content="website" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  if (description) {
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  }
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  }
  if (url) {
    tags.push(`<meta property="og:url" content="${escapeHtml(url)}" />`);
  }
  if (siteName) {
    tags.push(`<meta property="og:site_name" content="${escapeHtml(siteName)}" />`);
  }

  // Twitter Card tags
  tags.push(`<meta name="twitter:card" content="${escapeHtml(twitterCard)}" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  if (description) {
    tags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  }
  if (image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  if (og.twitterSite) {
    tags.push(`<meta name="twitter:site" content="@${escapeHtml(og.twitterSite.replace(/^@/, ''))}" />`);
  }
  if (og.twitterCreator) {
    tags.push(
      `<meta name="twitter:creator" content="@${escapeHtml(og.twitterCreator.replace(/^@/, ''))}" />`
    );
  }

  return imageWarning + '\n    ' + tags.join('\n    ');
};

export const generateIndexHtml = (profile: UserProfile): string => {
  const title = profile.openGraph?.title || profile.name;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <title>${escapeHtml(title)}</title>
    ${generateMetaTags(profile)}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
};
