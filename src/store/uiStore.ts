import { create } from 'zustand';

export type CenterTab = 'editor' | 'typing' | 'overview';

type UIState = {
  tab: CenterTab;
  selected: string[]; // unicode keys
  primary: string | null;
  dark: boolean;
  accent: string;
  showGrid: boolean;
  snap: boolean;
  toast: { id: number; message: string; kind: 'info' | 'error' }[];
  setTab: (t: CenterTab) => void;
  select: (unicode: string, mode?: 'single' | 'toggle' | 'range') => void;
  clearSelection: () => void;
  setSelectionList: (list: string[]) => void;
  toggleDark: () => void;
  setAccent: (hex: string) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  pushToast: (message: string, kind?: 'info' | 'error') => void;
  dismissToast: (id: number) => void;
};

const LS = {
  dark: 'fb.dark',
  accent: 'fb.accent',
  grid: 'fb.grid',
  snap: 'fb.snap',
};

function readBool(k: string, d: boolean) {
  const v = localStorage.getItem(k);
  return v == null ? d : v === '1';
}

let toastId = 0;

export const useUIStore = create<UIState>((set, get) => ({
  tab: 'editor',
  selected: [],
  primary: null,
  dark: readBool(LS.dark, false),
  accent: localStorage.getItem(LS.accent) || '#18181b',
  showGrid: readBool(LS.grid, true),
  snap: readBool(LS.snap, true),
  toast: [],

  setTab: (tab) => set({ tab }),

  select: (unicode, mode = 'single') => {
    const { selected } = get();
    if (mode === 'toggle') {
      const next = selected.includes(unicode)
        ? selected.filter((u) => u !== unicode)
        : [...selected, unicode];
      set({ selected: next, primary: next[next.length - 1] ?? null });
    } else if (mode === 'range' && get().primary) {
      set({ selected: Array.from(new Set([...selected, unicode])), primary: unicode });
    } else {
      set({ selected: [unicode], primary: unicode });
    }
  },

  clearSelection: () => set({ selected: [], primary: null }),
  setSelectionList: (list) =>
    set({ selected: list, primary: list[list.length - 1] ?? null }),

  toggleDark: () =>
    set((s) => {
      const dark = !s.dark;
      localStorage.setItem(LS.dark, dark ? '1' : '0');
      return { dark };
    }),

  setAccent: (accent) => {
    localStorage.setItem(LS.accent, accent);
    set({ accent });
  },

  toggleGrid: () =>
    set((s) => {
      const showGrid = !s.showGrid;
      localStorage.setItem(LS.grid, showGrid ? '1' : '0');
      return { showGrid };
    }),

  toggleSnap: () =>
    set((s) => {
      const snap = !s.snap;
      localStorage.setItem(LS.snap, snap ? '1' : '0');
      return { snap };
    }),

  pushToast: (message, kind = 'info') => {
    const id = ++toastId;
    set((s) => ({ toast: [...s.toast, { id, message, kind }].slice(-3) }));
    setTimeout(() => get().dismissToast(id), 4000);
  },

  dismissToast: (id) =>
    set((s) => ({ toast: s.toast.filter((t) => t.id !== id) })),
}));
