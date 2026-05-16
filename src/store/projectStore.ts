import { create } from 'zustand';
import type {
  Glyph,
  KerningPair,
  Project,
  Preset,
  FontMetadata,
  VersionSnapshot,
} from '@/types';
import { DEFAULT_GLYPH_METRICS, DEFAULT_TRANSFORM } from '@/types';
import { ALL_GLYPH_DEFS } from '@/lib/glyphs/asciiSet';
import { PRESETS } from '@/lib/font/presets';
import { normalizeSvg } from '@/lib/svg/normalize';

const STORAGE_KEY = 'fontbuilder.project';
const HISTORY_LIMIT = 50;

type HistorySnap = Pick<Project, 'glyphs' | 'kerningPairs' | 'font' | 'metrics' | 'preset'>;

function emptyGlyphs(): Record<string, Glyph> {
  const out: Record<string, Glyph> = {};
  for (const def of ALL_GLYPH_DEFS) {
    out[def.unicode] = {
      ...def,
      status: 'empty',
      transform: { ...DEFAULT_TRANSFORM },
      metrics: { ...DEFAULT_GLYPH_METRICS },
      errors: [],
      warnings: [],
    };
  }
  return out;
}

function newProject(name: string): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    font: {
      familyName: name,
      designer: '',
      copyright: '',
      version: '1.000',
    },
    metrics: { ...PRESETS.regular },
    preset: 'regular',
    glyphs: emptyGlyphs(),
    kerningPairs: [],
    settings: { liveBuildPreview: false },
    versionSnapshots: [],
  };
}

function persist(p: Project | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota — surfaced elsewhere */
  }
}

function loadPersisted(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    // backfill any newly added glyph defs
    const base = emptyGlyphs();
    p.glyphs = { ...base, ...p.glyphs };
    if (!p.versionSnapshots) p.versionSnapshots = [];
    return p;
  } catch {
    return null;
  }
}

type State = {
  project: Project | null;
  past: HistorySnap[];
  future: HistorySnap[];
  init: () => void;
  createProject: (name: string) => void;
  closeProject: () => void;
  snapshot: () => HistorySnap;
  commit: (mutator: (p: Project) => void, recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  uploadSvg: (unicode: string, svgText: string) => void;
  clearGlyph: (unicode: string) => void;
  updateGlyph: (unicode: string, patch: Partial<Glyph>) => void;
  setFontMeta: (patch: Partial<FontMetadata>) => void;
  setPreset: (preset: Preset) => void;
  upsertKerning: (pair: KerningPair) => void;
  removeKerning: (left: string, right: string) => void;
  saveSnapshot: (label: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  importJson: (json: string) => boolean;
  exportJson: () => string;
};

function snapOf(p: Project): HistorySnap {
  return {
    glyphs: structuredClone(p.glyphs),
    kerningPairs: structuredClone(p.kerningPairs),
    font: { ...p.font },
    metrics: { ...p.metrics },
    preset: p.preset,
  };
}

export const useProjectStore = create<State>((set, get) => ({
  project: null,
  past: [],
  future: [],

  init: () => {
    const p = loadPersisted();
    if (p) set({ project: p });
  },

  createProject: (name) => {
    const p = newProject(name.trim() || 'Untitled');
    persist(p);
    set({ project: p, past: [], future: [] });
  },

  closeProject: () => {
    persist(null);
    set({ project: null, past: [], future: [] });
  },

  snapshot: () => snapOf(get().project!),

  commit: (mutator, recordHistory = true) => {
    const cur = get().project;
    if (!cur) return;
    const before = recordHistory ? snapOf(cur) : null;
    const next = structuredClone(cur);
    mutator(next);
    next.updatedAt = Date.now();
    persist(next);
    set((s) => ({
      project: next,
      past: before
        ? [...s.past, before].slice(-HISTORY_LIMIT)
        : s.past,
      future: recordHistory ? [] : s.future,
    }));
  },

  undo: () => {
    const { project, past } = get();
    if (!project || past.length === 0) return;
    const prev = past[past.length - 1];
    const redoSnap = snapOf(project);
    const next = { ...project, ...structuredClone(prev), updatedAt: Date.now() };
    persist(next);
    set((s) => ({
      project: next,
      past: s.past.slice(0, -1),
      future: [...s.future, redoSnap].slice(-HISTORY_LIMIT),
    }));
  },

  redo: () => {
    const { project, future } = get();
    if (!project || future.length === 0) return;
    const nextSnap = future[future.length - 1];
    const undoSnap = snapOf(project);
    const next = { ...project, ...structuredClone(nextSnap), updatedAt: Date.now() };
    persist(next);
    set((s) => ({
      project: next,
      future: s.future.slice(0, -1),
      past: [...s.past, undoSnap].slice(-HISTORY_LIMIT),
    }));
  },

  uploadSvg: (unicode, svgText) => {
    const p = get().project;
    if (!p) return;
    const g = p.glyphs[unicode];
    if (!g) return;
    const res = normalizeSvg(svgText, g.category, p.metrics);
    get().commit((proj) => {
      const gl = proj.glyphs[unicode];
      gl.originalSvg = svgText;
      gl.warnings = res.warnings;
      gl.errors = res.errors;
      if (res.status === 'normalized' && res.path) {
        gl.status = 'normalized';
        gl.normalizedPath = res.path;
        gl.advanceWidthRaw = res.glyphWidth;
        if (!gl.metrics.advanceWidth) {
          gl.metrics.advanceWidth = Math.round((res.glyphWidth ?? 0) + 80);
          gl.metrics.leftSideBearing = 40;
        }
      } else {
        gl.status = 'error';
      }
    });
  },

  clearGlyph: (unicode) => {
    get().commit((proj) => {
      const g = proj.glyphs[unicode];
      if (!g) return;
      g.status = 'empty';
      g.originalSvg = undefined;
      g.normalizedPath = undefined;
      g.advanceWidthRaw = undefined;
      g.transform = { ...DEFAULT_TRANSFORM };
      g.metrics = { ...DEFAULT_GLYPH_METRICS };
      g.errors = [];
      g.warnings = [];
    });
  },

  updateGlyph: (unicode, patch) => {
    get().commit((proj) => {
      const g = proj.glyphs[unicode];
      if (!g) return;
      Object.assign(g, patch);
      if (patch.transform) g.transform = { ...g.transform, ...patch.transform };
      if (patch.metrics) g.metrics = { ...g.metrics, ...patch.metrics };
      g.updatedAt = Date.now();
    });
  },

  setFontMeta: (patch) =>
    get().commit((p) => {
      p.font = { ...p.font, ...patch };
    }),

  setPreset: (preset) =>
    get().commit((p) => {
      p.preset = preset;
      p.metrics = { ...PRESETS[preset] };
    }),

  upsertKerning: (pair) =>
    get().commit((p) => {
      const i = p.kerningPairs.findIndex(
        (k) => k.left === pair.left && k.right === pair.right,
      );
      if (i >= 0) p.kerningPairs[i] = pair;
      else p.kerningPairs.push(pair);
    }),

  removeKerning: (left, right) =>
    get().commit((p) => {
      p.kerningPairs = p.kerningPairs.filter(
        (k) => !(k.left === left && k.right === right),
      );
    }),

  saveSnapshot: (label) =>
    get().commit((p) => {
      const snap: VersionSnapshot = {
        id: crypto.randomUUID(),
        label: label || new Date().toLocaleString('ko-KR'),
        createdAt: Date.now(),
        projectState: { ...structuredClone(p), versionSnapshots: [] } as never,
      };
      p.versionSnapshots = [...p.versionSnapshots, snap].slice(-20);
    }, false),

  restoreSnapshot: (id) =>
    get().commit((p) => {
      const snap = p.versionSnapshots.find((s) => s.id === id);
      if (!snap) return;
      const st = snap.projectState as Project;
      p.font = structuredClone(st.font);
      p.metrics = structuredClone(st.metrics);
      p.preset = st.preset;
      p.glyphs = structuredClone(st.glyphs);
      p.kerningPairs = structuredClone(st.kerningPairs);
    }),

  deleteSnapshot: (id) =>
    get().commit((p) => {
      p.versionSnapshots = p.versionSnapshots.filter((s) => s.id !== id);
    }, false),

  importJson: (json) => {
    try {
      const data = JSON.parse(json) as Project;
      if (!data.glyphs || !data.font) return false;
      const base = emptyGlyphs();
      data.glyphs = { ...base, ...data.glyphs };
      data.id = crypto.randomUUID();
      data.versionSnapshots = data.versionSnapshots || [];
      persist(data);
      set({ project: data, past: [], future: [] });
      return true;
    } catch {
      return false;
    }
  },

  exportJson: () => JSON.stringify(get().project, null, 2),
}));
