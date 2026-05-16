import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Section, Slider } from '@/components/ui/primitives';
import { RECOMMENDED_KERNING_PAIRS } from '@/lib/font/presets';

export default function KerningPanel() {
  const project = useProjectStore((s) => s.project)!;
  const upsert = useProjectStore((s) => s.upsertKerning);
  const remove = useProjectStore((s) => s.removeKerning);
  const [showAdd, setShowAdd] = useState(false);

  const existing = new Set(project.kerningPairs.map((k) => k.left + k.right));
  const recommended = RECOMMENDED_KERNING_PAIRS.filter(
    ([l, r]) => !existing.has(l + r),
  );

  return (
    <Section
      title="커닝"
      right={
        <button className="text-xs text-text-muted" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? '닫기' : '+ 추천'}
        </button>
      }
    >
      {showAdd && (
        <div className="mb-3 flex flex-wrap gap-1">
          {recommended.slice(0, 24).map(([l, r]) => (
            <button
              key={l + r}
              onClick={() => upsert({ left: l, right: r, value: -40 })}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-xs hover:bg-surface-2"
            >
              {l}
              {r}
            </button>
          ))}
        </div>
      )}
      {project.kerningPairs.length === 0 && (
        <p className="text-xs text-text-muted">커닝 쌍이 없습니다. “+ 추천”에서 추가하세요.</p>
      )}
      <div className="flex flex-col gap-2">
        {project.kerningPairs.map((k) => (
          <div key={k.left + k.right} className="flex items-center gap-2">
            <span className="w-10 font-mono text-sm">
              {k.left}
              {k.right}
            </span>
            <Slider
              value={k.value}
              min={-200}
              max={100}
              onChange={(v) => upsert({ ...k, value: Math.round(v) })}
            />
            <span className="w-10 text-right text-xs tabular-nums">{k.value}</span>
            <button
              className="text-text-muted hover:text-danger"
              onClick={() => remove(k.left, k.right)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
