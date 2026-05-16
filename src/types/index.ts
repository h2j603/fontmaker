export type Preset = 'condensed' | 'regular' | 'display';

export type GlyphStatus = 'empty' | 'uploaded' | 'normalized' | 'error';

export type FontMetadata = {
  familyName: string;
  designer: string;
  copyright: string;
  version: string;
};

export type FontMetrics = {
  unitsPerEm: number;
  ascender: number;
  descender: number; // negative
  xHeight: number;
  capHeight: number;
};

export type GlyphTransform = {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotate: number; // degrees
  skewX: number; // degrees
  skewY: number; // degrees
};

export type GlyphMetrics = {
  advanceWidth: number;
  leftSideBearing: number;
  rightSideBearing: number;
  baselineOffset: number;
};

export type GlyphError = { code: string; message: string; hint?: string };
export type GlyphWarning = { code: string; message: string };

export type Glyph = {
  unicode: string; // hex codepoint, e.g. "0041"
  char: string;
  name: string;
  category: GlyphCategory;
  isSystem: boolean;
  status: GlyphStatus;
  originalSvg?: string; // raw svg text
  normalizedPath?: string; // svg path d in font coordinates
  advanceWidthRaw?: number; // intrinsic width from normalization
  transform: GlyphTransform;
  metrics: GlyphMetrics;
  errors: GlyphError[];
  warnings: GlyphWarning[];
  updatedAt?: number;
};

export type GlyphCategory =
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'punctuation'
  | 'system';

export type KerningPair = { left: string; right: string; value: number };

export type ProjectSettings = { liveBuildPreview: boolean };

export type VersionSnapshot = {
  id: string;
  label: string;
  createdAt: number;
  projectState: Omit<Project, 'versionSnapshots'>;
};

export type Project = {
  id: string;
  createdAt: number;
  updatedAt: number;
  font: FontMetadata;
  metrics: FontMetrics;
  preset: Preset;
  glyphs: Record<string, Glyph>; // keyed by unicode
  kerningPairs: KerningPair[];
  settings: ProjectSettings;
  versionSnapshots: VersionSnapshot[];
};

export const DEFAULT_TRANSFORM: GlyphTransform = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  skewX: 0,
  skewY: 0,
};

export const DEFAULT_GLYPH_METRICS: GlyphMetrics = {
  advanceWidth: 0,
  leftSideBearing: 0,
  rightSideBearing: 0,
  baselineOffset: 0,
};
