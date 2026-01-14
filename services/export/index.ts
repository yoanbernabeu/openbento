/**
 * Export Service - Main Entry Point
 *
 * Generates a complete React/Vite/Tailwind project from SiteData
 */

import JSZip from 'jszip';
import saveAs from 'file-saver';
import { SiteData } from '../../types';

// Config generators
import {
  generatePackageJson,
  generateViteConfig,
  generateTailwindConfig,
  generatePostCSSConfig,
  generateTSConfig,
} from './config';

// Template generators
import { generateIndexHtml, generateMainTsx, generateIndexCSS, generateAppTsx } from './templates';

// Image extraction
import { extractImages } from './imageExtractor';

// Deployment configs
import {
  ExportDeploymentTarget,
  VERCEL_JSON,
  NETLIFY_TOML,
  GITHUB_WORKFLOW_YAML,
  NGINX_CONF,
  DOCKERFILE,
  DOCKERIGNORE,
  getVpsNginxConf,
  HEROKU_STATIC_JSON,
  generateDeployMd,
} from './deploy';

// Re-export types
export type { ExportDeploymentTarget } from './deploy';

/**
 * Export the site as a complete React project in a zip file
 */
export const exportSite = async (
  data: SiteData,
  opts?: { siteId?: string; deploymentTarget?: ExportDeploymentTarget }
): Promise<void> => {
  const zip = new JSZip();
  const assetsFolder = zip.folder('public/assets');
  const srcFolder = zip.folder('src');

  // Extract base64 images and get mapping (also generates WebP versions)
  const imageMap = await extractImages(data, assetsFolder);

  const deploymentTarget: ExportDeploymentTarget = opts?.deploymentTarget ?? 'vercel';

  // Root configuration files
  zip.file('package.json', generatePackageJson(data.profile.name));
  zip.file('vite.config.ts', generateViteConfig());
  zip.file('tailwind.config.js', generateTailwindConfig());
  zip.file('postcss.config.js', generatePostCSSConfig());
  zip.file('tsconfig.json', generateTSConfig());
  zip.file('index.html', generateIndexHtml(data.profile.name));
  zip.file('DEPLOY.md', generateDeployMd({ name: data.profile.name, target: deploymentTarget }));

  // Source files
  srcFolder?.file('main.tsx', generateMainTsx());
  srcFolder?.file('index.css', generateIndexCSS());
  srcFolder?.file('App.tsx', generateAppTsx(data, imageMap, opts?.siteId));

  // Deployment-specific configuration files
  switch (deploymentTarget) {
    case 'vercel':
      zip.file('vercel.json', VERCEL_JSON);
      break;
    case 'netlify':
      zip.file('netlify.toml', NETLIFY_TOML);
      break;
    case 'github-pages':
      zip.file('.github/workflows/deploy.yml', GITHUB_WORKFLOW_YAML);
      break;
    case 'docker':
      zip.file('Dockerfile', DOCKERFILE);
      zip.file('nginx.conf', NGINX_CONF);
      zip.file('.dockerignore', DOCKERIGNORE);
      break;
    case 'vps':
      zip.file('nginx.conf', getVpsNginxConf());
      break;
    case 'heroku':
      zip.file('static.json', HEROKU_STATIC_JSON);
      break;
  }

  // Generate and download the zip
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(
    content,
    `${data.profile.name.replace(/\s+/g, '-').toLowerCase()}-bento-${deploymentTarget}.zip`
  );
};

// Keep for backward compatibility with PreviewPage
export const generatePreviewSrcDoc = (_data: SiteData, _opts?: { siteId?: string }): string => {
  // Return empty - will be removed when PreviewPage is refactored
  return '';
};
