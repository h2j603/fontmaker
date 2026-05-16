import opentype from 'opentype.js';
import { SVGPathData } from 'svg-pathdata';
import type { Glyph, Project } from '@/types';
import { buildGlyphTransformMatrix, multiply, Matrix } from '@/lib/svg/coordTransform';
import { injectKernTable, IndexedKern } from './kerning';

function pathToOpenType(d: string, m: Matrix): opentype.Path {
  const p = new opentype.Path();
  const tx = (x: number, y: number): [number, number] => [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5],
  ];
  const data = new SVGPathData(d).toAbs().normalizeHVZ().normalizeST().aToC();
  for (const c of data.commands) {
    const cc = c as unknown as Record<string, number> & { type: number };
    switch (cc.type) {
      case SVGPathData.MOVE_TO: {
        const [x, y] = tx(cc.x, cc.y);
        p.moveTo(x, y);
        break;
      }
      case SVGPathData.LINE_TO: {
        const [x, y] = tx(cc.x, cc.y);
        p.lineTo(x, y);
        break;
      }
      case SVGPathData.CURVE_TO: {
        const [x1, y1] = tx(cc.x1, cc.y1);
        const [x2, y2] = tx(cc.x2, cc.y2);
        const [x, y] = tx(cc.x, cc.y);
        p.curveTo(x1, y1, x2, y2, x, y);
        break;
      }
      case SVGPathData.QUAD_TO: {
        const [x1, y1] = tx(cc.x1, cc.y1);
        const [x, y] = tx(cc.x, cc.y);
        p.quadraticCurveTo(x1, y1, x, y);
        break;
      }
      case SVGPathData.CLOSE_PATH:
        p.close();
        break;
    }
  }
  return p;
}

export function glyphAdvanceWidth(g: Glyph): number {
  if (g.metrics.advanceWidth > 0) return g.metrics.advanceWidth;
  if (g.name === 'space' || g.name === '.null' || g.name === 'CR') return 500;
  if (g.advanceWidthRaw != null) return g.advanceWidthRaw;
  return 0;
}

export function isBuildable(g: Glyph): boolean {
  if (g.isSystem) return true;
  return (
    g.status === 'normalized' &&
    !!g.normalizedPath &&
    glyphAdvanceWidth(g) > 0 &&
    g.errors.length === 0
  );
}

function makeOpenTypeGlyph(g: Glyph): opentype.Glyph {
  const advance = glyphAdvanceWidth(g);
  let path = new opentype.Path();
  if (g.normalizedPath) {
    const tm = buildGlyphTransformMatrix(g.transform);
    // shift by left side bearing + baseline offset
    const offset: Matrix = [
      1,
      0,
      0,
      1,
      g.metrics.leftSideBearing,
      g.metrics.baselineOffset,
    ];
    path = pathToOpenType(g.normalizedPath, multiply(offset, tm));
  }
  const cp = g.unicode === 'NOTDEF' ? undefined : parseInt(g.unicode, 16);
  return new opentype.Glyph({
    name: g.name === g.char ? `uni${g.unicode}` : g.name,
    unicode: cp,
    advanceWidth: Math.max(0, Math.round(advance)),
    path,
  });
}

function notdefGlyph(metrics: Project['metrics']): opentype.Glyph {
  const p = new opentype.Path();
  const w = 500;
  const top = metrics.capHeight;
  p.moveTo(40, 0);
  p.lineTo(w - 40, 0);
  p.lineTo(w - 40, top);
  p.lineTo(40, top);
  p.close();
  return new opentype.Glyph({ name: '.notdef', advanceWidth: w, path: p });
}

export type BuildResult = {
  font: opentype.Font;
  arrayBuffer: ArrayBuffer;
  includedCount: number;
  excluded: string[];
};

export function buildFont(project: Project): BuildResult {
  const { font: meta, metrics } = project;
  const glyphList: opentype.Glyph[] = [];
  const excluded: string[] = [];

  // index 0 must be .notdef
  const notdefSrc = Object.values(project.glyphs).find((g) => g.name === '.notdef');
  if (notdefSrc && notdefSrc.normalizedPath) {
    glyphList.push(makeOpenTypeGlyph(notdefSrc));
  } else {
    glyphList.push(notdefGlyph(metrics));
  }

  for (const g of Object.values(project.glyphs)) {
    if (g.name === '.notdef') continue;
    if (g.isSystem) {
      glyphList.push(makeOpenTypeGlyph(g));
      continue;
    }
    if (isBuildable(g)) glyphList.push(makeOpenTypeGlyph(g));
    else if (g.status !== 'empty') excluded.push(g.char || g.name);
  }

  const font = new opentype.Font({
    familyName: meta.familyName || 'Untitled',
    styleName: 'Regular',
    unitsPerEm: metrics.unitsPerEm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    glyphs: glyphList,
  });

  font.names.designer = { en: meta.designer || '' };
  font.names.copyright = { en: meta.copyright || '' };
  font.names.version = { en: `Version ${meta.version || '1.000'}` };

  // kerning: opentype.js does not emit a kern table, so we splice an
  // old-style (Microsoft v0, format 0) kern table into the sfnt ourselves.
  const indexByChar = new Map<string, number>();
  glyphList.forEach((gl, i) => {
    if (gl.unicode) indexByChar.set(String.fromCodePoint(gl.unicode), i);
  });
  const indexedKern: IndexedKern[] = [];
  for (const k of project.kerningPairs) {
    if (!k.value) continue;
    const li = indexByChar.get(k.left);
    const ri = indexByChar.get(k.right);
    if (li != null && ri != null)
      indexedKern.push({ left: li, right: ri, value: k.value });
  }

  const arrayBuffer = injectKernTable(font.toArrayBuffer(), indexedKern);

  return {
    font,
    arrayBuffer,
    includedCount: glyphList.length,
    excluded,
  };
}

export function downloadFont(project: Project): BuildResult {
  const result = buildFont(project);
  const fileName = `${(project.font.familyName || 'Untitled').replace(/\s+/g, '-')}-Regular.otf`;
  const blob = new Blob([result.arrayBuffer], { type: 'font/otf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return result;
}

export function buildFontDataUrl(project: Project): string | null {
  try {
    const { arrayBuffer } = buildFont(project);
    const bytes = new Uint8Array(arrayBuffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:font/otf;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
