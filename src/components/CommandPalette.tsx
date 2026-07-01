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
  ListTodo,
  SquareTerminal,
  Network,
  Workflow,
  History,
  Settings,
  Plus,
  Palette,
  CornerDownLeft,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { useUi, type ActivityTab, type OpenTab } from '../stores/ui';
import { cn } from '../lib/cn';

// Destinations that open as full-page module tabs instead of rail panels.
const FULL_PAGE_TABS: Partial<Record<ActivityTab, OpenTab>> = {
  agents: { id: 'agents-studio', title: 'Agents', kind: 'agents-studio' },
  skills: { id: 'skills-studio', title: 'Skills', kind: 'skills-studio' },
  orchestrator: { id: 'router-studio', title: 'Orchestration', kind: 'router-studio' },
  hooks: { id: 'hooks-studio', title: 'Hooks', kind: 'hooks-studio' },
  'source-control': { id: 'source-control', title: 'Source Control', kind: 'source-control' },
  settings: { id: 'settings', title: 'Settings', kind: 'settings' },
};

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

const DEST: { tab: ActivityTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'explorer', label: 'Explorer', icon: <Folder size={15} /> },
  { tab: 'specs', label: 'Specs', icon: <FileCode2 size={15} /> },
  { tab: 'skills', label: 'Skills', icon: <Sparkles size={15} /> },
  { tab: 'agents', label: 'Agents', icon: <Bot size={15} /> },
  { tab: 'steering', label: 'Steering', icon: <Compass size={15} /> },
  { tab: 'hooks', label: 'Hooks', icon: <Zap size={15} /> },
  { tab: 'source-control', label: 'Source Control', icon: <GitBranch size={15} /> },
  { tab: 'tasks', label: 'Running Tasks', icon: <ListTodo size={15} /> },
  { tab: 'terminal', label: 'Terminals', icon: <SquareTerminal size={15} /> },
  { tab: 'orchestrator', label: 'Orchestrator', icon: <Network size={15} /> },
  { tab: 'graph', label: 'Agent Graph', icon: <Workflow size={15} /> },
  { tab: 'history', label: 'History', icon: <History size={15} /> },
  { tab: 'settings', label: 'Settings', icon: <Settings size={15} /> },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const specs = useWorkspace((s) => s.specs);
  const setActivity = useUi((s) => s.setActivity);
  const openTab = useUi((s) => s.openTab);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const s of specs) {
      const isFeature = s.kind === 'feature';
      const initial = isFeature ? 'requirements' : 'bugfix';
      const target = s.phase === 'requirements' ? initial : s.phase === 'design' ? 'design' : 'tasks';
      out.push({
        id: `spec:${s.id}`,
        label: s.name,
        hint: `${s.kind} · ${s.phase}`,
        icon: isFeature ? <FileCode2 size={15} /> : <Bug size={15} />,
        group: 'Specs',
        run: () => {
          setActivity('specs');
          openTab({
            id: `spec:${s.id}:${target}`,
            title: `${s.name} / ${target}.md`,
            kind: 'spec',
            specId: s.id,
            specFile: target as 'requirements' | 'design' | 'tasks' | 'bugfix',
          });
        },
      });
    }
    out.push({
      id: 'cmd:new-spec',
      label: 'New spec…',
      icon: <Plus size={15} />,
      group: 'Commands',
      run: () => setActivity('specs'),
    });
    out.push({
      id: 'cmd:welcome',
      label: 'Go to Welcome',
      icon: <Folder size={15} />,
      group: 'Commands',
      run: () => openTab({ id: 'welcome', title: 'Welcome', kind: 'welcome' }),
    });
    out.push({
      id: 'cmd:syntax',
      label: 'File syntax settings…',
      hint: 'themes & languages',
      icon: <Palette size={15} />,
      group: 'Commands',
      run: () => openTab({ id: 'syntax-studio', title: 'Syntax', kind: 'syntax-studio' }),
    });
    for (const d of DEST) {
      out.push({
        id: `dest:${d.tab}`,
        label: d.label,
        icon: d.icon,
        group: 'Go to',
        run: () => {
          const page = FULL_PAGE_TABS[d.tab];
          if (page) {
            openTab(page);
            return;
          }
          setActivity(d.tab);
          if (d.tab === 'graph') openTab({ id: 'agent-graph', title: 'Agent Graph', kind: 'graph' });
        },
      });
    }
    return out;
  }, [specs, setActivity, openTab]);

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
            placeholder="Jump to spec, task, or run a command…"
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
