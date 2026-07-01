import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Wand2,
  Plus,
  Search,
  FileCode2,
  ExternalLink,
  Power,
  PowerOff,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { useModuleConfig } from '../../stores/moduleConfig';
import { renderMarkdown } from '../../lib/markdown';
import { skillScaffold, skillPath, slugify } from '../../lib/library';
import { cn } from '../../lib/cn';
import type { SkillMeta } from '../../../electron/shared/types';
import {
  ModuleHeader,
  ModuleSection,
  Explainer,
  Callout,
  ScopeChip,
} from '../ModuleShell';
import { LibDialogShell, LibField } from './AgentsStudio';

const EXPLAINER = [
  {
    heading: 'What a skill is',
    body: 'A SKILL.md in .claude/skills/<name>/ whose entire body is injected into the system prompt when selected — so it actively steers the model, not just labels the run.',
  },
  {
    heading: 'How one gets injected',
    body: 'The governing SDD skill (sdd-feature / sdd-bugfix by spec kind) is injected into every spec + task run. Kraken additionally injects a domain skill when it confidently matches the work.',
  },
  {
    heading: 'Which is best for a task',
    body: 'Domain skills are scored by keyword fit; only a confident match is injected so an irrelevant skill never leaks in. Tune the threshold and toggles in Orchestration.',
  },
  {
    heading: 'Making your own',
    body: 'New skill scaffolds a SKILL.md in the correct format. Seed defaults installs the bundled SDD skills. Disable any skill below to exclude it from auto-injection.',
  },
];

export function SkillsStudio() {
  const root = useWorkspace((s) => s.root);
  const skills = useWorkspace((s) => s.skills);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? skills.filter(
          (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        )
      : skills;
  }, [skills, query]);

  const selected = skills.find((s) => s.path === selectedPath) ?? filtered[0] ?? null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Sparkles size={18} />}
        title="Skills"
        subtitle={`${skills.length} installed · instructions injected into the prompt`}
        actions={
          <>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-accent text-accent-fg hover:opacity-90"
            >
              <Plus size={13} /> New skill
            </button>
            <button
              onClick={seedDefaults}
              className="flex items-center gap-1.5 text-[12px] px-3 h-8 rounded-lg bg-elev text-dim hover:text-ink-50"
            >
              <Wand2 size={13} /> Seed defaults
            </button>
          </>
        }
      />

      {!root ? (
        <div className="flex-1 grid place-items-center text-[13px] text-faint">
          Open a folder to manage skills.
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[300px] shrink-0 border-r border-ink-800/40 flex flex-col min-h-0">
            <div className="p-3">
              <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-elev">
                <Search size={13} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills…"
                  className="flex-1 bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-faint"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {skills.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <p className="text-[12px] text-faint mb-3">No skills installed.</p>
                  <button
                    onClick={seedDefaults}
                    className="text-[12px] px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold"
                  >
                    Seed defaults
                  </button>
                </div>
              ) : (
                filtered.map((s) => (
                  <SkillRow
                    key={s.path}
                    skill={s}
                    active={selected?.path === s.path}
                    onSelect={() => setSelectedPath(s.path)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-7 py-6">
              <Explainer points={EXPLAINER} />
              {selected ? (
                <SkillDetail skill={selected} />
              ) : (
                <div className="text-[13px] text-faint">Select a skill to inspect it.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {creating && (
        <NewSkillDialog
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setSelectedPath(p);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function SkillRow({
  skill,
  active,
  onSelect,
}: {
  skill: SkillMeta;
  active: boolean;
  onSelect: () => void;
}) {
  const disabled = useModuleConfig((s) => s.config.disabledSkills.includes(skill.name));
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition',
        active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-elev/60'
      )}
    >
      <Sparkles
        size={13}
        className={cn('mt-0.5 shrink-0', disabled ? 'text-ink-600' : active ? 'text-accent' : 'text-dim')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[12.5px] font-medium truncate', disabled ? 'text-ink-500 line-through' : 'text-ink-100')}>
            {skill.name}
          </span>
        </div>
        <p className="text-[11px] text-faint leading-snug line-clamp-2">{skill.description}</p>
      </div>
    </button>
  );
}

function SkillDetail({ skill }: { skill: SkillMeta }) {
  const [body, setBody] = useState('');
  const openTab = useUi((s) => s.openTab);
  const disabled = useModuleConfig((s) => s.config.disabledSkills.includes(skill.name));
  const toggleSkill = useModuleConfig((s) => s.toggleSkill);

  useEffect(() => {
    window.kraken.skills.read(skill.path).then(setBody);
  }, [skill.path]);

  const isSdd = skill.name === 'sdd-feature' || skill.name === 'sdd-bugfix';

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[19px] font-bold text-ink-50 truncate">{skill.name}</h2>
            <ScopeChip scope={skill.scope} />
            {isSdd && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wide bg-sky-500/15 text-sky-300">
                governing
              </span>
            )}
          </div>
          <p className="text-[13px] text-dim mt-0.5 leading-relaxed">{skill.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() =>
            openTab({
              id: `skill:${skill.path}`,
              title: `skill: ${skill.name}`,
              kind: 'skill',
              filePath: skill.path,
            })
          }
          className="flex items-center gap-1.5 text-[11.5px] text-dim px-2.5 py-1 rounded-lg bg-elev hover:text-ink-50"
        >
          <FileCode2 size={12} /> Open file <ExternalLink size={10} />
        </button>
        <button
          onClick={() => toggleSkill(skill.name, disabled)}
          className={cn(
            'flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg font-medium transition',
            disabled ? 'bg-elev text-dim hover:text-ink-50' : 'bg-good/12 text-good'
          )}
        >
          {disabled ? <PowerOff size={12} /> : <Power size={12} />}
          {disabled ? 'Injection off' : 'Injection on'}
        </button>
      </div>

      <ModuleSection
        title="When it's injected"
        desc="How this skill reaches the model during a run."
      >
        {disabled ? (
          <Callout tone="warn">
            Auto-injection is off. This skill is skipped unless a run names it explicitly.
          </Callout>
        ) : isSdd ? (
          <Callout>
            Governs {skill.name === 'sdd-feature' ? 'feature' : 'bugfix'} specs — injected into every
            spec-drafting and task run of that kind.
          </Callout>
        ) : (
          <Callout>
            Injected when its keywords confidently match the task text (domain-skill matching). Adjust
            the confidence threshold in the Orchestration module.
          </Callout>
        )}
      </ModuleSection>

      <ModuleSection title="Injected instructions" desc="The full SKILL.md body prepended to the system prompt.">
        <div className="rounded-xl bg-ink-950 ring-1 ring-ink-800/40 px-5 py-4">
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </div>
      </ModuleSection>
    </div>
  );
}

function NewSkillDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (path: string) => void;
}) {
  const root = useWorkspace((s) => s.root);
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const skills = useWorkspace((s) => s.skills);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slug = slugify(name);
  const exists = skills.some((s) => s.name === slug || s.name === name.trim());

  const create = async () => {
    if (!root || !name.trim() || exists) return;
    setBusy(true);
    setErr(null);
    try {
      const path = skillPath(root, slug);
      await window.kraken.fs.write(path, skillScaffold(slug, description.trim()));
      await refreshAll();
      onCreated(path);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <LibDialogShell title="New skill" onClose={onClose}>
      <p className="text-[12px] text-dim mb-4">
        Writes a scaffolded skill to{' '}
        <code className="font-mono text-accent">.claude/skills/{slug || '<name>'}/SKILL.md</code>. The
        body is injected verbatim into the prompt, so write it as direct instructions.
      </p>
      <LibField label="Name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. tailwind-ui"
          className="lib-input"
        />
      </LibField>
      {name.trim() && exists && (
        <p className="text-[11px] text-bad -mt-2 mb-3">name already exists</p>
      )}
      <LibField label="Description (when it applies)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Apply when styling components with Tailwind — spacing, tokens, responsive rules…"
          className="lib-input min-h-[80px] resize-none"
        />
      </LibField>
      {err && <p className="text-[12px] text-bad mb-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-lg text-dim hover:text-ink-50">
          Cancel
        </button>
        <button
          onClick={create}
          disabled={!name.trim() || exists || busy}
          className="text-[12px] font-semibold px-4 h-8 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create skill'}
        </button>
      </div>
    </LibDialogShell>
  );
}
