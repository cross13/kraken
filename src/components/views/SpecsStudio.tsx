import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Trash2,
  FileCode2,
  Bug,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  Timer,
  Hash,
  ExternalLink,
  GitBranch,
  Layers,
  BarChart3,
  Inbox,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import type {
  SpecMeta,
  SpecPhase,
  SpecRunStat,
  RunRow,
  SpecEventRow,
} from '../../../electron/shared/types';
import { ModuleHeader, ModuleTabs, ModuleSection, Explainer, Callout } from '../ModuleShell';

const EXPLAINER = [
  {
    heading: 'What this manages',
    body: 'Every spec is a folder under .kraken/specs/ (spec.json + phase markdown). This module aggregates the run history mirrored in the app database against those specs so you can see where effort went.',
  },
  {
    heading: 'The analytics',
    body: 'Counts by phase and kind, plus run totals, error rate, and time spent — sourced from the runs table (every Claude invocation) grouped per spec.',
  },
  {
    heading: 'Reviewing a spec',
    body: 'Open a spec to see its recent runs, the phase-advance timeline, and links into the full run detail. Nothing here mutates a spec — it is read + delete only.',
  },
  {
    heading: 'Deleting',
    body: 'Delete removes the on-disk spec folder AND its mirrored history (runs, events, file changes). This is permanent — the confirm prompt guards it.',
  },
];

const PHASE_ORDER: SpecPhase[] = ['requirements', 'design', 'tasks', 'done'];
const PHASE_LABEL: Record<SpecPhase, string> = {
  requirements: 'Requirements',
  design: 'Design',
  tasks: 'Tasks',
  done: 'Done',
};

function ago(iso?: string | null) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!t) return '—';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDuration(ms?: number | null) {
  if (!ms || ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function SpecsStudio() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const [tab, setTab] = useState<'overview' | 'specs'>('overview');
  const [statsBySpec, setStatsBySpec] = useState<Record<string, SpecRunStat>>({});
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadStats = () => {
    if (!root) return;
    window.kraken.history.specRunStats(root).then((rows) => {
      const map: Record<string, SpecRunStat> = {};
      for (const r of rows) map[r.spec_id] = r;
      setStatsBySpec(map);
    });
  };

  // Refetch aggregates whenever the spec set changes (covers deletes/creates).
  useEffect(loadStats, [root, specs.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return specs;
    return specs.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [specs, query]);

  const selected = specs.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<LayoutDashboard size={18} />}
        title="Spec Manager"
        subtitle={`${specs.length} specs · analytics, review & cleanup`}
      />

      {!root ? (
        <div className="flex-1 grid place-items-center text-[13px] text-faint">
          Open a folder to manage specs.
        </div>
      ) : specs.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center">
          <div>
            <Inbox size={30} className="text-faint mx-auto mb-3" />
            <p className="text-[13px] text-dim">No specs yet.</p>
            <p className="text-[12px] text-faint mt-1">
              Create one from the Specs rail to start tracking runs here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ModuleTabs
            tabs={[
              { key: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
              { key: 'specs', label: 'Specs', icon: <FileCode2 size={13} /> },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'overview' ? (
            <OverviewTab specs={specs} statsBySpec={statsBySpec} onOpenSpec={(id) => {
              setSelectedId(id);
              setTab('specs');
            }} />
          ) : (
            <div className="flex-1 min-h-0 flex">
              {/* list */}
              <div className="w-[320px] shrink-0 border-r border-ink-800/40 flex flex-col min-h-0">
                <div className="p-3">
                  <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-elev">
                    <Search size={13} className="text-faint" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search specs…"
                      className="flex-1 bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-faint"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
                  {filtered.map((s) => (
                    <SpecRow
                      key={s.id}
                      spec={s}
                      stat={statsBySpec[s.id]}
                      active={selected?.id === s.id}
                      onSelect={() => setSelectedId(s.id)}
                    />
                  ))}
                </div>
              </div>

              {/* detail */}
              <div className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-7 py-6">
                  <Explainer points={EXPLAINER} />
                  {selected ? (
                    <SpecDetail
                      key={selected.id}
                      spec={selected}
                      stat={statsBySpec[selected.id]}
                      onDeleted={() => {
                        setSelectedId(null);
                        loadStats();
                      }}
                    />
                  ) : (
                    <div className="text-[13px] text-faint">Select a spec to review it.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverviewTab({
  specs,
  statsBySpec,
  onOpenSpec,
}: {
  specs: SpecMeta[];
  statsBySpec: Record<string, SpecRunStat>;
  onOpenSpec: (id: string) => void;
}) {
  const agg = useMemo(() => {
    const byPhase: Record<SpecPhase, number> = { requirements: 0, design: 0, tasks: 0, done: 0 };
    let features = 0;
    let bugfixes = 0;
    for (const s of specs) {
      byPhase[s.phase]++;
      if (s.kind === 'bugfix') bugfixes++;
      else features++;
    }
    let runs = 0;
    let errors = 0;
    let totalMs = 0;
    for (const st of Object.values(statsBySpec)) {
      runs += st.runs;
      errors += st.errors;
      totalMs += st.total_duration_ms;
    }
    return { byPhase, features, bugfixes, runs, errors, totalMs };
  }, [specs, statsBySpec]);

  const errorRate = agg.runs ? Math.round((agg.errors / agg.runs) * 100) : 0;
  const topSpecs = useMemo(
    () =>
      [...specs]
        .map((s) => ({ spec: s, stat: statsBySpec[s.id] }))
        .filter((x) => x.stat && x.stat.runs > 0)
        .sort((a, b) => (b.stat!.runs || 0) - (a.stat!.runs || 0))
        .slice(0, 6),
    [specs, statsBySpec]
  );
  const maxRuns = topSpecs[0]?.stat?.runs ?? 1;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-7 py-6">
        <Explainer points={EXPLAINER} />

        {/* stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-7">
          <StatCard icon={<Layers size={15} />} label="Specs" value={specs.length} />
          <StatCard
            icon={<CheckCircle2 size={15} />}
            label="Done"
            value={agg.byPhase.done}
            tone="good"
          />
          <StatCard
            icon={<Clock size={15} />}
            label="In progress"
            value={specs.length - agg.byPhase.done}
          />
          <StatCard icon={<Activity size={15} />} label="Runs" value={agg.runs} />
          <StatCard
            icon={<AlertTriangle size={15} />}
            label="Error rate"
            value={`${errorRate}%`}
            tone={errorRate > 20 ? 'bad' : undefined}
          />
          <StatCard icon={<Timer size={15} />} label="Time spent" value={fmtDuration(agg.totalMs)} />
        </div>

        {/* phase distribution */}
        <ModuleSection title="Pipeline" desc="Where your specs sit in the SDD flow.">
          <div className="space-y-2">
            {PHASE_ORDER.map((p) => {
              const n = agg.byPhase[p];
              const pct = specs.length ? Math.round((n / specs.length) * 100) : 0;
              return (
                <div key={p} className="flex items-center gap-3">
                  <div className="w-24 text-[12px] text-dim shrink-0">{PHASE_LABEL[p]}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-elev/70 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', p === 'done' ? 'bg-good' : 'bg-accent')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-[11.5px] text-faint shrink-0">
                    {n} · {pct}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[12px] text-dim">
            <span className="flex items-center gap-1.5">
              <FileCode2 size={13} className="text-accent" /> {agg.features} feature
              {agg.features === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1.5">
              <Bug size={13} className="text-accent" /> {agg.bugfixes} bugfix
              {agg.bugfixes === 1 ? '' : 'es'}
            </span>
          </div>
        </ModuleSection>

        {/* most active */}
        <ModuleSection
          title="Most active"
          desc="Specs that consumed the most agent runs. Click to review."
        >
          {topSpecs.length === 0 ? (
            <Callout>No runs recorded yet. Run a spec to populate analytics.</Callout>
          ) : (
            <div className="space-y-1.5">
              {topSpecs.map(({ spec, stat }) => (
                <button
                  key={spec.id}
                  onClick={() => onOpenSpec(spec.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-elev/50 hover:bg-elev text-left transition"
                >
                  <span className="text-[12.5px] text-ink-100 truncate w-48 shrink-0">
                    {spec.name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-ink-800/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(((stat!.runs || 0) / maxRuns) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11.5px] text-dim shrink-0 w-24 text-right">
                    {stat!.runs} runs · {fmtDuration(stat!.total_duration_ms)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ModuleSection>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-xl bg-elev/50 ring-1 ring-ink-800/40 px-3.5 py-3">
      <div
        className={cn(
          'flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide mb-1.5',
          tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-faint'
        )}
      >
        {icon}
        {label}
      </div>
      <div className="font-display text-[22px] font-bold text-ink-50 leading-none">{value}</div>
    </div>
  );
}

function SpecRow({
  spec,
  stat,
  active,
  onSelect,
}: {
  spec: SpecMeta;
  stat?: SpecRunStat;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition',
        active ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-elev/60'
      )}
    >
      {spec.kind === 'bugfix' ? (
        <Bug size={13} className={cn('mt-0.5 shrink-0', active ? 'text-accent' : 'text-dim')} />
      ) : (
        <FileCode2 size={13} className={cn('mt-0.5 shrink-0', active ? 'text-accent' : 'text-dim')} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-100 font-medium truncate">{spec.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <PhaseBadge phase={spec.phase} />
          <span className="text-[10.5px] text-faint">
            {stat?.runs ?? 0} runs · {ago(spec.updatedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

function PhaseBadge({ phase }: { phase: SpecPhase }) {
  return (
    <span
      className={cn(
        'text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wide',
        phase === 'done' ? 'bg-good/15 text-good' : 'bg-accent/12 text-accent'
      )}
    >
      {PHASE_LABEL[phase]}
    </span>
  );
}

function SpecDetail({
  spec,
  stat,
  onDeleted,
}: {
  spec: SpecMeta;
  stat?: SpecRunStat;
  onDeleted: () => void;
}) {
  const root = useWorkspace((s) => s.root)!;
  const deleteSpec = useWorkspace((s) => s.deleteSpec);
  const openTab = useUi((s) => s.openTab);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [events, setEvents] = useState<SpecEventRow[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    window.kraken.history.listRuns({ workspacePath: root, specId: spec.id, limit: 20 }).then(setRuns);
    window.kraken.history.listSpecEvents(root, spec.id).then(setEvents);
  }, [root, spec.id]);

  const remove = async () => {
    if (
      !window.confirm(
        `Delete spec "${spec.name}"?\n\nThis permanently removes its folder (.kraken/specs/${spec.id}) and all mirrored run history. This cannot be undone.`
      )
    )
      return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteSpec(spec.id);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 grid place-items-center rounded-xl bg-accent/12 text-accent shrink-0">
          {spec.kind === 'bugfix' ? <Bug size={20} /> : <FileCode2 size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[19px] font-bold text-ink-50 truncate">{spec.name}</h2>
            <PhaseBadge phase={spec.phase} />
          </div>
          <p className="text-[12px] text-faint mt-0.5 font-mono truncate">
            .kraken/specs/{spec.id}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={deleting}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-bad/10 text-bad hover:bg-bad/20 disabled:opacity-40 shrink-0"
        >
          <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {err && <p className="text-[12px] text-bad mb-3">{err}</p>}

      {/* quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
        <MiniStat icon={<Activity size={13} />} label="Runs" value={stat?.runs ?? 0} />
        <MiniStat
          icon={<AlertTriangle size={13} />}
          label="Errors"
          value={stat?.errors ?? 0}
          tone={stat && stat.errors > 0 ? 'bad' : undefined}
        />
        <MiniStat icon={<Timer size={13} />} label="Time" value={fmtDuration(stat?.total_duration_ms)} />
        <MiniStat icon={<Clock size={13} />} label="Last run" value={ago(stat?.last_run_at)} />
      </div>

      {/* meta */}
      <div className="flex flex-wrap items-center gap-2 mb-6 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-dim px-2.5 py-1 rounded-lg bg-elev">
          <Hash size={12} className="text-accent" /> created {ago(spec.createdAt)}
        </span>
        {spec.branch && (
          <span className="flex items-center gap-1.5 text-dim px-2.5 py-1 rounded-lg bg-elev">
            <GitBranch size={12} className="text-accent" /> {spec.branch}
          </span>
        )}
        {spec.prNumber && spec.prUrl && (
          <button
            onClick={() => window.kraken.shell.openUrl(spec.prUrl!)}
            className="flex items-center gap-1.5 text-dim px-2.5 py-1 rounded-lg bg-elev hover:text-ink-50"
          >
            PR #{spec.prNumber} <ExternalLink size={10} />
          </button>
        )}
      </div>

      {/* recent runs */}
      <ModuleSection title="Recent runs" desc="The latest agent invocations recorded for this spec.">
        {runs.length === 0 ? (
          <Callout>No runs recorded for this spec yet.</Callout>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  openTab({ id: `run:${r.id}`, title: `run: ${r.id.slice(0, 8)}`, kind: 'run', runId: r.id })
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-elev/40 hover:bg-elev text-left transition"
              >
                <StatusDot status={r.status} />
                <span className="text-[12px] text-ink-100 truncate flex-1">
                  {r.kind ?? 'run'}
                  {r.task_id ? ` · ${r.task_id}` : ''}
                  <span className="text-faint"> · {r.source}</span>
                </span>
                {r.agent && (
                  <span className="text-[10.5px] text-faint truncate max-w-[120px] hidden sm:block">
                    {r.agent}
                  </span>
                )}
                <span className="text-[10.5px] text-faint shrink-0">{fmtDuration(r.duration_ms)}</span>
                <span className="text-[10.5px] text-faint shrink-0 w-16 text-right">
                  {ago(r.started_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </ModuleSection>

      {/* timeline */}
      <ModuleSection title="Timeline" desc="Phase advances and edits recorded for this spec.">
        {events.length === 0 ? (
          <Callout>No events recorded.</Callout>
        ) : (
          <div className="space-y-1.5">
            {events.slice(0, 25).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="text-ink-100 capitalize">{e.event_type}</span>
                {e.from_phase && e.to_phase && (
                  <span className="text-faint">
                    {e.from_phase} → {e.to_phase}
                  </span>
                )}
                {e.file && <span className="text-faint font-mono">{e.file}</span>}
                <span className="text-faint ml-auto">{ago(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </ModuleSection>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: 'bad';
}) {
  return (
    <div className="rounded-lg bg-elev/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-faint mb-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-[15px] font-semibold', tone === 'bad' ? 'text-bad' : 'text-ink-50')}>
        {value}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: RunRow['status'] }) {
  const color =
    status === 'done'
      ? 'bg-good'
      : status === 'error'
        ? 'bg-bad'
        : status === 'running'
          ? 'bg-accent animate-pulse'
          : 'bg-ink-600';
  return <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />;
}
