import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import GlyphPreview from '@/components/GlyphPreview';

export default function GlyphOverview() {
  const project = useProjectStore((s) => s.project)!;
  const { select, setTab } = useUIStore();
  const [showMetrics, setShowMetrics] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-1.5 text-xs">
        <button
          onClick={() => setShowMetrics((v) => !v)}
          className={showMetrics ? 'text-accent' : 'text-text-muted'}
        >
          메트릭 박스
        </button>
      </div>
      <div className="grid flex-1 grid-cols-[repeat(12,minmax(0,1fr))] content-start gap-2 overflow-y-auto p-4">
        {Object.values(project.glyphs).map((g) => (
          <button
            key={g.unicode}
            onClick={() => {
              select(g.unicode);
              setTab('editor');
            }}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`aspect-square w-full rounded border bg-surface ${
                showMetrics ? 'border-accent/40' : 'border-border'
              }`}
            >
              {g.normalizedPath ? (
                <GlyphPreview glyph={g} metrics={project.metrics} className="h-full w-full p-1" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-text-muted/30">
                  {g.char || g.name.slice(0, 2)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-muted">U+{g.unicode}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
