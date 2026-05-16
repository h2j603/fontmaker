import { useMemo, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { CATEGORY_LABELS } from '@/lib/glyphs/asciiSet';
import GlyphPreview from '@/components/GlyphPreview';
import type { GlyphCategory, GlyphStatus } from '@/types';

const CATS: (GlyphCategory | 'all')[] = [
  'all', 'uppercase', 'lowercase', 'number', 'punctuation', 'system',
];
const STATUS: (GlyphStatus | 'all')[] = ['all', 'empty', 'uploaded', 'error'];
const STATUS_LABEL: Record<string, string> = {
  all: '전체', empty: '비어있음', uploaded: '업로드', error: '에러',
};

export default function GlyphGrid() {
  const project = useProjectStore((s) => s.project)!;
  const { selected, primary, select, setTab } = useUIStore();
  const [cat, setCat] = useState<GlyphCategory | 'all'>('all');
  const [stat, setStat] = useState<GlyphStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const glyphs = useMemo(() => {
    return Object.values(project.glyphs).filter((g) => {
      if (cat !== 'all' && g.category !== cat) return false;
      if (stat !== 'all') {
        if (stat === 'uploaded' && !(g.status === 'normalized' || g.status === 'uploaded'))
          return false;
        if (stat === 'empty' && g.status !== 'empty') return false;
        if (stat === 'error' && g.status !== 'error') return false;
      }
      if (q && !g.char.includes(q) && !g.name.includes(q)) return false;
      return true;
    });
  }, [project.glyphs, cat, stat, q]);

  const onClick = (e: React.MouseEvent, u: string) => {
    select(u, e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'toggle' : 'single');
    setTab('editor');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="글자 검색…"
          className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                cat === c ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text-muted'
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setStat(s)}
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                stat === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text-muted'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-6 content-start gap-1 overflow-y-auto p-2">
        {glyphs.map((g) => {
          const isSel = selected.includes(g.unicode);
          const isPrimary = primary === g.unicode;
          return (
            <button
              key={g.unicode}
              onClick={(e) => onClick(e, g.unicode)}
              title={`${g.name} (U+${g.unicode})`}
              className={`relative aspect-square rounded border bg-surface ${
                g.status === 'error'
                  ? 'border-danger'
                  : isPrimary || isSel
                    ? 'border-accent'
                    : 'border-border'
              } ${isSel ? 'ring-1 ring-accent' : ''}`}
            >
              {g.status === 'normalized' ? (
                <GlyphPreview
                  glyph={g}
                  metrics={project.metrics}
                  className="h-full w-full p-0.5 text-text"
                />
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center text-xs ${
                    g.status === 'error' ? 'text-danger' : 'text-text-muted/40'
                  }`}
                >
                  {g.char || g.name.slice(0, 3)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
