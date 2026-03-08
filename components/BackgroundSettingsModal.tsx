import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, Upload, X } from 'lucide-react';
import type { UserProfile } from '../types';
import ColorPickerWidget from './ColorPickerWidget';

type BackgroundSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  setProfile: (next: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
};

const PRESET_COLORS = [
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
];

const BackgroundSettingsModal: React.FC<BackgroundSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  setProfile,
}) => {
  const currentBackgroundColor = profile.backgroundColor || '#F7F7F7';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden ring-1 ring-gray-900/5"
            role="dialog"
            aria-modal="true"
            aria-label="Background settings"
          >
            <div className="p-6 pb-4 flex justify-between items-start border-b border-gray-100">
              <div>
                <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white mb-3">
                  <Palette size={18} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Background</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Change the page color, image, and blur in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                aria-label="Close background settings"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <section className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>

                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Set background color to ${color}`}
                        aria-pressed={profile.backgroundColor === color && !profile.backgroundImage}
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
                    <ColorPickerWidget
                      value={currentBackgroundColor}
                      active={
                        !PRESET_COLORS.includes(currentBackgroundColor) && !profile.backgroundImage
                      }
                      onActivate={() => {
                        if (
                          !PRESET_COLORS.includes(currentBackgroundColor) &&
                          !profile.backgroundImage
                        )
                          return;
                        setProfile({
                          ...profile,
                          backgroundColor: '#8B5CF6',
                          backgroundImage: undefined,
                        });
                      }}
                      ariaLabel="Choose a custom background color"
                      title="Custom color"
                      inline
                      panelClassName="basis-full"
                      onChange={(hex) =>
                        setProfile({
                          ...profile,
                          backgroundColor: hex,
                          backgroundImage: undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
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
                          if (!file) return;

                          const reader = new FileReader();
                          reader.onload = () => {
                            setProfile({
                              ...profile,
                              backgroundImage: reader.result as string,
                            });
                          };
                          reader.readAsDataURL(file);
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
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={profile.backgroundImage}
                        alt="Background preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {profile.backgroundImage && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700">Blur Amount</label>
                      <span className="text-xs text-gray-400">{profile.backgroundBlur || 0}px</span>
                    </div>
                    <input
                      type="range"
                      aria-label={`Background blur amount: ${profile.backgroundBlur || 0} pixels`}
                      min="0"
                      max="20"
                      value={profile.backgroundBlur || 0}
                      onChange={(e) =>
                        setProfile({ ...profile, backgroundBlur: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-violet-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </section>
            </div>

            <div className="p-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackgroundSettingsModal;
