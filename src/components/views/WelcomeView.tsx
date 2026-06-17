import { FileCode2, Bug, Sparkles, Bot, FolderOpen, BookOpen } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useState } from 'react';
import { NewSpecDialog } from '../dialogs/NewSpecDialog';
import { KrakenLogo } from '../KrakenLogo';

export function WelcomeView() {
  const root = useWorkspace((s) => s.root);
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const setActivity = useUi((s) => s.setActivity);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="max-w-3xl mx-auto px-10 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 grid place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent/40 shadow-glow text-white">
            <KrakenLogo className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-50">Kraken</h1>
            <p className="text-sm text-ink-400">Spec-Driven Development workbench, powered by Claude.</p>
          </div>
        </div>

        {!root ? (
          <div className="mt-8 rounded-xl border border-ink-800 bg-ink-900/40 p-6 shadow-panel">
            <h2 className="text-lg font-medium mb-1">Start with a workspace</h2>
            <p className="text-sm text-ink-400 mb-4">
              Open any folder. Specs live in <code className="text-ink-200 bg-ink-800 px-1.5 py-0.5 rounded">.kraken/specs/</code>; agents and skills are read from the standard <code className="text-ink-200 bg-ink-800 px-1.5 py-0.5 rounded">.claude/</code> locations — your existing Claude Code definitions work here too.
            </p>
            <button
              onClick={pickWorkspace}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-fg hover:opacity-90 transition"
            >
              <FolderOpen size={15} /> Open folder
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <ActionCard
                icon={<FileCode2 size={18} />}
                title="New Feature Spec"
                description="Requirements → Design → Tasks. EARS-formatted acceptance criteria."
                onClick={() => setShowNew(true)}
              />
              <ActionCard
                icon={<Bug size={18} />}
                title="New Bugfix Spec"
                description="Current → Expected → Unchanged. Minimum fix with regression guards."
                onClick={() => setShowNew(true)}
              />
              <ActionCard
                icon={<Bot size={18} />}
                title="Browse agents"
                description="Specialized SDD agents you can invoke from chat."
                onClick={() => setActivity('agents')}
              />
              <ActionCard
                icon={<Sparkles size={18} />}
                title="Browse skills"
                description="Reusable instruction packages. SKILL.md, progressive disclosure."
                onClick={() => setActivity('skills')}
              />
            </div>

            <div className="mt-8 rounded-xl border border-ink-800 bg-ink-900/40 p-5">
              <div className="flex items-center gap-2 text-ink-200 font-medium mb-2">
                <BookOpen size={15} /> The SDD loop
              </div>
              <ol className="text-sm text-ink-300 space-y-1.5 list-decimal ml-5">
                <li><b className="text-ink-50">Requirements</b> — capture user stories and EARS acceptance criteria.</li>
                <li><b className="text-ink-50">Design</b> — architecture, components, data, sequences, testing.</li>
                <li><b className="text-ink-50">Tasks</b> — dependency-ordered waves with explicit outcomes.</li>
              </ol>
              <p className="mt-3 text-xs text-ink-500">
                Bugfix specs swap step 1 for Reproduction → Current → Expected → <i>Unchanged</i> behavior.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-4 py-3">
              <div className="text-xs text-ink-400">
                Don't have skills or agents installed yet?
              </div>
              <button
                onClick={seedDefaults}
                className="text-xs px-3 py-1.5 rounded-md bg-ink-800 hover:bg-ink-700 text-ink-100"
              >
                Seed defaults
              </button>
            </div>
          </>
        )}
      </div>
      {showNew && <NewSpecDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-ink-800 bg-ink-900/40 hover:bg-ink-900 hover:border-ink-700 transition p-5 group"
    >
      <div className="w-9 h-9 grid place-items-center rounded-md bg-accent/15 text-accent mb-3 group-hover:bg-accent/25 transition">
        {icon}
      </div>
      <div className="text-sm font-medium text-ink-50">{title}</div>
      <div className="text-xs text-ink-400 mt-1 leading-relaxed">{description}</div>
    </button>
  );
}
