import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { buildFontDataUrl } from '@/lib/font/build';
import GlyphPreview from '@/components/GlyphPreview';

const PRESETS: Record<string, string> = {
  Pangram: 'The quick brown fox jumps over the lazy dog',
  'Lorem Ipsum': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  Numbers: '0 1 2 3 4 5 6 7 8 9',
  Punctuation: '! ? . , : ; ( ) [ ] { } & @ # * /',
};

export default function TypingPad() {
  const project = useProjectStore((s) => s.project)!;
  const [text, setText] = useState('Handgloves AVATAR\nThe quick brown fox 0123456789');
  const [fontSize, setFontSize] = useState(72);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [tracking, setTracking] = useState(0);
  const live = project.settings.liveBuildPreview;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const family = useRef(`fb-${Math.random().toString(36).slice(2)}`);
  const debounce = useRef<number>();

  useEffect(() => {
    if (!live) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setDataUrl(buildFontDataUrl(project));
    }, 500);
    return () => window.clearTimeout(debounce.current);
  }, [project, live]);

  useEffect(() => {
    if (!live || !dataUrl) return;
    const style = document.createElement('style');
    style.textContent = `@font-face{font-family:'${family.current}';src:url(${dataUrl}) format('opentype');}`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [dataUrl, live]);

  const glyphMap = useMemo(() => {
    const map = new Map<string, (typeof project.glyphs)[string]>();
    for (const g of Object.values(project.glyphs)) map.set(g.char, g);
    return map;
  }, [project.glyphs]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-2 text-xs">
        <label className="flex items-center gap-2">
          크기 {fontSize}
          <input type="range" min={12} max={200} value={fontSize}
            onChange={(e) => setFontSize(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          행간 {lineHeight.toFixed(1)}
          <input type="range" min={1} max={2.5} step={0.1} value={lineHeight}
            onChange={(e) => setLineHeight(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          자간 {tracking}
          <input type="range" min={-0.1} max={0.5} step={0.01} value={tracking}
            onChange={(e) => setTracking(+e.target.value)} />
        </label>
        <select
          className="rounded border border-border bg-bg px-2 py-1"
          onChange={(e) => e.target.value && setText(PRESETS[e.target.value])}
          value=""
        >
          <option value="">프리셋 문장…</option>
          {Object.keys(PRESETS).map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <span className="ml-auto text-text-muted">
          {live ? '라이브 프리뷰 (빌드 폰트)' : '글리프 SVG 미리보기'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-28 resize-none border-b border-border bg-bg p-3 text-sm outline-none"
      />
      <div className="flex-1 overflow-auto bg-surface p-6">
        {live ? (
          <div
            style={{
              fontFamily: family.current,
              fontSize,
              lineHeight,
              letterSpacing: `${tracking}em`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {dataUrl ? text : '빌드 중…'}
          </div>
        ) : (
          <div
            className="flex flex-wrap"
            style={{ lineHeight, gap: `${tracking}em` }}
          >
            {[...text].map((ch, i) =>
              ch === '\n' ? (
                <div key={i} className="w-full" />
              ) : ch === ' ' ? (
                <div key={i} style={{ width: fontSize * 0.4 }} />
              ) : (
                <div key={i} style={{ height: fontSize, width: fontSize * 0.75 }}>
                  {glyphMap.get(ch)?.normalizedPath ? (
                    <GlyphPreview
                      glyph={glyphMap.get(ch)!}
                      metrics={project.metrics}
                      className="h-full w-full"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-text-muted/30"
                      style={{ fontSize: fontSize * 0.7 }}
                    >
                      {ch}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
