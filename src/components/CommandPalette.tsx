import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Search,
  FileCode2,
  Bug,
  Folder,
  Sparkles,
  Bot,
  Compass,
  Zap,
  GitBranch,
  SquareTerminal,
  Network,
  History,
  Settings,
  Plus,
  Palette,
  Home,
  LibraryBig,
  Route,
  CornerDownLeft,
  MessageSquare,
  MonitorSmartphone,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { useUi, stageForPhase, type LibrarySection, type ActivityTab } from '../stores/ui';
import { cn } from '../lib/cn';

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

const LIBRARY_DESTS: { section: LibrarySection; label: string; icon: React.ReactNode }[] = [
  { section: 'agents', label: 'Agents', icon: <Bot size={15} /> },
  { section: 'skills', label: 'Skills', icon: <Sparkles size={15} /> },
  { section: 'hooks', label: 'Hooks', icon: <Zap size={15} /> },
  { section: 'steering', label: 'Steering', icon: <Compass size={15} /> },
  { section: 'routing', label: 'Routing', icon: <Route size={15} /> },
  { section: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { section: 'settings', label: 'Settings', icon: <Settings size={15} /> },
];

const ACTIVITY_DESTS: { tab: ActivityTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'runs', label: 'Activity — live runs', icon: <Network size={15} /> },
  { tab: 'history', label: 'Activity — history', icon: <History size={15} /> },
  { tab: 'terminals', label: 'Activity — terminals', icon: <SquareTerminal size={15} /> },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const specs = useWorkspace((s) => s.specs);
  const openSpec = useUi((s) => s.openSpec);
  const setSurface = useUi((s) => s.setSurface);
  const openLibrary = useUi((s) => s.openLibrary);
  const openActivity = useUi((s) => s.openActivity);
  const openOverlay = useUi((s) => s.openOverlay);
  const focusComposer = useUi((s) => s.focusComposer);
  const toggleAssistant = useUi((s) => s.toggleAssistant);
  const toggleExplorer = useUi((s) => s.toggleExplorer);
  const addTerminal = useUi((s) => s.addTerminal);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const s of specs) {
      out.push({
        id: `spec:${s.id}`,
        label: s.name,
        hint: `${s.kind} · ${s.phase}`,
        icon: s.kind === 'feature' ? <FileCode2 size={15} /> : <Bug size={15} />,
        group: 'Specs',
        run: () => openSpec(s.id, stageForPhase(s.phase)),
      });
    }
    out.push({
      id: 'cmd:new-spec',
      label: 'New spec…',
      hint: 'describe it on Home',
      icon: <Plus size={15} />,
      group: 'Commands',
      run: () => focusComposer(),
    });
    out.push({
      id: 'cmd:assistant',
      label: 'Toggle Assistant',
      hint: '⌘J',
      icon: <MessageSquare size={15} />,
      group: 'Commands',
      run: () => toggleAssistant(),
    });
    out.push({
      id: 'cmd:explorer',
      label: 'Browse files…',
      hint: '⌘⇧E',
      icon: <Folder size={15} />,
      group: 'Commands',
      run: () => toggleExplorer(),
    });
    out.push({
      id: 'cmd:travel-display',
      label: 'Open Travel Display',
      hint: 'wide run monitor · second screen',
      icon: <MonitorSmartphone size={15} />,
      group: 'Commands',
      run: () => window.octo.win.toggleWide(),
    });
    out.push({
      id: 'cmd:new-terminal',
      label: 'New terminal',
      icon: <SquareTerminal size={15} />,
      group: 'Commands',
      run: () => addTerminal('shell'),
    });
    out.push({
      id: 'cmd:new-claude',
      label: 'New Claude session',
      hint: 'interactive CLI',
      icon: <Sparkles size={15} />,
      group: 'Commands',
      run: () => addTerminal('claude'),
    });

    out.push({
      id: 'dest:home',
      label: 'Home',
      icon: <Home size={15} />,
      group: 'Go to',
      run: () => setSurface('home'),
    });
    for (const d of ACTIVITY_DESTS) {
      out.push({
        id: `dest:activity:${d.tab}`,
        label: d.label,
        icon: d.icon,
        group: 'Go to',
        run: () => openActivity(d.tab),
      });
    }
    for (const d of LIBRARY_DESTS) {
      out.push({
        id: `dest:library:${d.section}`,
        label: `Library — ${d.label}`,
        icon: d.icon,
        group: 'Go to',
        run: () => openLibrary(d.section),
      });
    }
    out.push({
      id: 'dest:library',
      label: 'Library',
      icon: <LibraryBig size={15} />,
      group: 'Go to',
      run: () => openLibrary(),
    });
    out.push({
      id: 'dest:repo',
      label: 'Repository',
      hint: 'git & pull requests',
      icon: <GitBranch size={15} />,
      group: 'Go to',
      run: () => openOverlay({ kind: 'repo' }),
    });
    return out;
  }, [
    specs,
    openSpec,
    setSurface,
    openLibrary,
    openActivity,
    openOverlay,
    focusComposer,
    toggleAssistant,
    toggleExplorer,
    addTerminal,
  ]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(needle) ||
        it.group.toLowerCase().includes(needle) ||
        (it.hint ?? '').toLowerCase().includes(needle)
    );
  }, [items, q]);

  // Keep the highlighted row in range as the list shrinks.
  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const fire = (it?: Item) => {
    if (!it) return;
    it.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[620px] rounded-2xl bg-panel shadow-card ring-1 ring-ink-50/[0.06] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, filtered.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            fire(filtered[sel]);
          }
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line/40">
          <Search size={16} className="text-faint shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to spec or run a command…"
            className="flex-1 bg-transparent text-[14px] text-ink-50 outline-none placeholder:text-faint"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-elev text-faint">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-faint">No matches</div>
          ) : (
            filtered.map((it, i) => {
              const showGroup = i === 0 || filtered[i - 1].group !== it.group;
              return (
                <div key={it.id}>
                  {showGroup && (
                    <div className="px-4 pt-2 pb-1 font-mono text-[10px] tracking-[0.14em] text-faint">
                      {it.group.toUpperCase()}
                    </div>
                  )}
                  <button
                    onMouseEnter={() => setSel(i)}
                    onClick={() => fire(it)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition',
                      i === sel ? 'bg-accent/10' : 'hover:bg-elev/60'
                    )}
                  >
                    <span className={cn('shrink-0', i === sel ? 'text-accent' : 'text-faint')}>
                      {it.icon}
                    </span>
                    <span
                      className={cn(
                        'flex-1 text-[13.5px] truncate',
                        i === sel ? 'text-ink-50' : 'text-ink-100'
                      )}
                    >
                      {it.label}
                    </span>
                    {it.hint && (
                      <span className="font-mono text-[11px] text-faint shrink-0">{it.hint}</span>
                    )}
                    {i === sel && <CornerDownLeft size={13} className="text-accent shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
