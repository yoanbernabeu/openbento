import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, X } from 'lucide-react';
import ColorPickerWidget from './ColorPickerWidget';

type TextColorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  value: string;
  defaultValue: string;
  onChange: (hex: string) => void;
};

const PRESET_TEXT_COLORS = ['#111827', '#374151', '#6B7280', '#FFFFFF', '#8B5CF6', '#EC4899'];

const TextColorModal: React.FC<TextColorModalProps> = ({
  isOpen,
  onClose,
  label,
  value,
  defaultValue,
  onChange,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`Choose ${label} color`}
          >
            <div className="p-5 pb-4 flex justify-between items-start border-b border-gray-100">
              <div>
                <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white mb-3">
                  <Palette size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{label} color</h2>
                <p className="text-gray-500 text-sm mt-0.5">Update the text color.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                aria-label="Close text color modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <button
                type="button"
                onClick={() => onChange(defaultValue)}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  value === defaultValue
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Par defaut
              </button>

              <div className="flex gap-2 flex-wrap">
                {PRESET_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set ${label} color to ${color}`}
                    aria-pressed={value === color}
                    onClick={() => onChange(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      value === color
                        ? 'border-violet-500 scale-110 shadow-md'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <ColorPickerWidget
                  value={value}
                  active={!PRESET_TEXT_COLORS.includes(value)}
                  onActivate={() => {
                    if (!PRESET_TEXT_COLORS.includes(value)) return;
                    onChange('#7C3AED');
                  }}
                  ariaLabel={`Choose a custom ${label} color`}
                  title="Custom color"
                  shape="circle"
                  inline
                  panelClassName="basis-full"
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="p-5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
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

export default TextColorModal;
