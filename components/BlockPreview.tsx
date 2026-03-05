import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BlockData, BlockType } from '../types';
import { Youtube, Play, Loader2 } from 'lucide-react';
import { getSocialPlatformOption, inferSocialPlatformFromUrl } from '../socialPlatforms';
import { openSafeUrl, isValidYouTubeChannelId, isValidLocationString } from '../utils/security';
import FluidTextEffect from './FluidTextEffect';

// Apple TV style 3D tilt effect hook
const useTiltEffect = (isEnabled: boolean = true) => {
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isEnabled || !elementRef.current) return;

      const rect = elementRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;

      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      const shadowX = rotateY * 1.5;
      const shadowY = rotateX * -1.5;

      setTiltStyle({
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
        boxShadow: `${shadowX}px ${shadowY}px 25px rgba(0,0,0,0.15), 0 8px 30px rgba(0,0,0,0.1)`,
        transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
        '--glare-x': `${glareX}%`,
        '--glare-y': `${glareY}%`,
      } as React.CSSProperties);
    },
    [isEnabled]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isEnabled) return;
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      transition: 'transform 0.5s ease-out, box-shadow 0.5s ease-out',
    });
  }, [isEnabled]);

  const handleMouseEnter = useCallback(() => {
    if (!isEnabled) return;
    setTiltStyle({ transition: 'transform 0.1s ease-out' });
  }, [isEnabled]);

  return { elementRef, tiltStyle, handleMouseMove, handleMouseLeave, handleMouseEnter };
};

interface BlockPreviewProps {
  block: BlockData;
  enableTiltEffect?: boolean;
  onClickBlock?: (blockId: string, url?: string) => void;
}

const BlockPreview: React.FC<BlockPreviewProps> = ({
  block,
  enableTiltEffect = true,
  onClickBlock,
}) => {
  const {
    elementRef: tiltRef,
    tiltStyle,
    handleMouseMove: onTiltMove,
    handleMouseLeave: onTiltLeave,
    handleMouseEnter: onTiltEnter,
  } = useTiltEffect(enableTiltEffect);
  const [fetchedVideos, setFetchedVideos] = useState<
    Array<{ id: string; title: string; thumbnail: string }>
  >(block.youtubeVideos || []);
  const [isLoading, setIsLoading] = useState(false);

  const mediaPosition = block.mediaPosition || { x: 50, y: 50 };

  // YouTube feed fetcher
  useEffect(() => {
    if (
      block.type === BlockType.SOCIAL &&
      block.channelId &&
      (!block.youtubeVideos || block.youtubeVideos.length === 0)
    ) {
      let isMounted = true;
      const fetchFeed = async () => {
        setIsLoading(true);
        try {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${block.channelId}`;
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
          const response = await fetch(proxyUrl);
          if (response.ok && isMounted) {
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            const entries = Array.from(xmlDoc.querySelectorAll('entry'));
            const vids = entries.slice(0, 4).map((entry) => {
              const vidId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
              const vidTitle = entry.getElementsByTagName('title')[0]?.textContent || '';
              return {
                id: vidId,
                title: vidTitle,
                thumbnail: `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`,
              };
            });
            if (vids.length > 0) setFetchedVideos(vids);
          }
        } catch (e) {
          console.warn('Auto-fetch warning:', e);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };
      fetchFeed();
      return () => {
        isMounted = false;
      };
    } else {
      setFetchedVideos(block.youtubeVideos || []);
    }
  }, [block.channelId, block.youtubeVideos, block.type]);

  // Border radius based on block size
  const getBorderRadius = () => {
    const minDim = Math.min(block.colSpan, block.rowSpan);
    if (minDim <= 1) return '0.5rem';
    if (minDim <= 2) return '0.625rem';
    if (minDim <= 3) return '0.75rem';
    return '0.875rem';
  };
  const borderRadius = getBorderRadius();

  // Size tier for responsive text
  const sizeTier = (() => {
    const minDim = Math.min(block.colSpan, block.rowSpan);
    const area = block.colSpan * block.rowSpan;
    if (minDim <= 1 || area <= 4) return 'xs';
    if (minDim <= 2 || area <= 8) return 'sm';
    if (minDim <= 3 || area <= 12) return 'md';
    return 'lg';
  })();

  const textScale = {
    titleText: {
      xs: 'text-[10px] md:text-sm',
      sm: 'text-xs md:text-base',
      md: 'text-sm md:text-lg lg:text-xl',
      lg: 'text-base md:text-xl lg:text-2xl',
    },
    titleDefault: {
      xs: 'text-[9px] md:text-xs',
      sm: 'text-[10px] md:text-sm',
      md: 'text-xs md:text-base',
      lg: 'text-sm md:text-lg',
    },
    subtext: {
      xs: 'text-[7px] md:text-[9px]',
      sm: 'text-[8px] md:text-[10px]',
      md: 'text-[9px] md:text-xs',
      lg: 'text-[10px] md:text-sm',
    },
    body: {
      xs: 'text-[8px] md:text-[10px]',
      sm: 'text-[9px] md:text-xs',
      md: 'text-[10px] md:text-sm',
      lg: 'text-xs md:text-base',
    },
    overlayTitle: {
      xs: 'text-[8px] md:text-[10px]',
      sm: 'text-[9px] md:text-xs',
      md: 'text-[10px] md:text-sm lg:text-base',
      lg: 'text-xs md:text-base lg:text-lg',
    },
    overlaySubtext: {
      xs: 'text-[6px] md:text-[8px]',
      sm: 'text-[7px] md:text-[9px]',
      md: 'text-[8px] md:text-[10px]',
      lg: 'text-[9px] md:text-xs',
    },
  };
  const textSizes = {
    titleText: textScale.titleText[sizeTier],
    titleDefault: textScale.titleDefault[sizeTier],
    subtext: textScale.subtext[sizeTier],
    body: textScale.body[sizeTier],
    overlayTitle: textScale.overlayTitle[sizeTier],
    overlaySubtext: textScale.overlaySubtext[sizeTier],
  };

  // Grid positioning
  const gridPositionStyle: React.CSSProperties = {};
  if (block.gridColumn !== undefined) {
    gridPositionStyle.gridColumnStart = block.gridColumn;
    gridPositionStyle.gridColumnEnd = block.gridColumn + block.colSpan;
  }
  if (block.gridRow !== undefined) {
    gridPositionStyle.gridRowStart = block.gridRow;
    gridPositionStyle.gridRowEnd = block.gridRow + block.rowSpan;
  }
  if (block.zIndex !== undefined) {
    gridPositionStyle.zIndex = block.zIndex;
  }

  // Click handler
  const handleClick = () => {
    let url = block.content;
    if (block.type === BlockType.SOCIAL && block.socialPlatform && block.socialHandle) {
      const option = getSocialPlatformOption(block.socialPlatform);
      url = option?.buildUrl(block.socialHandle);
    } else if (
      block.type === BlockType.SOCIAL &&
      block.channelId &&
      isValidYouTubeChannelId(block.channelId)
    ) {
      url = `https://youtube.com/channel/${block.channelId}`;
    }
    if (onClickBlock) {
      onClickBlock(block.id, url);
    }
    openSafeUrl(url);
  };

  // Detection helpers
  const activeVideos = fetchedVideos.length > 0 ? fetchedVideos : [];
  const activeVideoId =
    block.youtubeVideoId || (activeVideos.length > 0 ? activeVideos[0].id : undefined);
  const isYoutube =
    block.type === BlockType.SOCIAL &&
    (!!block.channelId || block.title?.toLowerCase().includes('youtube'));
  const isRichYoutube =
    isYoutube && activeVideoId && block.youtubeMode !== 'grid' && block.youtubeMode !== 'list';
  const isYoutubeGrid = isYoutube && (block.youtubeMode === 'grid' || block.youtubeMode === 'list');
  const isLinkWithImage = block.type === BlockType.LINK && block.imageUrl;

  // Background style
  let finalStyle: React.CSSProperties = block.customBackground
    ? { background: block.customBackground }
    : {};
  if (isRichYoutube) {
    finalStyle = {
      backgroundImage: `url(https://img.youtube.com/vi/${activeVideoId}/maxresdefault.jpg)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  } else if (isLinkWithImage && block.imageUrl) {
    finalStyle = {
      backgroundImage: `url(${block.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: `${mediaPosition.x}% ${mediaPosition.y}%`,
    };
  }

  // ===== SPACER BLOCK =====
  if (block.type === BlockType.SPACER) {
    return <div className="h-full" style={{ borderRadius, ...gridPositionStyle }} />;
  }

  // ===== SOCIAL ICON BLOCK =====
  if (block.type === BlockType.SOCIAL_ICON) {
    const platform = block.socialPlatform;
    const handle = block.socialHandle || '';
    const option = platform ? getSocialPlatformOption(platform) : undefined;
    const BrandIcon = option?.brandIcon;
    const FallbackIcon = option?.icon;
    const brandColor = option?.brandColor;
    const url = option && handle ? option.buildUrl(handle) : '';
    const useColor = !block.textColor || block.textColor === 'text-brand';
    const iconColor = useColor
      ? brandColor
      : block.textColor === 'text-black'
        ? '#000000'
        : block.textColor === 'text-gray-700'
          ? '#374151'
          : undefined;

    return (
      <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (onClickBlock) {
            e.preventDefault();
            onClickBlock(block.id, url);
            openSafeUrl(url);
          }
        }}
        className={`bento-item relative overflow-hidden h-full ${block.color || 'bg-white'} transition-all duration-200 group flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md`}
        style={{
          ...gridPositionStyle,
          borderRadius,
          ...(block.customBackground ? { background: block.customBackground } : {}),
        }}
      >
        <span className="group-hover:scale-110 transition-transform" style={{ color: iconColor }}>
          {BrandIcon ? <BrandIcon size={24} /> : FallbackIcon ? <FallbackIcon size={24} /> : null}
        </span>
      </a>
    );
  }

  // ===== YOUTUBE GRID/LIST =====
  if (isYoutubeGrid) {
    const displayVideos = activeVideos.slice(0, 4);
    return (
      <div
        onClick={handleClick}
        className={`bento-item group relative overflow-hidden ${block.color || 'bg-white'} cursor-pointer h-full ring-1 ring-black/5 shadow-sm hover:shadow-xl transition-all duration-300`}
        style={{
          ...gridPositionStyle,
          borderRadius,
          ...(block.customBackground ? { background: block.customBackground } : {}),
        }}
      >
        <div className="w-full h-full flex flex-col p-2 md:p-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <Youtube size={12} className="md:w-[14px] md:h-[14px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[10px] md:text-xs font-bold text-gray-900 truncate">
                {block.channelTitle || 'YouTube'}
              </h3>
              <span className="text-[8px] md:text-[9px] text-gray-400 font-medium">
                Latest videos
              </span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-300" size={16} />
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-1 md:gap-1.5 overflow-hidden">
              {displayVideos.length > 0 ? (
                displayVideos.map((vid, idx) => (
                  <a
                    key={idx}
                    href={`https://youtube.com/watch?v=${vid.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative overflow-hidden group/vid rounded bg-gray-100 block"
                  >
                    <img
                      src={vid.thumbnail}
                      alt={vid.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover/vid:bg-black/40 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-all">
                      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <Play size={10} className="md:w-3 md:h-3 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="col-span-2 flex items-center justify-center text-[9px] text-gray-400">
                  <span>No videos</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== STANDARD BLOCKS =====
  const tiltWrapperStyle: React.CSSProperties = enableTiltEffect
    ? { ...tiltStyle, width: '100%', height: '100%', transformStyle: 'preserve-3d' }
    : {};

  return (
    <div
      onClick={handleClick}
      style={{ ...gridPositionStyle }}
      className={`cursor-pointer h-full ${enableTiltEffect ? 'transform-gpu' : ''}`}
    >
      <div
        ref={enableTiltEffect ? tiltRef : undefined}
        onMouseMove={enableTiltEffect ? onTiltMove : undefined}
        onMouseLeave={enableTiltEffect ? onTiltLeave : undefined}
        onMouseEnter={enableTiltEffect ? onTiltEnter : undefined}
        style={{ ...finalStyle, borderRadius, ...tiltWrapperStyle }}
        className={`bento-item group relative overflow-hidden w-full h-full ${!block.customBackground && !isLinkWithImage && !isRichYoutube ? block.color || 'bg-white' : ''} ${block.textColor || 'text-gray-900'} ring-1 ring-black/5 shadow-sm ${!enableTiltEffect ? 'hover:shadow-xl' : ''} transition-all duration-300`}
      >
        {/* Glare effect */}
        {enableTiltEffect && (
          <div
            className="absolute inset-0 pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,0.25) 0%, transparent 60%)`,
            }}
          />
        )}

        {/* Gradient overlay for images */}
        {(isRichYoutube || isLinkWithImage) &&
          (block.title || block.subtext || block.channelTitle) && (
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-0 pointer-events-none" />
          )}

        <div className="w-full h-full pointer-events-none relative z-10">
          {/* MEDIA BLOCK */}
          {block.type === BlockType.MEDIA && block.imageUrl && !isLinkWithImage ? (
            <div className="w-full h-full relative overflow-hidden">
              {/\.(mp4|webm|ogg|mov)$/i.test(block.imageUrl) ? (
                <video
                  src={block.imageUrl}
                  className="full-img"
                  style={{ objectPosition: `${mediaPosition.x}% ${mediaPosition.y}%` }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={block.imageUrl}
                  alt={block.title || ''}
                  className="full-img"
                  style={{ objectPosition: `${mediaPosition.x}% ${mediaPosition.y}%` }}
                  draggable={false}
                />
              )}
              {block.title && (
                <div className="media-overlay">
                  <p className={`media-title ${textSizes.overlayTitle}`}>{block.title}</p>
                  {block.subtext && (
                    <p className={`media-subtext ${textSizes.overlaySubtext}`}>{block.subtext}</p>
                  )}
                </div>
              )}
            </div>
          ) : block.type === BlockType.MAP ? (
            /* MAP BLOCK */
            <div className="w-full h-full relative bg-gray-100 overflow-hidden">
              {isValidLocationString(block.content) ? (
                <iframe
                  width="100%"
                  height="100%"
                  className="opacity-95 grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(block.content || 'Paris')}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                ></iframe>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  Invalid location
                </div>
              )}
              {block.title && (
                <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 bg-gradient-to-t from-black/60 to-transparent">
                  <p className={`font-semibold text-white drop-shadow ${textSizes.overlayTitle}`}>
                    {block.title}
                  </p>
                </div>
              )}
            </div>
          ) : block.type === BlockType.FLUID_TEXT ? (
            <div className="w-full h-full pointer-events-auto">
              <FluidTextEffect
                text={block.title || 'Text'}
                fontSize={block.fluidTextFontSize ?? 0.33}
                colorClass={block.color}
                customBackground={block.customBackground}
              />
            </div>
          ) : isRichYoutube ? (
            /* YOUTUBE SINGLE */
            <div className="w-full h-full relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-full bg-red-500 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <Play
                    size={12}
                    className="md:w-4 md:h-4 lg:w-5 lg:h-5 text-white ml-0.5"
                    fill="white"
                  />
                </div>
              </div>
              {(block.channelTitle || block.title) && (
                <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                  <h3
                    className={`font-semibold text-white leading-tight drop-shadow-lg line-clamp-1 ${textSizes.overlayTitle}`}
                  >
                    {block.channelTitle || block.title}
                  </h3>
                </div>
              )}
            </div>
          ) : (
            /* DEFAULT BLOCK (Link, Social, Text) */
            <div className="p-2 md:p-3 lg:p-4 h-full flex flex-col justify-between relative">
              {block.type === BlockType.SOCIAL &&
                (() => {
                  const platform =
                    block.socialPlatform ?? inferSocialPlatformFromUrl(block.content);
                  const option = platform ? getSocialPlatformOption(platform) : undefined;
                  const BrandIcon = option?.brandIcon;
                  const FallbackIcon = option?.icon;
                  const brandColor = option?.brandColor;
                  const useColor = block.textColor === 'text-brand';
                  const iconColor = useColor ? brandColor : undefined;
                  return (
                    <div
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center shrink-0 ${block.textColor === 'text-white' || isLinkWithImage ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-gray-100'}`}
                      style={iconColor ? { color: iconColor } : undefined}
                    >
                      {BrandIcon ? (
                        <BrandIcon size={14} />
                      ) : FallbackIcon ? (
                        <FallbackIcon size={14} />
                      ) : null}
                    </div>
                  );
                })()}
              <div
                className={`${block.type === BlockType.TEXT ? 'flex flex-col justify-center h-full' : 'mt-auto'}`}
              >
                <h3
                  className={`font-bold leading-tight tracking-tight ${block.type === BlockType.TEXT ? `${textSizes.titleText} mb-2` : textSizes.titleDefault} ${isLinkWithImage ? 'text-white drop-shadow-lg' : ''}`}
                >
                  {block.channelTitle || block.title}
                </h3>
                {block.subtext && (
                  <p
                    className={`${textSizes.subtext} mt-1 font-medium ${isLinkWithImage ? 'text-white/80 drop-shadow' : 'opacity-60'}`}
                  >
                    {block.subtext}
                  </p>
                )}
                {block.type === BlockType.TEXT && block.content && (
                  <p
                    className={`opacity-70 mt-2 whitespace-pre-wrap leading-relaxed ${textSizes.body}`}
                  >
                    {block.content}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockPreview;
