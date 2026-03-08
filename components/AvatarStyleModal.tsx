import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Circle, Square, RectangleHorizontal, Sun, Minus } from 'lucide-react';
import type { AvatarStyle } from '../types';
import ColorPickerWidget from './ColorPickerWidget';

type AvatarStyleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string;
  style: AvatarStyle;
  onStyleChange: (style: AvatarStyle) => void;
};

const DEFAULT_STYLE: AvatarStyle = {
  shape: 'circle',
  shadow: true,
  border: true,
  borderColor: '#ffffff',
  borderWidth: 3,
};

const AvatarStyleModal: React.FC<AvatarStyleModalProps> = ({
  isOpen,
  onClose,
  avatarUrl,
  style,
  onStyleChange,
}) => {
  const currentStyle = { ...DEFAULT_STYLE, ...style };

  const getAvatarClasses = (s: AvatarStyle) => {
    const classes: string[] = ['w-24', 'h-24', 'object-cover', 'transition-all', 'duration-200'];

    // Shape
    if (s.shape === 'circle') classes.push('rounded-full');
    else if (s.shape === 'rounded') classes.push('rounded-2xl');
    else classes.push('rounded-none');

    // Shadow
    if (s.shadow) classes.push('shadow-xl');

    return classes.join(' ');
  };

  const getAvatarStyle = (s: AvatarStyle): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    if (s.border) {
      styles.border = `${s.borderWidth || 3}px solid ${s.borderColor || '#ffffff'}`;
    }

    return styles;
  };

  const updateStyle = (updates: Partial<AvatarStyle>) => {
    onStyleChange({ ...currentStyle, ...updates });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 pb-4 flex justify-between items-start border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Photo Style</h2>
                <p className="text-gray-500 text-sm mt-0.5">Customize appearance</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview */}
            <div className="p-6 bg-gray-50 flex justify-center">
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="Preview"
                  className={getAvatarClasses(currentStyle)}
                  style={getAvatarStyle(currentStyle)}
                />
              </div>
            </div>

            {/* Options */}
            <div className="p-5 space-y-5">
              {/* Shape */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Shape
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'circle', icon: Circle, label: 'Circle' },
                    { value: 'rounded', icon: RectangleHorizontal, label: 'Rounded' },
                    { value: 'square', icon: Square, label: 'Square' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => updateStyle({ shape: value as AvatarStyle['shape'] })}
                      className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        currentStyle.shape === value
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Sun size={18} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">Drop shadow</span>
                </div>
                <button
                  onClick={() => updateStyle({ shadow: !currentStyle.shadow })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    currentStyle.shadow ? 'bg-violet-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                      currentStyle.shadow ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Border */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Minus size={18} className="text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Border</span>
                  </div>
                  <button
                    onClick={() => updateStyle({ border: !currentStyle.border })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      currentStyle.border ? 'bg-violet-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                        currentStyle.border ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Border options (visible when border is enabled) */}
                {currentStyle.border && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-4 space-y-3"
                  >
                    {/* Border color */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 w-16">Color</span>
                      <div className="flex gap-2 flex-wrap items-center">
                        {['#ffffff', '#000000', '#6366f1', '#ec4899', '#10b981', '#f59e0b'].map(
                          (color) => (
                            <button
                              key={color}
                              onClick={() => updateStyle({ borderColor: color })}
                              className={`w-7 h-7 rounded-full border-2 transition-all ${
                                currentStyle.borderColor === color
                                  ? 'ring-2 ring-violet-500 ring-offset-2'
                                  : 'border-gray-200'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          )
                        )}
                        <ColorPickerWidget
                          value={currentStyle.borderColor || '#ffffff'}
                          active={
                            ![
                              '#ffffff',
                              '#000000',
                              '#6366f1',
                              '#ec4899',
                              '#10b981',
                              '#f59e0b',
                            ].includes(currentStyle.borderColor || '#ffffff')
                          }
                          onActivate={() => {
                            if (
                              ![
                                '#ffffff',
                                '#000000',
                                '#6366f1',
                                '#ec4899',
                                '#10b981',
                                '#f59e0b',
                              ].includes(currentStyle.borderColor || '#ffffff')
                            ) {
                              return;
                            }
                            updateStyle({ borderColor: '#8B5CF6' });
                          }}
                          ariaLabel="Choose a custom avatar border color"
                          title="Custom border color"
                          shape="circle"
                          inline
                          panelClassName="basis-full"
                          onChange={(hex) => updateStyle({ borderColor: hex })}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 pt-3 border-t border-gray-100">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
              >
                Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarStyleModal;
