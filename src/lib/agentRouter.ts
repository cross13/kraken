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
export type RouteReason =
  | 'per-task'
  | 'chat-override'
  | 'pinned'
  | 'default'
  | 'specialist'
  | 'generic';

/**
 * User-tunable routing knobs. Defaults reproduce the built-in behavior, so the
 * router works untouched; the renderer's module-config store pushes overrides in
 * via `setRouterConfig`, and every call site picks them up automatically.
 */
export interface RouterConfig {
  /** score bonus applied to workspace (project-local) agents */
  workspaceBonus: number;
  /** minimum score for a non-preferred specialist to win a task outright */
  specialistThreshold: number;
  /** when no agent matches a task, fall back to the first project-local agent */
  localFirst: boolean;
  /** action key (see `actionKey`) → pinned agent name */
  pinnedAgents: Record<string, string>;
  /** inject the governing SDD skill into spec/task prompts */
  skillInjection: boolean;
  /** additionally inject a confident domain skill (e.g. a frontend skill) */
  domainSkillInjection: boolean;
  /** minimum keyword score for a domain skill to be injected */
  domainSkillThreshold: number;
  /** skill names excluded from auto-injection */
  disabledSkills: string[];
}

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  workspaceBonus: 0.5,
  specialistThreshold: 2,
  localFirst: true,
  pinnedAgents: {},
  skillInjection: true,
  domainSkillInjection: true,
  domainSkillThreshold: 2,
  disabledSkills: [],
};

let activeConfig: RouterConfig = { ...DEFAULT_ROUTER_CONFIG };

/** Merge user overrides into the active routing config (renderer calls this). */
export function setRouterConfig(cfg: Partial<RouterConfig>): void {
  activeConfig = { ...DEFAULT_ROUTER_CONFIG, ...cfg };
}

/** Current effective routing config. */
export function getRouterConfig(): RouterConfig {
  return activeConfig;
}

/** Stable key for an action, used for per-action agent pins. */
export function actionKey(action: Action): string {
  return action.kind === 'spec-file' ? action.file : action.kind;
}

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
export function keywordsFromText(text: string): string[] {
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

export function actionProfile(action: Action): ActionProfile {
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

export interface ScoredAgent {
  agent: AgentMeta;
  score: number;
  /** keywords that matched the agent's name/description */
  hits: string[];
  /** workspace bonus folded into the score (0 for global agents) */
  bonus: number;
}

/**
 * Score every installed agent against a set of capability keywords, ranked
 * high→low. Project-local (workspace) agents get a configurable bonus so they win
 * over global ones. Exposed so the Orchestration studio can show the full
 * breakdown behind a routing decision.
 */
export function scoreAgents(agents: AgentMeta[], keywords: string[]): ScoredAgent[] {
  const bonus = activeConfig.workspaceBonus;
  const out: ScoredAgent[] = [];
  for (const a of agents) {
    const hay = `${a.name} ${a.description}`.toLowerCase();
    const hits = keywords.filter((kw) => hay.includes(kw));
    if (!hits.length) continue;
    const b = a.scope === 'workspace' ? bonus : 0;
    out.push({ agent: a, hits, bonus: b, score: hits.length + b });
  }
  return out.sort((x, y) => y.score - x.score);
}

/**
 * Highest-scoring installed agent for a set of capability keywords.
 */
function bestByKeywords(agents: AgentMeta[], keywords: string[]): ScoredAgent | null {
  if (!keywords.length) return null;
  return scoreAgents(agents, keywords)[0] ?? null;
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

  // 3. User-pinned agent for this action (from the Orchestration studio).
  const pinned = activeConfig.pinnedAgents[actionKey(action)];
  if (pinned) {
    const m = agents.find((a) => a.name === pinned);
    return m
      ? found(m, 'pinned')
      : { name: pinned, body: '', fromOverride: false, reason: 'pinned' };
  }

  const profile = actionProfile(action);
  const isTask = action.kind === 'task-execute' || action.kind === 'task-refine';
  const match = bestByKeywords(agents, profile.keywords);

  if (isTask) {
    // 4a. Strongly-matching specialist (incl. workspace bonus) wins outright.
    if (
      match &&
      match.score >= activeConfig.specialistThreshold &&
      !profile.preferred.includes(match.agent.name)
    ) {
      return found(match.agent, 'specialist');
    }
    // 4b. The bundled task executor, if the user seeded it.
    for (const name of profile.preferred) {
      const m = agents.find((a) => a.name === name);
      if (m) return found(m, 'default');
    }
    // 4c. Any keyword match at all.
    if (match) return found(match.agent, 'specialist');
    // 4d. Local-first: rather than going generic, use a project-local agent.
    if (activeConfig.localFirst) {
      const local = firstWorkspaceAgent(agents);
      if (local) return found(local, 'specialist');
    }
    // 4e. Truly nothing installed.
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
  if (!activeConfig.skillInjection) return null;
  const name = specKind === 'feature' ? 'sdd-feature' : 'sdd-bugfix';
  if (activeConfig.disabledSkills.includes(name)) return null;
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
  if (!activeConfig.domainSkillInjection) return null;
  const keywords = keywordsFromText(text);
  if (!keywords.length) return null;
  let best: { skill: SkillMeta; score: number } | null = null;
  for (const s of skills) {
    if (activeConfig.disabledSkills.includes(s.name)) continue;
    const hay = `${s.name} ${s.description}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) if (hay.includes(kw)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { skill: s, score };
  }
  return best && best.score >= activeConfig.domainSkillThreshold ? best.skill : null;
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

/**
 * Full explanation of how the router would resolve an action — the chosen agent
 * and skills plus the ranked candidate breakdown behind that decision. Powers the
 * Orchestration studio's routing playground, using the exact same logic as a real
 * run so what you preview is what you get.
 */
export interface RouteExplanation {
  agent: RoutedAgent;
  /** governing skill (SDD feature/bugfix) that would be injected */
  governingSkill: SkillMeta | null;
  /** confident domain skill match, if any */
  domainSkill: SkillMeta | null;
  keywords: string[];
  preferred: string[];
  candidates: ScoredAgent[];
}

export function explainRoute(
  action: Action,
  agents: AgentMeta[],
  skills: SkillMeta[],
  specKind: SpecKind,
  userOverride?: string | null
): RouteExplanation {
  const profile = actionProfile(action);
  const text =
    (action.kind === 'task-execute' || action.kind === 'task-refine'
      ? action.taskText
      : '') ?? '';
  return {
    agent: routeAgent(action, agents, userOverride),
    governingSkill: routeSkill(specKind, skills),
    domainSkill: bestSkillByText(text, skills),
    keywords: profile.keywords,
    preferred: profile.preferred,
    candidates: scoreAgents(agents, profile.keywords),
  };
}
