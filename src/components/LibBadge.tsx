import { Bot, Sparkles, Check, Globe, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/cn';
import { useWorkspace } from '../stores/workspace';
import { useUi } from '../stores/ui';
import { resolveAgent, resolveSkill, scopeLabel } from '../lib/verifyLibrary';

/**
 * A verified agent/skill chip: resolves the name against the installed library
 * and shows whether it's installed, from the root workspace `.claude/` or the
 * global `~/.claude/`. Click to open the resolved file. Falls back to a neutral
 * "generic" chip when no specific agent was routed.
 */
export function LibBadge({
  kind,
  name,
}: {
  kind: 'agent' | 'skill';
  name: string | null | undefined;
}) {
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const openTab = useUi((s) => s.openTab);

  const Icon = kind === 'agent' ? Bot : Sparkles;

  // Generic (no specific agent routed) — nothing to verify.
  if (!name) {
    return (
      <span
        title={
          kind === 'skill'
            ? 'No skill matched this run — nothing was injected.'
            : 'No specialized agent — Claude runs with the generic prompt.'
        }
        className="text-[9px] px-1.5 py-0.5 rounded bg-ink-700 text-ink-400 flex items-center gap-1"
      >
        <Icon size={9} /> {kind === 'skill' ? 'no skill' : 'generic'}
      </span>
    );
  }

  const res = kind === 'agent' ? resolveAgent(name, agents) : resolveSkill(name, skills);

  if (!res.installed) {
    return (
      <span
        title={`"${name}" is not installed in .claude/${kind}s (workspace root) or ~/.claude — the run falls back to the generic prompt.`}
        className="text-[9px] px-1.5 py-0.5 rounded bg-warn/15 text-warn flex items-center gap-1"
      >
        <AlertTriangle size={9} />
        {name}
        <span className="opacity-70">· missing</span>
      </span>
    );
  }

  const inRoot = res.scope === 'workspace';

  const open = () =>
    res.path &&
    openTab({
      id: `${kind}:${res.path}`,
      title: `${kind}: ${name}`,
      kind,
      filePath: res.path,
    });

  return (
    <button
      onClick={open}
      title={`${name} — installed in ${scopeLabel(res.scope)} (${res.path}). Click to open.`}
      className={cn(
        'text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 hover:brightness-125 transition',
        kind === 'agent'
          ? 'bg-accent/15 text-accent'
          : 'bg-sky-500/15 text-sky-300'
      )}
    >
      <Icon size={9} />
      {name}
      <span className="flex items-center gap-0.5 opacity-80">
        {inRoot ? <Check size={8} /> : <Globe size={8} />}
        {scopeLabel(res.scope)}
      </span>
    </button>
  );
}
