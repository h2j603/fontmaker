import { useHotkeys } from 'react-hotkeys-hook';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { downloadFont } from '@/lib/font/build';

export function useAppHotkeys() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const saveSnapshot = useProjectStore((s) => s.saveSnapshot);
  const clearGlyph = useProjectStore((s) => s.clearGlyph);
  const pushToast = useUIStore((s) => s.pushToast);

  useHotkeys('mod+z', (e) => {
    e.preventDefault();
    undo();
  });
  useHotkeys('mod+shift+z', (e) => {
    e.preventDefault();
    redo();
  });
  useHotkeys('mod+s', (e) => {
    e.preventDefault();
    saveSnapshot('');
    pushToast('스냅샷을 저장했습니다.');
  });
  useHotkeys('mod+b', (e) => {
    e.preventDefault();
    const p = useProjectStore.getState().project;
    if (!p) return;
    try {
      downloadFont(p);
      pushToast('OTF 빌드 완료, 다운로드를 시작합니다.');
    } catch {
      pushToast('빌드에 실패했습니다.', 'error');
    }
  });
  useHotkeys('delete,backspace', (e) => {
    const primary = useUIStore.getState().primary;
    const target = (e.target as HTMLElement)?.tagName;
    if (target === 'INPUT' || target === 'TEXTAREA') return;
    if (primary && confirm('선택한 글리프를 초기화할까요?')) clearGlyph(primary);
  });
  useHotkeys('escape', () => useUIStore.getState().clearSelection());
}
