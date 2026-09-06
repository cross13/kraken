// The Quick Start's checklist, and the one action that improves a skill.
//
// Every step here is **verified, not asserted**: it reads the same state the
// rest of the app reads, so a green check means the thing is actually true and
// a step the user already did on their own is already done. A tour that says
// "now open a workspace" to someone with one open is a tour nobody finishes.

import type { AgentMeta, SkillMeta, SpecMeta, SteeringFile } from '../../electron/shared/types';

export type StepId =
  | 'workspace'
  | 'backend'
  | 'library'
  | 'steering'
  | 'spec'
  | 'tracker';

export interface Step {
  id: StepId;
  title: string;
  /** Why it matters for the quality of the code that comes out. */
  why: string;
  done: boolean;
  /** What is true right now — shown instead of the `why` once done. */
  detail?: string;
  /** true when the step is worth doing but nothing breaks without it. */
  optional?: boolean;
}

export interface QuickStartState {
  root: string | null;
  backend: 'cli' | 'api';
  cliFound: boolean;
  cliVersion?: string;
  hasApiKey: boolean;
  agents: AgentMeta[];
  skills: SkillMeta[];
  steering: SteeringFile[];
  specs: SpecMeta[];
  trackers: number;
}

/**
 * Which steering docs actually say something.
 *
 * The bundled ones are seeded as scaffolds — a heading, an italic instruction,
 * and `- **Label**:` bullets with nothing after the colon. Counting those as
 * "done" would tick the highest-leverage step on the list for a workspace where
 * nobody has written a word, which is exactly the lie this checklist exists to
 * avoid. So the test is structural: is there any line left once headings, the
 * italic prompts and the empty label bullets are removed?
 */
export function steeringFilled(files: SteeringFile[]): SteeringFile[] {
  return files.filter((f) => {
    const meaningful = (f.body ?? '')
      .replace(/^---[\s\S]*?---/, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('#'))
      .filter((l) => !/^_.*_$/.test(l))
      .filter((l) => !/^-\s*\*\*.*\*\*[^:]*:\s*$/.test(l));
    return meaningful.length > 0;
  });
}

export function buildSteps(s: QuickStartState): Step[] {
  const ready = s.backend === 'cli' ? s.cliFound : s.hasApiKey;
  const filled = steeringFilled(s.steering);

  return [
    {
      id: 'workspace',
      title: 'Open the repository you want to work in',
      why: 'Octo runs Claude with this folder as its working directory, so it sees your code, your CLAUDE.md and your existing .claude/ setup.',
      done: Boolean(s.root),
      detail: s.root ? s.root.split('/').slice(-2).join('/') : undefined,
    },
    {
      id: 'backend',
      title: 'Connect a backend',
      why: 'The local Claude CLI is the default and the one that can edit files. The API backend has no tools, so it cannot write a spec document to disk.',
      done: ready,
      detail: ready
        ? s.backend === 'cli'
          ? `Claude CLI${s.cliVersion ? ` ${s.cliVersion}` : ''}`
          : 'Anthropic API key stored'
        : undefined,
    },
    {
      id: 'library',
      title: 'Install the bundled library',
      why: 'Twelve agents, six skills and the hooks that drive the SDD loop. The format skills are what keep Claude writing documents this app can actually parse.',
      done: s.agents.length > 0 && s.skills.length > 0,
      detail:
        s.agents.length > 0
          ? `${s.agents.length} agents · ${s.skills.length} skills installed`
          : undefined,
    },
    {
      id: 'steering',
      title: 'Say what this project is',
      why: 'Steering docs are prepended to every single run. This is the highest-leverage thing you can do for code quality: it is how Claude learns your stack, your commands and your conventions instead of guessing them.',
      done: filled.length > 0,
      detail: filled.length ? `${filled.map((f) => f.name).join(', ')} filled in` : undefined,
    },
    {
      id: 'spec',
      title: 'Run one spec end to end',
      why: 'Requirements → Plan → Build. The loop only makes sense once you have watched a gate stop you and a wave run tasks in parallel.',
      done: s.specs.length > 0,
      detail: s.specs.length
        ? `${s.specs.length} spec${s.specs.length === 1 ? '' : 's'}, ${s.specs.filter((x) => x.phase === 'done').length} shipped`
        : undefined,
    },
    {
      id: 'tracker',
      title: 'Connect your tracker',
      why: 'Link each spec to its Jira or tracker ticket, and start new specs from tickets that already exist instead of retyping them.',
      done: s.trackers > 0,
      detail: s.trackers ? `${s.trackers} tracker${s.trackers === 1 ? '' : 's'} enabled` : undefined,
      optional: true,
    },
  ];
}

// ---------- tips ----------

export interface Tip {
  title: string;
  body: string;
}

/**
 * Advice that is specific to how this app actually behaves. Generic prompting
 * tips are a web search away; these are the things you would only learn by
 * reading Octo's source or by losing an afternoon to them.
 */
export const TIPS: Tip[] = [
  {
    title: 'Steering beats prompting',
    body: 'Anything you would otherwise repeat in every prompt belongs in `.octo/steering/`. It is prepended to every run — chat, spec drafting, task execution and hooks alike — so it is the one place where writing something once actually changes everything.',
  },
  {
    title: 'Let the Plan stage ask you questions',
    body: 'A plan run that hits a decision it cannot make writes questions into Open Questions and stops, once. Answering them in Clarify costs a minute and saves the plan from committing to the wrong data shape. Quick Plan skips this deliberately — use it when you already know the answer.',
  },
  {
    title: 'Waves run in parallel, so keep them disjoint',
    body: 'Every task in a wave runs at the same time, as its own agent. Two tasks touching the same file will fight. If the plan puts them together, move one to the next wave before you press Run all.',
  },
  {
    title: 'Name the specialist when you know it',
    body: 'Write `- [ ] T4 @frontend-expert: …` on a task line and that agent runs it. Otherwise routing picks from the task text, and you can see exactly what it would choose in Library › Routing.',
  },
  {
    title: 'Read the format check, it is free',
    body: 'The strip above the gate bar is computed from the same parsers the app reads your documents with — no run, no cost. A criterion without SHALL is invisible to the Review view and never gets traced to a task, and it will tell you so.',
  },
  {
    title: 'Cite AC-n in the plan',
    body: 'When the plan names the criteria it satisfies, the Review view shows confirmed coverage. When it does not, coverage is guessed from word overlap — and guesses wrong. Improve with Claude adds the missing citations.',
  },
  {
    title: 'The gate is the point',
    body: 'Approving a document is what advances the phase, and approving the plan derives tasks.md from its ## Tasks section. If you find yourself approving without reading, you are running a very expensive autocomplete.',
  },
  {
    title: 'Watch runs on a second screen',
    body: 'The Travel Display (⌘K → Open Travel Display) puts every in-flight run on a secondary monitor as one colony. The katana pose is the verb, the face is the status, and the leash is what a task is waiting on.',
  },
];

// ---------- improving a skill with Claude ----------

/**
 * The rules a skill is judged against. Anthropic's own skill-authoring guidance,
 * plus the two constraints that are specific to this app: a skill's body is
 * injected verbatim into the system prompt, so length is a real cost; and the
 * front-matter `description` is what routing scores against, so it is
 * load-bearing rather than decorative.
 */
export const SKILL_REVIEW_SYSTEM = `You improve Agent Skills — the SKILL.md files Claude Code loads to learn how to do a specific kind of work.

Judge and rewrite against these rules:

- **The description is the trigger.** It is injected into the system prompt and is what skill routing scores against. Write it in the third person, say both what the skill does and when it applies, and be a little pushy about it — skills under-trigger far more often than they over-trigger. Avoid words that would make it match unrelated work.
- **The body is a cost.** It is prepended verbatim to the system prompt of every run that activates it. Cut anything the model already knows. Keep it under 500 lines; well under, if you can.
- **Imperative, specific, and about *this* project.** "Use the repo's existing error type" beats "handle errors well". Generic advice is noise the model already has.
- **Explain the reasoning, don't just forbid.** A rule with its "because" survives situations the author did not foresee; a bare ALWAYS/NEVER does not.
- **Show, where the shape is subtle.** One input/output example is worth a paragraph of description.

Keep the author's voice and intent. Do not invent facts about the project you cannot verify from the repository. If a section is already good, leave it alone.`;

export function skillReviewPrompt(skill: SkillMeta, relPath: string): string {
  return `Improve the skill **${skill.name}**, at \`${relPath}\`.

Read that file first, and read enough of the surrounding repository to judge whether its advice is true here — a skill that describes a stack this project does not use is worse than no skill.

Then rewrite it in place with the Edit or Write tool. Do not paste the result into chat; edit the file.

Afterwards, reply with a short list of what you changed and why — and say plainly if you think the skill should be deleted rather than improved.`;
}
