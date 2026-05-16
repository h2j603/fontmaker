import type { FontMetrics, Preset } from '@/types';

export const PRESETS: Record<Preset, FontMetrics> = {
  condensed: { unitsPerEm: 1000, ascender: 750, descender: -250, xHeight: 500, capHeight: 700 },
  regular: { unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 520, capHeight: 730 },
  display: { unitsPerEm: 1000, ascender: 900, descender: -300, xHeight: 600, capHeight: 800 },
};

export const PRESET_LABELS: Record<Preset, string> = {
  condensed: '자감형 (Condensed)',
  regular: '일반형 (Regular)',
  display: '장식형 (Display)',
};

export const RECOMMENDED_KERNING_PAIRS: [string, string][] = [
  ['A', 'V'], ['A', 'W'], ['A', 'Y'], ['A', 'T'], ['L', 'T'], ['L', 'V'],
  ['L', 'W'], ['L', 'Y'], ['P', 'A'], ['T', 'A'], ['V', 'A'], ['W', 'A'],
  ['Y', 'A'], ['T', 'o'], ['T', 'a'], ['T', 'e'], ['T', 'r'], ['T', 'u'],
  ['T', 'w'], ['T', 'y'], ['V', 'o'], ['W', 'o'], ['Y', 'o'], ['P', '.'],
  ['T', ','], ['V', '.'], ['f', "'"], ['r', '.'], ['r', ','], ['f', ')'],
  ['r', ')'], ['y', '.'],
];
