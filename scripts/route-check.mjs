// Prove that per-task agent routing still resolves the way it is meant to.
//
// Task routing appends IMPLEMENTER_SIGNALS to *every* task's keyword set, so a
// bundled agent whose description happens to contain one of those substrings
// ('implement' inside "implementation", 'app' inside "approved" or "mapping")
// clears the specialist threshold on every task and beats spec-task-executor
// outright. That is a one-word regression with no type error and no test to
// catch it — this script is the guard.
//
//   npm run routes            # print the routing table
//   npm run routes -- --check # exit 1 if any case resolves wrongly (CI-able)

import { defaultAgentsLibrary } from '../electron/defaultLibrary.ts';
import { routeAgent, scoreAgents, actionProfile } from '../src/lib/agentRouter.ts';

// listAgents sorts by name, and the score sort is stable, so ties fall to the
// alphabetically first agent. Reproduce that or the check lies.
const agents = Object.entries(defaultAgentsLibrary())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, body]) => {
    const fm = body.split('---')[1] ?? '';
    return {
      name,
      description: (fm.match(/^description:\s*(.*)$/m) ?? [, ''])[1],
      scope: 'workspace',
      path: `.claude/agents/${name}.md`,
      body,
    };
  });

const CASES = [
  ['generic', 'spec-task-executor', 'Refactor the settings panel so the model list loads once'],
  ['vague', 'spec-task-executor', 'Make the run list load faster'],
  ['frontend', 'frontend-expert', 'Render the format-check strip above the gate bar with Tailwind'],
  ['frontend', 'frontend-expert', 'Add a dark mode toggle button to the settings page'],
  ['backend', 'backend-expert', 'Add an IPC handler that returns the seed report from the main process'],
  ['backend', 'backend-expert', 'Expose a new REST endpoint for the run history'],
  ['database', 'database-expert', 'Add a migration for the runs table and index it by spec id'],
  ['database', 'database-expert', 'Persist the library version in the SQLite schema'],
  ['docs', 'docs-expert', 'Update the README and the changelog for the new library'],
];

let failed = 0;
for (const [label, want, text] of CASES) {
  const got = routeAgent({ kind: 'task-execute', taskText: text }, agents);
  const ok = got.name === want;
  if (!ok) failed++;
  const top = scoreAgents(agents, actionProfile({ kind: 'task-execute', taskText: text }).keywords)
    .slice(0, 3)
    .map((c) => `${c.agent.name}:${c.score}`)
    .join('  ');
  console.log(`${ok ? '  ' : '✗ '}${label.padEnd(9)} → ${String(got.name).padEnd(20)} (${got.reason})`);
  if (!ok) console.log(`    expected ${want}; ranking: ${top}`);
}

if (failed) {
  console.error(
    `\n✗ ${failed} of ${CASES.length} routing cases resolved to the wrong agent.\n` +
      'Usually a bundled description picked up an IMPLEMENTER_SIGNALS substring.'
  );
  process.exit(1);
}
console.log(`\n✓ all ${CASES.length} routing cases resolve as intended`);
