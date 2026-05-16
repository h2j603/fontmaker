import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { buildGlyphTransformMatrix, multiply, Matrix } from '@/lib/svg/coordTransform';
import { glyphAdvanceWidth } from '@/lib/font/build';
import { pathBBox } from '@/lib/svg/normalize';
import type { GlyphTransform } from '@/types';

const SNAP_GRID = 50;
const HANDLE_R = 5; // screen px

const ap = (m: Matrix, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot';

export default function GlyphEditor() {
  const project = useProjectStore((s) => s.project)!;
  const updateGlyph = useProjectStore((s) => s.updateGlyph);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const { primary, showGrid, snap, toggleGrid, toggleSnap, pushToast } = useUIStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ z: 0.4, px: 120, py: 80 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<
    | { kind: 'pan'; x: number; y: number; ox: number; oy: number }
    | { kind: 'move'; x: number; y: number; ox: number; oy: number }
    | { kind: 'handle'; id: HandleId; t0: GlyphTransform; startAng?: number; cf0?: { x: number; y: number } }
    | null
  >(null);
  const space = useRef(false);

  const g = primary ? project.glyphs[primary] : null;
  const m = project.metrics;
  const gT = g?.transform;

  const localBox = useMemo(
    () => (g?.normalizedPath ? pathBBox(g.normalizedPath) : null),
    [g?.normalizedPath],
  );

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  const fitToView = useCallback(() => {
    const h = m.ascender - m.descender;
    const z = Math.min(2, (size.h * 0.7) / h);
    setView({ z, px: size.w * 0.32, py: -m.descender * z + size.h * 0.15 });
  }, [m, size]);

  // auto fit when glyph changes or first sizing
  const fitKey = `${primary}:${size.w}x${size.h}`;
  const lastFit = useRef('');
  useEffect(() => {
    if (size.w && lastFit.current !== fitKey) {
      lastFit.current = fitKey;
      fitToView();
    }
  }, [fitKey, size.w, fitToView]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => e.code === 'Space' && (space.current = true);
    const up = (e: KeyboardEvent) => e.code === 'Space' && (space.current = false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toScreen = useCallback(
    (x: number, y: number) => ({ x: x * view.z + view.px, y: size.h - (y * view.z + view.py) }),
    [view, size.h],
  );
  const toFont = useCallback(
    (sx: number, sy: number) => ({ x: (sx - view.px) / view.z, y: (size.h - sy - view.py) / view.z }),
    [view, size.h],
  );

  const fullMatrix = useCallback(
    (t = gT!): Matrix =>
      multiply([1, 0, 0, 1, g!.metrics.leftSideBearing, g!.metrics.baselineOffset], buildGlyphTransformMatrix(t)),
    [g, gT],
  );

  // handle positions in screen space
  const handles = useMemo(() => {
    if (!g?.normalizedPath || !localBox || localBox.w === 0) return null;
    const M = fullMatrix();
    const { x, y, w, h } = localBox;
    const corner = (lx: number, ly: number) => {
      const f = ap(M, lx, ly);
      return toScreen(f.x, f.y);
    };
    const pts: Record<HandleId, { x: number; y: number }> = {
      nw: corner(x, y + h), n: corner(x + w / 2, y + h), ne: corner(x + w, y + h),
      e: corner(x + w, y + h / 2), se: corner(x + w, y), s: corner(x + w / 2, y),
      sw: corner(x, y), w: corner(x, y + h / 2),
      rot: (() => {
        const c = corner(x + w / 2, y + h);
        return { x: c.x, y: c.y - 28 };
      })(),
    };
    return pts;
  }, [g, localBox, fullMatrix, toScreen]);

  const rotatable = gT && gT.rotate === 0 && gT.skewX === 0 && gT.skewY === 0;

  const hitHandle = (sx: number, sy: number): HandleId | null => {
    if (!handles) return null;
    for (const id of Object.keys(handles) as HandleId[]) {
      const p = handles[id];
      if (Math.hypot(p.x - sx, p.y - sy) <= HANDLE_R + 4) return id;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = wrapRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (space.current || e.button === 1) {
      drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, ox: view.px, oy: view.py };
      return;
    }
    const hid = hitHandle(sx, sy);
    if (hid && g && gT) {
      if (hid === 'rot') {
        const M = fullMatrix();
        const c = ap(M, localBox!.x + localBox!.w / 2, localBox!.y + localBox!.h / 2);
        const f = toFont(sx, sy);
        drag.current = {
          kind: 'handle', id: hid, t0: { ...gT },
          cf0: c, startAng: Math.atan2(f.y - c.y, f.x - c.x),
        };
      } else if (rotatable) {
        drag.current = { kind: 'handle', id: hid, t0: { ...gT } };
      } else {
        pushToast('회전/스큐 상태에서는 핸들 리사이즈가 비활성됩니다. Inspector를 사용하세요.');
      }
      return;
    }
    if (g && g.normalizedPath) {
      drag.current = { kind: 'move', x: e.clientX, y: e.clientY, ox: gT!.translateX, oy: gT!.translateY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !g) return;
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, px: d.ox + (e.clientX - d.x), py: d.oy - (e.clientY - d.y) }));
      return;
    }
    if (d.kind === 'move') {
      let tx = d.ox + (e.clientX - d.x) / view.z;
      let ty = d.oy - (e.clientY - d.y) / view.z;
      if (snap && !e.altKey) {
        tx = Math.round(tx / SNAP_GRID) * SNAP_GRID;
        ty = Math.round(ty / SNAP_GRID) * SNAP_GRID;
      }
      updateGlyph(g.unicode, { transform: { ...g.transform, translateX: tx, translateY: ty } });
      return;
    }
    // handle drag
    const rect = wrapRef.current!.getBoundingClientRect();
    const f = toFont(e.clientX - rect.left, e.clientY - rect.top);
    const B = localBox!;
    const t0 = d.t0;
    if (d.id === 'rot') {
      const c = d.cf0!;
      const ang = Math.atan2(f.y - c.y, f.x - c.x);
      let deg = t0.rotate + ((ang - d.startAng!) * 180) / Math.PI;
      if (snap && !e.altKey) deg = Math.round(deg / 15) * 15;
      // keep visual center fixed
      const t1 = { ...t0, rotate: deg };
      const M1 = multiply(
        [1, 0, 0, 1, g.metrics.leftSideBearing, g.metrics.baselineOffset],
        buildGlyphTransformMatrix(t1),
      );
      const cNow = ap(M1, B.x + B.w / 2, B.y + B.h / 2);
      updateGlyph(g.unicode, {
        transform: {
          ...t1,
          translateX: t1.translateX + (c.x - cNow.x),
          translateY: t1.translateY + (c.y - cNow.y),
        },
      });
      return;
    }
    // resize (rot=0, skew=0): anchor = opposite side stays fixed
    const left = d.id.includes('w');
    const right = d.id.includes('e');
    const bottom = d.id === 's' || d.id === 'sw' || d.id === 'se';
    const top = d.id === 'n' || d.id === 'nw' || d.id === 'ne';
    const lsb = g.metrics.leftSideBearing;
    const base = g.metrics.baselineOffset;
    let { scaleX, scaleY, translateX, translateY } = t0;
    if (left || right) {
      const anchorLx = left ? B.x + B.w : B.x;
      const dragLx = left ? B.x : B.x + B.w;
      const Cx = t0.scaleX * anchorLx + t0.translateX + lsb;
      const denom = dragLx - anchorLx;
      if (Math.abs(denom) > 1e-6) {
        scaleX = (f.x - Cx) / denom;
        if (Math.abs(scaleX) < 0.01) scaleX = t0.scaleX;
        translateX = Cx - scaleX * anchorLx - lsb;
      }
    }
    if (top || bottom) {
      const anchorLy = bottom ? B.y + B.h : B.y;
      const dragLy = bottom ? B.y : B.y + B.h;
      const Cy = t0.scaleY * anchorLy + t0.translateY + base;
      const denom = dragLy - anchorLy;
      if (Math.abs(denom) > 1e-6) {
        scaleY = (f.y - Cy) / denom;
        if (Math.abs(scaleY) < 0.01) scaleY = t0.scaleY;
        translateY = Cy - scaleY * anchorLy - base;
      }
    }
    updateGlyph(g.unicode, {
      transform: { ...t0, scaleX, scaleY, translateX, translateY },
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      pushToast('SVG 파일만 업로드할 수 있습니다.', 'error');
      return;
    }
    file.text().then((t) => uploadSvg(primary!, t));
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
  const tm = g.normalizedPath ? fullMatrix() : null;
  const cursor =
    drag.current?.kind === 'pan' ? 'grabbing' : space.current ? 'grab' : 'default';

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <span className="font-medium">{g.name}</span>
        <span className="text-text-muted">U+{g.unicode}</span>
        <span className="ml-auto flex gap-2">
          <button onClick={toggleGrid} className={showGrid ? 'text-accent' : 'text-text-muted'}>그리드</button>
          <button onClick={toggleSnap} className={snap ? 'text-accent' : 'text-text-muted'}>스냅</button>
          <button onClick={fitToView} className="text-text-muted">화면 맞춤</button>
          <span className="text-text-muted">{Math.round(view.z * 100)}%</span>
        </span>
      </div>
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden bg-surface"
        onWheel={(e) => {
          const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          setView((v) => ({ ...v, z: Math.min(8, Math.max(0.05, v.z * f)) }));
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor }}
      >
        {!g.normalizedPath && g.status !== 'error' && (
          <label
            className="absolute left-1/2 top-1/2 flex h-44 w-72 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-center text-sm text-text-muted hover:border-accent"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fl = e.dataTransfer.files[0];
              if (fl) onFile(fl);
            }}
          >
            <span className="text-2xl">＋</span>
            SVG 업로드 (클릭 또는 드래그)
            <input type="file" accept=".svg" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
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
            Array.from({ length: 60 }).map((_, i) => {
              const s = toScreen((i - 30) * SNAP_GRID, 0);
              return <line key={i} x1={s.x} y1={0} x2={s.x} y2={size.h} stroke="var(--border)" strokeWidth={0.5} />;
            })}
          {lines.map((l) => {
            const s = toScreen(0, l.y);
            return (
              <g key={l.label}>
                <line x1={0} y1={s.y} x2={size.w} y2={s.y}
                  stroke={l.strong ? 'var(--accent)' : 'var(--text-muted)'}
                  strokeWidth={l.strong ? 1 : 0.5}
                  strokeDasharray={l.strong ? '' : '4 4'}
                  opacity={l.strong ? 0.8 : 0.4} />
                <text x={4} y={s.y - 3} fontSize={10} fill="var(--text-muted)">{l.label}</text>
              </g>
            );
          })}
          <line x1={origin.x} y1={0} x2={origin.x} y2={size.h} stroke="var(--text-muted)" strokeWidth={0.75} opacity={0.5} />
          <line x1={toScreen(advance, 0).x} y1={0} x2={toScreen(advance, 0).x} y2={size.h}
            stroke="var(--text-muted)" strokeWidth={0.75} strokeDasharray="2 3" opacity={0.6} />
          {tm && (
            <g transform={`translate(${view.px} ${size.h - view.py}) scale(${view.z} ${-view.z})`}>
              <path d={g.normalizedPath} transform={`matrix(${tm.join(' ')})`} fill="var(--text)" fillRule="nonzero" />
            </g>
          )}
          {handles && (
            <>
              <line x1={handles.n.x} y1={handles.n.y} x2={handles.rot.x} y2={handles.rot.y}
                stroke="var(--accent)" strokeWidth={1} opacity={0.6} />
              {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as HandleId[]).map((id) => (
                <rect key={id} x={handles[id].x - HANDLE_R} y={handles[id].y - HANDLE_R}
                  width={HANDLE_R * 2} height={HANDLE_R * 2}
                  fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.5}
                  opacity={rotatable ? 1 : 0.35} />
              ))}
              <circle cx={handles.rot.x} cy={handles.rot.y} r={HANDLE_R}
                fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
