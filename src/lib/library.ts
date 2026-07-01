import type { AgentMeta, SkillMeta } from '../../electron/shared/types';
import { routeAgent, type Action } from './agentRouter';
import { ROUTABLE_ACTIONS, type RoutableAction } from '../stores/moduleConfig';

/** kebab-case a display name into a safe file/skill slug. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

/** Absolute path for a new workspace agent file. */
export function agentPath(root: string, slug: string): string {
  return `${root}/.claude/agents/${slug}.md`;
}

/** Absolute path for a new workspace skill file. */
export function skillPath(root: string, slug: string): string {
  return `${root}/.claude/skills/${slug}/SKILL.md`;
}

/** Front-matter scaffold for a new agent, in Claude Code's exact format. */
export function agentScaffold(name: string, description: string, model?: string): string {
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${description || 'Describe when this agent should be used.'}`,
  ];
  if (model) lines.push(`model: ${model}`);
  lines.push('tools: Read, Write, Edit, Bash, Grep, Glob');
  lines.push('---');
  lines.push('');
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(
    'You are a specialized agent. Describe the role, the kinds of tasks you handle,'
  );
  lines.push('and the conventions you follow.');
  lines.push('');
  lines.push('## When to use me');
  lines.push('');
  lines.push('- …');
  lines.push('');
  lines.push('## How I work');
  lines.push('');
  lines.push('1. …');
  lines.push('');
  return lines.join('\n');
}

/** SKILL.md scaffold for a new skill, in Claude Code's exact format. */
export function skillScaffold(name: string, description: string): string {
  return [
    '---',
    `name: ${name}`,
    `description: ${description || 'Explain when this skill applies and what it does.'}`,
    '---',
    '',
    `# ${name}`,
    '',
    'The full body of this skill is injected into the system prompt whenever it is',
    'selected, so write it as direct instructions to the model.',
    '',
    '## Instructions',
    '',
    '- …',
    '',
    '## Examples',
    '',
    '- …',
    '',
  ].join('\n');
}

function buildAction(key: RoutableAction, taskText: string): Action {
  switch (key) {
    case 'requirements':
      return { kind: 'spec-file', file: 'requirements', specKind: 'feature' };
    case 'bugfix':
      return { kind: 'spec-file', file: 'bugfix', specKind: 'bugfix' };
    case 'design':
      return { kind: 'spec-file', file: 'design', specKind: 'feature' };
    case 'tasks':
      return { kind: 'spec-file', file: 'tasks', specKind: 'feature' };
    case 'task-execute':
      return { kind: 'task-execute', taskText };
    case 'task-refine':
      return { kind: 'task-refine', taskText };
    case 'polish':
      return { kind: 'polish' };
    case 'audit':
      return { kind: 'audit' };
  }
}

export { buildAction };

/**
 * Which SDD actions would route to a given agent right now (given the installed
 * library + current config). Used to show "best for" on an agent's detail page.
 */
export function actionsRoutingTo(
  agentName: string,
  agents: AgentMeta[]
): { key: RoutableAction; label: string }[] {
  const out: { key: RoutableAction; label: string }[] = [];
  for (const a of ROUTABLE_ACTIONS) {
    // Feed a domain-less task so matching is based on the agent's own fit.
    const routed = routeAgent(buildAction(a.key, ''), agents);
    if (routed.name === agentName) out.push({ key: a.key, label: a.label });
  }
  return out;
}
