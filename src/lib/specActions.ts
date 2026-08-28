import { useChat } from '../stores/chat';
import { useWorkspace } from '../stores/workspace';
import { useOrchestrator } from '../stores/orchestrator';
import { useModels } from '../stores/models';
import { useUi, stageForPhase } from '../stores/ui';
import { routeAgent, routeSkill, skillSystemBlock } from './agentRouter';
import { resolveAgent, resolveSkill } from './verifyLibrary';
import type { SpecKind, SpecMeta } from '../../electron/shared/types';

export type SpecDocFile = 'requirements' | 'bugfix' | 'plan' | 'tasks';

/** The doc file for a spec's first stage (bug specs analyze instead of gather). */
export function firstStageFile(kind: SpecKind): SpecDocFile {
  return kind === 'feature' ? 'requirements' : 'bugfix';
}

const EARS = `Use EARS notation strictly: "WHEN <event> THEN the system SHALL <behavior>", "WHILE <state> THE system SHALL <behavior>", "IF <precondition> THEN the system SHALL <behavior>".`;

function editInstruction(targetPath: string) {
  return `Use the **Read** tool to read the current contents of \`${targetPath}\`, then use the **Edit** or **Write** tool to apply your changes directly to that file. Do not paste the full file in chat — write it to disk. Keep a short summary of what you changed in your reply.`;
}

function draftPrompt(meta: SpecMeta, specRel: string, file: SpecDocFile): string {
  const targetPath = `${specRel}/${file}.md`;
  const prompts: Record<SpecDocFile, string> = {
    requirements: `Draft or refine **requirements.md** for the feature spec "${meta.name}".

${EARS}

Required sections: Introduction, User Stories, Acceptance Criteria (EARS), Out of Scope, Non-Functional Requirements.

${editInstruction(targetPath)}`,
    bugfix: `Draft or refine **bugfix.md** for the bug "${meta.name}".

Required sections: Reproduction (numbered steps), Current Behavior (WHEN/THEN), Expected Behavior (WHEN/THEN/SHALL), Unchanged Behavior (WHEN/THEN/SHALL CONTINUE TO — these protect against regressions), Environment.

${editInstruction(targetPath)}`,
    plan: `Draft or refine **plan.md** for "${meta.name}".

Read the current \`${specRel}/${meta.kind === 'feature' ? 'requirements.md' : 'bugfix.md'}\` first. If it has a **Resolved Decisions** section, treat each entry as a settled answer to an open question and reflect those decisions in the plan — do not re-open them. Then produce: Enfoque (with a \`\`\`mermaid flowchart of the approach), Archivos afectados (a table of \`path:line\` → change), Datos y contratos, Riesgos y rollback, Verificación mapping back to every acceptance criterion, Open Questions.

${editInstruction(targetPath)}`,
    tasks: `Draft or refine **tasks.md** for "${meta.name}".

Read the current \`${specRel}/plan.md\` first. Then produce dependency-ordered waves: Wave 1 = no dependencies and parallel-safe; each later wave lists its prerequisites explicitly. Every task has a single observable outcome. Close with a Verification checklist that maps every acceptance criterion to at least one task.

Format each task line **exactly** as \`- [ ] T1: <description>\` — a plain checkbox, then the bare id (T1, T2, …), then a colon. Do NOT wrap the id or checkbox in markdown bold/emphasis (no \`**T1**\`, no \`__T1__\`). Optionally name a specialized agent as \`- [ ] T1 @agent-name: <description>\`.

${editInstruction(targetPath)}`,
  };
  return prompts[file];
}

function buildSystem(agentBody: string, meta: SpecMeta, files: Record<string, string>): string {
  const base = `You are the Kraken SDD agent helping with a ${meta.kind} spec titled "${meta.name}". Current phase: ${meta.phase}. Be precise. Output GitHub-flavored markdown. Do not invent behaviors that are not stated or strongly implied — ask once for missing context, then commit to a draft.`;
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
}

/** What the critical self-review pass looks for, per document. */
const IMPROVE_FOCUS: Record<SpecDocFile, string> = {
  requirements: `- Every acceptance criterion is strict EARS and independently testable.
- Ambiguities, undefined behaviors, and missing edge cases (empty states, errors, concurrency, permissions).
- User stories without criteria, criteria without stories, and contradictions between sections.
- Missing non-functional requirements that the feature obviously implies (performance, persistence, a11y).
- Scope creep: anything that belongs in Out of Scope.`,
  bugfix: `- The reproduction is complete and deterministic (numbered, environment pinned).
- Current vs Expected Behavior are precise WHEN/THEN statements that don't overlap or contradict.
- Unchanged Behavior guards cover the realistic regression surface, not just the happy path.
- Any hypothesis stated as fact — separate observed behavior from diagnosis.`,
  plan: `- Every acceptance criterion in the requirements maps to a concrete part of the plan; call out any that don't.
- Component boundaries and data/state ownership are unambiguous.
- Error handling covers the failure modes the requirements imply.
- The Testing Strategy maps back to every acceptance criterion.
- Sequences reflect the real flow; remove hand-waving ("somehow", "as needed").`,
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

  const parts = [draftPrompt(meta, specRel, file)];
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
    skill: routeSkill(meta.kind, skills)?.name ?? null,
    model: stepModel,
    routeReason: routed.reason,
    agentScope: resolveAgent(routed.name, agents).scope ?? null,
  });

  return new Promise<boolean>((resolve) => {
    const off = window.kraken.claude.onEvent((ev) => {
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

    const specSkill = routeSkill(meta.kind, skills);
    const system = [skillSystemBlock(specSkill), buildSystem(routed.body, meta, files)]
      .filter(Boolean)
      .join('\n\n---\n\n');

    window.kraken.claude.stream({
      requestId,
      system,
      messages: [{ role: 'user', content: userText }],
      cwd: root,
      source: `spec:${file}`,
      specId: meta.id,
      agent: routed.name,
      kind: 'spec',
      skill: specSkill?.name ?? null,
      skillScope: resolveSkill(specSkill?.name, skills).scope ?? null,
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
    const off = window.kraken.claude.onEvent((ev) => {
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

    window.kraken.claude.stream({
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
 * "Plan" — create a spec from the composer text, open it, and stream the
 * first-stage draft while the user watches. Gated flow: they approve each phase.
 */
export async function planSpec(text: string, kind?: SpecKind): Promise<SpecMeta> {
  const ws = useWorkspace.getState();
  const resolvedKind = kind ?? specKindFromText(text);
  const spec = await ws.createSpec(specNameFromText(text), resolvedKind);
  useUi.getState().openSpec(spec.id, 'define');
  const { meta, files } = await window.kraken.specs.read(ws.root!, spec.id);
  void draftSpecDoc({ meta, files, file: firstStageFile(resolvedKind), brief: text });
  return spec;
}

/**
 * "Quick Plan" — draft requirements, design, and tasks back-to-back with no
 * approval stops (the Kiro-style escape hatch), landing on Tasks ready to run.
 */
export async function quickPlanSpec(text: string, kind?: SpecKind): Promise<SpecMeta | null> {
  const ws = useWorkspace.getState();
  const root = ws.root;
  if (!root) return null;
  const resolvedKind = kind ?? specKindFromText(text);
  const spec = await ws.createSpec(specNameFromText(text), resolvedKind);
  useUi.getState().openSpec(spec.id, 'define');

  const read = () => window.kraken.specs.read(root, spec.id);
  const order: SpecDocFile[] = [firstStageFile(resolvedKind), 'plan', 'tasks'];
  for (const file of order) {
    const { meta, files } = await read();
    const ok = await draftSpecDoc({ meta, files, file, brief: text });
    if (!ok) break;
    if (file !== 'tasks') {
      const updated = await window.kraken.specs.advance(root, spec.id);
      useUi.getState().openSpec(spec.id, stageForPhase(updated.phase));
    } else {
      useUi.getState().openSpec(spec.id, 'build');
    }
    await ws.refreshAll();
  }
  return spec;
}
