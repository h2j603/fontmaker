import { SVGPathData, SVGPathDataTransformer } from 'svg-pathdata';
import {
  IDENTITY,
  Matrix,
  multiply,
  parseTransform,
} from './coordTransform';
import { GlyphCategory, GlyphError, GlyphWarning } from '@/types';
import { NEAR_OPEN_THRESHOLD } from './autoFix';

export type NormalizeResult = {
  status: 'normalized' | 'error';
  path?: string; // font-coordinate svg path d
  advanceWidthRaw?: number;
  glyphWidth?: number;
  warnings: GlyphWarning[];
  errors: GlyphError[];
};

function shapeToPathD(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const num = (a: string, def = 0) => parseFloat(el.getAttribute(a) || `${def}`);
  switch (tag) {
    case 'path':
      return el.getAttribute('d');
    case 'rect': {
      const x = num('x'), y = num('y'), w = num('width'), h = num('height');
      if (w <= 0 || h <= 0) return null;
      return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    }
    case 'line':
      return `M${num('x1')} ${num('y1')}L${num('x2')} ${num('y2')}`;
    case 'polyline':
    case 'polygon': {
      const pts = (el.getAttribute('points') || '').trim();
      if (!pts) return null;
      const d = `M${pts.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ')}`;
      return tag === 'polygon' ? `${d}Z` : d;
    }
    case 'circle': {
      const cx = num('cx'), cy = num('cy'), r = num('r');
      if (r <= 0) return null;
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
    }
    case 'ellipse': {
      const cx = num('cx'), cy = num('cy'), rx = num('rx'), ry = num('ry');
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;
    }
    default:
      return null;
  }
}

const DRAW_TAGS = new Set([
  'path', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse',
]);

type SubPath = { data: SVGPathData };

/** Bake an SVG path `d` + element matrix into absolute cubic commands,
 *  converting arcs/smooth/H/V while preserving CLOSE_PATH (Z). */
export function bakePath(d: string, m: Matrix): SVGPathData {
  return new SVGPathData(d)
    .toAbs()
    .aToC()
    .normalizeST()
    .transform(SVGPathDataTransformer.NORMALIZE_HVZ(false))
    .matrix(...m);
}

/** Tight-ish bbox of a path `d` (uses on/off-curve points). */
export function pathBBox(d: string): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  try {
    for (const c of new SVGPathData(d).toAbs().commands) {
      const cc = c as unknown as Record<string, number>;
      for (const [px, py] of [
        [cc.x, cc.y],
        [cc.x1, cc.y1],
        [cc.x2, cc.y2],
      ] as const) {
        if (px === undefined || py === undefined) continue;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  } catch {
    /* malformed */
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export type ContourResult = { merged: string[]; openCount: number; maxGap: number };

/** Split each subpath into contours, close every contour so it is fillable,
 *  and report contours that were genuinely open (gap > threshold). */
export function closeContours(subs: SubPath[], N: Matrix): ContourResult {
  const merged: string[] = [];
  let openCount = 0;
  let maxGap = 0;
  for (const sub of subs) {
    const cmds = sub.data.matrix(...N).round(2).commands;
    let i = 0;
    while (i < cmds.length) {
      if (cmds[i].type !== SVGPathData.MOVE_TO) {
        i++;
        continue;
      }
      const contour: typeof cmds = [];
      const start = cmds[i] as unknown as Record<string, number>;
      contour.push(cmds[i]);
      i++;
      let closed = false;
      let lastPt = { x: start.x, y: start.y };
      while (i < cmds.length && cmds[i].type !== SVGPathData.MOVE_TO) {
        const c = cmds[i];
        if (c.type === SVGPathData.CLOSE_PATH) {
          closed = true;
          i++;
          break;
        }
        const cc = c as unknown as Record<string, number>;
        if (cc.x !== undefined) lastPt = { x: cc.x, y: cc.y };
        contour.push(c);
        i++;
      }
      if (contour.length < 2) continue; // lone moveto — drop noise point
      if (!closed) {
        const gap = Math.hypot(lastPt.x - start.x, lastPt.y - start.y);
        if (gap > NEAR_OPEN_THRESHOLD) {
          openCount++;
          maxGap = Math.max(maxGap, gap);
        }
      }
      contour.push({ type: SVGPathData.CLOSE_PATH });
      const cd = new SVGPathData('M0 0');
      cd.commands = contour;
      merged.push(cd.encode());
    }
  }
  return { merged, openCount, maxGap };
}

function collect(el: Element, parentMatrix: Matrix, out: SubPath[]) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'symbol')
    return;
  const m = multiply(parentMatrix, parseTransform(el.getAttribute('transform')));
  if (DRAW_TAGS.has(tag)) {
    const d = shapeToPathD(el);
    if (d) {
      try {
        out.push({ data: bakePath(d, m) });
      } catch {
        /* skip malformed subpath */
      }
    }
  }
  for (const child of Array.from(el.children)) collect(child, m, out);
}

function bbox(subs: SubPath[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of subs) {
    for (const c of s.data.commands) {
      const pts: number[][] = [];
      const cc = c as unknown as Record<string, number>;
      if (cc.x !== undefined) pts.push([cc.x, cc.y]);
      if (cc.x1 !== undefined) pts.push([cc.x1, cc.y1]);
      if (cc.x2 !== undefined) pts.push([cc.x2, cc.y2]);
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function targetHeight(
  category: GlyphCategory,
  metrics: { capHeight: number; xHeight: number },
): number {
  if (category === 'lowercase') return metrics.xHeight;
  return metrics.capHeight;
}

export function normalizeSvg(
  svgText: string,
  category: GlyphCategory,
  metrics: { capHeight: number; xHeight: number },
): NormalizeResult {
  const warnings: GlyphWarning[] = [];
  const errors: GlyphError[] = [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  } catch {
    return { status: 'error', warnings, errors: [{ code: 'parse', message: 'SVG 파싱 실패' }] };
  }
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) {
    return {
      status: 'error',
      warnings,
      errors: [{ code: 'parse', message: '유효한 SVG가 아닙니다.' }],
    };
  }

  const subs: SubPath[] = [];
  collect(svg, IDENTITY, subs);

  if (subs.length === 0 || subs.every((s) => s.data.commands.length === 0)) {
    return {
      status: 'error',
      warnings,
      errors: [
        {
          code: 'empty',
          message: '그릴 수 있는 path를 찾지 못했습니다.',
          hint: '텍스트/이미지는 지원하지 않습니다. Illustrator에서 Object > Path > Outline Stroke 후 다시 내보내세요.',
        },
      ],
    };
  }

  const bb = bbox(subs);
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  if (!isFinite(w) || !isFinite(h) || h <= 0 || w <= 0) {
    return {
      status: 'error',
      warnings,
      errors: [{ code: 'bbox', message: '글리프 크기를 계산할 수 없습니다.' }],
    };
  }

  const s = targetHeight(category, metrics) / h;
  // Font-coordinate normalization matrix: flip Y, scale, move to origin.
  const N: Matrix = [s, 0, 0, -s, -bb.minX * s, bb.maxY * s];

  const { merged, openCount, maxGap } = closeContours(subs, N);
  if (openCount > 0) {
    warnings.push({
      code: 'auto-close',
      message: `열린 윤곽선 ${openCount}개를 자동으로 닫았습니다 (최대 간격 ${Math.round(
        maxGap,
      )} units). 획(stroke) 기반 SVG라면 Illustrator에서 Outline Stroke 후 다시 내보내세요.`,
    });
  }

  if (merged.length === 0) {
    return {
      status: 'error',
      warnings,
      errors: [{ code: 'empty', message: '정규화 후 패스가 비었습니다.' }],
    };
  }

  const glyphWidth = Math.round(w * s);
  return {
    status: 'normalized',
    path: merged.join(' '),
    advanceWidthRaw: glyphWidth,
    glyphWidth,
    warnings,
    errors,
  };
}
