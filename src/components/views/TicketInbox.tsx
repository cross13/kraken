import { useCallback, useEffect, useState } from 'react';
import { Ticket, Loader2, RotateCcw, AlertTriangle, ArrowUpRight, Bug, FileCode2 } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { planSpecFromTicket, specKindFromText } from '../../lib/specActions';
import { cn } from '../../lib/cn';
import { bridgeReady, STALE_BRIDGE } from '../../lib/bridge';
import type { TicketProviderConfig, TicketSummary } from '../../../electron/shared/types';

/**
 * The open work already sitting in your trackers, under the composer.
 *
 * Most specs do not start from a blank prompt — they start from a ticket
 * somebody already wrote. Starting from one here means the brief is what was
 * actually asked for, and the spec is linked from birth, so nothing has to be
 * reconciled afterwards.
 *
 * It renders nothing when no tracker is enabled: a workspace with no tracker
 * should not grow an empty section explaining that it has no tracker.
 */
export function TicketInbox() {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const openLibrary = useUi((s) => s.openLibrary);

  const [groups, setGroups] = useState<
    { provider: TicketProviderConfig; tickets: TicketSummary[]; error?: string }[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!root) return;
    if (!bridgeReady('tickets', 'listOpen')) {
      setStale(true);
      setGroups([]);
      return;
    }
    setLoading(true);
    try {
      setGroups(await window.octo.tickets.listOpen({ root, limit: 30 }));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void load();
  }, [load]);

  if (stale)
    return (
      <p className="flex gap-2 text-[11.5px] text-warn leading-snug mb-8 px-1">
        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
        Tracker tickets can&rsquo;t be listed: {STALE_BRIDGE}
      </p>
    );
  if (!groups || groups.length === 0) return null;

  // A ticket a spec already covers is not something to start again.
  const linked = new Set(specs.map((s) => s.ticket?.key).filter(Boolean) as string[]);
  const all = groups.flatMap((g) => g.tickets).filter((t) => !linked.has(t.key));
  const errors = groups.filter((g) => g.error);
  const shown = showAll ? all : all.slice(0, 6);

  const start = async (t: TicketSummary) => {
    setStarting(t.key);
    try {
      await planSpecFromTicket(t);
    } finally {
      setStarting(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Ticket size={13} className="text-accent" />
        <h2 className="text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold">
          Open in your trackers
        </h2>
        <span className="text-[11px] text-faint">
          {all.length} not done{linked.size ? ` · ${linked.size} already has a spec` : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => void load()}
          disabled={loading}
          title="Refresh from the trackers"
          className="text-faint hover:text-ink-200 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        </button>
      </div>

      {all.length > 0 && (
        <div className="k-cards">
          {shown.map((t) => {
            const kind = specKindFromText(`${t.title} ${t.description ?? ''}`);
            return (
              <button
                key={`${t.provider}-${t.key}`}
                onClick={() => void start(t)}
                disabled={!!starting}
                title={`Start a ${kind} spec from ${t.key} — the ticket becomes the brief, and the spec is linked to it`}
                className="group text-left rounded-[13px] bg-card border border-ink-800 hover:border-accent/45 transition p-3.5 disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[11px] text-accent-2">{t.key}</span>
                  {t.status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
                      {t.status}
                    </span>
                  )}
                  <span className="flex-1" />
                  {starting === t.key ? (
                    <Loader2 size={12} className="animate-spin text-accent" />
                  ) : (
                    <ArrowUpRight
                      size={12}
                      className="text-faint opacity-0 group-hover:opacity-100 transition"
                    />
                  )}
                </div>
                <div className="text-[12.5px] text-ink-100 leading-snug line-clamp-2">
                  {t.title || t.key}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      kind === 'feature' ? 'text-accent-2 bg-accent/15' : 'text-warn bg-warn/15'
                    )}
                  >
                    {kind === 'feature' ? <FileCode2 size={9} /> : <Bug size={9} />}
                    {kind}
                  </span>
                  <span className="text-[10px] text-faint truncate">{t.providerLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {all.length > shown.length && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2.5 text-[11.5px] text-faint hover:text-ink-200 transition px-1"
        >
          Show {all.length - shown.length} more
        </button>
      )}

      {all.length === 0 && !errors.length && (
        <p className="text-[11.5px] text-faint px-1">
          Nothing open that doesn&rsquo;t already have a spec.
        </p>
      )}

      {errors.map((g) => (
        <p key={g.provider.id} className="flex gap-2 text-[11.5px] text-dim leading-snug px-1 mt-2">
          <AlertTriangle size={12} className="text-warn shrink-0 mt-0.5" />
          <span>
            <b className="text-ink-200 font-medium">{g.provider.label}</b>: {g.error}{' '}
            <button
              onClick={() => openLibrary('tickets')}
              className="underline hover:text-ink-100"
            >
              Configure
            </button>
          </span>
        </p>
      ))}
    </section>
  );
}
