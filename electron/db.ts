import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import type {
  SpecMeta,
  SpecPhase,
  RunRow,
  ErrorRow,
  SpecEventRow,
  SpecRunStat,
  HookRunRow,
  RunFileRow,
  RunFileCount,
  SpecFileChange,
} from './shared/types.js';

export type {
  RunRow,
  ErrorRow,
  SpecEventRow,
  HookRunRow,
  RunFileRow,
  RunFileCount,
  SpecFileChange,
};

// ---------- Schema ----------

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS specs (
    id TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('feature','bugfix')),
    phase TEXT NOT NULL CHECK (phase IN ('requirements','design','tasks','done')),
    fs_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (workspace_path, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_specs_workspace ON specs(workspace_path)`,
  `CREATE INDEX IF NOT EXISTS idx_specs_updated ON specs(updated_at DESC)`,

  `CREATE TABLE IF NOT EXISTS spec_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_path TEXT NOT NULL,
    spec_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    from_phase TEXT,
    to_phase TEXT,
    file TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_spec_events_spec ON spec_events(workspace_path, spec_id)`,
  `CREATE INDEX IF NOT EXISTS idx_spec_events_created ON spec_events(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    workspace_path TEXT,
    spec_id TEXT,
    backend TEXT NOT NULL CHECK (backend IN ('cli','api')),
    model TEXT,
    agent TEXT,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running','done','error','cancelled')),
    prompt TEXT,
    system TEXT,
    response TEXT,
    error TEXT,
    duration_ms INTEGER,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    skill TEXT,
    skill_scope TEXT,
    route_reason TEXT,
    agent_scope TEXT,
    kind TEXT,
    task_id TEXT,
    wave TEXT,
    depends_on TEXT,
    command TEXT,
    tools TEXT,
    permission_mode TEXT,
    model_source TEXT,
    resolved_model TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_path)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_spec ON runs(workspace_path, spec_id)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`,

  `CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    workspace_path TEXT,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_errors_run ON errors(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_errors_workspace ON errors(workspace_path)`,
  `CREATE INDEX IF NOT EXISTS idx_errors_created ON errors(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS run_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    workspace_path TEXT,
    path TEXT NOT NULL,
    tool TEXT,
    op TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    first_at TEXT NOT NULL,
    last_at TEXT NOT NULL,
    UNIQUE (run_id, path, tool)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_run_files_run ON run_files(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_run_files_workspace ON run_files(workspace_path)`,

  `CREATE TABLE IF NOT EXISTS hook_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_path TEXT,
    hook_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    run_id TEXT,
    spec_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hook_runs_workspace ON hook_runs(workspace_path)`,
  `CREATE INDEX IF NOT EXISTS idx_hook_runs_created ON hook_runs(created_at DESC)`,
];

// ---------- Singleton ----------

let db: Database.Database | null = null;

export function initDb(): Database.Database {
  if (db) return db;
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'kraken.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const stmt of SCHEMA) db.exec(stmt);
  migrateRuns(db);
  reconcileOrphanedRuns(db);
  return db;
}

/**
 * At startup no run can be in flight, so any row still marked `running` was
 * orphaned by a previous app close/crash. Left as-is it lingers forever and the
 * agent graph renders a perpetual spinner for an already-finished task. Settle
 * them as `cancelled` so history reflects reality.
 */
function reconcileOrphanedRuns(d: Database.Database) {
  d.prepare(
    `UPDATE runs
        SET status = 'cancelled',
            error = COALESCE(error, 'Interrupted — app closed during run'),
            ended_at = COALESCE(ended_at, started_at)
      WHERE status = 'running'`
  ).run();
}

/**
 * `runs` uses CREATE TABLE IF NOT EXISTS, so databases created before the
 * routing/audit columns existed won't pick them up. Add each missing column
 * idempotently — `ALTER TABLE ... ADD COLUMN` throws if it already exists, so
 * each is guarded.
 */
function migrateRuns(d: Database.Database) {
  const cols = [
    'skill TEXT',
    'skill_scope TEXT',
    'route_reason TEXT',
    'agent_scope TEXT',
    'kind TEXT',
    'task_id TEXT',
    'wave TEXT',
    'depends_on TEXT',
    'command TEXT',
    'tools TEXT',
    'permission_mode TEXT',
    'model_source TEXT',
    'resolved_model TEXT',
  ];
  for (const col of cols) {
    try {
      d.exec(`ALTER TABLE runs ADD COLUMN ${col}`);
    } catch {
      // column already exists — expected on up-to-date databases
    }
  }
}

function require_db(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// ---------- Specs ----------

export function upsertSpec(workspacePath: string, meta: SpecMeta) {
  const d = require_db();
  d.prepare(
    `INSERT INTO specs (id, workspace_path, name, kind, phase, fs_path, created_at, updated_at)
     VALUES (@id, @workspace_path, @name, @kind, @phase, @fs_path, @created_at, @updated_at)
     ON CONFLICT(workspace_path, id) DO UPDATE SET
       name = excluded.name,
       phase = excluded.phase,
       fs_path = excluded.fs_path,
       updated_at = excluded.updated_at`
  ).run({
    id: meta.id,
    workspace_path: workspacePath,
    name: meta.name,
    kind: meta.kind,
    phase: meta.phase,
    fs_path: meta.path,
    created_at: meta.createdAt,
    updated_at: meta.updatedAt,
  });
}

/**
 * Delete a spec and every mirrored row that belongs to it — spec_events, runs
 * (+ their run_files/errors), and hook_runs. There are no FK cascades between
 * these tables, so we clear them explicitly inside one transaction.
 */
export function deleteSpec(workspacePath: string, id: string) {
  const d = require_db();
  const runsForSpec = `SELECT id FROM runs WHERE workspace_path IS ? AND spec_id IS ?`;
  const tx = d.transaction(() => {
    d.prepare(`DELETE FROM errors WHERE run_id IN (${runsForSpec})`).run(workspacePath, id);
    d.prepare(`DELETE FROM run_files WHERE run_id IN (${runsForSpec})`).run(workspacePath, id);
    d.prepare(`DELETE FROM runs WHERE workspace_path IS ? AND spec_id IS ?`).run(workspacePath, id);
    d.prepare(`DELETE FROM spec_events WHERE workspace_path IS ? AND spec_id IS ?`).run(
      workspacePath,
      id
    );
    d.prepare(`DELETE FROM hook_runs WHERE workspace_path IS ? AND spec_id IS ?`).run(
      workspacePath,
      id
    );
    d.prepare(`DELETE FROM specs WHERE workspace_path = ? AND id = ?`).run(workspacePath, id);
  });
  tx();
}

/** Per-spec run aggregates (runs, errors, cancelled, total time, last activity). */
export function specRunStats(workspacePath: string): SpecRunStat[] {
  const d = require_db();
  return d
    .prepare(
      `SELECT spec_id,
              COUNT(*) AS runs,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
              COALESCE(SUM(duration_ms), 0) AS total_duration_ms,
              MAX(started_at) AS last_run_at
         FROM runs
        WHERE workspace_path IS ? AND spec_id IS NOT NULL
        GROUP BY spec_id`
    )
    .all(workspacePath) as SpecRunStat[];
}

export function recordSpecEvent(
  workspacePath: string,
  specId: string,
  event: {
    type: 'created' | 'edited' | 'advanced' | 'reverted';
    from_phase?: SpecPhase | null;
    to_phase?: SpecPhase | null;
    file?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const d = require_db();
  d.prepare(
    `INSERT INTO spec_events (workspace_path, spec_id, event_type, from_phase, to_phase, file, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    workspacePath,
    specId,
    event.type,
    event.from_phase ?? null,
    event.to_phase ?? null,
    event.file ?? null,
    event.metadata ? JSON.stringify(event.metadata) : null,
    new Date().toISOString()
  );
}

export function listSpecEvents(
  workspacePath: string,
  specId: string,
  limit = 100
): SpecEventRow[] {
  const d = require_db();
  return d
    .prepare(
      `SELECT * FROM spec_events WHERE workspace_path = ? AND spec_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(workspacePath, specId, limit) as SpecEventRow[];
}

// ---------- Runs ----------

export interface BeginRunInput {
  id: string;
  workspacePath?: string | null;
  specId?: string | null;
  backend: 'cli' | 'api';
  model?: string;
  agent?: string | null;
  source: string; // 'chat' | 'spec-editor' | etc.
  prompt?: string | null;
  system?: string | null;
  // routing/audit
  skill?: string | null;
  skillScope?: string | null;
  routeReason?: string | null;
  agentScope?: string | null;
  kind?: string | null;
  taskId?: string | null;
  wave?: string | null;
  dependsOn?: string[] | null;
  modelSource?: string | null;
}

export function beginRun(input: BeginRunInput) {
  const d = require_db();
  d.prepare(
    `INSERT INTO runs (id, workspace_path, spec_id, backend, model, agent, source, status, prompt, system, started_at,
       skill, skill_scope, route_reason, agent_scope, kind, task_id, wave, depends_on, model_source)
     VALUES (@id, @workspace_path, @spec_id, @backend, @model, @agent, @source, 'running', @prompt, @system, @started_at,
       @skill, @skill_scope, @route_reason, @agent_scope, @kind, @task_id, @wave, @depends_on, @model_source)`
  ).run({
    id: input.id,
    workspace_path: input.workspacePath ?? null,
    spec_id: input.specId ?? null,
    backend: input.backend,
    model: input.model ?? null,
    agent: input.agent ?? null,
    source: input.source,
    prompt: input.prompt ?? null,
    system: input.system ?? null,
    started_at: new Date().toISOString(),
    skill: input.skill ?? null,
    skill_scope: input.skillScope ?? null,
    route_reason: input.routeReason ?? null,
    agent_scope: input.agentScope ?? null,
    kind: input.kind ?? null,
    task_id: input.taskId ?? null,
    wave: input.wave ?? null,
    depends_on: input.dependsOn && input.dependsOn.length ? JSON.stringify(input.dependsOn) : null,
    model_source: input.modelSource ?? null,
  });
}

/** Record the exact invocation once the backend is dispatched (for audit). */
export function updateRunCommand(
  id: string,
  input: {
    command?: string | null;
    tools?: string[] | null;
    permissionMode?: string | null;
    modelSource?: string | null;
  }
) {
  const d = require_db();
  d.prepare(
    `UPDATE runs SET command = ?, tools = ?, permission_mode = ?,
       model_source = COALESCE(?, model_source) WHERE id = ?`
  ).run(
    input.command ?? null,
    input.tools && input.tools.length ? JSON.stringify(input.tools) : null,
    input.permissionMode ?? null,
    input.modelSource ?? null,
    id
  );
}

/** Record the model the backend actually reported using. */
export function updateRunResolvedModel(id: string, model: string) {
  const d = require_db();
  d.prepare(`UPDATE runs SET resolved_model = ? WHERE id = ?`).run(model, id);
}

// ---------- Run files (what a run created / edited) ----------

/** Record one file a run touched. Upserts by (run_id, path, tool), bumping count. */
export function recordRunFile(input: {
  runId: string;
  workspacePath?: string | null;
  path: string;
  tool?: string | null;
  op?: string | null;
}) {
  const d = require_db();
  const now = new Date().toISOString();
  d.prepare(
    `INSERT INTO run_files (run_id, workspace_path, path, tool, op, count, first_at, last_at)
     VALUES (@run_id, @workspace_path, @path, @tool, @op, 1, @now, @now)
     ON CONFLICT(run_id, path, tool) DO UPDATE SET
       count = count + 1,
       last_at = excluded.last_at`
  ).run({
    run_id: input.runId,
    workspace_path: input.workspacePath ?? null,
    path: input.path,
    tool: input.tool ?? null,
    op: input.op ?? null,
    now,
  });
}

export function listRunFiles(runId: string): RunFileRow[] {
  const d = require_db();
  return d
    .prepare(`SELECT * FROM run_files WHERE run_id = ? ORDER BY last_at DESC`)
    .all(runId) as RunFileRow[];
}

/**
 * Every distinct file changed across a spec's runs, aggregated for the
 * completion summary (op/tool/touch-count + which tasks touched it).
 */
export function listSpecFiles(opts: {
  workspacePath?: string | null;
  specId: string;
}): SpecFileChange[] {
  const d = require_db();
  const where: string[] = ['r.spec_id IS ?'];
  const params: unknown[] = [opts.specId];
  if (opts.workspacePath !== undefined) {
    where.push('r.workspace_path IS ?');
    params.push(opts.workspacePath);
  }
  const sql = `SELECT rf.path AS path,
       GROUP_CONCAT(DISTINCT rf.op) AS ops,
       GROUP_CONCAT(DISTINCT rf.tool) AS tools,
       SUM(rf.count) AS count,
       GROUP_CONCAT(DISTINCT r.task_id) AS task_ids,
       MAX(rf.last_at) AS last_at
     FROM run_files rf JOIN runs r ON r.id = rf.run_id
     WHERE ${where.join(' AND ')}
     GROUP BY rf.path
     ORDER BY last_at DESC`;
  return d.prepare(sql).all(...params) as SpecFileChange[];
}

/** Distinct-file counts per run, for badges. Scoped to a workspace/spec via runs join. */
export function runFileCounts(opts: {
  workspacePath?: string | null;
  specId?: string | null;
}): RunFileCount[] {
  const d = require_db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workspacePath !== undefined) {
    where.push('r.workspace_path IS ?');
    params.push(opts.workspacePath);
  }
  if (opts.specId !== undefined) {
    where.push('r.spec_id IS ?');
    params.push(opts.specId);
  }
  const sql = `SELECT rf.run_id AS run_id, COUNT(DISTINCT rf.path) AS files
     FROM run_files rf JOIN runs r ON r.id = rf.run_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY rf.run_id`;
  return d.prepare(sql).all(...params) as RunFileCount[];
}

export function appendRunResponse(id: string, chunk: string) {
  const d = require_db();
  d.prepare(`UPDATE runs SET response = COALESCE(response,'') || ? WHERE id = ?`).run(
    chunk,
    id
  );
}

export function finishRun(
  id: string,
  status: 'done' | 'error' | 'cancelled',
  errorMessage?: string
) {
  const d = require_db();
  const row = d.prepare(`SELECT started_at FROM runs WHERE id = ?`).get(id) as
    | { started_at: string }
    | undefined;
  const ended = new Date().toISOString();
  const duration = row ? Date.parse(ended) - Date.parse(row.started_at) : null;
  d.prepare(
    `UPDATE runs SET status = ?, error = ?, ended_at = ?, duration_ms = ? WHERE id = ?`
  ).run(status, errorMessage ?? null, ended, duration, id);
}

export function listRuns(opts: {
  workspacePath?: string | null;
  specId?: string | null;
  limit?: number;
}): RunRow[] {
  const d = require_db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workspacePath !== undefined) {
    where.push('workspace_path IS ?');
    params.push(opts.workspacePath);
  }
  if (opts.specId !== undefined) {
    where.push('spec_id IS ?');
    params.push(opts.specId);
  }
  const sql = `SELECT * FROM runs ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY started_at DESC LIMIT ?`;
  params.push(opts.limit ?? 100);
  return d.prepare(sql).all(...params) as RunRow[];
}

export function getRun(id: string): RunRow | null {
  const d = require_db();
  return (d.prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as RunRow | undefined) ?? null;
}

// ---------- Errors ----------

export function recordError(input: {
  runId?: string | null;
  workspacePath?: string | null;
  category: 'cli_spawn' | 'cli_exit' | 'api' | 'parse' | 'fs' | 'other';
  message: string;
  details?: Record<string, unknown>;
}) {
  const d = require_db();
  d.prepare(
    `INSERT INTO errors (run_id, workspace_path, category, message, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.runId ?? null,
    input.workspacePath ?? null,
    input.category,
    input.message,
    input.details ? JSON.stringify(input.details) : null,
    new Date().toISOString()
  );
}

export function listErrors(opts: {
  workspacePath?: string | null;
  limit?: number;
}): ErrorRow[] {
  const d = require_db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workspacePath !== undefined) {
    where.push('workspace_path IS ?');
    params.push(opts.workspacePath);
  }
  const sql = `SELECT * FROM errors ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY created_at DESC LIMIT ?`;
  params.push(opts.limit ?? 100);
  return d.prepare(sql).all(...params) as ErrorRow[];
}

// ---------- Hook runs ----------

export function recordHookRun(input: {
  workspacePath?: string | null;
  hookId: string;
  trigger: string;
  runId?: string | null;
  specId?: string | null;
  status: string;
}) {
  const d = require_db();
  d.prepare(
    `INSERT INTO hook_runs (workspace_path, hook_id, trigger, run_id, spec_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.workspacePath ?? null,
    input.hookId,
    input.trigger,
    input.runId ?? null,
    input.specId ?? null,
    input.status,
    new Date().toISOString()
  );
}

export function listHookRuns(opts: {
  workspacePath?: string | null;
  limit?: number;
}): HookRunRow[] {
  const d = require_db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.workspacePath !== undefined) {
    where.push('workspace_path IS ?');
    params.push(opts.workspacePath);
  }
  const sql = `SELECT * FROM hook_runs ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY created_at DESC LIMIT ?`;
  params.push(opts.limit ?? 100);
  return d.prepare(sql).all(...params) as HookRunRow[];
}

// ---------- Stats ----------

export function getStats(workspacePath?: string | null) {
  const d = require_db();
  const where = workspacePath !== undefined ? 'WHERE workspace_path IS ?' : '';
  const args = workspacePath !== undefined ? [workspacePath] : [];
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM runs ${where}`).get(...args) as {
    n: number;
  }).n;
  const errors = (d
    .prepare(`SELECT COUNT(*) AS n FROM runs ${where} ${where ? 'AND' : 'WHERE'} status = 'error'`)
    .get(...args) as { n: number }).n;
  const cancelled = (d
    .prepare(
      `SELECT COUNT(*) AS n FROM runs ${where} ${where ? 'AND' : 'WHERE'} status = 'cancelled'`
    )
    .get(...args) as { n: number }).n;
  const avgDuration = (d
    .prepare(
      `SELECT AVG(duration_ms) AS avg_ms FROM runs ${where} ${where ? 'AND' : 'WHERE'} status = 'done'`
    )
    .get(...args) as { avg_ms: number | null }).avg_ms;
  return { total, errors, cancelled, avgDurationMs: avgDuration };
}
