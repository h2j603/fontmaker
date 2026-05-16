import { SVGPathData } from 'svg-pathdata';
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

function collect(el: Element, parentMatrix: Matrix, out: SubPath[]) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'symbol')
    return;
  const m = multiply(parentMatrix, parseTransform(el.getAttribute('transform')));
  if (DRAW_TAGS.has(tag)) {
    const d = shapeToPathD(el);
    if (d) {
      try {
        const data = new SVGPathData(d).toAbs().aToC().normalizeHVZ().matrix(...m);
        out.push({ data });
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

  const merged: string[] = [];
  for (const sub of subs) {
    const baked = sub.data
      .matrix(...N)
      .normalizeST()
      .aToC();
    const cmds = baked.commands;
    if (cmds.length === 0) continue;

    // Auto-fix: close near-open subpaths.
    const first = cmds[0] as unknown as Record<string, number>;
    const last = cmds[cmds.length - 1] as unknown as Record<string, number>;
    const hasClose = cmds.some((c) => c.type === SVGPathData.CLOSE_PATH);
    if (
      !hasClose &&
      first.x !== undefined &&
      last.x !== undefined &&
      Math.hypot(first.x - last.x, first.y - last.y) <= NEAR_OPEN_THRESHOLD
    ) {
      baked.commands.push({ type: SVGPathData.CLOSE_PATH });
      warnings.push({
        code: 'auto-close',
        message: `열린 패스를 자동으로 연결했습니다 (간격 ${Math.round(
          Math.hypot(first.x - last.x, first.y - last.y),
        )} units).`,
      });
    }
    merged.push(baked.round(2).encode());
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
