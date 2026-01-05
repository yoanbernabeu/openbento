import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Settings,
  Trash2,
  Upload,
  X,
  Code,
  User,
  Share2,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  Globe,
} from 'lucide-react';
import type { SocialPlatform, UserProfile, BlockData } from '../types';
import { AVATAR_PLACEHOLDER } from '../constants';
import ImageCropModal from './ImageCropModal';
import {
  buildSocialUrl,
  getSocialPlatformOption,
  SOCIAL_PLATFORM_OPTIONS,
  formatFollowerCount,
} from '../socialPlatforms';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  setProfile: (next: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
  bentoName?: string;
  onBentoNameChange?: (name: string) => void;
  // For raw JSON editing
  blocks?: BlockData[];
  onBlocksChange?: (blocks: BlockData[]) => void;
};

type TabType = 'general' | 'social' | 'seo' | 'analytics' | 'json';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  setProfile,
  bentoName,
  onBentoNameChange,
  blocks,
  onBlocksChange,
}) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarSrc, setPendingAvatarSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Social accounts state
  const [isAddingSocial, setIsAddingSocial] = useState(false);
  const [newPlatform, setNewPlatform] = useState<SocialPlatform>('instagram');
  const [newHandle, setNewHandle] = useState('');

  // JSON editor state
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Supabase Analytics state
  const [supabaseProjectUrl, setSupabaseProjectUrl] = useState('');
  const [supabaseDbPassword, setSupabaseDbPassword] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<{
    ok: boolean;
    message: string;
    logs?: string[];
  } | null>(null);
  const [savedConfig, setSavedConfig] = useState<{ projectUrl?: string; anonKey?: string } | null>(
    null
  );

  // Load saved config on mount
  useEffect(() => {
    if (isOpen && activeTab === 'analytics') {
      fetch('/__openbento/config')
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.config) {
            setSavedConfig(data.config);
            setSupabaseProjectUrl(data.config.projectUrl || '');
            setSupabaseAnonKey(data.config.anonKey || '');
            // Also update profile analytics if not set
            if (data.config.projectUrl && !profile.analytics?.supabaseUrl) {
              setProfile({
                ...profile,
                analytics: {
                  ...profile.analytics,
                  enabled: true,
                  supabaseUrl: data.config.projectUrl,
                  anonKey: data.config.anonKey,
                },
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab, profile, setProfile]);

  const handleSupabaseSetup = async () => {
    setSetupLoading(true);
    setSetupResult(null);

    try {
      const res = await fetch('/__openbento/supabase/simple-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectUrl: supabaseProjectUrl,
          dbPassword: supabaseDbPassword,
          anonKey: supabaseAnonKey,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSetupResult({ ok: true, message: 'Database setup complete!', logs: data.logs });
        setSavedConfig(data.config);
        setSupabaseDbPassword(''); // Clear password after success
        // Update profile
        setProfile({
          ...profile,
          analytics: {
            enabled: true,
            supabaseUrl: supabaseProjectUrl,
            anonKey: supabaseAnonKey,
          },
        });
      } else {
        setSetupResult({ ok: false, message: data.error || 'Setup failed', logs: data.logs });
      }
    } catch (e) {
      setSetupResult({ ok: false, message: 'Network error: ' + (e as Error).message });
    } finally {
      setSetupLoading(false);
    }
  };

  const socialAccounts = profile.socialAccounts || [];

  // Update JSON text when modal opens or data changes
  useEffect(() => {
    if (isOpen && activeTab === 'json') {
      const fullConfig = {
        name: bentoName || 'My Bento',
        profile,
        blocks: blocks || [],
      };
      setJsonText(JSON.stringify(fullConfig, null, 2));
      setJsonError(null);
    }
  }, [isOpen, activeTab, profile, blocks, bentoName]);

  const addSocialAccount = () => {
    if (!newHandle.trim()) return;

    const exists = socialAccounts.some((acc) => acc.platform === newPlatform);
    if (exists) {
      setProfile({
        ...profile,
        socialAccounts: socialAccounts.map((acc) =>
          acc.platform === newPlatform ? { ...acc, handle: newHandle.trim() } : acc
        ),
      });
    } else {
      setProfile({
        ...profile,
        socialAccounts: [...socialAccounts, { platform: newPlatform, handle: newHandle.trim() }],
      });
    }

    setNewHandle('');
    setIsAddingSocial(false);
  };

  const removeSocialAccount = (platform: SocialPlatform) => {
    setProfile({
      ...profile,
      socialAccounts: socialAccounts.filter((acc) => acc.platform !== platform),
    });
  };

  const updateSocialHandle = (platform: SocialPlatform, handle: string) => {
    setProfile({
      ...profile,
      socialAccounts: socialAccounts.map((acc) =>
        acc.platform === platform ? { ...acc, handle } : acc
      ),
    });
  };

  const updateFollowerCount = (platform: SocialPlatform, count: string) => {
    const numCount = count ? parseInt(count.replace(/\D/g, ''), 10) : undefined;
    setProfile({
      ...profile,
      socialAccounts: socialAccounts.map((acc) =>
        acc.platform === platform ? { ...acc, followerCount: numCount } : acc
      ),
    });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      setPendingAvatarSrc(result);
    };
    reader.readAsDataURL(file);

    try {
      e.target.value = '';
    } catch {
      // ignore
    }
  };

  const resetAvatar = () => setProfile({ ...profile, avatarUrl: AVATAR_PLACEHOLDER });

  const handleJsonSave = () => {
    try {
      const parsed = JSON.parse(jsonText);

      // Validate structure
      if (!parsed.profile || !Array.isArray(parsed.blocks)) {
        setJsonError('Invalid structure: must have "profile" and "blocks"');
        return;
      }

      // Apply changes
      if (parsed.name && onBentoNameChange) {
        onBentoNameChange(parsed.name);
      }
      setProfile(parsed.profile);
      if (onBlocksChange) {
        onBlocksChange(parsed.blocks);
      }

      setJsonError(null);
    } catch (e) {
      setJsonError(`JSON Parse Error: ${(e as Error).message}`);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <User size={16} /> },
    { id: 'social', label: 'Social', icon: <Share2 size={16} /> },
    { id: 'seo', label: 'SEO', icon: <Globe size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
    { id: 'json', label: 'Raw JSON', icon: <Code size={16} /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden ring-1 ring-gray-900/5"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start border-b border-gray-100">
              <div>
                <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white mb-3">
                  <Settings size={18} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Profile, social accounts, and configuration.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-1 border-b border-gray-100">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    activeTab === tab.id
                      ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-900 -mb-[2px]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 pt-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* GENERAL TAB */}
              {activeTab === 'general' && (
                <>
                  {/* Bento Name */}
                  {onBentoNameChange && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Bento
                      </h3>
                      <div className="p-3 bg-white border border-gray-200 rounded-xl">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          Project Name
                        </label>
                        <input
                          type="text"
                          aria-label="Project name"
                          value={bentoName || ''}
                          onChange={(e) => onBentoNameChange(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none transition-all"
                          placeholder="My Bento"
                        />
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          Used as filename when exporting JSON
                        </p>
                      </div>
                    </section>
                  )}

                  {/* Profile */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Profile
                    </h3>
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 ring-2 ring-white shadow-lg">
                          <img
                            src={profile.avatarUrl || AVATAR_PLACEHOLDER}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            aria-label="Upload avatar image"
                            onClick={() => avatarInputRef.current?.click()}
                            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <Upload size={14} />
                            Upload
                          </button>
                          <button
                            type="button"
                            aria-label="Reset avatar to default"
                            onClick={resetAvatar}
                            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Name
                          </label>
                          <input
                            type="text"
                            aria-label="Your name"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-semibold text-gray-800"
                            placeholder="Your name"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Avatar URL
                          </label>
                          <input
                            type="text"
                            aria-label="Avatar URL"
                            value={profile.avatarUrl || ''}
                            onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-mono text-xs text-gray-700"
                            placeholder="/images/avatar.jpg or https://..."
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Enter a path or URL instead of uploading to avoid base64 encoding
                          </p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Bio
                          </label>
                          <textarea
                            aria-label="Bio"
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium text-gray-700 h-24 resize-none"
                            placeholder="A short bio…"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Branding */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Branding
                    </h3>
                    <div className="flex items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Show OpenBento credit</p>
                        <p className="text-xs text-gray-400">
                          Displays the OpenBento footer in the builder and export.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            showBranding: !(profile.showBranding !== false),
                          })
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          profile.showBranding !== false ? 'bg-gray-900' : 'bg-gray-200'
                        }`}
                        aria-pressed={profile.showBranding !== false}
                        aria-label="Toggle OpenBento branding"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            profile.showBranding !== false ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Social icons in header */}
                    <div className="flex items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          Social icons in header
                        </p>
                        <p className="text-xs text-gray-400">
                          Display your social icons under your name and bio.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProfile({
                            ...profile,
                            showSocialInHeader: !profile.showSocialInHeader,
                          })
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          profile.showSocialInHeader ? 'bg-gray-900' : 'bg-gray-200'
                        }`}
                        aria-pressed={profile.showSocialInHeader}
                        aria-label="Toggle social icons in header"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            profile.showSocialInHeader ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Show follower count */}
                    {profile.showSocialInHeader && (
                      <div className="flex items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-xl ml-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">Show follower count</p>
                          <p className="text-xs text-gray-400">
                            Display follower numbers next to icons (e.g., 220k).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              showFollowerCount: !profile.showFollowerCount,
                            })
                          }
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            profile.showFollowerCount ? 'bg-gray-900' : 'bg-gray-200'
                          }`}
                          aria-pressed={profile.showFollowerCount}
                          aria-label="Toggle follower count"
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              profile.showFollowerCount ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </section>

                  {/* Background Section */}
                  <section className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Background
                    </h3>

                    {/* Background Color */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Background Color
                      </label>

                      {/* Color picker + Hex input row */}
                      <div className="flex items-center gap-3">
                        {/* Native color picker - large clickable area */}
                        <div className="relative">
                          <input
                            type="color"
                            aria-label="Background color picker"
                            value={profile.backgroundColor || '#F7F7F7'}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                backgroundColor: e.target.value,
                                backgroundImage: undefined,
                              })
                            }
                            className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-violet-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Open color picker"
                          />
                        </div>

                        {/* Hex input */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 font-mono">#</span>
                            <input
                              type="text"
                              aria-label="Background color hex code"
                              value={(profile.backgroundColor || '#F7F7F7').replace('#', '')}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                                if (val.length >= 3) {
                                  setProfile({
                                    ...profile,
                                    backgroundColor: `#${val}`,
                                    backgroundImage: undefined,
                                  });
                                }
                              }}
                              placeholder="F7F7F7"
                              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:outline-none"
                              maxLength={6}
                            />
                          </div>
                        </div>

                        {/* Preview swatch */}
                        <div
                          className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow-inner"
                          style={{ backgroundColor: profile.backgroundColor || '#F7F7F7' }}
                          title={profile.backgroundColor || '#F7F7F7'}
                        />
                      </div>

                      {/* Preset colors */}
                      <div className="flex gap-2 flex-wrap">
                        {[
                          '#F7F7F7',
                          '#ffffff',
                          '#f0f0f0',
                          '#e5e5e5',
                          '#1a1a1a',
                          '#0a0a0a',
                          '#1e293b',
                          '#0f172a',
                          '#fef3c7',
                          '#dbeafe',
                          '#dcfce7',
                          '#fce7f3',
                        ].map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Set background color to ${color}`}
                            aria-pressed={
                              profile.backgroundColor === color && !profile.backgroundImage
                            }
                            onClick={() =>
                              setProfile({
                                ...profile,
                                backgroundColor: color,
                                backgroundImage: undefined,
                              })
                            }
                            className={`w-7 h-7 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                              profile.backgroundColor === color && !profile.backgroundImage
                                ? 'border-violet-500 scale-110 shadow-md'
                                : 'border-gray-200 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Background Image */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Background Image
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          aria-label="Background image URL"
                          value={profile.backgroundImage || ''}
                          onChange={(e) =>
                            setProfile({ ...profile, backgroundImage: e.target.value || undefined })
                          }
                          placeholder="https://example.com/image.jpg"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:outline-none"
                        />
                        <label
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500"
                          aria-label="Upload background image"
                        >
                          <Upload size={16} className="text-gray-600" />
                          <input
                            type="file"
                            accept="image/*"
                            aria-label="Upload background image file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setProfile({
                                    ...profile,
                                    backgroundImage: reader.result as string,
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {profile.backgroundImage && (
                          <button
                            type="button"
                            aria-label="Remove background image"
                            onClick={() => setProfile({ ...profile, backgroundImage: undefined })}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            title="Remove background image"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      {profile.backgroundImage && (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={profile.backgroundImage}
                            alt="Background preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Background Blur (only when image is set) */}
                    {profile.backgroundImage && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-gray-700">
                            Blur Amount
                          </label>
                          <span className="text-xs text-gray-400">
                            {profile.backgroundBlur || 0}px
                          </span>
                        </div>
                        <input
                          type="range"
                          aria-label={`Background blur amount: ${profile.backgroundBlur || 0} pixels`}
                          min="0"
                          max="20"
                          value={profile.backgroundBlur || 0}
                          onChange={(e) =>
                            setProfile({ ...profile, backgroundBlur: parseInt(e.target.value) })
                          }
                          className="w-full accent-violet-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* SEO TAB */}
              {activeTab === 'seo' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Social Sharing & SEO
                    </h3>
                    <p className="text-sm text-gray-500">
                      Configure how your bento appears when shared on social media platforms like
                      Twitter, Facebook, and LinkedIn.
                    </p>
                  </div>

                  {/* OpenGraph Title */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Share Title
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      aria-label="OpenGraph share title"
                      value={profile.openGraph?.title || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          openGraph: { ...profile.openGraph, title: e.target.value || undefined },
                        })
                      }
                      placeholder={profile.name || 'Your page title'}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                    />
                    <p className="text-xs text-gray-400">
                      Defaults to your profile name. Used as the title in social media previews.
                    </p>
                  </div>

                  {/* OpenGraph Description */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Share Description
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <textarea
                      aria-label="OpenGraph share description"
                      value={profile.openGraph?.description || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          openGraph: {
                            ...profile.openGraph,
                            description: e.target.value || undefined,
                          },
                        })
                      }
                      placeholder={profile.bio || 'Describe your page...'}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none resize-none h-20"
                    />
                    <p className="text-xs text-gray-400">
                      Defaults to your bio. Brief description shown in social media previews.
                    </p>
                  </div>

                  {/* OpenGraph Image */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Share Image URL
                      <span className="text-gray-400 font-normal ml-1">(recommended)</span>
                    </label>
                    <input
                      type="url"
                      aria-label="OpenGraph share image URL"
                      value={profile.openGraph?.image || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          openGraph: { ...profile.openGraph, image: e.target.value || undefined },
                        })
                      }
                      placeholder="https://example.com/og-image.jpg"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none font-mono text-xs"
                    />
                    {profile.openGraph?.image && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <img
                          src={profile.openGraph.image}
                          alt="OG preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 font-medium mb-1">
                        ⚠️ Image Requirements
                      </p>
                      <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                        <li>Recommended size: 1200×630px (PNG or JPG)</li>
                        <li>Must be publicly accessible (not data:// URLs)</li>
                        <li>Defaults to your avatar if not set</li>
                      </ul>
                    </div>
                  </div>

                  {/* Canonical URL */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Canonical URL
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="url"
                      aria-label="Canonical URL"
                      value={profile.openGraph?.url || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          openGraph: { ...profile.openGraph, url: e.target.value || undefined },
                        })
                      }
                      placeholder="https://yourdomain.com"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none font-mono text-xs"
                    />
                    <p className="text-xs text-gray-400">
                      The deployed URL of your page. Leave empty to set via environment variable.
                    </p>
                  </div>

                  {/* Site Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Site Name
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      aria-label="Site name"
                      value={profile.openGraph?.siteName || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          openGraph: { ...profile.openGraph, siteName: e.target.value || undefined },
                        })
                      }
                      placeholder={profile.name || 'My Bento'}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                    />
                    <p className="text-xs text-gray-400">Defaults to your profile name.</p>
                  </div>

                  {/* Twitter Card Settings */}
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Twitter Card
                    </h4>

                    {/* Twitter Card Type */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-600">Card Type</label>
                      <div className="flex gap-3">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="twitterCard"
                            value="summary"
                            checked={
                              (profile.openGraph?.twitterCard || 'summary_large_image') === 'summary'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                openGraph: {
                                  ...profile.openGraph,
                                  twitterCard: e.target.value as 'summary' | 'summary_large_image',
                                },
                              })
                            }
                            className="peer sr-only"
                          />
                          <div className="p-3 bg-gray-50 border-2 border-gray-200 rounded-xl peer-checked:border-violet-500 peer-checked:bg-violet-50 transition-all">
                            <p className="text-sm font-semibold text-gray-900">Summary</p>
                            <p className="text-xs text-gray-500">Square image preview</p>
                          </div>
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="twitterCard"
                            value="summary_large_image"
                            checked={
                              (profile.openGraph?.twitterCard || 'summary_large_image') ===
                              'summary_large_image'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                openGraph: {
                                  ...profile.openGraph,
                                  twitterCard: e.target.value as 'summary' | 'summary_large_image',
                                },
                              })
                            }
                            className="peer sr-only"
                          />
                          <div className="p-3 bg-gray-50 border-2 border-gray-200 rounded-xl peer-checked:border-violet-500 peer-checked:bg-violet-50 transition-all">
                            <p className="text-sm font-semibold text-gray-900">Large Image</p>
                            <p className="text-xs text-gray-500">Wide image preview</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Twitter Site Handle */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-600">
                        Twitter Site Handle
                        <span className="text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">@</span>
                        <input
                          type="text"
                          aria-label="Twitter site handle"
                          value={profile.openGraph?.twitterSite || ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              openGraph: {
                                ...profile.openGraph,
                                twitterSite: e.target.value || undefined,
                              },
                            })
                          }
                          placeholder="yourusername"
                          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        Twitter account for the website/brand
                      </p>
                    </div>

                    {/* Twitter Creator Handle */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-600">
                        Twitter Creator Handle
                        <span className="text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">@</span>
                        <input
                          type="text"
                          aria-label="Twitter creator handle"
                          value={profile.openGraph?.twitterCreator || ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              openGraph: {
                                ...profile.openGraph,
                                twitterCreator: e.target.value || undefined,
                              },
                            })
                          }
                          placeholder="yourpersonalhandle"
                          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-gray-400">Twitter account for the content creator</p>
                    </div>
                  </div>

                  {/* Testing Tools */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                    <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <CheckCircle size={16} />
                      Test Your Meta Tags
                    </h4>
                    <p className="text-xs text-blue-700">
                      After exporting and deploying, validate your social previews:
                    </p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>
                        •{' '}
                        <a
                          href="https://developers.facebook.com/tools/debug/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-800"
                        >
                          Facebook Sharing Debugger
                        </a>
                      </li>
                      <li>
                        •{' '}
                        <a
                          href="https://cards-dev.twitter.com/validator"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-800"
                        >
                          Twitter Card Validator
                        </a>
                      </li>
                      <li>
                        •{' '}
                        <a
                          href="https://www.linkedin.com/post-inspector/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-blue-800"
                        >
                          LinkedIn Post Inspector
                        </a>
                      </li>
                    </ul>
                  </div>
                </section>
              )}

              {/* SOCIAL TAB */}
              {activeTab === 'social' && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Social Accounts
                    </h3>
                    <button
                      type="button"
                      aria-label="Add social account"
                      onClick={() => {
                        // Set newPlatform to first available platform not already added
                        const availablePlatforms = SOCIAL_PLATFORM_OPTIONS.filter(
                          (opt) => !socialAccounts.some((acc) => acc.platform === opt.id)
                        );
                        if (availablePlatforms.length > 0) {
                          setNewPlatform(availablePlatforms[0].id);
                        }
                        setIsAddingSocial(true);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {socialAccounts.length === 0 && !isAddingSocial && (
                      <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        No social accounts configured yet
                      </p>
                    )}

                    {socialAccounts.map((account) => {
                      const option = getSocialPlatformOption(account.platform);
                      if (!option) return null;
                      const BrandIcon = option.brandIcon;
                      const FallbackIcon = option.icon;
                      const url = buildSocialUrl(account.platform, account.handle);

                      return (
                        <div
                          key={account.platform}
                          className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            {BrandIcon ? (
                              <span style={{ color: option.brandColor }}>
                                <BrandIcon size={18} />
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                <FallbackIcon size={18} />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                            <input
                              type="text"
                              aria-label={`${option.label} handle`}
                              value={account.handle}
                              onChange={(e) => updateSocialHandle(account.platform, e.target.value)}
                              placeholder={option.placeholder}
                              className="w-full text-xs text-gray-500 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                            />
                          </div>
                          <div className="shrink-0 w-20">
                            <input
                              type="text"
                              aria-label={`${option.label} follower count`}
                              value={account.followerCount || ''}
                              onChange={(e) =>
                                updateFollowerCount(account.platform, e.target.value)
                              }
                              placeholder="Followers"
                              className="w-full text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            {account.followerCount && (
                              <p className="text-[9px] text-gray-400 text-right mt-0.5">
                                {formatFollowerCount(account.followerCount)}
                              </p>
                            )}
                          </div>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-violet-600 truncate max-w-[120px]"
                              title={url}
                            >
                              Preview
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeSocialAccount(account.platform)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            aria-label={`Remove ${option.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}

                    {isAddingSocial && (
                      <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
                        <div className="flex gap-2">
                          <select
                            aria-label="Select social platform"
                            value={newPlatform}
                            onChange={(e) => setNewPlatform(e.target.value as SocialPlatform)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none"
                          >
                            {SOCIAL_PLATFORM_OPTIONS.filter(
                              (opt) => !socialAccounts.some((acc) => acc.platform === opt.id)
                            ).map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          aria-label="Social account handle"
                          value={newHandle}
                          onChange={(e) => setNewHandle(e.target.value)}
                          placeholder={
                            getSocialPlatformOption(newPlatform)?.placeholder || 'yourhandle'
                          }
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && addSocialAccount()}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label="Cancel adding social account"
                            onClick={() => {
                              setIsAddingSocial(false);
                              setNewHandle('');
                            }}
                            className="flex-1 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            aria-label="Add social account"
                            onClick={addSocialAccount}
                            disabled={!newHandle.trim()}
                            className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Add Account
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === 'analytics' && (
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Supabase Analytics
                    </h3>
                    <p className="text-sm text-gray-500">
                      Track page views and clicks on your exported bento. This requires a Supabase
                      project.
                    </p>
                  </div>

                  {/* Status indicator */}
                  {savedConfig?.projectUrl && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                      <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Analytics configured</p>
                        <p className="text-xs text-green-600">{savedConfig.projectUrl}</p>
                      </div>
                    </div>
                  )}

                  {/* Setup instructions */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Database size={16} />
                      Setup Instructions
                    </h4>
                    <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                      <li>
                        Create a Supabase project at{' '}
                        <a
                          href="https://supabase.com"
                          target="_blank"
                          rel="noopener"
                          className="text-violet-600 underline"
                        >
                          supabase.com
                        </a>
                      </li>
                      <li>Copy your Project URL (e.g., https://xxx.supabase.co)</li>
                      <li>Copy your Database Password (from project creation)</li>
                      <li>Copy your Publishable Key (Settings → API → anon public)</li>
                      <li>Fill the form below and click "Setup Database"</li>
                    </ol>
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ This setup only works in dev mode. Credentials are stored locally and never
                      committed.
                    </p>
                  </div>

                  {/* Setup form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Supabase Project URL
                      </label>
                      <input
                        type="text"
                        aria-label="Supabase project URL"
                        value={supabaseProjectUrl}
                        onChange={(e) => setSupabaseProjectUrl(e.target.value)}
                        placeholder="https://xxxxx.supabase.co"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Database Password
                      </label>
                      <input
                        type="password"
                        aria-label="Supabase database password"
                        value={supabaseDbPassword}
                        onChange={(e) => setSupabaseDbPassword(e.target.value)}
                        placeholder="Your Supabase DB password"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all focus:outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Used only for setup, not stored.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Publishable Key (anon public)
                      </label>
                      <input
                        type="text"
                        aria-label="Supabase publishable key"
                        value={supabaseAnonKey}
                        onChange={(e) => setSupabaseAnonKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIs..."
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all font-mono text-xs focus:outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Safe to use in client-side code. Never use the secret/service_role key here.
                      </p>
                    </div>

                    {/* Save Config button */}
                    <button
                      type="button"
                      aria-label="Save analytics configuration"
                      onClick={() => {
                        if (!supabaseProjectUrl || !supabaseAnonKey) return;
                        fetch('/__openbento/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            projectUrl: supabaseProjectUrl,
                            anonKey: supabaseAnonKey,
                            savedAt: new Date().toISOString(),
                          }),
                        }).then(() => {
                          setSavedConfig({
                            projectUrl: supabaseProjectUrl,
                            anonKey: supabaseAnonKey,
                          });
                          setProfile({
                            ...profile,
                            analytics: {
                              enabled: true,
                              supabaseUrl: supabaseProjectUrl,
                              anonKey: supabaseAnonKey,
                            },
                          });
                          setSetupResult({ ok: true, message: 'Config saved!' });
                        });
                      }}
                      disabled={!supabaseProjectUrl || !supabaseAnonKey}
                      className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <CheckCircle size={18} />
                      Save Config
                    </button>

                    {/* Setup Database button */}
                    <button
                      type="button"
                      aria-label="Setup analytics database"
                      onClick={handleSupabaseSetup}
                      disabled={setupLoading || !supabaseProjectUrl || !supabaseDbPassword}
                      className="w-full py-2.5 bg-violet-100 text-violet-700 rounded-xl font-semibold hover:bg-violet-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {setupLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <Database size={16} />
                          Setup Database (first time only)
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      Only needed once to create the analytics table
                    </p>
                  </div>

                  {/* Result */}
                  {setupResult && (
                    <div
                      className={`p-4 rounded-xl ${setupResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {setupResult.ok ? (
                          <CheckCircle size={18} className="text-green-600" />
                        ) : (
                          <AlertCircle size={18} className="text-red-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${setupResult.ok ? 'text-green-800' : 'text-red-800'}`}
                        >
                          {setupResult.message}
                        </span>
                      </div>
                      {setupResult.logs && (
                        <div className="mt-2 p-2 bg-black/5 rounded text-xs font-mono text-gray-600 max-h-32 overflow-auto">
                          {setupResult.logs.map((log, i) => (
                            <div key={i}>{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enable toggle */}
                  <div className="pt-4 border-t border-gray-100">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-gray-700">
                        Enable Analytics on Export
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Enable analytics on export"
                        checked={profile.analytics?.enabled || false}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            analytics: {
                              ...profile.analytics,
                              enabled: e.target.checked,
                              supabaseUrl: supabaseProjectUrl || profile.analytics?.supabaseUrl,
                              anonKey: supabaseAnonKey || profile.analytics?.anonKey,
                            },
                          })
                        }
                        className="w-5 h-5 rounded text-violet-600 border-gray-300 focus:ring-violet-500"
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      When enabled, your exported page will track views and clicks.
                    </p>
                  </div>
                </section>
              )}

              {/* JSON TAB */}
              {activeTab === 'json' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Raw Configuration
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Edit the JSON directly. Be careful!
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Apply JSON changes"
                      onClick={handleJsonSave}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Apply Changes
                    </button>
                  </div>

                  {jsonError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                      {jsonError}
                    </div>
                  )}

                  <textarea
                    aria-label="Raw JSON configuration"
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="w-full h-[400px] bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-xl border-0 focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                    spellCheck={false}
                  />

                  <div className="text-xs text-gray-400 space-y-1">
                    <p>
                      <strong>Structure:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                      <li>
                        <code>name</code>: Bento project name
                      </li>
                      <li>
                        <code>profile</code>: User profile (name, bio, avatarUrl, etc.)
                      </li>
                      <li>
                        <code>blocks</code>: Array of blocks with gridColumn, gridRow, colSpan,
                        rowSpan
                      </li>
                    </ul>
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                aria-label="Close settings modal"
                onClick={onClose}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </motion.div>

          <ImageCropModal
            isOpen={!!pendingAvatarSrc}
            src={pendingAvatarSrc || ''}
            title="Crop profile photo"
            onCancel={() => setPendingAvatarSrc(null)}
            onConfirm={(dataUrl) => {
              setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
              setPendingAvatarSrc(null);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
