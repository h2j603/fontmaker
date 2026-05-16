import { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { buildGlyphTransformMatrix, multiply } from '@/lib/svg/coordTransform';
import { glyphAdvanceWidth } from '@/lib/font/build';

const SNAP_GRID = 50;

export default function GlyphEditor() {
  const project = useProjectStore((s) => s.project)!;
  const updateGlyph = useProjectStore((s) => s.updateGlyph);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const { primary, showGrid, snap, toggleGrid, toggleSnap, pushToast } = useUIStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ z: 0.4, px: 120, py: 80 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<{ type: 'pan' | 'move'; x: number; y: number; ox: number; oy: number } | null>(null);
  const space = useRef(false);

  const g = primary ? project.glyphs[primary] : null;
  const m = project.metrics;

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') space.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toScreen = useCallback(
    (x: number, y: number) => ({
      x: x * view.z + view.px,
      y: size.h - (y * view.z + view.py),
    }),
    [view, size.h],
  );

  const fitToView = useCallback(() => {
    const h = m.ascender - m.descender;
    const z = (size.h * 0.7) / h;
    setView({ z, px: size.w * 0.3, py: -m.descender * z + size.h * 0.15 });
  }, [m, size]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const z = Math.min(8, Math.max(0.05, view.z * factor));
    setView((v) => ({ ...v, z }));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    if (space.current || e.button === 1) {
      drag.current = { type: 'pan', x: e.clientX, y: e.clientY, ox: view.px, oy: view.py };
    } else if (g && g.normalizedPath) {
      drag.current = {
        type: 'move',
        x: e.clientX,
        y: e.clientY,
        ox: g.transform.translateX,
        oy: g.transform.translateY,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.type === 'pan') {
      setView((v) => ({ ...v, px: d.ox + dx, py: d.oy - dy }));
    } else if (g) {
      let tx = d.ox + dx / view.z;
      let ty = d.oy - dy / view.z;
      if (snap && !e.altKey) {
        tx = Math.round(tx / SNAP_GRID) * SNAP_GRID;
        ty = Math.round(ty / SNAP_GRID) * SNAP_GRID;
      }
      updateGlyph(g.unicode, { transform: { ...g.transform, translateX: tx, translateY: ty } });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      pushToast('SVG 파일만 업로드할 수 있습니다.', 'error');
      return;
    }
    file.text().then((t) => {
      uploadSvg(primary!, t);
    });
  };

  if (!g) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        왼쪽 그리드에서 글리프를 선택하세요.
      </div>
    );
  }

  const lines = [
    { y: 0, label: 'baseline', strong: true },
    { y: m.xHeight, label: 'x-height' },
    { y: m.capHeight, label: 'cap' },
    { y: m.ascender, label: 'asc' },
    { y: m.descender, label: 'desc' },
  ];
  const advance = glyphAdvanceWidth(g);
  const origin = toScreen(0, 0);
  const tm = g.normalizedPath
    ? multiply(
        [1, 0, 0, 1, g.metrics.leftSideBearing, g.metrics.baselineOffset],
        buildGlyphTransformMatrix(g.transform),
      )
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <span className="font-medium">{g.name}</span>
        <span className="text-text-muted">U+{g.unicode}</span>
        <span className="ml-auto flex gap-2">
          <button onClick={toggleGrid} className={showGrid ? 'text-accent' : 'text-text-muted'}>
            그리드
          </button>
          <button onClick={toggleSnap} className={snap ? 'text-accent' : 'text-text-muted'}>
            스냅
          </button>
          <button onClick={fitToView} className="text-text-muted">
            화면 맞춤
          </button>
          <span className="text-text-muted">{Math.round(view.z * 100)}%</span>
        </span>
      </div>
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden bg-surface"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: drag.current?.type === 'pan' ? 'grabbing' : 'default' }}
      >
        {!g.normalizedPath && g.status !== 'error' && (
          <label
            className="absolute left-1/2 top-1/2 flex h-44 w-72 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-center text-sm text-text-muted hover:border-accent"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
          >
            <span className="text-2xl">＋</span>
            SVG 업로드 (클릭 또는 드래그)
            <input
              type="file"
              accept=".svg"
              hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        )}
        {g.status === 'error' && !g.normalizedPath && (
          <div className="absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-danger bg-surface p-4 text-center text-sm">
            <p className="font-medium text-danger">정규화 실패</p>
            {g.errors.map((e, i) => (
              <p key={i} className="mt-1 text-text-muted">
                {e.message}
                {e.hint && <span className="mt-1 block text-xs">{e.hint}</span>}
              </p>
            ))}
          </div>
        )}

        <svg className="absolute inset-0 h-full w-full" width={size.w} height={size.h}>
          {showGrid &&
            Array.from({ length: 40 }).map((_, i) => {
              const gx = (i - 20) * SNAP_GRID;
              const s = toScreen(gx, 0);
              return (
                <line
                  key={`v${i}`}
                  x1={s.x}
                  y1={0}
                  x2={s.x}
                  y2={size.h}
                  stroke="var(--border)"
                  strokeWidth={0.5}
                />
              );
            })}
          {lines.map((l) => {
            const s = toScreen(0, l.y);
            return (
              <g key={l.label}>
                <line
                  x1={0}
                  y1={s.y}
                  x2={size.w}
                  y2={s.y}
                  stroke={l.strong ? 'var(--accent)' : 'var(--text-muted)'}
                  strokeWidth={l.strong ? 1 : 0.5}
                  strokeDasharray={l.strong ? '' : '4 4'}
                  opacity={l.strong ? 0.8 : 0.4}
                />
                <text x={4} y={s.y - 3} fontSize={10} fill="var(--text-muted)">
                  {l.label}
                </text>
              </g>
            );
          })}
          {/* origin + advance width */}
          <line
            x1={origin.x}
            y1={0}
            x2={origin.x}
            y2={size.h}
            stroke="var(--text-muted)"
            strokeWidth={0.75}
            opacity={0.5}
          />
          <line
            x1={toScreen(advance, 0).x}
            y1={0}
            x2={toScreen(advance, 0).x}
            y2={size.h}
            stroke="var(--text-muted)"
            strokeWidth={0.75}
            strokeDasharray="2 3"
            opacity={0.6}
          />
          {tm && (
            <g
              transform={`translate(${view.px} ${size.h - view.py}) scale(${view.z} ${-view.z})`}
            >
              <path
                d={g.normalizedPath}
                transform={`matrix(${tm.join(' ')})`}
                fill="var(--text)"
                fillRule="nonzero"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
