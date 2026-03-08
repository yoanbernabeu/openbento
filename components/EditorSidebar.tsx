import React, { useState } from 'react';
import { BlockData, BlockType, SocialPlatform, UserProfile } from '../types';
import { BASE_COLORS } from '../constants';
import ColorPickerWidget from './ColorPickerWidget';
import {
  X,
  Link,
  MapPin,
  Image as ImageIcon,
  Github,
  Upload,
  Trash2,
  Type as TypeIcon,
  MoveVertical,
  Youtube,
  ExternalLink,
  RefreshCw,
  Loader2,
  Grid3X3,
  Square,
  List,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import {
  buildSocialUrl,
  extractHandleFromUrl,
  getSocialDisplayHandle,
  getSocialPlatformOption,
  inferSocialPlatformFromUrl,
  normalizeSocialHandle,
  SOCIAL_PLATFORM_OPTIONS,
} from '../socialPlatforms';

interface EditorSidebarProps {
  profile: UserProfile;
  addBlock: (type: BlockType) => void;
  editingBlock: BlockData | null;
  updateBlock: (b: BlockData) => void;
  onDelete: (id: string) => void;
  closeEdit: () => void;
  isOpen: boolean;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  profile,
  addBlock,
  editingBlock,
  updateBlock,
  onDelete,
  closeEdit,
  isOpen,
}) => {
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleBlockImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingBlock) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateBlock({ ...editingBlock, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const isYouTubeActive =
    editingBlock?.type === BlockType.SOCIAL &&
    !!(editingBlock.channelId && editingBlock.channelId.length > 0);

  const resolvedSocialPlatform: SocialPlatform | undefined =
    editingBlock?.type === BlockType.SOCIAL
      ? (editingBlock.socialPlatform ?? inferSocialPlatformFromUrl(editingBlock.content) ?? 'x')
      : undefined;

  const resolvedSocialHandle: string =
    editingBlock?.type === BlockType.SOCIAL
      ? (editingBlock.socialHandle ??
        extractHandleFromUrl(resolvedSocialPlatform, editingBlock.content) ??
        '')
      : '';

  const resolvedSocialOption = getSocialPlatformOption(resolvedSocialPlatform);
  const resolvedSocialUrl = buildSocialUrl(resolvedSocialPlatform, resolvedSocialHandle);

  const getContrastTextClass = (hexColor: string) => {
    const sanitized = hexColor.replace('#', '');
    if (sanitized.length !== 6) return 'text-gray-900';

    const r = parseInt(sanitized.slice(0, 2), 16);
    const g = parseInt(sanitized.slice(2, 4), 16);
    const b = parseInt(sanitized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.6 ? 'text-gray-900' : 'text-white';
  };

  const fetchLatestFromRSS = async () => {
    const cId = editingBlock?.channelId;
    if (!cId) return;

    setIsFetching(true);
    setFetchError(null);

    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${cId}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Network error');

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      const entries = Array.from(xmlDoc.querySelectorAll('entry'));
      const authorName = xmlDoc.querySelector('author > name')?.textContent;

      if (entries.length > 0 && editingBlock) {
        const videos = entries.slice(0, 4).map((entry) => {
          const vidId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
          const vidTitle = entry.getElementsByTagName('title')[0]?.textContent || '';
          return {
            id: vidId,
            title: vidTitle,
            thumbnail: `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`,
          };
        });

        const latestVideo = videos[0];

        updateBlock({
          ...editingBlock,
          youtubeVideoId: latestVideo.id,
          youtubeVideos: videos,
          content: `https://www.youtube.com/watch?v=${latestVideo.id}`,
          title: authorName || editingBlock.title,
          subtext: latestVideo.title,
          channelTitle: authorName || '',
        });
      } else {
        setFetchError('No videos found.');
      }
    } catch (error) {
      console.error(error);
      setFetchError('Failed to fetch. Check ID.');
    } finally {
      setIsFetching(false);
    }
  };

  const autoFillSocialText = (
    prevPlatform: SocialPlatform | undefined,
    prevHandle: string,
    nextPlatform: SocialPlatform,
    nextHandle: string
  ): Partial<Pick<BlockData, 'title' | 'subtext'>> => {
    if (!editingBlock) return {};
    const prevLabel = getSocialPlatformOption(prevPlatform)?.label;
    const nextLabel = getSocialPlatformOption(nextPlatform)?.label;

    const prevAutoSub = getSocialDisplayHandle(prevPlatform, prevHandle);
    const nextAutoSub = getSocialDisplayHandle(nextPlatform, nextHandle);

    const title =
      !editingBlock.title ||
      editingBlock.title === 'Social' ||
      (prevLabel && editingBlock.title === prevLabel)
        ? (nextLabel ?? editingBlock.title)
        : editingBlock.title;

    const subtext =
      !editingBlock.subtext || (prevAutoSub && editingBlock.subtext === prevAutoSub)
        ? nextAutoSub || editingBlock.subtext
        : editingBlock.subtext;

    return { title, subtext };
  };

  const handleSelectSocialPlatform = (platform: SocialPlatform) => {
    if (!editingBlock || editingBlock.type !== BlockType.SOCIAL) return;

    const prevPlatform = resolvedSocialPlatform;
    const prevHandle = resolvedSocialHandle;
    const prevKind = getSocialPlatformOption(prevPlatform)?.kind;
    const nextKind = getSocialPlatformOption(platform)?.kind;

    const nextHandleRaw = prevKind !== nextKind ? '' : prevHandle;
    const nextHandle = normalizeSocialHandle(platform, nextHandleRaw);
    const nextUrl = buildSocialUrl(platform, nextHandle);

    const { title, subtext } = autoFillSocialText(prevPlatform, prevHandle, platform, nextHandle);

    updateBlock({
      ...editingBlock,
      socialPlatform: platform,
      socialHandle: nextHandle,
      content: nextUrl,
      title,
      subtext,

      // Switch to platform mode => disable YouTube preview mode
      channelId: undefined,
      youtubeVideoId: undefined,
      youtubeVideos: undefined,
      youtubeMode: undefined,
      channelTitle: undefined,
    });
  };

  const handleChangeSocialInput = (rawInput: string) => {
    if (!editingBlock || editingBlock.type !== BlockType.SOCIAL) return;

    // Allow pasting full URLs
    if (/^https?:\/\//i.test(rawInput.trim())) {
      const inferred = inferSocialPlatformFromUrl(rawInput) ?? 'custom';
      const extracted = extractHandleFromUrl(inferred, rawInput);
      const nextHandle = normalizeSocialHandle(inferred, extracted ?? rawInput);

      const nextUrl = extracted
        ? buildSocialUrl(inferred, nextHandle)
        : buildSocialUrl('custom', rawInput);
      const { title, subtext } = autoFillSocialText(
        resolvedSocialPlatform,
        resolvedSocialHandle,
        inferred,
        nextHandle
      );

      updateBlock({
        ...editingBlock,
        socialPlatform: inferred,
        socialHandle: nextHandle,
        content: nextUrl,
        title,
        subtext,

        // Keep this in platform mode if user is pasting URLs
        channelId: undefined,
        youtubeVideoId: undefined,
        youtubeVideos: undefined,
        youtubeMode: undefined,
        channelTitle: undefined,
      });
      return;
    }

    const platform = resolvedSocialPlatform ?? 'x';
    const nextHandle = normalizeSocialHandle(platform, rawInput);
    const nextUrl = buildSocialUrl(platform, nextHandle);
    const { title, subtext } = autoFillSocialText(
      platform,
      resolvedSocialHandle,
      platform,
      nextHandle
    );

    updateBlock({
      ...editingBlock,
      socialPlatform: platform,
      socialHandle: nextHandle,
      content: nextUrl,
      title,
      subtext,

      // Platform mode
      channelId: undefined,
      youtubeVideoId: undefined,
      youtubeVideos: undefined,
      youtubeMode: undefined,
      channelTitle: undefined,
    });
  };

  const isSelectedColor = (c: any) => {
    if (!editingBlock) return false;
    if (editingBlock.customBackground) return editingBlock.customBackground === c.hex;
    return editingBlock.color === c.bg;
  };

  return (
    <aside
      role="complementary"
      aria-label="Block editor sidebar"
      className={`fixed right-0 top-0 h-screen w-full md:w-[400px] bg-white z-50 shadow-xl transform transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col border-l border-gray-200
	        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
        <div>
          <h2 className="font-bold text-base text-gray-900 tracking-tight">
            {editingBlock ? 'Edit Block' : 'Edit'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {editingBlock ? 'Customize your block' : 'Build your layout'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeEdit}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-7 no-scrollbar pb-20">
        {/* EDITING A SPECIFIC BLOCK */}
        {editingBlock ? (
          <div className="space-y-8 animate-fade-in">
            {/* Input Group */}
            <div className="space-y-5">
              {/* 1. Title (Not for spacers or social icons) */}
              {editingBlock.type !== BlockType.SPACER &&
                editingBlock.type !== BlockType.SOCIAL_ICON && (
                  <div>
                    <label
                      htmlFor="block-title-input"
                      className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                    >
                      Title
                    </label>
                    <input
                      id="block-title-input"
                      type="text"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium"
                      value={editingBlock.title || ''}
                      onChange={(e) => updateBlock({ ...editingBlock, title: e.target.value })}
                      placeholder="Label your block"
                    />
                  </div>
                )}

              {/* 2a. SOCIAL_ICON BLOCK: Simple platform + handle */}
              {editingBlock.type === BlockType.SOCIAL_ICON && (
                <div className="space-y-3">
                  <div>
                    <fieldset>
                      <legend className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Platform
                      </legend>
                      <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                        {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
                          const active = platform.id === editingBlock.socialPlatform;
                          const BrandIcon = platform.brandIcon;
                          const FallbackIcon = platform.icon;
                          return (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() =>
                                updateBlock({ ...editingBlock, socialPlatform: platform.id })
                              }
                              className={`p-1.5 rounded-lg border transition-all flex flex-col items-center gap-0.5 ${active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                              title={platform.label}
                            >
                              {BrandIcon ? (
                                <span style={{ color: active ? '#ffffff' : platform.brandColor }}>
                                  <BrandIcon size={14} />
                                </span>
                              ) : (
                                <span className={active ? 'text-white' : 'text-gray-500'}>
                                  <FallbackIcon size={14} />
                                </span>
                              )}
                              <span className="text-[8px] font-medium leading-tight truncate w-full text-center">
                                {platform.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>

                  <div>
                    <label
                      htmlFor="social-icon-handle-input"
                      className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1"
                    >
                      {getSocialPlatformOption(editingBlock.socialPlatform)?.kind === 'url'
                        ? 'URL'
                        : 'Handle'}
                    </label>
                    <input
                      id="social-icon-handle-input"
                      type="text"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all font-medium text-gray-600"
                      value={editingBlock.socialHandle || ''}
                      onChange={(e) =>
                        updateBlock({ ...editingBlock, socialHandle: e.target.value })
                      }
                      placeholder={
                        getSocialPlatformOption(editingBlock.socialPlatform)?.placeholder ??
                        'yourhandle'
                      }
                    />
                  </div>

                  {/* Icon Color Style */}
                  <fieldset>
                    <legend className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Icon Style
                    </legend>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label="Set icon color to brand color"
                        aria-pressed={editingBlock.textColor === 'text-brand'}
                        onClick={() => updateBlock({ ...editingBlock, textColor: 'text-brand' })}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          !editingBlock.textColor || editingBlock.textColor === 'text-brand'
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            background:
                              getSocialPlatformOption(editingBlock.socialPlatform)?.brandColor ||
                              '#6366f1',
                          }}
                        />
                        Color
                      </button>
                      <button
                        type="button"
                        aria-label="Set icon color to Grey"
                        aria-pressed={editingBlock.textColor === 'text-gray-700'}
                        onClick={() => updateBlock({ ...editingBlock, textColor: 'text-gray-700' })}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          editingBlock.textColor === 'text-gray-700'
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-gray-500" />
                        Grey
                      </button>
                      <button
                        type="button"
                        aria-label="Set icon color to Black"
                        aria-pressed={editingBlock.textColor === 'text-black'}
                        onClick={() => updateBlock({ ...editingBlock, textColor: 'text-black' })}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          editingBlock.textColor === 'text-black'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full bg-black" />
                        Black
                      </button>
                    </div>
                  </fieldset>

                  {editingBlock.socialHandle &&
                    buildSocialUrl(editingBlock.socialPlatform, editingBlock.socialHandle) && (
                      <div className="bg-violet-50 border border-violet-200 rounded-lg p-2">
                        <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">
                          Preview
                        </p>
                        <a
                          href={buildSocialUrl(
                            editingBlock.socialPlatform,
                            editingBlock.socialHandle
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-violet-700 hover:text-violet-900 break-all underline"
                        >
                          {buildSocialUrl(editingBlock.socialPlatform, editingBlock.socialHandle)}
                        </a>
                      </div>
                    )}
                </div>
              )}

              {/* 2b. SOCIAL BLOCK: Mode + Platform */}
              {editingBlock.type === BlockType.SOCIAL && (
                <div className="space-y-4">
                  <div className="p-1 bg-gray-100 rounded-xl flex">
                    <button
                      type="button"
                      aria-pressed={!isYouTubeActive}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isYouTubeActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                      onClick={() =>
                        updateBlock({
                          ...editingBlock,
                          channelId: undefined,
                          youtubeVideoId: undefined,
                          youtubeVideos: undefined,
                          youtubeMode: undefined,
                          channelTitle: undefined,
                        })
                      }
                    >
                      Platforms
                    </button>
                    <button
                      type="button"
                      aria-pressed={isYouTubeActive}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${isYouTubeActive ? 'bg-red-500 shadow text-white' : 'text-gray-500 hover:text-red-600'}`}
                      onClick={() =>
                        updateBlock({
                          ...editingBlock,
                          socialPlatform: 'youtube',
                          channelId: editingBlock.channelId || 'UCRlsJWh1XwmNGxZPFgJ0Zlw',
                          youtubeMode: editingBlock.youtubeMode || 'single',
                        })
                      }
                    >
                      <Youtube size={14} /> YouTube
                    </button>
                  </div>

                  {!isYouTubeActive && (
                    <div className="space-y-4">
                      <div>
                        <fieldset>
                          <legend className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Platform
                          </legend>
                          <div className="grid grid-cols-3 gap-2">
                            {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
                              const active = platform.id === resolvedSocialPlatform;
                              return (
                                <button
                                  key={platform.id}
                                  type="button"
                                  aria-label={platform.label}
                                  aria-pressed={active}
                                  onClick={() => handleSelectSocialPlatform(platform.id)}
                                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 ${active ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                  title={platform.label}
                                >
                                  <platform.icon
                                    size={16}
                                    className={active ? 'text-white' : 'text-gray-500'}
                                  />
                                  <span className="text-[11px] font-semibold leading-tight truncate">
                                    {platform.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      </div>

                      <div>
                        <label
                          htmlFor="social-block-handle-input"
                          className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                        >
                          {resolvedSocialOption?.kind === 'url' ? 'URL' : 'Username / Handle'}
                        </label>
                        <input
                          id="social-block-handle-input"
                          type="text"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium text-gray-600"
                          value={resolvedSocialHandle}
                          onChange={(e) => handleChangeSocialInput(e.target.value)}
                          placeholder={resolvedSocialOption?.placeholder ?? 'yourhandle'}
                        />
                      </div>

                      {resolvedSocialUrl && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Resolved Link
                          </p>
                          <a
                            href={resolvedSocialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-gray-700 hover:text-black break-all underline"
                          >
                            {resolvedSocialUrl}
                          </a>
                        </div>
                      )}

                      {/* Icon Color Style for SOCIAL blocks */}
                      <div>
                        <fieldset>
                          <legend className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Icon Color
                          </legend>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              aria-pressed={editingBlock.textColor === 'text-brand'}
                              onClick={() =>
                                updateBlock({ ...editingBlock, textColor: 'text-brand' })
                              }
                              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                                editingBlock.textColor === 'text-brand'
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{
                                  background:
                                    getSocialPlatformOption(editingBlock.socialPlatform)
                                      ?.brandColor || '#6366f1',
                                }}
                              />
                              Color
                            </button>
                            <button
                              type="button"
                              aria-pressed={editingBlock.textColor === undefined}
                              onClick={() => updateBlock({ ...editingBlock, textColor: undefined })}
                              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                                !editingBlock.textColor || editingBlock.textColor === 'text-black'
                                  ? 'bg-gray-800 text-white border-gray-800'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-full bg-gray-600" />
                              Default
                            </button>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. YOUTUBE SPECIFIC INPUTS */}
              {isYouTubeActive && (
                <div className="p-5 bg-red-50 rounded-2xl border border-red-100 space-y-5">
                  {/* A. Channel Config */}
                  <div>
                    <label
                      htmlFor="youtube-channel-id-input"
                      className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between"
                    >
                      Channel ID
                      <a
                        href="https://commentpicker.com/youtube-channel-id.php"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-red-500 underline flex items-center"
                      >
                        Find ID <ExternalLink size={8} className="ml-1" />
                      </a>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="youtube-channel-id-input"
                        type="text"
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm placeholder-gray-400 font-mono"
                        value={editingBlock.channelId || ''}
                        onChange={(e) =>
                          updateBlock({ ...editingBlock, channelId: e.target.value })
                        }
                        placeholder="UC..."
                      />
                      <button
                        type="button"
                        aria-label="Fetch latest videos"
                        onClick={fetchLatestFromRSS}
                        disabled={isFetching || !editingBlock.channelId}
                        className="bg-red-500 text-white px-4 rounded-xl font-bold text-xs hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
                        title="Fetch latest videos"
                      >
                        {isFetching ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RefreshCw size={18} />
                        )}
                      </button>
                    </div>
                    {fetchError && (
                      <p className="text-red-500 text-xs mt-2 font-medium">{fetchError}</p>
                    )}
                  </div>

                  {/* B. Display Mode Toggle (Always Visible) */}
                  <fieldset>
                    <legend className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Video Layout
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        aria-pressed={editingBlock.youtubeMode === 'single'}
                        onClick={() =>
                          updateBlock({
                            ...editingBlock,
                            youtubeMode: 'single',
                            colSpan: 3,
                            rowSpan: 3,
                          })
                        }
                        className={`p-2 rounded-xl text-xs font-medium border flex flex-col items-center justify-center gap-2 h-20 transition-all ${editingBlock.youtubeMode === 'single' || !editingBlock.youtubeMode ? 'bg-red-500 text-white border-red-500 shadow-md ring-2 ring-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        <Square size={20} /> Single
                      </button>
                      <button
                        type="button"
                        aria-pressed={editingBlock.youtubeMode === 'grid'}
                        onClick={() =>
                          updateBlock({
                            ...editingBlock,
                            youtubeMode: 'grid',
                            colSpan: 6,
                            rowSpan: 6,
                          })
                        }
                        className={`p-2 rounded-xl text-xs font-medium border flex flex-col items-center justify-center gap-2 h-20 transition-all ${editingBlock.youtubeMode === 'grid' ? 'bg-red-500 text-white border-red-500 shadow-md ring-2 ring-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        <Grid3X3 size={20} /> Grid
                      </button>
                      <button
                        type="button"
                        aria-pressed={editingBlock.youtubeMode === 'list'}
                        onClick={() =>
                          updateBlock({
                            ...editingBlock,
                            youtubeMode: 'list',
                            colSpan: 6,
                            rowSpan: 6,
                          })
                        }
                        className={`p-2 rounded-xl text-xs font-medium border flex flex-col items-center justify-center gap-2 h-20 transition-all ${editingBlock.youtubeMode === 'list' ? 'bg-red-500 text-white border-red-500 shadow-md ring-2 ring-red-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        <List size={20} /> List
                      </button>
                    </div>
                  </fieldset>
                </div>
              )}

              {/* 4. CONTENT FIELDS (Standard) */}
              {(editingBlock.type === BlockType.LINK ||
                editingBlock.type === BlockType.MEDIA ||
                editingBlock.type === BlockType.MAP) && (
                <div>
                  {/* Image Upload for Block */}
                  {(editingBlock.type === BlockType.MEDIA ||
                    editingBlock.type === BlockType.LINK) && (
                    <div className="mb-4">
                      <label
                        htmlFor="block-img-upload"
                        className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
                      >
                        Upload Image{' '}
                        {editingBlock.type === BlockType.LINK ? '(Optional Background)' : ''}
                      </label>
                      <label
                        htmlFor="block-img-upload"
                        className="relative group cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-black transition-colors block"
                        aria-label="Upload block image"
                      >
                        <input
                          id="block-img-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleBlockImageUpload}
                        />
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Upload size={20} />
                          <span className="text-xs">Click to upload</span>
                        </div>
                        {editingBlock.imageUrl && (
                          <div className="mt-2 text-[10px] text-green-600 font-medium text-center">
                            Image Selected
                          </div>
                        )}
                      </label>
                    </div>
                  )}

                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {editingBlock.type === BlockType.MEDIA
                      ? 'Media URL / Path'
                      : editingBlock.type === BlockType.MAP
                        ? 'Address / City'
                        : 'Destination URL'}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-mono text-xs text-gray-600"
                    value={
                      editingBlock.type === BlockType.MEDIA
                        ? editingBlock.imageUrl || ''
                        : editingBlock.content || ''
                    }
                    onChange={(e) => {
                      if (editingBlock.type === BlockType.MEDIA)
                        updateBlock({ ...editingBlock, imageUrl: e.target.value });
                      else updateBlock({ ...editingBlock, content: e.target.value });
                    }}
                    placeholder={
                      editingBlock.type === BlockType.MEDIA
                        ? '/images/photo.jpg, video.mp4 or URL'
                        : 'https://...'
                    }
                  />
                  {editingBlock.type === BlockType.MEDIA && (
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Supports images, GIFs, and videos (.mp4, .webm, .mov)
                    </p>
                  )}
                </div>
              )}

              {(editingBlock.type === BlockType.TEXT ||
                editingBlock.type === BlockType.LINK ||
                editingBlock.type === BlockType.SOCIAL) && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {editingBlock.type === BlockType.TEXT ? 'Description' : 'Subtitle / Details'}
                  </label>
                  <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium text-gray-600 h-28 resize-none"
                    value={
                      editingBlock.type === BlockType.TEXT
                        ? editingBlock.content || ''
                        : editingBlock.subtext || ''
                    }
                    onChange={(e) => {
                      if (editingBlock.type === BlockType.TEXT)
                        updateBlock({ ...editingBlock, content: e.target.value });
                      else updateBlock({ ...editingBlock, subtext: e.target.value });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Appearance (Colors) */}
            {editingBlock.type !== BlockType.SPACER && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Palette size={14} /> Background
                </label>

                {/* Solid Colors */}
                <div className="space-y-2">
                  <fieldset>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Solid Colors + Custom
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {BASE_COLORS.filter((c) => c.type === 'solid').map((c) => {
                        const active = isSelectedColor(c);
                        return (
                          <button
                            type="button"
                            aria-label={`Set background color to ${c.name}`}
                            aria-pressed={active}
                            key={c.name}
                            onClick={() =>
                              updateBlock({
                                ...editingBlock,
                                color: c.bg,
                                textColor: c.text,
                                customBackground: undefined,
                              })
                            }
                            className={`h-10 rounded-full border shadow-sm transition-all transform active:scale-95 ${c.bg} ${active ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'} flex items-center justify-center`}
                            title={c.name}
                          >
                            {active && (
                              <CheckCircle2
                                size={16}
                                className={c.text === 'text-white' ? 'text-white' : 'text-black'}
                              />
                            )}
                          </button>
                        );
                      })}
                      <ColorPickerWidget
                        value={
                          editingBlock.customBackground?.startsWith('#')
                            ? editingBlock.customBackground
                            : '#6366F1'
                        }
                        active={!!editingBlock.customBackground?.startsWith('#')}
                        onActivate={() => {
                          if (editingBlock.customBackground?.startsWith('#')) return;
                          const hex = '#6366F1';
                          updateBlock({
                            ...editingBlock,
                            color: undefined,
                            customBackground: hex,
                            textColor: getContrastTextClass(hex),
                          });
                        }}
                        ariaLabel="Choose a custom background color"
                        title="Custom color"
                        shape="circle"
                        sizeClassName="w-full h-10"
                        inline
                        panelClassName="col-span-full"
                        onChange={(hex) =>
                          updateBlock({
                            ...editingBlock,
                            color: undefined,
                            customBackground: hex,
                            textColor: getContrastTextClass(hex),
                          })
                        }
                      />
                    </div>
                  </fieldset>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-gray-100">
              <button
                type="button"
                aria-label={`Remove block ${editingBlock.title}`}
                onClick={() => onDelete(editingBlock.id)}
                className="w-full py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} /> Remove Block
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-gray-900 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900">Design</h3>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Use <span className="font-semibold">Settings</span> to configure profile,
                  branding, analytics and deploy defaults. Click a block to edit its content, size
                  and colors.
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-gray-900 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900">Add Content</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: BlockType.LINK, label: 'Link', icon: Link, color: 'bg-blue-600' },
                  { type: BlockType.SOCIAL, label: 'Social', icon: Github, color: 'bg-violet-600' },
                  { type: BlockType.MEDIA, label: 'Media', icon: ImageIcon, color: 'bg-pink-600' },
                  { type: BlockType.TEXT, label: 'Note', icon: TypeIcon, color: 'bg-emerald-600' },
                  { type: BlockType.MAP, label: 'Map', icon: MapPin, color: 'bg-amber-500' },
                  {
                    type: BlockType.SPACER,
                    label: 'Spacer',
                    icon: MoveVertical,
                    color: 'bg-gray-600',
                  },
                ].map((btn) => (
                  <button
                    type="button"
                    aria-label={`Add ${btn.label} Block`}
                    key={btn.type}
                    onClick={() => addBlock(btn.type)}
                    className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-lg transition-all group"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl ${btn.color} text-white flex items-center justify-center shadow-sm transition-colors`}
                    >
                      <btn.icon size={18} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{btn.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {profile.showBranding !== false && (
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400 font-medium">
            OpenBento &bull; Open Source
          </p>
        </div>
      )}
    </aside>
  );
};

export default EditorSidebar;
