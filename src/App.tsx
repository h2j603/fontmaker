import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import Landing from './pages/Landing';
import Project from './pages/Project';
import Toasts from './components/ui/Toasts';

export default function App() {
  const project = useProjectStore((s) => s.project);
  const init = useProjectStore((s) => s.init);
  const dark = useUIStore((s) => s.dark);
  const accent = useUIStore((s) => s.accent);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    // pick readable foreground
    const c = accent.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty('--accent-fg', lum > 0.6 ? '#0a0a0a' : '#ffffff');
  }, [accent]);

  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 1024;

  if (isMobile) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-text-muted">
        데스크톱 브라우저(1024px 이상)에서 사용하세요.
      </div>
    );
  }

  return (
    <>
      {project ? <Project /> : <Landing />}
      <Toasts />
    </>
  );
}
