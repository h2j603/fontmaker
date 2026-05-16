import { useMemo, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { isBuildable } from '@/lib/font/build';

export default function BottomBar() {
  const project = useProjectStore((s) => s.project)!;
  const { select, setTab } = useUIStore();
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const all = Object.values(project.glyphs).filter((g) => !g.isSystem);
    const buildable = all.filter(isBuildable);
    const missing = all.filter((g) => g.status === 'empty');
    const noMetric = all.filter(
      (g) => g.status === 'normalized' && g.metrics.advanceWidth <= 0,
    );
    const errored = all.filter((g) => g.status === 'error');
    return { total: all.length, buildable, missing, noMetric, errored };
  }, [project.glyphs]);

  const pct = Math.round((stats.buildable.length / stats.total) * 100);

  return (
    <>
      <footer className="flex items-center gap-4 border-t border-border px-4 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-text-muted">
            {stats.buildable.length}/{stats.total} 빌드 가능
            {stats.noMetric.length > 0 && ` · ${stats.noMetric.length}개 메트릭 미설정`}
          </span>
        </div>
        <button
          className="ml-auto text-text-muted hover:text-text"
          onClick={() => setOpen((v) => !v)}
        >
          검증 체크리스트
        </button>
      </footer>
      {open && (
        <div className="fixed bottom-10 right-4 z-40 max-h-96 w-80 overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">검증 체크리스트</h3>
            <button onClick={() => setOpen(false)} className="text-text-muted">
              ×
            </button>
          </div>
          {[
            { title: '누락 글리프', list: stats.missing },
            { title: '메트릭 미설정', list: stats.noMetric },
            { title: '패스 오류', list: stats.errored },
          ].map((grp) => (
            <div key={grp.title} className="mb-3">
              <p className="mb-1 text-xs font-medium text-text-muted">
                {grp.title} ({grp.list.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {grp.list.map((g) => (
                  <button
                    key={g.unicode}
                    onClick={() => {
                      select(g.unicode);
                      setTab('editor');
                    }}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-xs hover:bg-surface-2"
                  >
                    {g.char || g.name}
                  </button>
                ))}
                {grp.list.length === 0 && (
                  <span className="text-xs text-text-muted">없음 ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
