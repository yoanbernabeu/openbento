/**
 * Generate layout components for the exported App.tsx
 */

interface LayoutParams {
  avatarRadius: string;
  avatarShadow: string;
  avatarBorder: string;
  bgStyle: string;
  showSocialInHeader: boolean;
  hasSocialAccounts: boolean;
  showBranding: boolean;
  backgroundBlur?: number;
  backgroundImage?: string;
}

export const generateDesktopLayout = (params: LayoutParams): string => `
        {/* Desktop Layout */}
        <div className="hidden lg:flex">
          <div className="fixed left-0 top-0 w-[420px] h-screen flex flex-col justify-center items-start px-12">
            <div className="w-40 h-40 overflow-hidden bg-gray-100 mb-8" style={avatarStyle}>
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">{profile.name}</h1>
            <p className="text-base text-gray-500 font-medium whitespace-pre-wrap max-w-xs">{profile.bio}</p>
            ${
              params.showSocialInHeader && params.hasSocialAccounts
                ? `
            <div className="flex flex-wrap gap-3 mt-4">
              {profile.socialAccounts?.map((acc: any) => {
                const platform = SOCIAL_PLATFORMS[acc.platform]
                const Icon = platform?.icon
                const url = platform?.buildUrl(acc.handle)
                const showCount = profile.showFollowerCount && acc.followerCount
                return (
                  <a key={acc.platform} href={url} target="_blank" rel="noopener noreferrer"
                    className={\`\${showCount ? 'px-3 py-2' : 'w-10 h-10'} bg-white rounded-full shadow-md flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg transition-all\`}
                    style={{ color: platform?.brandColor }}>
                    {Icon && <Icon size={20} />}
                    {showCount && (
                      <span className="text-sm font-semibold text-gray-700">
                        {formatFollowerCount(acc.followerCount)}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>`
                : ''
            }
          </div>
          <div className="ml-[420px] flex-1 p-12">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(9, 1fr)', gridAutoRows: '64px' }}>
              {blocks.map(block => <Block key={block.id} block={block} />)}
            </div>
          </div>
        </div>`;

// Mobile grid configuration constants
export const MOBILE_GRID_CONFIG = {
  columns: 2,
  rowHeight: 80,
  gap: 12,
} as const;

export const generateMobileLayoutHelper = (): string => `
// Mobile layout helper - calculates responsive grid spans
const getMobileLayout = (block: BlockData) => ({
  colSpan: block.colSpan >= 5 ? 2 : 1,
  rowSpan: block.colSpan >= 3 && block.colSpan < 5 ? Math.max(block.rowSpan, 2) : block.rowSpan
})
`;

export const generateMobileLayout = (params: LayoutParams): string => `
        {/* Mobile Layout - 2 columns adaptive */}
        <div className="lg:hidden">
          <div className="p-4 pt-8 flex flex-col items-center text-center">
            <div className="w-24 h-24 mb-4 overflow-hidden bg-gray-100" style={avatarStyle}>
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mb-2">{profile.name}</h1>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-wrap max-w-xs">{profile.bio}</p>
            ${
              params.showSocialInHeader && params.hasSocialAccounts
                ? `
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {profile.socialAccounts?.map((acc: any) => {
                const platform = SOCIAL_PLATFORMS[acc.platform]
                const Icon = platform?.icon
                const url = platform?.buildUrl(acc.handle)
                const showCount = profile.showFollowerCount && acc.followerCount
                return (
                  <a key={acc.platform} href={url} target="_blank" rel="noopener noreferrer"
                      className={\`\${showCount ? 'px-3 py-2' : 'w-10 h-10'} bg-white rounded-full shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform\`}
                    style={{ color: platform?.brandColor }}>
                    {Icon && <Icon size={20} />}
                    {showCount && (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatFollowerCount(acc.followerCount)}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>`
                : ''
            }
          </div>
          <div className="p-4">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(${MOBILE_GRID_CONFIG.columns}, 1fr)', gridAutoRows: '${MOBILE_GRID_CONFIG.rowHeight}px', gap: '${MOBILE_GRID_CONFIG.gap}px' }}>
              {sortedBlocks.map(block => {
                const mobile = getMobileLayout(block)
                return (
                  <div key={block.id} style={{ gridColumn: \`span \${mobile.colSpan}\`, gridRow: \`span \${mobile.rowSpan}\` }}>
                    <Block block={{ ...block, gridColumn: undefined, gridRow: undefined }} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>`;

export const generateVerticalLinksLayout = (params: LayoutParams): string => `
        <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-28 h-28 mb-5 overflow-hidden bg-gray-100" style={avatarStyle}>
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-none mb-2">{profile.name}</h1>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-wrap max-w-md leading-relaxed">{profile.bio}</p>
            ${
              params.showSocialInHeader && params.hasSocialAccounts
                ? `
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {profile.socialAccounts?.map((acc: any) => {
                const platform = SOCIAL_PLATFORMS[acc.platform]
                const Icon = platform?.icon
                const url = platform?.buildUrl(acc.handle)
                const showCount = profile.showFollowerCount && acc.followerCount
                return (
                  <a key={acc.platform} href={url} target="_blank" rel="noopener noreferrer"
                    className={\`\${showCount ? 'px-3 py-2' : 'w-10 h-10'} bg-white rounded-full shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform\`}
                    style={{ color: platform?.brandColor }}>
                    {Icon && <Icon size={20} />}
                    {showCount && (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatFollowerCount(acc.followerCount)}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>`
                : ''
            }
          </div>
          <div className="mt-6 space-y-4">
            {topLevelVerticalBlocks.map(block => {
              if (block.type === BlockType.COLLECTION) {
                const children = getCollectionChildren(block.id)
                const isExpanded = expandedCollections[block.id] ?? block.expandedByDefault !== false
                return (
                  <div key={block.id} className={\`rounded-[1.1rem] border border-gray-200 \${block.color || 'bg-white'} \${block.textColor || 'text-gray-900'} shadow-sm overflow-hidden\`} style={block.customBackground ? { background: block.customBackground } : undefined}>
                    <button
                      type="button"
                      onClick={() => setExpandedCollections(prev => ({ ...prev, [block.id]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-4 py-4 text-left"
                    >
                      <p className="text-sm font-bold">{block.title || 'Collection'}</p>
                      <span className={\`text-gray-500 transition-transform \${isExpanded ? 'rotate-180' : ''}\`}>⌄</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 bg-gray-50/80">
                        {children.map(child => {
                          const normalizedChild = child.type === BlockType.SOCIAL_ICON
                            ? { ...child, colSpan: 9, rowSpan: 2 }
                            : { ...child, colSpan: 9, gridColumn: undefined, gridRow: undefined }
                          const childHeight = Math.max(96, Math.min(320, child.rowSpan * 64))
                          return (
                            <div key={child.id} style={{ height: \`\${childHeight}px\` }} className="pt-3">
                              <Block block={{ ...normalizedChild, gridColumn: undefined, gridRow: undefined }} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              const normalizedBlock = block.type === 'SOCIAL_ICON'
                ? { ...block, colSpan: 9, rowSpan: 2 }
                : { ...block, colSpan: 9, gridColumn: undefined, gridRow: undefined }
              const blockHeight = Math.max(96, Math.min(320, block.rowSpan * 64))
              return (
                <div key={block.id} style={{ height: \`\${blockHeight}px\` }}>
                  <Block block={{ ...normalizedBlock, gridColumn: undefined, gridRow: undefined }} />
                </div>
              )
            })}
          </div>
        </div>`;

export const generateFooter = (showBranding: boolean): string =>
  showBranding
    ? `
        <footer className="w-full py-10 text-center">
          <p className="text-sm text-gray-400 font-medium">
            Made with <span className="text-red-400">♥</span> using{' '}
            <a href="https://github.com/yoanbernabeu/openbento" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-violet-500 transition-colors">OpenBento</a>
          </p>
        </footer>`
    : '';

export const generateBackgroundBlur = (
  backgroundImage: string | undefined,
  backgroundBlur: number | undefined
): string => {
  if (backgroundImage && backgroundBlur && backgroundBlur > 0) {
    return `<div className="fixed inset-0 z-0 pointer-events-none" style={{ backdropFilter: 'blur(${backgroundBlur}px)', WebkitBackdropFilter: 'blur(${backgroundBlur}px)' }} />`;
  }
  return '';
};
