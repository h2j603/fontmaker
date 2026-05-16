import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Button, Modal, TextField } from '@/components/ui/primitives';

export default function Landing() {
  const createProject = useProjectStore((s) => s.createProject);
  const importJson = useProjectStore((s) => s.importJson);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      if (!importJson(t)) alert('가져오기에 실패했습니다. 유효한 프로젝트 JSON이 아닙니다.');
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Font Builder</h1>
        <p className="mt-3 max-w-md text-text-muted">
          SVG를 올리고 메트릭을 다듬어 브라우저 안에서 바로 OTF 폰트로 빌드하세요.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button variant="primary" onClick={() => setOpen(true)} className="px-6 py-3 text-base">
          새 폰트 만들기
        </Button>
        <label className="cursor-pointer text-sm text-text-muted underline">
          JSON 프로젝트 가져오기
          <input type="file" accept="application/json,.json" hidden onChange={onImport} />
        </label>
      </div>

      {open && (
        <Modal title="새 폰트 만들기" onClose={() => setOpen(false)}>
          <p className="mb-2 text-sm text-text-muted">폰트 이름 (1–30자)</p>
          <TextField value={name} onChange={setName} placeholder="My Display Font" />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={name.trim().length === 0 || name.trim().length > 30}
              onClick={() => createProject(name)}
            >
              만들기
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
