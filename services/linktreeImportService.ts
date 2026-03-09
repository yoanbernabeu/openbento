import { AVATAR_PLACEHOLDER } from '../constants';
import {
  extractHandleFromUrl,
  inferSocialPlatformFromUrl,
  normalizeSocialHandle,
} from '../socialPlatforms';
import type { BlockData, SavedBento, SocialAccount, UserProfile } from '../types';
import { BlockType } from '../types';
import { GRID_VERSION, importBentoFromJSON, type BentoJSON } from './storageService';

type LinktreeSocialLink = {
  url?: string;
  profileUrl?: string;
  href?: string;
  link?: string;
  type?: string;
  platform?: string;
};

type LinktreePageProps = {
  username?: string;
  pageTitle?: string;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  customAvatar?: string | null;
  socialLinks?: LinktreeSocialLink[];
  seoSchema?: {
    mainEntity?: {
      sameAs?: string[];
    };
  };
  account?: {
    username?: string;
    pageTitle?: string;
    description?: string | null;
    profilePictureUrl?: string | null;
    customAvatar?: string | null;
    dynamicMetaTitle?: string | null;
    dynamicMetaDescription?: string | null;
    socialLinks?: LinktreeSocialLink[];
    links?: Array<Record<string, unknown>>;
    theme?: {
      background?: {
        color?: string;
      };
      buttonStyle?: {
        backgroundStyle?: {
          color?: string;
        };
        textStyle?: {
          color?: string;
        };
      };
      typeface?: {
        color?: string;
      };
    };
  };
};

export type LinktreeImportResult = {
  bento: SavedBento;
  importedCount: number;
  skippedCount: number;
  warnings: string[];
};

const normalizeLinktreeInput = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a Linktree URL or username.');

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'linktr.ee' && hostname !== 'www.linktr.ee') {
      throw new Error('Only linktr.ee URLs are supported.');
    }
    const username = parsed.pathname.split('/').filter(Boolean)[0];
    if (!username) throw new Error('The Linktree URL must include a username.');
    return `https://linktr.ee/${username}`;
  }

  const username = trimmed
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?linktr\.ee\//i, '')
    .split(/[/?#]/)[0];

  if (!username) throw new Error('The Linktree username is invalid.');
  return `https://linktr.ee/${username}`;
};

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const pickFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const pickFirstUrl = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (isHttpUrl(value)) return value;
  }
  return undefined;
};

const sanitizeImportedTitle = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+\|\s*Linktree$/i, '').trim();
};

const collectSocialUrls = (pageProps: LinktreePageProps): string[] => {
  const urls = new Set<string>();
  const socialLists = [pageProps.socialLinks, pageProps.account?.socialLinks];

  for (const list of socialLists) {
    for (const item of list || []) {
      const url = pickFirstUrl(item.url, item.profileUrl, item.href, item.link);
      if (url) urls.add(url);
    }
  }

  for (const sameAs of pageProps.seoSchema?.mainEntity?.sameAs || []) {
    if (isHttpUrl(sameAs)) urls.add(sameAs);
  }

  return Array.from(urls);
};

const extractSocialAccounts = (pageProps: LinktreePageProps): SocialAccount[] => {
  const dedupe = new Map<string, SocialAccount>();

  for (const url of collectSocialUrls(pageProps)) {
    const platform = inferSocialPlatformFromUrl(url);
    if (!platform) continue;

    const rawHandle = extractHandleFromUrl(platform, url) || url;
    const handle = normalizeSocialHandle(platform, rawHandle);
    if (!handle) continue;

    dedupe.set(platform, { platform, handle });
  }

  return Array.from(dedupe.values());
};

const createLinkBlocks = (pageProps: LinktreePageProps) => {
  const links = Array.isArray(pageProps.account?.links) ? pageProps.account.links : [];
  const buttonColor = pageProps.account?.theme?.buttonStyle?.backgroundStyle?.color || '#111827';
  const textColorHex = pageProps.account?.theme?.buttonStyle?.textStyle?.color || '#ffffff';

  let importedCount = 0;
  let skippedCount = 0;

  const blocks = links.flatMap((link, index) => {
    const url = pickFirstUrl(link.url, link.href);
    const title = pickFirstText(link.title);
    const isActive = link.isActive !== false;
    const isLocked = Boolean(link.isLocked || link.locked);

    if (!url || !title || !isActive || isLocked) {
      skippedCount += 1;
      return [];
    }

    importedCount += 1;

    let hostname = '';
    try {
      hostname = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      hostname = 'External link';
    }

    return [
      {
        id: `linktree-link-${index}`,
        type: BlockType.LINK,
        title,
        subtext: hostname,
        content: url,
        colSpan: 9,
        rowSpan: 3,
        gridColumn: 1,
        gridRow: importedCount * 3 - 2,
        customBackground: buttonColor,
        textColor: textColorHex.toLowerCase() === '#000000' ? 'text-gray-900' : 'text-white',
      } satisfies BlockData,
    ];
  });

  return { blocks, importedCount, skippedCount };
};

const createProfile = (
  pageProps: LinktreePageProps,
  socialAccounts: SocialAccount[]
): UserProfile => {
  const title = sanitizeImportedTitle(
    pickFirstText(
      pageProps.account?.pageTitle,
      pageProps.pageTitle,
      pageProps.account?.dynamicMetaTitle,
      pageProps.metaTitle,
      pageProps.account?.username,
      pageProps.username,
      'Imported Linktree'
    )
  );
  const description = pickFirstText(
    pageProps.account?.description,
    pageProps.description,
    pageProps.account?.dynamicMetaDescription,
    pageProps.metaDescription
  );
  const avatarUrl = pickFirstUrl(
    pageProps.account?.profilePictureUrl,
    pageProps.account?.customAvatar,
    pageProps.customAvatar
  );

  return {
    name: title || 'Imported Linktree',
    bio: description,
    avatarUrl:
      avatarUrl && !avatarUrl.includes('/blank-avatar.svg') ? avatarUrl : AVATAR_PLACEHOLDER,
    theme: 'light',
    primaryColor: 'blue',
    showBranding: true,
    showSocialInHeader: socialAccounts.length > 0,
    showFollowerCount: false,
    socialAccounts,
    analytics: { enabled: false, supabaseUrl: '' },
    backgroundColor: pageProps.account?.theme?.background?.color || '#f8fafc',
    openGraph: {
      title: title || 'Imported Linktree',
      description,
      image: avatarUrl && !avatarUrl.includes('/blank-avatar.svg') ? avatarUrl : undefined,
      siteName: 'Linktree import',
      twitterCardType: 'summary_large_image',
    },
  };
};

const buildBentoJsonFromLinktree = (pageProps: LinktreePageProps) => {
  const socialAccounts = extractSocialAccounts(pageProps);
  const { blocks: linkBlocks, importedCount, skippedCount } = createLinkBlocks(pageProps);
  const profile = createProfile(pageProps, socialAccounts);
  const warnings = [
    'Experimental import: some Linktree elements may need manual cleanup after import.',
  ];

  if (skippedCount > 0) {
    warnings.push(`${skippedCount} item(s) could not be imported automatically.`);
  }
  if (socialAccounts.length === 0) {
    warnings.push('No supported social accounts were detected on this Linktree page.');
  }

  const json: BentoJSON = {
    id: `linktree_${Date.now()}`,
    name: `${profile.name.replace(/^@/, '').trim() || 'Linktree Import'} Bento`,
    version: '1.0',
    gridVersion: GRID_VERSION,
    profile,
    blocks: linkBlocks,
    exportedAt: Date.now(),
  };

  return { json, importedCount, skippedCount, warnings };
};

export const importLinktreeToBento = async (input: string): Promise<LinktreeImportResult> => {
  if (import.meta.env.VITE_ENABLE_IMPORT !== 'true') {
    throw new Error('Import feature is disabled. Set VITE_ENABLE_IMPORT=true to enable it.');
  }

  const sourceUrl = normalizeLinktreeInput(input);
  const endpoint = `/__openbento/import/linktree?url=${encodeURIComponent(sourceUrl)}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    throw new Error(
      `Unable to reach the Linktree import service. ${(error as Error).message || ''}`.trim()
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    pageProps?: LinktreePageProps;
  } | null;

  if (!response.ok || !payload?.ok || !payload.pageProps) {
    if (response.status === 404) {
      throw new Error('Linktree import is unavailable in this environment.');
    }
    throw new Error(payload?.error || 'Failed to fetch this Linktree page.');
  }

  const { json, importedCount, skippedCount, warnings } = buildBentoJsonFromLinktree(
    payload.pageProps
  );

  return {
    bento: importBentoFromJSON(json),
    importedCount,
    skippedCount,
    warnings,
  };
};
