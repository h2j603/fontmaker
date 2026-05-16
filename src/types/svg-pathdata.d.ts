declare module 'svg-pathdata' {
  export type SVGCommand = {
    type: number;
    relative?: boolean;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  export class SVGPathData {
    constructor(d: string);
    commands: SVGCommand[];
    static readonly MOVE_TO: number;
    static readonly LINE_TO: number;
    static readonly CURVE_TO: number;
    static readonly QUAD_TO: number;
    static readonly CLOSE_PATH: number;
    static readonly ARC: number;
    toAbs(): SVGPathData;
    toRel(): SVGPathData;
    normalizeHVZ(): SVGPathData;
    normalizeST(): SVGPathData;
    qtToC(): SVGPathData;
    aToC(): SVGPathData;
    sanitize(): SVGPathData;
    round(n?: number): SVGPathData;
    matrix(a: number, b: number, c: number, d: number, e: number, f: number): SVGPathData;
    encode(): string;
  }
}
