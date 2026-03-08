import type { LucideIcon } from 'lucide-react';
import {
  AtSign,
  BookText,
  Camera,
  Cloud,
  Code,
  Coffee,
  Dribbble,
  Facebook,
  Gamepad2,
  Github,
  Gitlab,
  Globe,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  MessageCircle,
  Newspaper,
  Phone,
  Pin,
  Rss,
  Send,
  Twitch,
  Video,
  X,
  Youtube,
} from 'lucide-react';

// Simple Icons (brand icons with official colors)
import {
  SiX,
  SiInstagram,
  SiTiktok,
  SiYoutube,
  SiGithub,
  SiGitlab,
  SiLinkedin,
  SiFacebook,
  SiTwitch,
  SiDribbble,
  SiMedium,
  SiDevdotto,
  SiReddit,
  SiPinterest,
  SiThreads,
  SiBluesky,
  SiMastodon,
  SiSubstack,
  SiPatreon,
  SiKofi,
  SiBuymeacoffee,
  SiSnapchat,
  SiDiscord,
  SiTelegram,
  SiWhatsapp,
  SiSpotify,
} from 'react-icons/si';
import type { IconType } from 'react-icons';

import type { SocialPlatform } from './types';

export type SocialPlatformOption = {
  id: SocialPlatform;
  label: string;
  icon: LucideIcon | IconType;
  brandIcon?: IconType; // Colored brand icon from Simple Icons
  brandColor?: string; // Official brand color
  placeholder: string;
  kind: 'handle' | 'url';
  buildUrl: (input: string) => string;
  formatHandleForDisplay?: (handle: string) => string;
};

const normalizeHandle = (value: string): string => value.trim().replace(/^@+/, '');

// SECURITY: Validate URL has safe protocol
const isValidHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const ensureHttps = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  // If already has protocol, validate it's http/https
  if (/^https?:\/\//i.test(trimmed)) {
    return isValidHttpUrl(trimmed) ? trimmed : '';
  }

  // Add https and validate
  const withHttps = `https://${trimmed.replace(/^\/+/, '')}`;
  return isValidHttpUrl(withHttps) ? withHttps : '';
};

export const SOCIAL_PLATFORM_OPTIONS: SocialPlatformOption[] = [
  {
    id: 'x',
    label: 'X',
    icon: X,
    brandIcon: SiX,
    brandColor: '#000000',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://x.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    brandIcon: SiInstagram,
    brandColor: '#E4405F',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.instagram.com/${encodeURIComponent(normalizeHandle(input))}/`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: Video,
    brandIcon: SiTiktok,
    brandColor: '#000000',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.tiktok.com/@${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    brandIcon: SiYoutube,
    brandColor: '#FF0000',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.youtube.com/@${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'github',
    label: 'GitHub',
    icon: Github,
    brandIcon: SiGithub,
    brandColor: '#181717',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://github.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    icon: Gitlab,
    brandIcon: SiGitlab,
    brandColor: '#FC6D26',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://gitlab.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    brandIcon: SiLinkedin,
    brandColor: '#0A66C2',
    placeholder: 'your-handle',
    kind: 'handle',
    buildUrl: (input) =>
      `https://www.linkedin.com/in/${encodeURIComponent(normalizeHandle(input))}/`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    brandIcon: SiFacebook,
    brandColor: '#1877F2',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.facebook.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'twitch',
    label: 'Twitch',
    icon: Twitch,
    brandIcon: SiTwitch,
    brandColor: '#9146FF',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.twitch.tv/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'dribbble',
    label: 'Dribbble',
    icon: Dribbble,
    brandIcon: SiDribbble,
    brandColor: '#EA4C89',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://dribbble.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: Newspaper,
    brandIcon: SiMedium,
    brandColor: '#000000',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://medium.com/@${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'devto',
    label: 'Dev.to',
    icon: Code,
    brandIcon: SiDevdotto,
    brandColor: '#0A0A0A',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://dev.to/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: MessageCircle,
    brandIcon: SiReddit,
    brandColor: '#FF4500',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) =>
      `https://www.reddit.com/user/${encodeURIComponent(normalizeHandle(input))}/`,
    formatHandleForDisplay: (h) => `u/${normalizeHandle(h)}`,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: Pin,
    brandIcon: SiPinterest,
    brandColor: '#BD081C',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.pinterest.com/${encodeURIComponent(normalizeHandle(input))}/`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: AtSign,
    brandIcon: SiThreads,
    brandColor: '#000000',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://www.threads.net/@${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: Cloud,
    brandIcon: SiBluesky,
    brandColor: '#0085FF',
    placeholder: 'name.bsky.social',
    kind: 'handle',
    buildUrl: (input) => `https://bsky.app/profile/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'spotify',
    label: 'Spotify',
    icon: SiSpotify,
    brandIcon: SiSpotify,
    brandColor: '#1DB954',
    placeholder: 'spotify username',
    kind: 'handle',
    buildUrl: (input) =>
      `https://open.spotify.com/user/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    icon: Rss,
    brandIcon: SiMastodon,
    brandColor: '#6364FF',
    placeholder: '@user@instance.tld',
    kind: 'handle',
    buildUrl: (input) => {
      const raw = input.trim();
      if (!raw) return '';
      // SECURITY: If user provides URL, validate it's http/https before returning
      if (/^https?:\/\//i.test(raw)) {
        return isValidHttpUrl(raw) ? raw : '';
      }
      const cleaned = raw.replace(/^@+/, '');
      const [user, instance] = cleaned.split('@');
      if (!user || !instance) return '';
      // SECURITY: Validate instance is a valid domain (no special chars that could break URL)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(instance)) return '';
      return `https://${instance}/@${encodeURIComponent(user)}`;
    },
    formatHandleForDisplay: (h) => {
      const cleaned = h.trim().replace(/^@+/, '');
      return cleaned ? `@${cleaned}` : '';
    },
  },
  {
    id: 'substack',
    label: 'Substack',
    icon: BookText,
    brandIcon: SiSubstack,
    brandColor: '#FF6719',
    placeholder: 'newsletter',
    kind: 'handle',
    buildUrl: (input) => {
      const cleaned = normalizeHandle(input)
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*/, '')
        .replace(/\.substack\.com$/i, '');
      if (!cleaned) return '';
      return `https://${cleaned}.substack.com`;
    },
    formatHandleForDisplay: (h) => normalizeHandle(h).replace(/\.substack\.com$/i, ''),
  },
  {
    id: 'patreon',
    label: 'Patreon',
    icon: AtSign,
    brandIcon: SiPatreon,
    brandColor: '#FF424D',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://patreon.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'kofi',
    label: 'Ko-fi',
    icon: Coffee,
    brandIcon: SiKofi,
    brandColor: '#FF5E5B',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://ko-fi.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'buymeacoffee',
    label: 'Buy Me a Coffee',
    icon: Coffee,
    brandIcon: SiBuymeacoffee,
    brandColor: '#FFDD00',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) =>
      `https://www.buymeacoffee.com/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'snapchat',
    label: 'Snapchat',
    icon: Camera,
    brandIcon: SiSnapchat,
    brandColor: '#FFFC00',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) =>
      `https://www.snapchat.com/add/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: Gamepad2,
    brandIcon: SiDiscord,
    brandColor: '#5865F2',
    placeholder: 'server-invite-code',
    kind: 'handle',
    buildUrl: (input) => `https://discord.gg/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: Send,
    brandIcon: SiTelegram,
    brandColor: '#26A5E4',
    placeholder: 'yourhandle',
    kind: 'handle',
    buildUrl: (input) => `https://t.me/${encodeURIComponent(normalizeHandle(input))}`,
    formatHandleForDisplay: (h) => `@${normalizeHandle(h)}`,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: Phone,
    brandIcon: SiWhatsapp,
    brandColor: '#25D366',
    placeholder: '+33612345678',
    kind: 'handle',
    buildUrl: (input) =>
      `https://wa.me/${encodeURIComponent(normalizeHandle(input).replace(/[^0-9+]/g, ''))}`,
    formatHandleForDisplay: (h) => normalizeHandle(h),
  },
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    placeholder: 'example.com',
    kind: 'url',
    buildUrl: (input) => ensureHttps(input),
  },
  {
    id: 'custom',
    label: 'Custom URL',
    icon: LinkIcon,
    placeholder: 'https://...',
    kind: 'url',
    buildUrl: (input) => ensureHttps(input),
  },
];

export const getSocialPlatformOption = (
  platform: SocialPlatform | undefined
): SocialPlatformOption | undefined => {
  if (!platform) return undefined;
  return SOCIAL_PLATFORM_OPTIONS.find((p) => p.id === platform);
};

// SECURITY: Check if hostname matches a domain (exact match or subdomain)
const hostMatches = (hostname: string, domain: string): boolean => {
  return hostname === domain || hostname.endsWith(`.${domain}`);
};

export const inferSocialPlatformFromUrl = (url: string | undefined): SocialPlatform | undefined => {
  if (!url) return undefined;

  // SECURITY: Parse URL properly to extract hostname instead of substring matching
  // This prevents attacks like https://evil.com/fake/spotify.com/ bypassing checks
  let hostname: string;
  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return undefined;
  }

  // Check hostname against known platforms
  if (hostMatches(hostname, 'x.com') || hostMatches(hostname, 'twitter.com')) return 'x';
  if (hostMatches(hostname, 'instagram.com')) return 'instagram';
  if (hostMatches(hostname, 'tiktok.com')) return 'tiktok';
  if (hostMatches(hostname, 'youtube.com') || hostMatches(hostname, 'youtu.be')) return 'youtube';
  if (hostMatches(hostname, 'github.com')) return 'github';
  if (hostMatches(hostname, 'gitlab.com')) return 'gitlab';
  if (hostMatches(hostname, 'linkedin.com')) return 'linkedin';
  if (hostMatches(hostname, 'facebook.com')) return 'facebook';
  if (hostMatches(hostname, 'twitch.tv')) return 'twitch';
  if (hostMatches(hostname, 'dribbble.com')) return 'dribbble';
  if (hostMatches(hostname, 'medium.com')) return 'medium';
  if (hostMatches(hostname, 'dev.to')) return 'devto';
  if (hostMatches(hostname, 'reddit.com')) return 'reddit';
  if (hostMatches(hostname, 'pinterest.com')) return 'pinterest';
  if (hostMatches(hostname, 'threads.net')) return 'threads';
  if (hostMatches(hostname, 'bsky.app')) return 'bluesky';
  if (hostMatches(hostname, 'substack.com')) return 'substack';
  if (hostMatches(hostname, 'patreon.com')) return 'patreon';
  if (hostMatches(hostname, 'ko-fi.com')) return 'kofi';
  if (hostMatches(hostname, 'buymeacoffee.com')) return 'buymeacoffee';
  if (hostMatches(hostname, 'snapchat.com')) return 'snapchat';
  if (hostMatches(hostname, 'discord.gg') || hostMatches(hostname, 'discord.com')) return 'discord';
  if (hostMatches(hostname, 't.me') || hostMatches(hostname, 'telegram.org')) return 'telegram';
  if (hostMatches(hostname, 'wa.me') || hostMatches(hostname, 'whatsapp.com')) return 'whatsapp';
  if (hostMatches(hostname, 'spotify.com')) return 'spotify';
  return undefined;
};

export const extractHandleFromUrl = (
  platform: SocialPlatform | undefined,
  url: string | undefined
): string | undefined => {
  if (!platform || !url) return undefined;
  try {
    const parsed = new URL(ensureHttps(url));
    const path = parsed.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);

    switch (platform) {
      case 'x':
      case 'instagram':
      case 'github':
      case 'gitlab':
      case 'facebook':
      case 'twitch':
      case 'dribbble':
      case 'devto':
      case 'pinterest':
        return segments[0];
      case 'reddit':
        if (segments[0] === 'u' && segments[1]) return segments[1];
        if (segments[0] === 'user' && segments[1]) return segments[1];
        return undefined;
      case 'linkedin':
        if (segments[0] === 'in' && segments[1]) return segments[1];
        return undefined;
      case 'tiktok':
        if (segments[0]?.startsWith('@')) return segments[0].slice(1);
        if (segments[0] === '@' && segments[1]) return segments[1];
        if (segments[0] === 'share' && segments[1]) return segments[1];
        return segments[0]?.replace(/^@/, '');
      case 'youtube':
        if (segments[0]?.startsWith('@')) return segments[0].slice(1);
        if (segments[0] === 'channel' && segments[1]) return segments[1];
        return undefined;
      case 'threads':
        if (segments[0]?.startsWith('@')) return segments[0].slice(1);
        return undefined;
      case 'bluesky':
        if (segments[0] === 'profile' && segments[1]) return segments[1];
        return undefined;
      case 'substack':
        return parsed.hostname.replace(/\.substack\.com$/i, '');
      case 'mastodon':
        // Prefer @user@instance from hostname + path
        if (segments[0]?.startsWith('@')) return `${segments[0].slice(1)}@${parsed.hostname}`;
        return undefined;
      case 'snapchat':
        if (segments[0] === 'add' && segments[1]) return segments[1];
        return segments[0];
      case 'discord':
        return segments[0]; // invite code
      case 'telegram':
        return segments[0];
      case 'whatsapp':
        return segments[0]; // phone number
      case 'website':
      case 'custom':
        return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const getSocialDisplayHandle = (
  platform: SocialPlatform | undefined,
  handle: string | undefined
): string => {
  if (!platform || !handle) return '';
  const opt = getSocialPlatformOption(platform);
  if (opt?.formatHandleForDisplay) return opt.formatHandleForDisplay(handle);
  return handle.trim();
};

export const buildSocialUrl = (
  platform: SocialPlatform | undefined,
  input: string | undefined
): string => {
  if (!platform) return '';
  const opt = getSocialPlatformOption(platform);
  if (!opt) return '';
  const raw = (input ?? '').trim();
  if (!raw) return '';
  return opt.buildUrl(raw);
};

export const normalizeSocialHandle = (
  platform: SocialPlatform | undefined,
  input: string
): string => {
  if (platform === 'mastodon') return input.trim().replace(/^@+/, '');
  if (platform === 'custom' || platform === 'website') return input.trim();
  return normalizeHandle(input);
};

// Format follower count: 220430 → "220k", 1500000 → "1.5M"
export const formatFollowerCount = (count: number | undefined): string => {
  if (count === undefined || count === null) return '';
  if (count < 1000) return String(count);
  if (count < 1000000) {
    const k = count / 1000;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(k % 1 === 0 ? 0 : 1)}k`;
  }
  const m = count / 1000000;
  return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(m % 1 === 0 ? 0 : 1)}M`;
};
