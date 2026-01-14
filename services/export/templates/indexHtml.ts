/**
 * Generate index.html for exported project
 */

import { escapeHtml } from '../helpers';

export const generateIndexHtml = (title: string): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

    <!-- Preconnect to external resources for faster loading -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
    <link rel="dns-prefetch" href="https://fonts.gstatic.com" />

    <!-- Google Fonts with font-display: swap and latin subset for better performance -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&subset=latin&display=swap" rel="stylesheet" />

    <title>${escapeHtml(title)}</title>

    <!-- Critical CSS for above-the-fold content -->
    <style>
      *,*::before,*::after{box-sizing:border-box}
      body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
      #root{min-height:100vh}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
