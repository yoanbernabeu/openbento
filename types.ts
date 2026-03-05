export enum BlockType {
  LINK = 'LINK',
  TEXT = 'TEXT',
  FLUID_TEXT = 'FLUID_TEXT',
  MEDIA = 'MEDIA', // Images, GIFs, videos
  SOCIAL = 'SOCIAL',
  SOCIAL_ICON = 'SOCIAL_ICON', // Small icon-only social block for 9x9 grid
  MAP = 'MAP',
  SPACER = 'SPACER',
}

export type SocialPlatform =
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'github'
  | 'gitlab'
  | 'linkedin'
  | 'facebook'
  | 'twitch'
  | 'dribbble'
  | 'medium'
  | 'devto'
  | 'reddit'
  | 'pinterest'
  | 'threads'
  | 'bluesky'
  | 'mastodon'
  | 'substack'
  | 'patreon'
  | 'kofi'
  | 'buymeacoffee'
  | 'website'
  | 'snapchat'
  | 'discord'
  | 'telegram'
  | 'whatsapp'
  | 'spotify'
  | 'custom';

// Configured social account in settings
export interface SocialAccount {
  platform: SocialPlatform;
  handle: string; // Username/handle without @ or full URL for url-type platforms
  followerCount?: number; // Optional follower/subscriber count
}

export interface BlockData {
  id: string;
  type: BlockType;
  title?: string;
  content?: string; // URL or Text
  subtext?: string;
  imageUrl?: string;
  mediaPosition?: { x: number; y: number }; // Object position for media (0-100 for each axis)
  colSpan: number; // 1-9 (9-col grid)
  rowSpan: number; // 1+ (builder clamps to 50)
  color?: string; // Tailwind class like 'bg-blue-100'
  customBackground?: string; // Raw CSS value (hex or gradient)
  textColor?: string; // 'text-black' or 'text-white'
  rotation?: number; // Removed usage, kept for type safety if needed, or remove.
  fluidTextFontSize?: number; // 0.1 - 0.8 scale for Fluid Text

  // Grid positioning (explicit placement)
  gridColumn?: number; // 1-based column start position
  gridRow?: number; // 1-based row start position

  // YouTube specific
  channelId?: string; // Persist the ID for dynamic fetching
  youtubeVideoId?: string; // For Single Mode (fallback or initial)
  channelTitle?: string;
  youtubeMode?: 'single' | 'grid' | 'list';
  youtubeVideos?: Array<{ id: string; title: string; thumbnail: string }>;

  // Social platform (non-YouTube mode)
  socialPlatform?: SocialPlatform;
  socialHandle?: string; // Stored without leading '@' when possible

  // Z-index for overlapping blocks (runtime only, not saved)
  zIndex?: number;
}

// Profile picture style options
export interface AvatarStyle {
  shape: 'circle' | 'square' | 'rounded'; // circle, square, or rounded corners
  shadow: boolean; // drop shadow
  border: boolean; // show border/contour
  borderColor?: string; // border color (default: white)
  borderWidth?: number; // border width in pixels (default: 3)
}

// OpenGraph meta tags for social sharing
export interface OpenGraphData {
  title?: string; // Title for social previews (defaults to profile name)
  description?: string; // Description (max 200 chars recommended)
  image?: string; // Image URL (1200x630px recommended)
  siteName?: string; // Site name
  twitterHandle?: string; // Twitter/X handle (without @)
  twitterCardType?: 'summary' | 'summary_large_image'; // Twitter card type
}

export interface UserProfile {
  name: string;
  bio: string;
  avatarUrl: string;
  avatarStyle?: AvatarStyle; // Profile picture style options
  theme: 'light' | 'dark';
  primaryColor: string;
  showBranding?: boolean;
  showSocialInHeader?: boolean; // Show social icons row under name/bio
  showFollowerCount?: boolean; // Show follower count next to social icons
  // Background customization
  backgroundColor?: string; // CSS color value (hex, rgb, etc.)
  backgroundImage?: string; // URL or data URL for background image
  backgroundBlur?: number; // Blur amount for background image (0-20)
  analytics?: {
    enabled?: boolean;
    supabaseUrl?: string; // https://<project-ref>.supabase.co
    anonKey?: string; // DEPRECATED: No longer needed - Edge Function handles auth securely
  };
  // Centralized social accounts configuration
  socialAccounts?: SocialAccount[];
  // OpenGraph meta tags for social sharing
  openGraph?: OpenGraphData;
}

export interface SiteData {
  profile: UserProfile;
  blocks: BlockData[];
  gridVersion?: number;
}

export interface SavedBento {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: SiteData;
}
