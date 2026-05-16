// 2D affine matrix in SVG convention: [a, b, c, d, e, f]
// x' = a*x + c*y + e ; y' = b*x + d*y + f
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

const deg = (d: number) => (d * Math.PI) / 180;

export function translate(tx: number, ty = 0): Matrix {
  return [1, 0, 0, 1, tx, ty];
}
export function scale(sx: number, sy = sx): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}
export function rotate(a: number): Matrix {
  const r = deg(a);
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
}
export function skewX(a: number): Matrix {
  return [1, 0, Math.tan(deg(a)), 1, 0, 0];
}
export function skewY(a: number): Matrix {
  return [1, Math.tan(deg(a)), 0, 1, 0, 0];
}

const TRANSFORM_RE = /(\w+)\s*\(([^)]*)\)/g;

export function parseTransform(value: string | null): Matrix {
  if (!value) return IDENTITY;
  let m: Matrix = IDENTITY;
  let match: RegExpExecArray | null;
  TRANSFORM_RE.lastIndex = 0;
  while ((match = TRANSFORM_RE.exec(value))) {
    const fn = match[1];
    const args = match[2]
      .split(/[\s,]+/)
      .map((s) => parseFloat(s))
      .filter((n) => !Number.isNaN(n));
    let next: Matrix = IDENTITY;
    switch (fn) {
      case 'translate':
        next = translate(args[0] || 0, args[1] || 0);
        break;
      case 'scale':
        next = scale(args[0] ?? 1, args[1] ?? args[0] ?? 1);
        break;
      case 'rotate':
        if (args.length >= 3) {
          next = multiply(
            multiply(translate(args[1], args[2]), rotate(args[0])),
            translate(-args[1], -args[2]),
          );
        } else {
          next = rotate(args[0] || 0);
        }
        break;
      case 'skewX':
        next = skewX(args[0] || 0);
        break;
      case 'skewY':
        next = skewY(args[0] || 0);
        break;
      case 'matrix':
        if (args.length === 6) next = args as Matrix;
        break;
    }
    m = multiply(m, next);
  }
  return m;
}

export function buildGlyphTransformMatrix(t: {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  skewX: number;
  skewY: number;
}): Matrix {
  let m = translate(t.translateX, t.translateY);
  m = multiply(m, rotate(t.rotate));
  m = multiply(m, skewX(t.skewX));
  m = multiply(m, skewY(t.skewY));
  m = multiply(m, scale(t.scaleX, t.scaleY));
  return m;
}
