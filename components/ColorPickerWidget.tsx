import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, Pipette } from 'lucide-react';

type ColorPickerWidgetProps = {
  value: string;
  onChange: (hex: string) => void;
  onActivate?: () => void;
  ariaLabel: string;
  title?: string;
  active?: boolean;
  shape?: 'circle' | 'rounded';
  sizeClassName?: string;
  fallbackColor?: string;
  inline?: boolean;
  panelClassName?: string;
};

type HSV = {
  h: number;
  s: number;
  v: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value: string, fallback = '#8B5CF6') => {
  const cleaned = value.trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  return fallback;
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

const rgbToHsv = (r: number, g: number, b: number): HSV => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

const hsvToRgb = ({ h, s, v }: HSV) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h >= 0 && h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return {
    r: (rn + m) * 255,
    g: (gn + m) * 255,
    b: (bn + m) * 255,
  };
};

const ColorPickerWidget: React.FC<ColorPickerWidgetProps> = ({
  value,
  onChange,
  onActivate,
  ariaLabel,
  title = 'Custom color',
  active = false,
  shape = 'rounded',
  sizeClassName = 'w-7 h-7',
  fallbackColor = '#8B5CF6',
  inline = false,
  panelClassName = '',
}) => {
  const normalizedValue = useMemo(() => normalizeHex(value, fallbackColor), [value, fallbackColor]);
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(normalizedValue.replace('#', ''));
  const [hsv, setHsv] = useState<HSV>(() => {
    const rgb = hexToRgb(normalizedValue);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rgb = hexToRgb(normalizedValue);
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    setHexInput(normalizedValue.replace('#', ''));
  }, [normalizedValue]);

  useEffect(() => {
    if (inline && !active && isOpen) {
      setIsOpen(false);
    }
  }, [active, inline, isOpen]);

  useEffect(() => {
    if (inline || !isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [inline, isOpen]);

  const currentColor = useMemo(() => {
    const rgb = hsvToRgb(hsv);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }, [hsv]);

  const hueColor = useMemo(() => {
    const rgb = hsvToRgb({ h: hsv.h, s: 1, v: 1 });
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }, [hsv.h]);

  const textClass = useMemo(() => {
    const { r, g, b } = hexToRgb(normalizedValue);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? 'text-gray-700' : 'text-white';
  }, [normalizedValue]);

  const commitHex = (hex: string) => {
    const next = normalizeHex(hex, fallbackColor);
    onChange(next);
  };

  const updateFromSaturation = (clientX: number, clientY: number) => {
    const bounds = saturationRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const nextS = clamp((clientX - bounds.left) / bounds.width, 0, 1);
    const nextV = clamp(1 - (clientY - bounds.top) / bounds.height, 0, 1);
    const nextHsv = { ...hsv, s: nextS, v: nextV };
    setHsv(nextHsv);
    const rgb = hsvToRgb(nextHsv);
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const startSaturationDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateFromSaturation(event.clientX, event.clientY);

    const handleMove = (moveEvent: PointerEvent) =>
      updateFromSaturation(moveEvent.clientX, moveEvent.clientY);
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const pickFromScreen = async () => {
    const EyeDropperApi = (
      window as Window & {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!EyeDropperApi) return;

    try {
      const eyeDropper = new EyeDropperApi();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex.toUpperCase());
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Eyedropper failed', error);
      }
    }
  };

  return (
    <div ref={rootRef} className={inline ? 'contents' : 'relative'}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={active}
        onClick={() => {
          onActivate?.();
          if (inline) {
            setIsOpen(true);
            return;
          }
          setIsOpen((open) => !open);
        }}
        className={`relative ${sizeClassName} ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'} border-2 shadow-sm transform active:scale-95 transition-all flex items-center justify-center overflow-hidden ${
          active ? 'border-violet-500 scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'
        }`}
        title={title}
      >
        {active ? (
          <div className="absolute inset-0" style={{ backgroundColor: normalizedValue }} />
        ) : null}
        <Palette size={12} className={`relative z-10 ${active ? textClass : 'text-gray-600'}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: inline ? -6 : 6, scale: 0.98, height: inline ? 0 : 'auto' }}
            animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, y: inline ? -6 : 6, scale: 0.98, height: inline ? 0 : 'auto' }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`overflow-hidden ${
              inline
                ? `mt-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm ${panelClassName}`
                : 'absolute top-full mt-2 left-0 z-50 w-60 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl'
            }`}
          >
            <div
              ref={saturationRef}
              className="relative h-32 w-full cursor-crosshair rounded-xl"
              style={{ backgroundColor: hueColor }}
              onPointerDown={startSaturationDrag}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white to-transparent" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black to-transparent" />
              <div
                className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: currentColor,
                }}
              />
            </div>

            <div className="mt-3 space-y-3">
              <input
                type="range"
                aria-label={`${ariaLabel} hue`}
                min="0"
                max="360"
                value={hsv.h}
                onChange={(event) => {
                  const nextHsv = { ...hsv, h: Number(event.target.value) };
                  setHsv(nextHsv);
                  const rgb = hsvToRgb(nextHsv);
                  onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
                }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-transparent"
                style={{
                  background:
                    'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />

              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-mono text-gray-400">#</span>
                  <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <input
                      type="text"
                      aria-label={`${ariaLabel} hex value`}
                      value={hexInput}
                      onChange={(event) => {
                        const nextValue = event.target.value
                          .replace(/[^0-9a-fA-F]/g, '')
                          .slice(0, 6)
                          .toUpperCase();
                        setHexInput(nextValue);
                        if (nextValue.length >= 3) {
                          commitHex(`#${nextValue}`);
                        }
                      }}
                      className="w-full bg-transparent text-sm font-mono uppercase text-gray-700 outline-none"
                      placeholder="8B5CF6"
                      maxLength={6}
                    />
                  </div>
                </div>
                {typeof window !== 'undefined' && 'EyeDropper' in window && (
                  <button
                    type="button"
                    aria-label={`${ariaLabel} eyedropper`}
                    onClick={pickFromScreen}
                    className="h-11 w-11 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Pipette size={15} className="text-gray-600" />
                  </button>
                )}
                <div
                  className="h-11 w-11 rounded-xl border-2 border-gray-200 shadow-inner shrink-0"
                  style={{ backgroundColor: normalizedValue }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColorPickerWidget;
