import type { AgentMeta, SkillMeta } from '../../electron/shared/types';

/**
 * Resolution of an agent/skill name against the *installed* library — the
 * `.claude/agents` & `.claude/skills` dirs in the workspace root (scope
 * `workspace`) and the user's home (`global`). The lists in the workspace store
 * are already deduped with workspace taking priority, so a name resolves to the
 * single effective file that a run would actually use.
 */
export interface LibResolution {
  /** the name we tried to resolve (null = generic / none) */
  name: string | null;
  /** false when the name doesn't match any installed file */
  installed: boolean;
  /** workspace = the project's root .claude/, global = ~/.claude/ */
  scope?: 'workspace' | 'global';
  /** absolute path to the resolved markdown file */
  path?: string;
}

export function resolveAgent(
  name: string | null | undefined,
  agents: AgentMeta[]
): LibResolution {
  if (!name) return { name: null, installed: false };
  const m = agents.find((a) => a.name === name);
  return m
    ? { name, installed: true, scope: m.scope, path: m.path }
    : { name, installed: false };
}

export function resolveSkill(
  name: string | null | undefined,
  skills: SkillMeta[]
): LibResolution {
  if (!name) return { name: null, installed: false };
  const m = skills.find((s) => s.name === name);
  return m
    ? { name, installed: true, scope: m.scope, path: m.path }
    : { name, installed: false };
}

/** Short, human label for where a resolved file lives. */
export function scopeLabel(scope?: 'workspace' | 'global'): string {
  if (scope === 'workspace') return 'root';
  if (scope === 'global') return 'global';
  return 'not installed';
}
