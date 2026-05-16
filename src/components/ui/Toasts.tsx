import { useUIStore } from '@/store/uiStore';

export default function Toasts() {
  const toast = useUIStore((s) => s.toast);
  const dismiss = useUIStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toast.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto cursor-pointer rounded-md border px-4 py-2 text-sm shadow-lg ${
            t.kind === 'error'
              ? 'border-danger bg-danger text-white'
              : 'border-border bg-surface text-text'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
