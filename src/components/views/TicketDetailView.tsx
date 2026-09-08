import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  AlertTriangle,
  Check,
  Circle,
  ChevronRight,
  Link2,
  Clock,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi, stageForPhase } from '../../stores/ui';
import { Markdown } from '../Markdown';
import { TrackerMark } from '../../lib/trackerBrand';
import { cn } from '../../lib/cn';
import { bridgeReady, STALE_BRIDGE } from '../../lib/bridge';
import { planSpecFromTicket, quickPlanSpecFromTicket } from '../../lib/specActions';
import type {
  TicketDetail,
  TicketProviderConfig,
  TicketSummary,
} from '../../../electron/shared/types';

/**
 * **Reading a ticket without starting anything.**
 *
 * Until this existed, the only thing you could do with a ticket in Entrada was
 * arm it and drop it on the board — which meant the only way to find out
 * whether a ticket was the work you thought it was, or big enough to split, or
 * already carrying a plan, was to create a spec and look at what came out. That
 * leaves litter on disk for a question that should cost nothing.
 *
 * So this panel is read-first. It shows what the tracker actually holds — the
 * description, the plan it already carries and whether that plan is signed off,
 * the criteria you will be validated against, the comments and the history —
 * and only *then* offers the two entry points, which are the same two the board
 * offers. Nothing here writes to the tracker.
 */
export function TicketDetailView({
  ticket,
  provider,
}: {
  ticket: TicketSummary;
  provider?: TicketProviderConfig;
}) {
  const root = useWorkspace((s) => s.root);
  const specs = useWorkspace((s) => s.specs);
  const openSpec = useUi((s) => s.openSpec);
  const closeOverlay = useUi((s) => s.closeOverlay);

  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | 'plan' | 'quick'>(null);
  const [showHistory, setShowHistory] = useState(false);

  // A spec may already cover this ticket, in which case the entry points are
  // the wrong offer entirely — you want the spec, not a second one.
  const covering = useMemo(
    () => specs.find((s) => s.ticket?.key === ticket.key),
    [specs, ticket.key]
  );

  useEffect(() => {
    if (!root) return;
    if (!bridgeReady('tickets', 'detail')) {
      setError(STALE_BRIDGE);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    window.octo.tickets
      .detail({ root, providerId: ticket.provider, ticket })
      .then((res) => {
        if (!live) return;
        setDetail(res.detail);
        setError(res.ok ? null : (res.error ?? 'The tracker could not be read.'));
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [root, ticket]);

  // Until the read lands, the row already has enough to draw the header — the
  // panel opens filled in rather than as a spinner over nothing.
  const t = detail?.ticket ?? ticket;
  const start = async (how: 'plan' | 'quick') => {
    setCreating(how);
    try {
      const spec =
        how === 'plan' ? await planSpecFromTicket(ticket) : await quickPlanSpecFromTicket(ticket);
      if (spec) {
        closeOverlay();
        openSpec(spec.id, stageForPhase(spec.phase));
      }
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="k-read px-7 py-6">
          {/* ---- who and what ---- */}
          <div className="flex items-center gap-2 mb-2">
            {provider && <TrackerMark provider={provider} size={13} className="shrink-0" />}
            <span className="font-mono text-[11.5px] text-accent-text">{t.key}</span>
            {t.url && (
              <button
                onClick={() => void window.octo.shell.openUrl(t.url!)}
                title="Abrir en el tracker"
                className="flex items-center gap-1 text-[11px] text-faint hover:text-ink-100 transition"
              >
                <ExternalLink size={11} /> abrir
              </button>
            )}
            <div className="flex-1" />
            {loading && <Loader2 size={13} className="animate-spin text-faint" />}
          </div>

          <h1 className="m-0 font-display text-[21px] leading-[1.25] font-semibold text-ink-50 tracking-[-0.012em] mb-3">
            {t.title || t.key}
          </h1>

          <FieldGrid detail={detail} ticket={t} />

          {t.labels && t.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {t.labels.map((l) => (
                <span key={l} className="text-[10.5px] text-dim px-1.5 py-px bg-raised">
                  {l}
                </span>
              ))}
            </div>
          )}

          {error && (
            <p className="flex gap-2 text-[11.5px] text-warn leading-snug mt-4">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>
                No se pudo leer el ticket completo — esto es lo que había en la lista. {error}
              </span>
            </p>
          )}

          {covering && (
            <button
              onClick={() => {
                closeOverlay();
                openSpec(covering.id, stageForPhase(covering.phase));
              }}
              className="flex items-center gap-2 w-full mt-4 px-3 py-2.5 bg-accent/[0.08] ring-1 ring-inset ring-accent/40 text-left hover:bg-accent/[0.12] transition"
            >
              <Link2 size={12} className="text-accent shrink-0" />
              <span className="text-[12px] text-ink-100 truncate">
                Ya tiene spec: <b className="font-medium">{covering.name}</b> · {covering.phase}
              </span>
              <div className="flex-1" />
              <ChevronRight size={12} className="text-accent-text shrink-0" />
            </button>
          )}

          {/* ---- the ticket's own words ---- */}
          <Section title="Descripción">
            {detail?.body ? (
              <Markdown source={detail.body} className="md" />
            ) : loading ? (
              <Skeleton />
            ) : (
              <Empty>El ticket no trae descripción.</Empty>
            )}
          </Section>

          {/* ---- a plan it already carries ---- */}
          {detail?.plan && (
            <Section
              title="Plan en el ticket"
              aside={
                detail.planApproved === undefined ? null : (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-[10.5px]',
                      detail.planApproved ? 'text-accent-text' : 'text-warn'
                    )}
                  >
                    {detail.planApproved ? <Check size={11} /> : <Circle size={9} />}
                    {detail.planApproved
                      ? `aprobado${detail.planApprovedBy ? ` por ${detail.planApprovedBy}` : ''}`
                      : 'sin aprobar'}
                  </span>
                )
              }
            >
              <Markdown source={detail.plan} className="md" />
            </Section>
          )}

          {/* ---- what it will be validated against ---- */}
          {detail && detail.criteria.length > 0 && (
            <Section title={`Criterios de validación · ${detail.criteria.length}`}>
              <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
                {detail.criteria.map((c, i) => {
                  const done = /verif|done|pass|ok|cumpl/i.test(c.state ?? '');
                  return (
                    <li key={i} className="flex gap-2.5 text-[12.5px] leading-[1.5]">
                      <span className="font-mono text-[10.5px] text-ink-600 shrink-0 pt-[3px] w-6 text-right">
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 mt-[5px] w-2.5 h-2.5 grid place-items-center',
                          done ? 'text-accent-text' : 'text-ink-700'
                        )}
                        title={c.stateLabel ?? c.state ?? ''}
                      >
                        {done ? <Check size={10} strokeWidth={3} /> : <Circle size={8} />}
                      </span>
                      <span className="text-ink-200">{c.text}</span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {/* ---- conversation ---- */}
          {detail && detail.comments.length > 0 && (
            <Section title={`Comentarios · ${detail.comments.length}`}>
              <div className="flex flex-col gap-3">
                {detail.comments.map((c, i) => (
                  <div key={i} className="border-l-2 border-ink-800 pl-3">
                    <div className="flex items-center gap-2 text-[10.5px] text-ink-600 mb-1">
                      {c.author && <span className="text-dim">{c.author}</span>}
                      {c.when && <span>{when(c.when)}</span>}
                    </div>
                    <Markdown source={c.body} className="md" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ---- what has happened ---- */}
          {detail && detail.history.length > 0 && (
            <Section
              title={`Historial · ${detail.history.length}`}
              aside={
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-[10.5px] text-faint hover:text-ink-100 transition"
                >
                  {showHistory ? 'ocultar' : 'ver'}
                </button>
              }
            >
              {showHistory && (
                <ul className="m-0 p-0 list-none flex flex-col gap-1">
                  {detail.history.map((h, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[11.5px] text-ink-600">
                      <span className="font-mono text-[10.5px] shrink-0 w-[74px]">
                        {when(h.when)}
                      </span>
                      <span className="text-dim">{prettyAction(h.what)}</span>
                      {h.actor && <span className="truncate">· {actorName(h.actor)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* ---- last resort: the server's own words ---- */}
          {!loading && detail && !detail.body && !detail.plan && detail.raw && (
            <Section title="Respuesta del tracker">
              <p className="text-[11px] text-ink-600 leading-snug mb-2">
                Octo no reconoció la forma de esta respuesta. Esto es lo que el tracker contestó,
                tal cual.
              </p>
              <pre className="m-0 p-3 bg-raised overflow-x-auto text-[11.5px] leading-[1.5] text-dim whitespace-pre-wrap">
                {detail.raw}
              </pre>
            </Section>
          )}
        </div>
      </div>

      {/* ---- and only now, what you can do about it ---- */}
      {!covering && (
        <div className="shrink-0 flex items-center gap-2 px-7 py-3 border-t border-ink-800 bg-ink-50/[0.02]">
          <span className="text-[11.5px] text-ink-600 truncate">
            Leer no crea nada. Cuando quieras empezar:
          </span>
          <div className="flex-1" />
          <button
            onClick={() => void start('plan')}
            disabled={creating !== null}
            title="Crea el spec y para en cada aprobación"
            className="flex items-center gap-1.5 h-8 px-3 border border-ink-800 text-[12px] font-semibold text-dim hover:border-accent/50 hover:text-accent-text transition disabled:opacity-50"
          >
            {creating === 'plan' ? <Loader2 size={12} className="animate-spin" /> : null}
            Plan
          </button>
          <button
            onClick={() => void start('quick')}
            disabled={creating !== null}
            title="Redacta requirements y plan sin paradas"
            className="flex items-center gap-1.5 h-8 px-3 bg-accent text-[12px] font-semibold text-accent-fg hover:opacity-90 transition disabled:opacity-50"
          >
            {creating === 'quick' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Zap size={12} />
            )}
            Plan rápido
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The ticket's fields as a definition list — only the ones that came back.
 *
 * A fixed grid with `—` in the gaps would make every tracker look like it was
 * withholding something; the trackers genuinely differ in what they model.
 */
function FieldGrid({ detail, ticket }: { detail: TicketDetail | null; ticket: TicketSummary }) {
  const rows: [string, string | undefined][] = [
    ['Estado', ticket.statusLabel ?? ticket.status],
    ['Tipo', ticket.type],
    ['Prioridad', ticket.priority],
    ['Asignado', ticket.assignee],
    ['Reporta', detail?.reporter],
    ['En', ticket.group],
    ['Creado', when(detail?.created)],
    ['Actualizado', when(ticket.updated)],
    ['Estimado', minutes(detail?.estimateMinutes)],
    ['Registrado', minutes(detail?.loggedMinutes)],
  ];
  const shown = rows.filter(([, v]) => Boolean(v));
  if (!shown.length) return null;
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1.5">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[10.5px] text-ink-600 tracking-[0.04em] self-center">{k}</dt>
          <dd className="m-0 text-[12px] text-ink-200 truncate self-center">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-ink-850">
        <h2 className="m-0 font-mono text-[10px] tracking-[0.12em] font-medium text-faint">
          {title.toUpperCase()}
        </h2>
        <div className="flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[12px] text-ink-600 italic">{children}</p>;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[92, 78, 85].map((w, i) => (
        <div key={i} className="h-3 bg-raised animate-pulse-slow" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/** `6 sep 09:40` — a timestamp you can compare at a glance, not an ISO string. */
function when(iso?: string): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function minutes(n?: number): string | undefined {
  if (!n) return undefined;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** `task.plan_approved` → `plan approved`. The tracker's event names are dotted. */
function prettyAction(what: string): string {
  return what.replace(/^[a-z]+\./, '').replace(/[_.]/g, ' ');
}

/** `human:Lucas borella` → `Lucas borella`; the prefix is the tracker's, not news. */
function actorName(actor: string): string {
  return actor.replace(/^(human|agent|user|bot):/i, '');
}
