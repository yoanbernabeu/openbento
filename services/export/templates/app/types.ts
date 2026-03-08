/**
 * Generate TypeScript types for the exported App.tsx
 */

export const generateTypes = (): string => `
// Types
enum BlockType {
  LINK = 'LINK',
  TEXT = 'TEXT',
  MEDIA = 'MEDIA',
  SOCIAL = 'SOCIAL',
  COLLECTION = 'COLLECTION',
  SOCIAL_ICON = 'SOCIAL_ICON',
  MAP = 'MAP',
  SPACER = 'SPACER'
}

type SocialPlatform = 'x' | 'instagram' | 'tiktok' | 'youtube' | 'github' | 'gitlab' | 'linkedin' | 'facebook' | 'twitch' | 'dribbble' | 'medium' | 'devto' | 'reddit' | 'pinterest' | 'threads' | 'bluesky' | 'mastodon' | 'substack' | 'patreon' | 'kofi' | 'buymeacoffee' | 'website' | 'snapchat' | 'discord' | 'telegram' | 'whatsapp' | 'custom'

interface BlockData {
  id: string
  type: BlockType
  title?: string
  content?: string
  subtext?: string
  imageUrl?: string
  mediaPosition?: { x: number; y: number }
  colSpan: number
  rowSpan: number
  color?: string
  customBackground?: string
  textColor?: string
  gridColumn?: number
  gridRow?: number
  channelId?: string
  youtubeVideoId?: string
  channelTitle?: string
  youtubeMode?: 'single' | 'grid' | 'list'
  youtubeVideos?: Array<{ id: string; title: string; thumbnail: string }>
  socialPlatform?: SocialPlatform
  socialHandle?: string
  collectionId?: string
  expandedByDefault?: boolean
  zIndex?: number
}
`;
