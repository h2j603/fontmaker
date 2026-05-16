import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/primitives';
import { downloadFont } from '@/lib/font/build';
import SnapshotsPanel from './SnapshotsPanel';

const ACCENTS = ['#18181b', '#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#7c3aed'];

export default function TopBar() {
  const project = useProjectStore((s) => s.project)!;
  const setFontMeta = useProjectStore((s) => s.setFontMeta);
  const closeProject = useProjectStore((s) => s.closeProject);
  const exportJson = useProjectStore((s) => s.exportJson);
  const commit = useProjectStore((s) => s.commit);
  const { tab, setTab, dark, toggleDark, accent, setAccent, pushToast } = useUIStore();
  const [menu, setMenu] = useState(false);
  const [accentOpen, setAccentOpen] = useState(false);
  const [snaps, setSnaps] = useState(false);

  const build = () => {
    try {
      const r = downloadFont(project);
      pushToast(
        `OTF 빌드 완료 (${r.includedCount}자)${r.excluded.length ? `, 제외 ${r.excluded.length}자` : ''}`,
      );
    } catch (e) {
      pushToast('빌드 실패: ' + (e as Error).message, 'error');
    }
  };

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.font.familyName || 'font'}.json`;
    a.click();
  };

  const toggleLive = () =>
    commit((p) => {
      p.settings.liveBuildPreview = !p.settings.liveBuildPreview;
    }, false);

  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2">
      <span className="font-bold">FB</span>
      <input
        value={project.font.familyName}
        onChange={(e) => setFontMeta({ familyName: e.target.value })}
        className="rounded bg-transparent px-1 text-sm font-medium outline-none hover:bg-surface-2 focus:bg-surface-2"
      />
      <span className="text-xs text-text-muted">저장됨 · localStorage</span>

      <nav className="ml-4 flex gap-1">
        {(['editor', 'typing', 'overview'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${
              tab === t ? 'bg-accent text-accent-fg' : 'text-text-muted hover:bg-surface-2'
            }`}
          >
            {t === 'editor' ? '에디터' : t === 'typing' ? '타이핑' : '오버뷰'}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={project.settings.liveBuildPreview}
            onChange={toggleLive}
          />
          라이브 프리뷰
        </label>
        <Button variant="primary" onClick={build}>
          OTF 다운로드
        </Button>
        <button onClick={() => setSnaps(true)} title="스냅샷" className="px-1.5 text-sm">
          ⏱
        </button>
        <div className="relative">
          <button
            onClick={() => setAccentOpen((v) => !v)}
            className="h-5 w-5 rounded-full border border-border"
            style={{ background: accent }}
          />
          {accentOpen && (
            <div className="absolute right-0 top-7 z-50 grid grid-cols-4 gap-1 rounded-md border border-border bg-surface p-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setAccent(c);
                    setAccentOpen(false);
                  }}
                  className="h-6 w-6 rounded-full border border-border"
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="col-span-4 mt-1 h-6 w-full"
              />
            </div>
          )}
        </div>
        <button onClick={toggleDark} className="px-1.5 text-sm">
          {dark ? '☀️' : '🌙'}
        </button>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="px-1.5 text-lg leading-none">
            ⋮
          </button>
          {menu && (
            <div
              className="absolute right-0 top-8 z-50 w-44 rounded-md border border-border bg-surface py-1 text-sm"
              onMouseLeave={() => setMenu(false)}
            >
              <button className="block w-full px-3 py-1.5 text-left hover:bg-surface-2" onClick={doExport}>
                JSON 익스포트
              </button>
              <button
                className="block w-full px-3 py-1.5 text-left text-danger hover:bg-surface-2"
                onClick={() => {
                  if (
                    confirm(
                      '이 브라우저의 로컬 프로젝트를 삭제하고 초기 화면으로 갑니다. 되돌릴 수 없습니다. 먼저 JSON 익스포트를 권장합니다.',
                    )
                  ) {
                    closeProject();
                  }
                }}
              >
                프로젝트 초기화
              </button>
            </div>
          )}
        </div>
      </div>
      {snaps && <SnapshotsPanel onClose={() => setSnaps(false)} />}
    </header>
  );
}
