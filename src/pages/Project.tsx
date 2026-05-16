import { useUIStore } from '@/store/uiStore';
import TopBar from '@/components/topbar/TopBar';
import GlyphGrid from '@/components/sidebar/GlyphGrid';
import GlyphEditor from '@/components/canvas/GlyphEditor';
import TypingPad from '@/components/typing/TypingPad';
import GlyphOverview from '@/components/overview/GlyphOverview';
import Inspector from '@/components/inspector/Inspector';
import BottomBar from '@/components/bottombar/BottomBar';
import { useAppHotkeys } from '@/hooks/useHotkeys';

export default function Project() {
  const tab = useUIStore((s) => s.tab);
  useAppHotkeys();

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border">
          <GlyphGrid />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          {tab === 'editor' && <GlyphEditor />}
          {tab === 'typing' && <TypingPad />}
          {tab === 'overview' && <GlyphOverview />}
        </main>
        <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-border">
          <Inspector />
        </aside>
      </div>
      <BottomBar />
    </div>
  );
}
