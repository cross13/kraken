import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  CircleSlash,
  Loader2,
  Terminal,
  Cloud,
  Bot,
  Sparkles,
  FilePlus2,
  FilePen,
} from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import { cn } from '../../lib/cn';
import type { RunRow, RunFileRow } from '../../../electron/shared/types';

/** Skill names actually injected into a run's system prompt (ground truth). */
function injectedSkills(system: string | null): string[] {
  if (!system) return [];
  const names: string[] = [];
  const re = /^#\s*Active skill:\s*([^\n—]+?)(?:\s+—|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(system))) names.push(m[1].trim());
  return [...new Set(names)];
}

export function RunViewer({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [files, setFiles] = useState<RunFileRow[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [r, f] = await Promise.all([
        window.kraken.history.getRun(runId),
        window.kraken.history.listRunFiles(runId),
      ]);
      if (!active) return;
      if (!r) setNotFound(true);
      else setRun(r);
      setFiles(f);
    };
    load();
    const t = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [runId]);

  if (notFound) return <div className="p-6 text-sm text-ink-400">Run not found.</div>;
  if (!run) return <div className="p-6 text-sm text-ink-400">Loading run…</div>;

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="max-w-4xl mx-auto px-8 py-6 space-y-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            <BackendBadge backend={run.backend} />
            {run.agent && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                @{run.agent}
              </span>
            )}
            {run.model && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-300 font-mono">
                {run.model}
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-ink-500 break-all">{run.id}</div>
          <div className="flex items-center gap-3 text-[11px] text-ink-400">
            <span>started {new Date(run.started_at).toLocaleString()}</span>
            {run.duration_ms != null && (
              <>
                <span>·</span>
                <span>
                  duration {(run.duration_ms / 1000).toFixed(2)}s
                </span>
              </>
            )}
            {run.workspace_path && (
              <>
                <span>·</span>
                <span className="font-mono">{run.workspace_path.split('/').slice(-2).join('/')}</span>
              </>
            )}
          </div>
        </header>

        <ActiveContext run={run} />

        {files.length > 0 && (
          <Section title={`Output files — ${files.length} touched`}>
            <div className="space-y-0.5">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 text-[12px] text-ink-200 rounded px-1.5 py-1 hover:bg-ink-800/40"
                >
                  {f.op === 'write' ? (
                    <FilePlus2 size={13} className="text-emerald-400 shrink-0" />
                  ) : (
                    <FilePen size={13} className="text-sky-400 shrink-0" />
                  )}
                  <span className="font-mono break-all">{f.path}</span>
                  <span className="text-[10px] text-ink-500 ml-auto shrink-0">
                    {f.tool}
                    {f.count > 1 ? ` ×${f.count}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {run.system && (
          <Section title="System prompt (exact text sent)">
            <pre className="text-[11px] font-mono text-ink-300 whitespace-pre-wrap leading-relaxed">
              {run.system}
            </pre>
          </Section>
        )}

        {run.prompt && (
          <Section title="Prompt">
            <pre className="text-[12px] font-mono text-ink-100 whitespace-pre-wrap leading-relaxed">
              {run.prompt}
            </pre>
          </Section>
        )}

        {run.response && (
          <Section title="Response">
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(run.response) }} />
          </Section>
        )}

        {run.error && (
          <Section title="Error" tone="bad">
            <pre className="text-[12px] font-mono text-bad whitespace-pre-wrap leading-relaxed">
              {run.error}
            </pre>
          </Section>
        )}
      </div>
    </div>
  );
}

/**
 * Verifiable summary of what context the run actually used — agent + skills are
 * detected from the system prompt that was sent, not from routing guesses.
 */
function ActiveContext({ run }: { run: RunRow }) {
  const skills = injectedSkills(run.system);
  return (
    <section className="rounded-lg border border-ink-800 bg-ink-900/40 p-4">
      <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
        Active context — verified from the system prompt
      </h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-accent shrink-0" />
          <span className="text-[11px] text-ink-400 w-12">Agent</span>
          {run.agent ? (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
              {run.agent}
            </span>
          ) : (
            <span className="text-[11px] text-ink-500">generic (no specialized agent)</span>
          )}
        </div>
        <div className="flex items-start gap-2">
          <Sparkles size={13} className="text-sky-300 shrink-0 mt-0.5" />
          <span className="text-[11px] text-ink-400 w-12 shrink-0">Skills</span>
          {skills.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span
                  key={s}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-medium flex items-center gap-1"
                >
                  <CheckCircle2 size={10} /> {s}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-[11px] text-ink-500">none injected</span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-ink-500 mt-2 leading-snug">
        These are parsed from the exact system prompt below — proof of what the run actually
        received, not what the router intended.
      </p>
    </section>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'bad';
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border bg-ink-900/40 p-4',
        tone === 'bad' ? 'border-bad/30 bg-bad/5' : 'border-ink-800'
      )}
    >
      <h3 className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: RunRow['status'] }) {
  const tones = {
    done: 'bg-ok/15 text-ok',
    error: 'bg-bad/15 text-bad',
    running: 'bg-accent/15 text-accent',
    cancelled: 'bg-ink-700/60 text-ink-300',
  };
  const Icon = {
    done: CheckCircle2,
    error: AlertCircle,
    running: Loader2,
    cancelled: CircleSlash,
  }[status];
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider',
        tones[status]
      )}
    >
      <Icon size={11} className={status === 'running' ? 'animate-spin' : ''} />
      {status}
    </span>
  );
}

function BackendBadge({ backend }: { backend: RunRow['backend'] }) {
  const Icon = backend === 'cli' ? Terminal : Cloud;
  return (
    <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-300">
      <Icon size={11} />
      {backend === 'cli' ? 'local CLI' : 'API'}
    </span>
  );
}
