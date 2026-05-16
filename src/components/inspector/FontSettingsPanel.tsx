import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Section, Field, TextField } from '@/components/ui/primitives';
import { PRESET_LABELS } from '@/lib/font/presets';
import type { Preset } from '@/types';

export default function FontSettingsPanel() {
  const project = useProjectStore((s) => s.project)!;
  const setFontMeta = useProjectStore((s) => s.setFontMeta);
  const setPreset = useProjectStore((s) => s.setPreset);
  const pushToast = useUIStore((s) => s.pushToast);

  const onPreset = (p: Preset) => {
    if (p === project.preset) return;
    if (!confirm('메트릭 프리셋을 변경하면 가이드라인이 바뀝니다. 계속할까요?')) return;
    setPreset(p);
    pushToast(`프리셋을 ${PRESET_LABELS[p]}(으)로 변경했습니다.`);
  };

  return (
    <Section title="폰트 설정">
      <Field label="Family">
        <TextField value={project.font.familyName} onChange={(v) => setFontMeta({ familyName: v })} />
      </Field>
      <Field label="Designer">
        <TextField value={project.font.designer} onChange={(v) => setFontMeta({ designer: v })} />
      </Field>
      <Field label="Copyright">
        <TextField value={project.font.copyright} onChange={(v) => setFontMeta({ copyright: v })} />
      </Field>
      <Field label="Version">
        <TextField value={project.font.version} onChange={(v) => setFontMeta({ version: v })} />
      </Field>
      <div className="mt-3">
        <p className="mb-1 text-xs text-text-muted">메트릭 프리셋</p>
        <div className="flex flex-col gap-1">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => onPreset(p)}
              className={`rounded border px-2 py-1 text-left text-sm ${
                project.preset === p
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
