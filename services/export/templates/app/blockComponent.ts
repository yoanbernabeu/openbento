/**
 * Generate Block component for the exported App.tsx
 */

export const generateBlockComponent = (): string => `
// Block component
const Block = ({ block }: { block: BlockData }) => {
  const { elementRef, tiltStyle, handleMouseMove, handleMouseLeave } = useTiltEffect(true)
  const [videos, setVideos] = useState(block.youtubeVideos || [])
  const [loading, setLoading] = useState(false)
  const mediaPos = block.mediaPosition || { x: 50, y: 50 }

  useEffect(() => {
    if (block.type === BlockType.SOCIAL && block.channelId && !block.youtubeVideos?.length) {
      setLoading(true)
      const rssUrl = \`https://www.youtube.com/feeds/videos.xml?channel_id=\${block.channelId}\`
      const proxyUrl = \`https://api.allorigins.win/raw?url=\${encodeURIComponent(rssUrl)}\`
      fetch(proxyUrl).then(r => r.text()).then(text => {
        const parser = new DOMParser()
        const xml = parser.parseFromString(text, 'text/xml')
        const entries = Array.from(xml.querySelectorAll('entry'))
        const vids = entries.slice(0, 4).map(e => {
          const id = e.getElementsByTagName('yt:videoId')[0]?.textContent || ''
          const title = e.getElementsByTagName('title')[0]?.textContent || ''
          return { id, title, thumbnail: \`https://img.youtube.com/vi/\${id}/mqdefault.jpg\` }
        })
        if (vids.length) setVideos(vids)
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [block.channelId, block.youtubeVideos, block.type])

  const getBorderRadius = () => {
    const minDim = Math.min(block.colSpan, block.rowSpan)
    if (minDim <= 1) return '0.5rem'
    if (minDim <= 2) return '0.625rem'
    if (minDim <= 3) return '0.75rem'
    return '0.875rem'
  }
  const borderRadius = getBorderRadius()

  const gridStyle: React.CSSProperties = {}
  if (block.gridColumn !== undefined) {
    gridStyle.gridColumnStart = block.gridColumn
    gridStyle.gridColumnEnd = block.gridColumn + block.colSpan
  }
  if (block.gridRow !== undefined) {
    gridStyle.gridRowStart = block.gridRow
    gridStyle.gridRowEnd = block.gridRow + block.rowSpan
  }

  const handleClick = () => {
    let url = block.content
    if (block.type === BlockType.SOCIAL && block.socialPlatform && block.socialHandle) {
      url = SOCIAL_PLATFORMS[block.socialPlatform]?.buildUrl(block.socialHandle)
    } else if (block.channelId) {
      url = \`https://youtube.com/channel/\${block.channelId}\`
    }
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const isYoutube = block.type === BlockType.SOCIAL && block.channelId
  const activeVideoId = block.youtubeVideoId || videos[0]?.id
  const isRichYT = isYoutube && activeVideoId && block.youtubeMode !== 'grid' && block.youtubeMode !== 'list'
  const isYTGrid = isYoutube && (block.youtubeMode === 'grid' || block.youtubeMode === 'list')
  const isLinkImg = block.type === BlockType.LINK && block.imageUrl

  if (block.type === BlockType.SPACER) return <div style={{ borderRadius, ...gridStyle }} className="h-full" />

  if (block.type === BlockType.SOCIAL_ICON) {
    const platform = SOCIAL_PLATFORMS[block.socialPlatform || 'custom']
    const Icon = platform?.icon
    const url = block.socialHandle ? platform?.buildUrl(block.socialHandle) : ''
    return (
      <a href={url || undefined} target="_blank" rel="noopener noreferrer" onClick={handleClick}
        className={\`bento-item relative h-full \${block.color || 'bg-white'} flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md transition-all\`}
        style={{ borderRadius, ...gridStyle, ...(block.customBackground ? { background: block.customBackground } : {}) }}>
        {Icon && <span style={{ color: platform.brandColor }}><Icon size={24} /></span>}
      </a>
    )
  }

  if (isYTGrid) {
    return (
      <div onClick={handleClick} style={{ borderRadius, ...gridStyle, ...(block.customBackground ? { background: block.customBackground } : {}) }}
        className={\`bento-item group cursor-pointer h-full \${block.color || 'bg-white'} ring-1 ring-black/5 shadow-sm hover:shadow-xl transition-all\`}>
        <div className="w-full h-full flex flex-col p-2 md:p-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <div className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center"><Youtube size={12} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[10px] md:text-xs font-bold text-gray-900 truncate">{block.channelTitle || 'YouTube'}</h3>
              <span className="text-[8px] text-gray-400">Latest videos</span>
            </div>
          </div>
          {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" size={16} /></div> : (
            <div className="flex-1 grid grid-cols-2 gap-1 overflow-hidden">
              {videos.slice(0, 4).map((v, i) => (
                <a key={i} href={\`https://youtube.com/watch?v=\${v.id}\`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="relative overflow-hidden rounded bg-gray-100 group/vid">
                  <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" loading="lazy" width="320" height="180" />
                  <div className="absolute inset-0 bg-black/20 group-hover/vid:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover/vid:opacity-100 transition-opacity">
                      <Play size={10} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  let bgStyle: React.CSSProperties = block.customBackground ? { background: block.customBackground } : {}
  if (isRichYT) bgStyle = { backgroundImage: \`url(https://img.youtube.com/vi/\${activeVideoId}/maxresdefault.jpg)\`, backgroundSize: 'cover', backgroundPosition: 'center' }
  else if (isLinkImg && block.imageUrl) bgStyle = { backgroundImage: \`url(\${block.imageUrl})\`, backgroundSize: 'cover', backgroundPosition: \`\${mediaPos.x}% \${mediaPos.y}%\` }

  return (
    <div onClick={handleClick} style={{ ...gridStyle }} className="cursor-pointer h-full transform-gpu">
      <div ref={elementRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        style={{ ...bgStyle, borderRadius, ...tiltStyle, width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
        className={\`bento-item group relative overflow-hidden w-full h-full \${!block.customBackground && !isLinkImg && !isRichYT ? (block.color || 'bg-white') : ''} \${block.textColor || 'text-gray-900'} ring-1 ring-black/5 shadow-sm transition-all\`}>
        <div className="absolute inset-0 pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,0.25) 0%, transparent 60%)' }} />
        {(isRichYT || isLinkImg) && (block.title || block.subtext) && (
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-0" />
        )}
        <div className="w-full h-full relative z-10">
          {block.type === BlockType.MEDIA && block.imageUrl ? (
            <div className="w-full h-full relative overflow-hidden">
              {blockIsVideo[block.id] ? (
                <video src={block.imageUrl} className="full-img" style={{ objectPosition: \`\${mediaPos.x}% \${mediaPos.y}%\` }} autoPlay loop muted playsInline />
              ) : (
                <picture>
                  {blockWebpUrls[block.id] && <source srcSet={blockWebpUrls[block.id]!} type="image/webp" />}
                  <img src={block.imageUrl} alt={block.title || ''} className="full-img" style={{ objectPosition: \`\${mediaPos.x}% \${mediaPos.y}%\` }} loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                </picture>
              )}
              {block.title && <div className="media-overlay"><p className="media-title text-sm">{block.title}</p>{block.subtext && <p className="media-subtext">{block.subtext}</p>}</div>}
            </div>
          ) : block.type === BlockType.MAP ? (
            <div className="w-full h-full relative bg-gray-100 overflow-hidden">
              <iframe width="100%" height="100%" className="opacity-95 grayscale-[20%] group-hover:grayscale-0 transition-all"
                src={\`https://maps.google.com/maps?q=\${encodeURIComponent(block.content || 'Paris')}&t=&z=13&ie=UTF8&iwloc=&output=embed\`} loading="lazy" sandbox="allow-scripts allow-same-origin" />
              {block.title && <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent"><p className="font-semibold text-white text-sm">{block.title}</p></div>}
            </div>
          ) : isRichYT ? (
            <div className="w-full h-full relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play size={16} className="text-white ml-0.5" fill="white" />
                </div>
              </div>
              {(block.channelTitle || block.title) && <div className="absolute bottom-0 left-0 right-0 p-3"><h3 className="font-semibold text-white text-sm drop-shadow-lg">{block.channelTitle || block.title}</h3></div>}
            </div>
          ) : (
            <div className="p-3 h-full flex flex-col justify-between">
              {block.type === BlockType.SOCIAL && block.socialPlatform && (() => {
                const platform = SOCIAL_PLATFORMS[block.socialPlatform]
                const Icon = platform?.icon
                return Icon ? (
                  <div className={\`w-7 h-7 rounded-lg flex items-center justify-center \${block.textColor === 'text-white' || isLinkImg ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-100'}\`}
                    style={{ color: block.textColor === 'text-brand' ? platform.brandColor : undefined }}>
                    <Icon size={14} />
                  </div>
                ) : null
              })()}
              <div className={block.type === BlockType.TEXT ? 'flex flex-col justify-center h-full' : 'mt-auto'}>
                <h3 className={\`font-bold leading-tight \${isLinkImg ? 'text-white drop-shadow-lg' : ''}\`}>{block.title}</h3>
                {block.subtext && <p className={\`text-xs mt-1 \${isLinkImg ? 'text-white/80' : 'opacity-60'}\`}>{block.subtext}</p>}
                {block.type === BlockType.TEXT && block.content && <p className="opacity-70 mt-2 text-sm whitespace-pre-wrap">{block.content}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
`;
