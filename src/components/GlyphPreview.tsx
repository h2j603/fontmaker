import { Glyph, FontMetrics } from '@/types';
import { buildGlyphTransformMatrix, multiply } from '@/lib/svg/coordTransform';
import { glyphAdvanceWidth } from '@/lib/font/build';

export default function GlyphPreview({
  glyph,
  metrics,
  className = '',
  color = 'currentColor',
}: {
  glyph: Glyph;
  metrics: FontMetrics;
  className?: string;
  color?: string;
}) {
  const asc = metrics.ascender;
  const desc = metrics.descender;
  const h = asc - desc;
  const w = glyphAdvanceWidth(glyph) || metrics.unitsPerEm * 0.6;
  if (!glyph.normalizedPath) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="xMidYMid meet">
        <text
          x={w / 2}
          y={h * 0.62}
          textAnchor="middle"
          fontSize={h * 0.5}
          fill="var(--text-muted)"
          opacity={0.35}
        >
          {glyph.char}
        </text>
      </svg>
    );
  }
  const tm = buildGlyphTransformMatrix(glyph.transform);
  const off = multiply(
    [1, 0, 0, 1, glyph.metrics.leftSideBearing, glyph.metrics.baselineOffset],
    tm,
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform={`translate(0 ${asc}) scale(1 -1)`}>
        <g transform={`matrix(${off.join(' ')})`}>
          <path d={glyph.normalizedPath} fill={color} fillRule="nonzero" />
        </g>
      </g>
    </svg>
  );
}
