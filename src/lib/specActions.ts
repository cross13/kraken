import { useChat } from '../stores/chat';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { useModels } from '../stores/models';
import { useUi, stageForPhase } from '../stores/ui';
import {
  matchingSkills,
  routeAgent,
  routeFormatSkill,
  routeSkill,
  skillSystemBlocks,
  type SpecDocFile,
} from './agentRouter';
import { resolveAgent, resolveSkill } from './verifyLibrary';
import type { SkillMeta, SpecKind, SpecMeta, TicketSummary } from '../../electron/shared/types';

// Declared next to the router that dispatches on it; re-exported here because
// this is where the rest of the renderer has always imported it from.
export type { SpecDocFile };

/** The doc file for a spec's first stage (bug specs analyze instead of gather). */
export function firstStageFile(kind: SpecKind): SpecDocFile {
  return kind === 'feature' ? 'requirements' : 'bugfix';
}

const EARS = `Use EARS notation strictly: "WHEN <event> THEN the system SHALL <behavior>", "WHILE <state> THE system SHALL <behavior>", "IF <precondition> THEN the system SHALL <behavior>". **Number every criterion** \`- AC-1: …\`, \`- AC-2: …\` — the plan cites those ids, and the Review view traces each one to the sections and tasks that satisfy it.`;

function editInstruction(targetPath: string) {
  return `Use the **Read** tool to read the current contents of \`${targetPath}\`, then use the **Edit** or **Write** tool to apply your changes directly to that file. Do not paste the full file in chat — write it to disk. Keep a short summary of what you changed in your reply.`;
}

function draftPrompt(
  meta: SpecMeta,
  specRel: string,
  file: SpecDocFile,
  noStops = false
): string {
  const targetPath = `${specRel}/${file}.md`;
  const prompts: Record<SpecDocFile, string> = {
    requirements: `Draft or refine **requirements.md** for the feature spec "${meta.name}".

${EARS}

Required sections: Introduction, User Stories, Acceptance Criteria (EARS), Out of Scope, Non-Functional Requirements.

Number the user stories \`US-1\`, \`US-2\`, … and end each criterion with the story it answers, \`(US-2)\`. **Every story needs a criterion and every criterion needs a story** — a story nothing tests gets silently dropped in the build; a criterion no story asks for is scope from nowhere. Write criteria that can be checked: "responds in under 200 ms", never "feels responsive".

${editInstruction(targetPath)}`,
    bugfix: `Draft or refine **bugfix.md** for the bug "${meta.name}".

Required sections: Reproduction (numbered steps), Current Behavior (WHEN/THEN), Expected Behavior (WHEN/THEN/SHALL), Unchanged Behavior (WHEN/THEN/SHALL CONTINUE TO — these protect against regressions), Environment.

${editInstruction(targetPath)}`,
    plan: `Draft or refine **plan.md** for "${meta.name}".

Read the current \`${specRel}/${meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'}\` first. If it has a **Resolved Decisions** section, treat each entry as a settled answer to an open question and reflect those decisions in the plan — do not re-open them.

${noStops ? `**Do not stop to ask.** This is a hands-off run: pick the reasonable default for every open decision, record it in the plan, and list anything the user should revisit under \`## Open Questions\`.` : `**Clarify before you plan.** Before writing anything, check whether a decision would *materially change* this plan — library or dependency choice, data shape, migration strategy, a UX tradeoff, an ambiguous requirement. If 1–4 such unknowns exist and \`## Resolved Decisions\` does not already answer them: do **not** draft. Append them to the \`## Open Questions\` section of \`${specRel}/${meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'}\` (one \`- [ ] question\` line each, creating the section if missing, never duplicating a question that is already there), tell the user in chat to answer them in **Open Questions → Apply to requirements**, and stop without touching \`plan.md\`.

Ask **once**. If \`## Resolved Decisions\` already exists, or the user has told you to proceed, draft the plan now: pick the reasonable default for anything still open and record it in the plan rather than stopping again.`}

Produce exactly these sections, in this order:

1. A one-line objective blockquote (\`> …\`) with appetite and risk.
2. \`## Approach\` — open with **one \`\`\`mermaid flowchart** of the approach (3–7 nodes, every label quoted), then one paragraph: the strategy chosen and, in one sentence each, the alternatives rejected.
3. \`## Affected files\` — a table \`| File | Change |\` with real \`path:line\` references from this workspace. Locate them; do not guess.
4. **The changes, area by area** — one \`##\` section per area of the codebase this touches, named after this project's real boundaries (\`## Backend changes\` / \`## Frontend changes\`, or \`## Main-process changes\` / \`## Renderer changes\` — use the names the repo itself uses). Cover schemas, IPC, persisted state, components and stores here.
5. \`## Key implementation details\` — the specifics an executor would otherwise have to guess: defaults, formats, ordering, edge cases, error states.
6. \`## Risks & rollback\` — a table \`| Risk | Mitigation | How to revert |\`.
7. \`## Verification\` — every acceptance criterion mapped to how it is proven.
8. \`## Tasks\` — **required.** Dependency-ordered waves as \`### Wave 1\`, \`### Wave 2 (depends on T1)\`, … Wave 1 has no dependencies and its tasks must be parallel-safe (disjoint files). Every task has exactly one observable outcome.
9. \`## Open Questions\`.

**Cite the criteria.** Write the requirement ids (\`AC-1\`, \`AC-2\`, …) into the rows, bullets and **task lines** that satisfy them — e.g. \`- [ ] T3: render the option chips — _outcome: clicking an option resolves it (AC-3)_\`. The Review view reads those ids to show coverage: a cited criterion is confirmed, an uncited one is only inferred from wording.

**Write the contracts as code, not as prose.** In the area sections, commit to the literal shape in a fenced block: the exact type or interface, the SQL column with its default, the IPC signature, the JSON key. \`custom_fields TEXT DEFAULT '[]'\` and \`{ id, name, value, type, visibleOnCard }\` are plan material; "store the fields somewhere" is not.

Leave a \`## Critical Decisions\` heading at the end of the file (with no entries): the Build stage appends to it when execution deviates from this plan.

Format each task line **exactly** as \`- [ ] T1: <description> — _outcome: ..._\` — a plain checkbox, then the bare id (T1, T2, …), then a colon. Do NOT wrap the id or checkbox in markdown bold/emphasis (no \`**T1**\`, no \`__T1__\`). Optionally name a specialized agent as \`- [ ] T1 @agent-name: <description>\`.

The \`## Tasks\` section is what the Build stage executes: approving this plan copies it into tasks.md verbatim, so **a plan without it cannot be approved**.

${editInstruction(targetPath)}`,
    tasks: `Draft or refine **tasks.md** for "${meta.name}".

Read the current \`${specRel}/plan.md\` first. Then produce dependency-ordered waves: Wave 1 = no dependencies and parallel-safe; each later wave lists its prerequisites explicitly. Every task has a single observable outcome. Close with a Verification checklist that maps every acceptance criterion to at least one task.

Format each task line **exactly** as \`- [ ] T1: <description>\` — a plain checkbox, then the bare id (T1, T2, …), then a colon. Do NOT wrap the id or checkbox in markdown bold/emphasis (no \`**T1**\`, no \`__T1__\`). Optionally name a specialized agent as \`- [ ] T1 @agent-name: <description>\`.

${editInstruction(targetPath)}`,
  };
  return prompts[file];
}

function buildSystem(agentBody: string, meta: SpecMeta, files: Record<string, string>): string {
  const base = `You are the Octo SDD agent helping with a ${meta.kind} spec titled "${meta.name}". Current phase: ${meta.phase}. Be precise. Output GitHub-flavored markdown. Do not invent behaviors that are not stated or strongly implied — ask once for missing context, then commit to a draft.`;
  const context = [
    files.requirements && `# requirements.md\n${files.requirements}`,
    files.bugfix && `# bugfix.md\n${files.bugfix}`,
    files.plan && `# plan.md\n${files.plan}`,
    files.tasks && `# tasks.md\n${files.tasks}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return [base, agentBody, context && `# Current spec files\n\n${context}`]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The text a domain-skill match is made against: what the document being written
 * is *about*. For a plan that is the approved requirements plus the original
 * brief — the plan itself is usually still empty, so matching on it finds
 * nothing.
 */
export function groundingText(meta: SpecMeta, files: Record<string, string>): string {
  return [meta.name, meta.brief, files.requirements, files.bugfix].filter(Boolean).join('\n');
}

/** The base skills every spec run carries. */
export function skillsFor(meta: SpecMeta, file: SpecDocFile, skills: SkillMeta[]): SkillMeta[] {
  return [routeSkill(meta.kind, skills), routeFormatSkill(file, skills)].filter(
    Boolean
  ) as SkillMeta[];
}

/**
 * The skills a spec-drafting run actually injects, comma-joined — `SpecRunRow.skill`
 * is documented as a list, and Activity would otherwise name only the first one.
 */
function injectedSkillNames(list: SkillMeta[]): string | null {
  const names = [...new Set(list.map((s) => s.name))];
  return names.length ? names.join(', ') : null;
}

export interface DraftOptions {
  meta: SpecMeta;
  files: Record<string, string>;
  file: SpecDocFile;
  /** the user's original description (from the Home composer) to ground the draft */
  brief?: string;
  /** revision feedback from the gate bar's "Revise with feedback" */
  feedback?: string;
  /** self-review mode: Claude critiques the current doc and refines it in place */
  improve?: boolean;
  /**
   * Names of domain skills to inject on top of the base two. Explicit names
   * rather than a flag, because detection is a suggestion the user gets to
   * overrule before the run — substring matching finds a "file table" as
   * readily as a database one.
   */
  domainSkills?: string[];
  /**
   * Hands-off run (Quick Plan): never stop to ask. Suppresses the Plan step's
   * clarifying-question round so the draft always lands on disk.
   */
  noStops?: boolean;
}

/** What the critical self-review pass looks for, per document. */
const IMPROVE_FOCUS: Record<SpecDocFile, string> = {
  requirements: `- Every acceptance criterion is strict EARS and independently testable — replace untestable wording ("responsive", "intuitive", "easy to use", "fast") with the number or the observable behind it.
- Every user story has at least one criterion, and every criterion names the story it answers (\`US-n\`). Call out a story nothing covers, and a criterion no story asks for.
- Ambiguities, undefined behaviors, and missing edge cases (empty states, errors, concurrency, permissions).
- User stories without criteria, criteria without stories, and contradictions between sections.
- Missing non-functional requirements that the feature obviously implies (performance, persistence, a11y).
- Scope creep: anything that belongs in Out of Scope.`,
  bugfix: `- The reproduction is complete and deterministic (numbered, environment pinned).
- Current vs Expected Behavior are precise WHEN/THEN statements that don't overlap or contradict.
- Unchanged Behavior guards cover the realistic regression surface, not just the happy path.
- Any hypothesis stated as fact — separate observed behavior from diagnosis.`,
  plan: `- Every acceptance criterion in the requirements maps to a concrete part of the plan; call out any that don't.
- The Approach diagram reflects the real flow — remove hand-waving ("somehow", "as needed").
- Affected-file references are real paths in this workspace, not invented ones.
- The changes are grouped by area of the codebase, and each area names the real files it touches.
- Contracts are written as code, not prose: exact types, SQL with defaults, IPC signatures, JSON keys. Replace every "store it somewhere" with the literal shape.
- Key implementation details leave nothing for the executor to guess (defaults, formats, ordering, edge cases, error states).
- Error and failure modes the requirements imply are covered.
- Verification maps back to every acceptance criterion.
- Every acceptance criterion id appears somewhere in the plan — add the missing \`AC-n\` citations to the sections and task lines that already satisfy them, and say so when a criterion has nothing to cite.
- \`## Tasks\` exists and is executable: wave ordering is correct, tasks in the same wave are truly parallel-safe (disjoint files), dependencies are explicit, and each task has exactly one observable outcome — split tasks that hide several.
- Task lines keep the exact \`- [ ] T1: …\` format (checkbox state preserved for completed tasks).`,
  tasks: `- Every component named in the plan and every acceptance criterion is covered by at least one task; call out gaps.
- Wave ordering is correct: tasks in the same wave are truly parallel-safe (disjoint files), dependencies are explicit.
- Each task has exactly one observable outcome — split tasks that hide several.
- The Verification checklist maps every acceptance criterion to at least one task.
- Task lines keep the exact \`- [ ] T1: …\` format (checkbox state preserved for completed tasks).`,
};

/**
 * Draft (or revise) one spec document with Claude. The agent edits the file on
 * disk via tools; progress streams into the chat/Assistant like before. The
 * returned promise resolves once the run finishes — `true` on success — so
 * callers (Quick Plan) can chain phases.
 */
export function draftSpecDoc(opts: DraftOptions): Promise<boolean> {
  const { meta, files, file } = opts;
  const chat = useChat.getState();
  const orch = useOrchestrator.getState();
  const { agents, skills, root } = useWorkspace.getState();
  const specRel = meta.path.replace(root ? root + '/' : '', '');

  // Revising, improving, or running hands-off never stops to ask: the document
  // has to come back changed.
  const noStops = Boolean(opts.noStops || opts.improve || opts.feedback);
  const parts = [draftPrompt(meta, specRel, file, noStops)];
  if (opts.brief) {
    parts.push(`The user described the work as:\n\n> ${opts.brief.split('\n').join('\n> ')}`);
  }
  if (opts.feedback) {
    parts.push(
      `The user reviewed the current document and asks for this revision:\n\n> ${opts.feedback
        .split('\n')
        .join('\n> ')}\n\nApply targeted changes — keep everything else intact.`
    );
  }
  if (opts.improve) {
    parts.push(`This is a **self-review pass**: the document already exists — do NOT rewrite it from scratch. Act as a critical senior reviewer of \`${specRel}/${file}.md\`:

1. Read the current document (and the other spec files for cross-checking) and list what's weak, checking specifically for:
${IMPROVE_FOCUS[file]}
2. Apply **targeted edits** that fix what you found — tighten wording, fill gaps, resolve contradictions. Preserve the document's structure, any user-authored decisions, and all completed checkbox states.
3. If something needs a decision only the user can make, add it to the \`## Open Questions\` section instead of guessing.

In your chat reply, list the improvements you made as short bullets (what + why). If the document is already solid, say so and change nothing.`);
  }
  const userText = parts.join('\n\n');

  chat.push({ id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() });

  const routed = routeAgent(
    { kind: 'spec-file', file, specKind: meta.kind },
    agents,
    chat.selectedAgent
  );
  const injected = [
    ...skillsFor(meta, file, skills),
    ...(opts.domainSkills ?? [])
      .map((n) => skills.find((s) => s.name === n))
      .filter(Boolean as unknown as (s: SkillMeta | undefined) => s is SkillMeta),
  ];

  const requestId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  chat.push({
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    streaming: true,
    agent: routed.name ?? undefined,
  });
  chat.setBusy(true, requestId);

  const stepModel = useModels
    .getState()
    .modelFor(file === 'plan' ? 'plan' : file === 'tasks' ? 'tasks' : 'requirements');

  orch.startRun({
    requestId,
    agent: routed.name,
    source: `spec:${file}`,
    kind: 'spec',
    title: `${opts.improve ? 'Improve' : opts.feedback ? 'Revise' : 'Draft'} ${file}.md · ${meta.name}`,
    specId: meta.id,
    startedAt: Date.now(),
    status: 'running',
    skill: injectedSkillNames(injected),
    model: stepModel,
    routeReason: routed.reason,
    agentScope: resolveAgent(routed.name, agents).scope ?? null,
  });

  return new Promise<boolean>((resolve) => {
    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) chat.appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        chat.finish(assistantId);
        off();
        useOrchestrator.getState().finishRun(requestId, 'done');
        resolve(true);
      }
      if (ev.type === 'error') {
        chat.fail(assistantId, ev.error ?? 'Unknown error');
        off();
        useOrchestrator.getState().finishRun(requestId, 'error');
        resolve(false);
      }
    });

    // The SDD skill frames the stage and its gates, the format skill carries the
    // literal shape the document must come out in, and `domainSkills` adds the
    // ones this particular work matches.
    const system = [skillSystemBlocks(injected), buildSystem(routed.body, meta, files)]
      .filter(Boolean)
      .join('\n\n---\n\n');

    window.octo.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: `spec:${file}`,
      specId: meta.id,
      agent: routed.name,
      kind: 'spec',
      skill: injectedSkillNames(injected),
      skillScope: resolveSkill(injected[0]?.name, skills).scope ?? null,
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
      model: stepModel,
    });
  });
}

/**
 * Polish — a critical review pass over the finished implementation, applied
 * from the Ship screen. Fixes go straight to disk; suggestions land in chat.
 */
export function polishSpec(meta: SpecMeta): Promise<boolean> {
  const chat = useChat.getState();
  const orch = useOrchestrator.getState();
  const { agents, root } = useWorkspace.getState();
  const specRel = meta.path.replace(root ? root + '/' : '', '');
  const reqLabel = meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md';

  const userText = `All tasks for **${meta.name}** are complete. Please polish the implementation:

1. Review the diff for correctness and edge cases.
2. Spot any missing tests or regressions vs the spec's acceptance criteria.
3. Suggest cleanups: dead code, awkward abstractions, naming, comments.
4. If anything is genuinely wrong, apply the fix directly using Edit/Write tools.

Reference \`${specRel}/${reqLabel}\`, \`${specRel}/plan.md\`, and \`${specRel}/tasks.md\`. Keep your chat reply concise.`;

  const system = `You are polishing the implementation of the spec "${meta.name}" (${meta.kind}).

All tasks in \`${specRel}/tasks.md\` are marked done. The user wants a critical review:

- **Correctness** — bugs, races, off-by-ones, missing edge cases, integration mismatches.
- **Regressions** — interactions with Unchanged Behavior (for bugfix specs) or untouched code paths.
- **Coverage** — every acceptance criterion (every EARS statement) should be exercised by at least one test.
- **Cleanups** — dead code, awkward abstractions, naming, missing types or docs.

When you find something genuinely wrong, apply the fix directly using the Edit/Write tools. For optional suggestions, list them in chat. Be specific: cite file:line.

Reference \`${specRel}/${reqLabel}\`, \`${specRel}/plan.md\`, and \`${specRel}/tasks.md\` before forming opinions.`;

  chat.push({ id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() });
  const routed = routeAgent({ kind: 'polish' }, agents, chat.selectedAgent);
  const requestId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  chat.push({
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    streaming: true,
    agent: routed.name ?? 'code-reviewer',
  });
  orch.startRun({
    requestId,
    agent: routed.name,
    source: 'polish',
    kind: 'polish',
    title: `Polish ${meta.name}`,
    specId: meta.id,
    startedAt: Date.now(),
    status: 'running',
    model: useModels.getState().modelFor('polish'),
    routeReason: routed.reason,
    agentScope: resolveAgent(routed.name, agents).scope ?? null,
  });

  return new Promise<boolean>((resolve) => {
    const off = window.octo.claude.onEvent((ev) => {
      if (ev.requestId !== requestId) return;
      if (ev.type === 'delta' && ev.text) chat.appendDelta(assistantId, ev.text, ev.channel);
      if (ev.type === 'done') {
        chat.finish(assistantId);
        off();
        useOrchestrator.getState().finishRun(requestId, 'done');
        resolve(true);
      }
      if (ev.type === 'error') {
        chat.fail(assistantId, ev.error ?? 'Unknown error');
        off();
        useOrchestrator.getState().finishRun(requestId, 'error');
        resolve(false);
      }
    });

    window.octo.claude.stream({
      requestId,
      system: [routed.body, system].filter(Boolean).join('\n\n---\n\n'),
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: 'polish',
      specId: meta.id,
      agent: routed.name,
      kind: 'polish',
      routeReason: routed.reason,
      agentScope: resolveAgent(routed.name, agents).scope ?? null,
      model: useModels.getState().modelFor('polish'),
    });
  });
}

/** Derive a short spec name from a free-form description. */
export function specNameFromText(text: string): string {
  const firstLine = text.split(/[\n.!?]/)[0]?.trim() ?? text.trim();
  const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
  return (words.length > 64 ? words.slice(0, 64) : words) || 'New spec';
}

/** Guess feature vs bugfix from the description; the user can override. */
export function specKindFromText(text: string): SpecKind {
  return /\b(bug|fix|crash|error|broken|regression|fail(s|ing|ed)?|doesn'?t work|not working)\b/i.test(
    text
  )
    ? 'bugfix'
    : 'feature';
}

/**
 * "Plan" — create a spec from the composer text and open it on the first stage.
 *
 * Deliberately starts **no Claude run**: the composer text is stored as the
 * spec's `brief` (and quoted at the top of the seeded document), and the user
 * decides when to spend a run by pressing *Draft … with Claude* at the gate
 * bar. Use `quickPlanSpec` for the hands-off path.
 */
export async function planSpec(text: string, kind?: SpecKind): Promise<SpecMeta> {
  const ws = useWorkspace.getState();
  const resolvedKind = kind ?? specKindFromText(text);
  const spec = await ws.createSpec(specNameFromText(text), resolvedKind, text);
  useUi.getState().openSpec(spec.id, 'define');
  return spec;
}

/**
 * Start a spec from a ticket that already exists.
 *
 * The ticket becomes the brief, so the Requirements draft is grounded in what
 * was actually asked for rather than in a sentence retyped from it. The link is
 * written immediately and `spec-created` is marked applied — the ticket is the
 * origin, so proposing to create another one would be exactly backwards.
 */
export async function planSpecFromTicket(
  ticket: TicketSummary,
  kind?: SpecKind
): Promise<SpecMeta | null> {
  const ws = useWorkspace.getState();
  const root = ws.root;
  if (!root) return null;

  // Read the ticket itself, not just the row that was clicked: the description,
  // its validation criteria and any plan already written on it are the spec's
  // starting content, not context for a model to paraphrase.
  const resolvedKind =
    kind ?? specKindFromText(`${ticket.title} ${ticket.description ?? ''}`);
  const res = await window.octo.tickets
    .seed({ root, providerId: ticket.provider, ticket, kind: resolvedKind })
    .catch(() => null);
  const seed = res?.seed;

  const spec = await ws.createSpec(
    ticket.title || ticket.key,
    resolvedKind,
    seed?.brief ?? `${ticket.key}: ${ticket.title}`
  );

  // Copy the ticket's content into the documents. `plan.md` only when the
  // ticket actually carries a plan — an empty one is not an improvement on no
  // file at all, and the Plan gate would refuse it anyway.
  const firstFile = resolvedKind === 'feature' ? 'requirements' : 'bugfix';
  if (seed?.requirements?.trim()) {
    await window.octo.specs
      .writeFile(root, spec.id, firstFile, seed.requirements)
      .catch(() => null);
  }
  if (seed?.plan?.trim()) {
    await window.octo.specs.writeFile(root, spec.id, 'plan', seed.plan).catch(() => null);
  }

  await window.octo.tickets.link({ root, specId: spec.id, ticket }).catch(() => null);
  await ws.refreshAll();
  useUi.getState().openSpec(spec.id, 'define');
  return spec;
}

/**
 * "Quick Plan" — draft requirements, design, and tasks back-to-back with no
 * approval stops (the Kiro-style escape hatch), landing on Tasks ready to run.
 * `noStops` also disarms the Plan step's clarifying-question round: a hands-off
 * run picks defaults and records them instead of stopping for an answer.
 */
export async function quickPlanSpec(text: string, kind?: SpecKind): Promise<SpecMeta | null> {
  const ws = useWorkspace.getState();
  const root = ws.root;
  if (!root) return null;
  const resolvedKind = kind ?? specKindFromText(text);
  const spec = await ws.createSpec(specNameFromText(text), resolvedKind, text);
  useUi.getState().openSpec(spec.id, 'define');

  const read = () => window.octo.specs.read(root, spec.id);
  // Two documents now, not three: the plan carries its own task waves, and
  // advancing past it derives tasks.md.
  const order: SpecDocFile[] = [firstStageFile(resolvedKind), 'plan'];
  for (const file of order) {
    const { meta, files } = await read();
    const ok = await draftSpecDoc({ meta, files, file, brief: text, noStops: true });
    if (!ok) break;
    const updated = await window.octo.specs.advance(root, spec.id);
    useUi.getState().openSpec(spec.id, stageForPhase(updated.phase));
    await ws.refreshAll();
  }
  return spec;
}
