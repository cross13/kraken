import type { AgentMeta, SkillMeta, SpecKind } from '../../electron/shared/types';

/**
 * Context-aware agent + skill selection.
 *
 * Precedence for agents: explicit per-task `@agent` > chat `@agent` override >
 * the best-matching *installed* agent for the action. "Best match" first tries
 * the bundled default by name, then scores every agent in `.claude/agents`
 * (workspace + global) by how well its name/description fits the work — so a
 * frontend task picks your frontend agent instead of the generic executor.
 */

export type Action =
  | { kind: 'spec-file'; file: 'requirements' | 'bugfix' | 'design' | 'tasks'; specKind: SpecKind }
  | { kind: 'task-execute'; taskAgent?: string; taskText?: string }
  | { kind: 'task-refine'; taskAgent?: string; taskText?: string }
  | { kind: 'polish' }
  | { kind: 'audit' };

/** Why an agent was chosen — surfaced in the UI so routing is transparent. */
export type RouteReason = 'per-task' | 'chat-override' | 'default' | 'specialist' | 'generic';

export interface RoutedAgent {
  name: string | null;
  body: string;
  fromOverride: boolean;
  reason: RouteReason;
}

interface ActionProfile {
  /** bundled default agent names, in priority order */
  preferred: string[];
  /** capability keywords used to score installed agents */
  keywords: string[];
}

// Map free-text task descriptions to capability signals, so we can match an
// installed agent whose name/description mentions the same domain.
const CAPABILITY_TAGS: Record<string, string[]> = {
  frontend: [
    'frontend', 'front-end', 'front end', 'ui', 'ux', 'react', 'vue', 'svelte',
    'component', 'css', 'tailwind', 'style', 'styling', 'button', 'page', 'layout',
    'view', 'render', 'dom', 'accessib', 'responsive', 'animation', 'design system',
  ],
  backend: [
    'backend', 'back-end', 'back end', 'api', 'endpoint', 'server', 'route',
    'controller', 'service', 'handler', 'middleware', 'rest', 'graphql', 'rpc',
  ],
  database: [
    'database', 'db', 'sql', 'schema', 'migration', 'query', 'postgres', 'sqlite',
    'mysql', 'mongo', 'prisma', 'orm', 'index', 'table',
  ],
  test: ['test', 'unit test', 'jest', 'vitest', 'e2e', 'coverage', 'assertion', 'mock'],
  devops: ['ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'deploy', 'build', 'release', 'infra'],
  docs: ['documentation', 'readme', 'changelog', 'docs', 'tutorial', 'guide'],
  security: ['security', 'auth', 'authentication', 'authorization', 'token', 'encrypt', 'vulnerab', 'permission'],
  data: ['data pipeline', 'etl', 'analytics', 'ingestion', 'dataset'],
};

// Broad signals that an agent does general implementation/engineering work —
// used so we still pick a real agent for tasks that don't name a domain.
const IMPLEMENTER_SIGNALS = [
  'implement', 'implementation', 'build', 'building', 'develop', 'developer',
  'development', 'engineer', 'engineering', 'code', 'coding', 'feature',
  'component', 'module', 'refactor', 'function', 'application', 'app', 'software',
  'desktop', 'fullstack', 'full-stack',
];

/** Capability keywords implied by a task description. */
function keywordsFromText(text: string): string[] {
  const t = text.toLowerCase();
  const out = new Set<string>();
  for (const [tag, words] of Object.entries(CAPABILITY_TAGS)) {
    const hits = words.filter((w) => t.includes(w));
    if (hits.length) {
      out.add(tag);
      // include the matched signal words so an agent named e.g. "react-expert" scores
      hits.forEach((w) => out.add(w));
    }
  }
  return [...out];
}

function actionProfile(action: Action): ActionProfile {
  switch (action.kind) {
    case 'spec-file':
      if (action.file === 'requirements')
        return { preferred: ['spec-requirements-writer'], keywords: ['requirement', 'product', 'analyst', 'spec', 'user story'] };
      if (action.file === 'bugfix')
        return { preferred: ['bug-analyzer'], keywords: ['bug', 'debug', 'analyz', 'triage', 'root cause'] };
      if (action.file === 'design')
        return { preferred: ['spec-design-architect'], keywords: ['design', 'architect', 'architecture', 'system', 'ui', 'ux', 'frontend'] };
      return { preferred: ['spec-task-planner'], keywords: ['task', 'plan', 'planner', 'breakdown', 'decompos'] };
    case 'task-execute':
    case 'task-refine':
      // Capability signals from the task text PLUS broad implementation signals,
      // so a general engineering/build agent (e.g. electron-pro) still matches
      // tasks that don't name a specific domain.
      return {
        preferred: ['spec-task-executor'],
        keywords: [...keywordsFromText(action.taskText ?? ''), ...IMPLEMENTER_SIGNALS],
      };
    case 'polish':
      return { preferred: ['code-reviewer'], keywords: ['review', 'reviewer', 'quality', 'refactor', 'lint', 'polish'] };
    case 'audit':
      return { preferred: ['spec-doctor', 'code-reviewer'], keywords: ['audit', 'doctor', 'drift', 'review', 'consistency'] };
  }
}

interface ScoredAgent {
  agent: AgentMeta;
  score: number;
}

/**
 * Highest-scoring installed agent for a set of capability keywords. Project-local
 * (workspace) agents get a bonus so they win over global ones — "best agent from
 * the local .claude folder" is the priority.
 */
function bestByKeywords(agents: AgentMeta[], keywords: string[]): ScoredAgent | null {
  if (!keywords.length) return null;
  let best: ScoredAgent | null = null;
  for (const a of agents) {
    const hay = `${a.name} ${a.description}`.toLowerCase();
    let hits = 0;
    for (const kw of keywords) if (hay.includes(kw)) hits += 1;
    if (hits === 0) continue;
    const score = hits + (a.scope === 'workspace' ? 0.5 : 0);
    if (!best || score > best.score) best = { agent: a, score };
  }
  return best;
}

/** First project-local (workspace) agent, used as a local-first fallback. */
function firstWorkspaceAgent(agents: AgentMeta[]): AgentMeta | null {
  return agents.find((a) => a.scope === 'workspace') ?? null;
}

function found(agent: AgentMeta, reason: RouteReason): RoutedAgent {
  return { name: agent.name, body: agent.body, fromOverride: reason === 'per-task' || reason === 'chat-override', reason };
}

export function routeAgent(
  action: Action,
  agents: AgentMeta[],
  userOverride?: string | null
): RoutedAgent {
  // 1. Explicit per-task @agent always wins.
  const taskAgent =
    (action.kind === 'task-execute' || action.kind === 'task-refine') && action.taskAgent
      ? action.taskAgent
      : null;
  if (taskAgent) {
    const m = agents.find((a) => a.name === taskAgent);
    return m
      ? found(m, 'per-task')
      : { name: taskAgent, body: '', fromOverride: true, reason: 'per-task' };
  }

  // 2. Chat @agent override.
  if (userOverride) {
    const m = agents.find((a) => a.name === userOverride);
    return m
      ? found(m, 'chat-override')
      : { name: userOverride, body: '', fromOverride: true, reason: 'chat-override' };
  }

  const profile = actionProfile(action);
  const isTask = action.kind === 'task-execute' || action.kind === 'task-refine';
  const match = bestByKeywords(agents, profile.keywords);

  if (isTask) {
    // 3a. Strongly-matching specialist (incl. workspace bonus) wins outright.
    if (match && match.score >= 2 && !profile.preferred.includes(match.agent.name)) {
      return found(match.agent, 'specialist');
    }
    // 3b. The bundled task executor, if the user seeded it.
    for (const name of profile.preferred) {
      const m = agents.find((a) => a.name === name);
      if (m) return found(m, 'default');
    }
    // 3c. Any keyword match at all.
    if (match) return found(match.agent, 'specialist');
    // 3d. Local-first: rather than going generic, use a project-local agent.
    const local = firstWorkspaceAgent(agents);
    if (local) return found(local, 'specialist');
    // 3e. Truly nothing installed.
    return { name: null, body: '', fromOverride: false, reason: 'generic' };
  }

  // For phase/review actions, the bundled default is the right pick when present.
  for (const name of profile.preferred) {
    const m = agents.find((a) => a.name === name);
    if (m) return found(m, 'default');
  }
  if (match) return found(match.agent, 'specialist');
  return { name: null, body: '', fromOverride: false, reason: 'generic' };
}

export function routeSkill(
  specKind: SpecKind,
  skills: SkillMeta[]
): SkillMeta | null {
  const name = specKind === 'feature' ? 'sdd-feature' : 'sdd-bugfix';
  return skills.find((s) => s.name === name) ?? null;
}

/** Find an installed skill by exact name. */
export function findSkill(name: string | null | undefined, skills: SkillMeta[]): SkillMeta | null {
  if (!name) return null;
  return skills.find((s) => s.name === name) ?? null;
}

/**
 * Best domain skill for a task's text (e.g. a frontend skill for UI work).
 * Only returns a confident match so we don't inject an irrelevant skill.
 */
export function bestSkillByText(text: string, skills: SkillMeta[]): SkillMeta | null {
  const keywords = keywordsFromText(text);
  if (!keywords.length) return null;
  let best: { skill: SkillMeta; score: number } | null = null;
  for (const s of skills) {
    const hay = `${s.name} ${s.description}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (hay.includes(kw)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { skill: s, score };
  }
  return best && best.score >= 2 ? best.skill : null;
}

/** Build a system-prompt block that actually injects a skill's instructions. */
export function skillSystemBlock(skill: SkillMeta | null | undefined): string {
  if (!skill) return '';
  const body = (skill.body ?? '').trim();
  const header = `# Active skill: ${skill.name}${skill.description ? ` — ${skill.description}` : ''}`;
  return body ? `${header}\n\n${body}` : header;
}

/** Combine several skills' instruction blocks, de-duplicated by name. */
export function skillSystemBlocks(list: (SkillMeta | null | undefined)[]): string {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const s of list) {
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    const b = skillSystemBlock(s);
    if (b) blocks.push(b);
  }
  return blocks.join('\n\n---\n\n');
}
