import { useCallback, useEffect, useState } from 'react';
import { Ticket, ExternalLink, Loader2, Check, AlertTriangle, ChevronRight } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { TrackerMark } from '../../lib/trackerBrand';
import { bridgeReady } from '../../lib/bridge';
import { pendingEvents, syncEventId, eventLabel, type SyncEvent } from '../../lib/ticketSync';
import type { SpecMeta, TicketAction, TicketProviderConfig } from '../../../electron/shared/types';

/**
 * The spec's tracker ticket, and what it is still owed.
 *
 * Nothing here writes without being shown first: an event resolves into the
 * exact tool calls it would make, those are rendered with their arguments, and
 * only then can they be sent. Writing into a board the team shares has to be
 * inspectable *before* it happens, not explicable afterwards.
 */
export function TicketPanel({
  meta,
  files,
  summary,
  compact,
}: {
  meta: SpecMeta;
  files: { plan?: string; requirements?: string; bugfix?: string };
  summary?: string;
  compact?: boolean;
}) {
  const root = useWorkspace((s) => s.root)!;
  const refreshAll = useWorkspace((s) => s.refreshAll);
  const openLibrary = useUi((s) => s.openLibrary);
  const openOverlay = useUi((s) => s.openOverlay);

  // The whole list, not just "is any enabled": the spec's ticket names a
  // provider *id*, and its preset is what says which mark and hue to wear.
  const [providers, setProviders] = useState<TicketProviderConfig[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ provider: { id: string; label: string }; actions: TicketAction[] }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const pending = pendingEvents(meta, files, summary);

  useEffect(() => {
    // A preload older than this component has no `tickets` namespace at all;
    // reading through it would throw synchronously, before any `.catch`.
    if (!bridgeReady('tickets', 'listProviders')) {
      setProviders([]);
      return;
    }
    window.octo.tickets
      .listProviders(root)
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [root]);

  const configured = providers === null ? null : providers.some((p) => p.enabled);
  const linkedProvider = providers?.find((p) => p.id === meta.ticket?.provider);

  const preview = useCallback(
    async (ev: SyncEvent) => {
      const id = syncEventId(ev);
      if (expanded === id) {
        setExpanded(null);
        return;
      }
      setExpanded(id);
      setPlan([]);
      const res = await window.octo.tickets.plan({ root, specId: meta.id, event: ev });
      setPlan(res);
    },
    [expanded, root, meta.id]
  );

  const apply = async (ev: SyncEvent) => {
    const id = syncEventId(ev);
    setBusy(id);
    setNotice(null);
    try {
      for (const group of plan) {
        const res = await window.octo.tickets.apply({
          root,
          specId: meta.id,
          providerId: group.provider.id,
          actions: group.actions,
          eventId: id,
        });
        if (!res.ok) {
          setNotice({ tone: 'bad', text: res.error ?? 'The tracker rejected the call' });
          return;
        }
      }
      setNotice({ tone: 'ok', text: 'Tracker updated' });
      setExpanded(null);
      setPlan([]);
      await refreshAll();
    } finally {
      setBusy(null);
    }
  };

  // Nothing configured and nothing linked: stay out of the way entirely.
  if (configured === false && !meta.ticket) return null;
  if (configured === null) return null;

  const body = (
    <>
      {meta.ticket ? (
        <div className="flex items-center gap-2 min-w-0">
          {linkedProvider ? (
            <TrackerMark provider={linkedProvider} size={13} className="shrink-0" />
          ) : (
            <Ticket size={13} className="text-accent shrink-0" />
          )}
          {/* The key opens the ticket itself. From inside a spec, "what did the
              ticket actually say?" is asked constantly and used to mean leaving
              the app for the tracker's own tab. */}
          <button
            onClick={() =>
              openOverlay({
                kind: 'ticket',
                provider: linkedProvider,
                ticket: {
                  key: meta.ticket!.key,
                  title: meta.ticket!.title ?? '',
                  status: meta.ticket!.status,
                  url: meta.ticket!.url,
                  provider: meta.ticket!.provider,
                  providerLabel: linkedProvider?.label ?? meta.ticket!.provider,
                },
              })
            }
            title="Ver el ticket"
            className="font-mono text-[12px] text-ink-50 hover:text-accent-text transition"
          >
            {meta.ticket.key}
          </button>
          {meta.ticket.url && (
            <button
              onClick={() => void window.octo.shell.openUrl(meta.ticket!.url!)}
              className="text-faint hover:text-ink-200 transition"
              title="Open in the tracker"
            >
              <ExternalLink size={11} />
            </button>
          )}
          {meta.ticket.status && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
              {meta.ticket.status}
            </span>
          )}
        </div>
      ) : (
        <div className="text-[11.5px] text-dim">Not linked to a ticket yet.</div>
      )}

      {pending.length === 0 && meta.ticket && (
        <div className="flex items-center gap-1.5 text-[11px] text-ok">
          <Check size={11} /> Up to date
        </div>
      )}

      {pending.map((ev) => {
        const id = syncEventId(ev);
        const open = expanded === id;
        return (
          <div key={id} className="rounded-lg bg-ink-900/50 overflow-hidden">
            <button
              onClick={() => void preview(ev)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-elev/50 transition"
            >
              <ChevronRight
                size={12}
                className={cn('shrink-0 text-faint transition', open && 'rotate-90')}
              />
              <span className="flex-1 min-w-0 text-[11.5px] text-ink-200">{eventLabel(ev)}</span>
            </button>
            {open && (
              <div className="px-2.5 pb-2.5 space-y-2">
                {plan.length === 0 ? (
                  <p className="text-[11px] text-faint">
                    No tracker is mapped for this step.{' '}
                    <button
                      onClick={() => openLibrary('tickets')}
                      className="underline hover:text-ink-200"
                    >
                      Configure it
                    </button>
                    .
                  </p>
                ) : (
                  <>
                    {plan.map((g) =>
                      g.actions.map((a, i) => (
                        <div key={`${g.provider.id}-${i}`} className="text-[11px]">
                          <div className="text-ink-200">{a.summary}</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-bg px-2 py-1.5 font-mono text-[10.5px] text-faint">
                            {a.tool}({JSON.stringify(a.args, null, 1).replace(/\n\s*/g, ' ')})
                          </pre>
                        </div>
                      ))
                    )}
                    <button
                      onClick={() => void apply(ev)}
                      disabled={busy === id}
                      className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {busy === id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Send to the tracker
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {notice && (
        <div
          className={cn(
            'flex items-start gap-1.5 text-[11px] leading-snug',
            notice.tone === 'ok' ? 'text-ok' : 'text-danger-text'
          )}
        >
          {notice.tone === 'ok' ? (
            <Check size={11} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          )}
          {notice.text}
        </div>
      )}
    </>
  );

  // The compact variant carries its own heading: the caller cannot know whether
  // this renders anything (a JSX element is always truthy), so a heading owned
  // by the caller would be left standing over nothing.
  if (compact)
    return (
      <div>
        <h3 className="text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-2">
          Tracker
        </h3>
        <div className="space-y-2">{body}</div>
      </div>
    );

  return (
    <section className="rounded-lg border border-ink-700/70 bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-700/70">
        <Ticket size={14} className="text-accent" />
        <h3 className="text-[12.5px] font-medium text-ink-50">Tracker</h3>
        <div className="flex-1" />
        <button
          onClick={() => openLibrary('tickets')}
          className="text-[11px] text-faint hover:text-ink-200 transition"
        >
          Configure →
        </button>
      </header>
      <div className="p-4 space-y-2.5">{body}</div>
    </section>
  );
}
