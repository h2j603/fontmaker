import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Section, Field, NumberField, Slider, Button } from '@/components/ui/primitives';
import FontSettingsPanel from './FontSettingsPanel';
import KerningPanel from './KerningPanel';
import { DEFAULT_TRANSFORM } from '@/types';

export default function Inspector() {
  const project = useProjectStore((s) => s.project)!;
  const updateGlyph = useProjectStore((s) => s.updateGlyph);
  const clearGlyph = useProjectStore((s) => s.clearGlyph);
  const { selected, primary, clearSelection } = useUIStore();

  if (selected.length === 0) {
    return (
      <div>
        <FontSettingsPanel />
        <KerningPanel />
      </div>
    );
  }

  if (selected.length > 1) {
    return <BatchEditor unicodes={selected} onClose={clearSelection} />;
  }

  const g = primary ? project.glyphs[primary] : null;
  if (!g) return null;
  const setM = (patch: Partial<typeof g.metrics>) =>
    updateGlyph(g.unicode, { metrics: { ...g.metrics, ...patch } });
  const setT = (patch: Partial<typeof g.transform>) =>
    updateGlyph(g.unicode, { transform: { ...g.transform, ...patch } });

  return (
    <div>
      <Section title="글리프 정보">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-lg font-medium">{g.char || g.name}</div>
            <div className="text-xs text-text-muted">U+{g.unicode} · {g.name}</div>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              g.status === 'error'
                ? 'bg-danger text-white'
                : g.status === 'normalized'
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-2 text-text-muted'
            }`}
          >
            {g.status === 'normalized' ? '정규화됨' : g.status === 'error' ? '에러' : '비어있음'}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={() => clearGlyph(g.unicode)}>
            글리프 초기화
          </Button>
        </div>
      </Section>

      <Section
        title="메트릭"
        right={
          <button
            className="text-xs text-text-muted"
            onClick={() =>
              setM({ advanceWidth: (g.advanceWidthRaw ?? 0) + 80, leftSideBearing: 40, rightSideBearing: 40, baselineOffset: 0 })
            }
          >
            리셋
          </button>
        }
      >
        <Field label="Advance">
          <NumberField value={g.metrics.advanceWidth} onChange={(v) => setM({ advanceWidth: v })} />
        </Field>
        <Slider
          value={g.metrics.advanceWidth}
          min={0}
          max={project.metrics.unitsPerEm}
          onChange={(v) => setM({ advanceWidth: Math.round(v) })}
        />
        <Field label="LSB">
          <NumberField value={g.metrics.leftSideBearing} onChange={(v) => setM({ leftSideBearing: v })} />
        </Field>
        <Field label="RSB">
          <NumberField value={g.metrics.rightSideBearing} onChange={(v) => setM({ rightSideBearing: v })} />
        </Field>
        <Field label="Baseline">
          <NumberField value={g.metrics.baselineOffset} onChange={(v) => setM({ baselineOffset: v })} />
        </Field>
      </Section>

      <Section
        title="변형"
        right={
          <button
            className="text-xs text-text-muted"
            onClick={() => updateGlyph(g.unicode, { transform: { ...DEFAULT_TRANSFORM } })}
          >
            리셋
          </button>
        }
      >
        <Field label="Translate X">
          <NumberField value={g.transform.translateX} onChange={(v) => setT({ translateX: v })} />
        </Field>
        <Field label="Translate Y">
          <NumberField value={g.transform.translateY} onChange={(v) => setT({ translateY: v })} />
        </Field>
        <Field label="Scale X">
          <NumberField step={0.01} value={g.transform.scaleX} onChange={(v) => setT({ scaleX: v })} />
        </Field>
        <Field label="Scale Y">
          <NumberField step={0.01} value={g.transform.scaleY} onChange={(v) => setT({ scaleY: v })} />
        </Field>
        <Field label="Rotate">
          <NumberField value={g.transform.rotate} onChange={(v) => setT({ rotate: v })} />
        </Field>
        <Field label="Skew X">
          <NumberField value={g.transform.skewX} onChange={(v) => setT({ skewX: v })} />
        </Field>
        <Field label="Skew Y">
          <NumberField value={g.transform.skewY} onChange={(v) => setT({ skewY: v })} />
        </Field>
      </Section>

      {(g.errors.length > 0 || g.warnings.length > 0) && (
        <Section title="오류 & 경고">
          {g.errors.map((e, i) => (
            <p key={`e${i}`} className="mb-1 text-xs text-danger">
              ⚠ {e.message}
            </p>
          ))}
          {g.warnings.map((w, i) => (
            <p key={`w${i}`} className="mb-1 text-xs text-text-muted">
              · {w.message}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

function BatchEditor({ unicodes, onClose }: { unicodes: string[]; onClose: () => void }) {
  const updateGlyph = useProjectStore((s) => s.updateGlyph);
  const project = useProjectStore((s) => s.project)!;
  const [vals, setVals] = useState({ aw: 0, lsb: 0, rsb: 0, base: 0 });
  const { aw, lsb, rsb, base } = vals;
  const apply = () =>
    unicodes.forEach((u) => {
      const g = project.glyphs[u];
      updateGlyph(u, {
        metrics: {
          ...g.metrics,
          ...(aw ? { advanceWidth: aw } : {}),
          ...(lsb ? { leftSideBearing: lsb } : {}),
          ...(rsb ? { rightSideBearing: rsb } : {}),
          ...(base ? { baselineOffset: base } : {}),
        },
      });
    });
  return (
    <Section title={`${unicodes.length}개 글리프 선택됨`} right={
      <button className="text-xs text-text-muted" onClick={onClose}>선택 해제</button>
    }>
      <p className="mb-3 text-xs text-text-muted">값을 입력하고 적용하면 일괄 반영됩니다 (0은 무시).</p>
      <Field label="Advance"><NumberField value={aw} onChange={(v) => setVals((s) => ({ ...s, aw: v }))} /></Field>
      <Field label="LSB"><NumberField value={lsb} onChange={(v) => setVals((s) => ({ ...s, lsb: v }))} /></Field>
      <Field label="RSB"><NumberField value={rsb} onChange={(v) => setVals((s) => ({ ...s, rsb: v }))} /></Field>
      <Field label="Baseline"><NumberField value={base} onChange={(v) => setVals((s) => ({ ...s, base: v }))} /></Field>
      <Button variant="primary" onClick={apply} className="mt-2 w-full">
        적용
      </Button>
    </Section>
  );
}
