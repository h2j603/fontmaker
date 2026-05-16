import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Button, Modal, TextField } from '@/components/ui/primitives';

export default function SnapshotsPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)!;
  const saveSnapshot = useProjectStore((s) => s.saveSnapshot);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);
  const deleteSnapshot = useProjectStore((s) => s.deleteSnapshot);
  const pushToast = useUIStore((s) => s.pushToast);
  const [label, setLabel] = useState('');

  return (
    <Modal title="버전 스냅샷" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <TextField value={label} onChange={setLabel} placeholder="라벨 (선택)" />
        <Button
          variant="primary"
          onClick={() => {
            saveSnapshot(label);
            setLabel('');
            pushToast('스냅샷을 저장했습니다.');
          }}
        >
          저장
        </Button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {[...project.versionSnapshots].reverse().map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
          >
            <div>
              <div>{s.label}</div>
              <div className="text-xs text-text-muted">
                {new Date(s.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm('이 버전으로 되돌립니다. 현재 상태를 덮어씁니다. 계속할까요?')) {
                    restoreSnapshot(s.id);
                    pushToast('스냅샷을 복원했습니다.');
                    onClose();
                  }
                }}
              >
                복원
              </Button>
              <button
                className="px-2 text-text-muted hover:text-danger"
                onClick={() => deleteSnapshot(s.id)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {project.versionSnapshots.length === 0 && (
          <p className="text-sm text-text-muted">저장된 스냅샷이 없습니다.</p>
        )}
      </div>
    </Modal>
  );
}
