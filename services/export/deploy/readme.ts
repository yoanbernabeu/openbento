/**
 * Generate deployment README
 */

import { ExportDeploymentTarget } from './types';

export const generateDeployMd = (params: {
  name: string;
  target: ExportDeploymentTarget;
}): string => `# Deploy ${params.name}

This is a React/Vite/Tailwind project exported from OpenBento.

## Quick Start

\`\`\`bash
npm install
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
\`\`\`

## Deployment

### ${params.target.charAt(0).toUpperCase() + params.target.slice(1)}

${
  params.target === 'vercel'
    ? `1. Push to GitHub
2. Import in Vercel
3. Deploy (auto-detected)`
    : ''
}
${
  params.target === 'netlify'
    ? `1. Push to GitHub
2. Import in Netlify
3. Deploy (auto-detected)`
    : ''
}
${
  params.target === 'github-pages'
    ? `1. Push to GitHub
2. Go to Settings → Pages → Source: GitHub Actions
3. The included workflow will auto-deploy`
    : ''
}
${
  params.target === 'docker'
    ? `\`\`\`bash
docker build -t my-bento .
docker run -p 8080:80 my-bento
\`\`\``
    : ''
}
${
  params.target === 'vps'
    ? `1. Copy files to your server
2. Run \`npm install && npm run build\`
3. Configure nginx with the provided config
4. Point nginx root to the \`dist\` folder`
    : ''
}
${
  params.target === 'heroku'
    ? `1. Create Heroku app
2. Add buildpack: \`heroku/nodejs\`
3. Push to Heroku`
    : ''
}

## Files

- \`src/App.tsx\` - Main component with all data embedded
- \`src/index.css\` - Tailwind styles
- \`public/assets/\` - Images (if any)
- \`index.html\` - Includes OpenGraph meta tags for social sharing

## Social Sharing (OpenGraph Meta Tags)

Your exported page includes OpenGraph and Twitter Card meta tags for beautiful social media previews.

### Configured Meta Tags

The following meta tags are included in \`index.html\`:
- **og:title** & **twitter:title** - Share title (defaults to your profile name)
- **og:description** & **twitter:description** - Share description (defaults to your bio)
- **og:image** & **twitter:image** - Share image (defaults to your avatar)
- **og:url** - Canonical URL (if configured)
- **og:site_name** - Site name (defaults to your profile name)
- **twitter:card** - Card type (summary or summary_large_image)

### Image Requirements

For best results with social media previews:
- **Recommended size**: 1200×630px (PNG or JPG format)
- **Must be publicly accessible** - Data URLs (base64) won't work
- **Use absolute URLs** - e.g., \`https://yourdomain.com/og-image.jpg\`

### Testing Your Previews

After deploying, validate your social media previews:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### Updating Meta Tags

To modify meta tags after export, edit \`index.html\` or reconfigure in OpenBento settings before exporting again.
`;
