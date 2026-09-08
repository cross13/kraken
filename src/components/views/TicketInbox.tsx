import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, AlertTriangle, ChevronRight, Link2, Eye } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { useUi } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { TrackerMark } from '../../lib/trackerBrand';
import { bridgeReady, STALE_BRIDGE } from '../../lib/bridge';
import type { SpecMeta, TicketProviderConfig, TicketSummary } from '../../../electron/shared/types';

export interface TicketGroup {
  provider: TicketProviderConfig;
  tickets: TicketSummary[];
  error?: string;
}

/**
 * Loading the open work out of every configured tracker.
 *
 * Lifted out of the component because Home decides the *layout* from the
 * answer: with no tracker configured there is no Entrada pane at all and the
 * board takes the whole width, which the pane cannot decide from inside itself.
 */
export function useTicketGroups(root: string | null) {
  const [groups, setGroups] = useState<TicketGroup[]>([]);
  const [hasProviders, setHasProviders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);

  // Two reads, on purpose. `listProviders` is a local config read and answers
  // *whether there is an Entrada pane at all*; `listOpen` talks to every
  // tracker over MCP and can take seconds. Deciding the layout from the slow
  // one makes the board jump sideways once the network answers.
  useEffect(() => {
    if (!root || !bridgeReady('tickets', 'listProviders')) {
      setHasProviders(false);
      return;
    }
    let live = true;
    window.octo.tickets
      .listProviders(root)
      .then((list) => live && setHasProviders(list.some((p) => p.enabled)))
      .catch(() => live && setHasProviders(false));
    return () => {
      live = false;
    };
  }, [root]);

  const reload = useCallback(async () => {
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
    void reload();
  }, [reload]);

  return { groups, hasProviders, loading, stale, reload };
}

interface Lane {
  id: string;
  label: string;
  /** the tracker this lane draws from — absent on the *Ya con spec* lane */
  provider?: TicketProviderConfig;
  /** tickets nothing covers yet — clicking one arms it for the board */
  open: TicketSummary[];
  /** tickets a spec already covers, paired with it and with their tracker */
  linked: { ticket: TicketSummary; spec: SpecMeta; provider: TicketProviderConfig }[];
  error?: string;
}

/**
 * Builds the pane's lanes: **one per tracker**, plus a separate lane for the
 * tickets a spec already covers.
 *
 * The third lane exists because "already has a spec" is the answer to a
 * question people actually ask ("did we start PROJ-205?"). Filtering those rows
 * out — what this pane used to do — answers it by making the evidence vanish.
 */
function buildLanes(groups: TicketGroup[], specs: SpecMeta[]): Lane[] {
  const specByKey = new Map<string, SpecMeta>();
  for (const s of specs) if (s.ticket?.key) specByKey.set(s.ticket.key, s);

  const lanes: Lane[] = [];
  const linked: Lane['linked'] = [];

  for (const g of groups) {
    const open: TicketSummary[] = [];
    for (const t of g.tickets) {
      const spec = specByKey.get(t.key);
      if (spec) linked.push({ ticket: t, spec, provider: g.provider });
      else open.push(t);
    }
    lanes.push({
      id: g.provider.id,
      label: g.provider.label,
      provider: g.provider,
      open,
      linked: [],
      error: g.error,
    });
  }

  if (linked.length) {
    lanes.push({ id: '__linked', label: 'Ya con spec', open: [], linked });
  }
  return lanes;
}

// ---------- reading a ticket's own vocabulary ----------

/**
 * How loud a priority is, from whatever word the tracker used for it.
 *
 * No two trackers agree — `Urgente`, `Highest`, `Blocker`, `P1` — and none of
 * them says where that sits on a scale. Substring matching against the words
 * that actually recur is the honest amount of inference; anything unrecognised
 * gets no colour rather than a wrong one.
 */
const P_HOT = /urgen|highest|critical|blocker|\bp0\b/i;
const P_WARM = /high|alta|major|\bp1\b/i;

function priorityTone(p: string): string {
  if (P_HOT.test(p)) return 'text-danger-text';
  if (P_WARM.test(p)) return 'text-warn';
  return 'text-ink-600';
}

/** `12m` · `4h` · `3d` — how long the ticket has sat since anyone touched it. */
function age(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}d` : `${Math.round(d / 30)}me`;
}

/**
 * The one line under a ticket's title: where it lives, who has it, how old it
 * is, and whatever the tracker chose to label it with.
 *
 * Every part is optional and simply absent when the tracker sent nothing —
 * padding the line with `—` would make an empty field look like an answer.
 */
function metaLine(t: TicketSummary): string[] {
  return [t.group, t.assignee, age(t.updated), ...(t.labels ?? []).slice(0, 2)].filter(
    (x): x is string => Boolean(x)
  );
}

/**
 * The **read** half of a ticket row: its own column on the right edge, with a
 * rule between it and the row.
 *
 * It was a 12px icon that faded in on hover, in the corner, and it was
 * effectively invisible — a discovery affordance you have to already know about
 * has failed at the one job it has. So it is a persistent target now: a real
 * column, sized like a control, legible at rest. That costs 36px of a pane that
 * has room for it, and it buys the answer to "can I look at this without
 * starting it?" being visible rather than remembered.
 *
 * The rule is what stops it reading as decoration inside the row: it is a
 * *different action*, and it has to look separable to be clicked deliberately.
 */
function InspectRail({ onClick, ticketKey }: { onClick: () => void; ticketKey: string }) {
  return (
    <button
      onClick={onClick}
      title={`Ver ${ticketKey} — leer el ticket sin crear nada`}
      aria-label={`Ver ${ticketKey}`}
      className="shrink-0 w-9 grid place-items-center border-l border-ink-800 bg-ink-50/[0.025] text-dim hover:bg-accent/[0.14] hover:text-accent-text focus-visible:bg-accent/[0.14] focus-visible:text-accent-text transition"
    >
      <Eye size={14} />
    </button>
  );
}

interface Props {
  groups: TicketGroup[];
  loading: boolean;
  stale: boolean;
  reload: () => void;
  /** `TicketSummary.key` of the ticket waiting for a board column, if any */
  armedKey: string | null;
  onArm: (ticket: TicketSummary | null) => void;
  /** true while a spec is being created — the pane stops accepting clicks */
  busy: boolean;
}

/**
 * **Entrada** — the board's left pane: the open work already sitting in your
 * trackers, one lane per source.
 *
 * Most specs do not start from a blank prompt; they start from a ticket
 * somebody already wrote. Clicking one *arms* it, and the board answers by
 * lighting up the two columns a spec can legitimately start in — so the ticket
 * becomes the brief and the spec is linked from birth.
 */
export function TicketInbox({
  groups,
  loading,
  stale,
  reload,
  armedKey,
  onArm,
  busy,
}: Props) {
  const specs = useWorkspace((s) => s.specs);
  const openSpec = useUi((s) => s.openSpec);
  const openLibrary = useUi((s) => s.openLibrary);
  const openOverlay = useUi((s) => s.openOverlay);

  const lanes = useMemo(() => buildLanes(groups, specs), [groups, specs]);

  // Reading a ticket is a *detail view*, not a board state: it opens the
  // slide-over and leaves whatever was armed exactly as it was, so looking
  // something up never costs you the selection you had made.
  const onInspect = (ticket: TicketSummary) =>
    openOverlay({
      kind: 'ticket',
      ticket,
      provider: groups.find((g) => g.provider.id === ticket.provider)?.provider,
    });
  // Every tracker open, the "already covered" lane closed: it is evidence, not
  // work, and it should not compete for height with what you can act on.
  const [closed, setClosed] = useState<Record<string, boolean>>({ __linked: true });
  const toggle = (id: string) => setClosed((c) => ({ ...c, [id]: !c[id] }));

  const openCount = lanes.reduce((n, l) => n + l.open.length, 0);
  const errors = lanes.filter((l) => l.error);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2.5 h-[26px] mb-3 shrink-0">
        <h2 className="m-0 font-display text-[13px] font-semibold text-ink-50 tracking-[0.01em]">
          Entrada
        </h2>
        <span className="text-[11.5px] text-ink-600">{openCount} sin empezar</span>
        <div className="flex-1" />
        <button
          onClick={reload}
          disabled={loading}
          title="Sincronizar con los trackers"
          className="w-6 h-6 grid place-items-center text-ink-600 hover:text-ink-200 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
        </button>
      </div>

      {stale && (
        <p className="flex gap-2 text-[11.5px] text-warn leading-snug mb-3">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          Los tickets no se pueden listar: {STALE_BRIDGE}
        </p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3.5 -mr-2 pr-2">
        {lanes.map((lane) => {
          const isLinked = lane.id === '__linked';
          const count = isLinked ? lane.linked.length : lane.open.length;
          const shut = !!closed[lane.id];
          return (
            <div key={lane.id} className="flex flex-col shrink-0">
              <button
                onClick={() => toggle(lane.id)}
                className={cn(
                  'flex items-center gap-2 h-10 px-2.5 border-l-2 transition text-left w-full shrink-0',
                  isLinked
                    ? 'bg-accent/[0.08] border-l-accent text-accent-text'
                    : 'bg-raised border-l-ink-700 text-dim hover:text-ink-50'
                )}
              >
                <ChevronRight
                  size={12}
                  strokeWidth={2.2}
                  className={cn('shrink-0 transition-transform', !shut && 'rotate-90')}
                />
                {/* the tracker's own mark, so a lane is identifiable before its
                    name is read — Entrada is the one place several sit stacked */}
                {lane.provider ? (
                  <TrackerMark provider={lane.provider} size={12} className="shrink-0" />
                ) : (
                  <Link2 size={12} className="shrink-0" />
                )}
                <span className="font-mono text-[10px] tracking-[0.1em] font-medium truncate">
                  {lane.label.toUpperCase()}
                </span>
                <div className="flex-1" />
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    isLinked ? 'text-accent-text' : 'text-ink-600'
                  )}
                >
                  {count}
                </span>
              </button>

              {!shut && (
                <div className="flex flex-col">
                  {lane.open.map((t) => {
                    const armed = armedKey === t.key;
                    const status = t.statusLabel ?? t.status;
                    const meta = metaLine(t);
                    return (
                      // A wrapper, because the row now carries **two** actions:
                      // arming it for the board, and simply reading it. They
                      // cannot nest — a button inside a button is invalid — and
                      // they must not be the same click, since one of them
                      // eventually writes a spec to disk and the other never
                      // touches anything.
                      <div
                        key={`${t.provider}-${t.key}`}
                        className={cn(
                          'group flex border-b border-ink-850 transition',
                          armed
                            ? 'bg-accent/10 ring-1 ring-inset ring-accent/55'
                            : 'hover:bg-raised'
                        )}
                      >
                      <button
                        onClick={() => onArm(armed ? null : t)}
                        disabled={busy}
                        title={[t.key, t.title, t.description?.slice(0, 400)]
                          .filter(Boolean)
                          .join('\n\n')}
                        className="flex-1 min-w-0 flex flex-col gap-1 justify-center pl-2.5 pr-2 py-2 min-h-[52px] text-left disabled:opacity-50"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-accent-text shrink-0">
                            {t.key}
                          </span>
                          {t.type && (
                            <span className="text-[10.5px] text-ink-600 shrink-0">{t.type}</span>
                          )}
                          {status && (
                            <span className="text-[10.5px] text-ink-600 px-1.5 py-px bg-raised shrink-0 truncate max-w-[100px]">
                              {status}
                            </span>
                          )}
                          <div className="flex-1" />
                          <span
                            className={cn(
                              'flex items-center gap-1 text-[10.5px] text-accent-text shrink-0 transition-opacity',
                              armed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            al board
                            <ChevronRight size={11} strokeWidth={2.4} />
                          </span>
                        </div>

                        <div className="text-[12.5px] text-ink-200 leading-snug line-clamp-2">
                          {t.title || t.key}
                        </div>

                        {(t.priority || meta.length > 0) && (
                          <div className="flex items-center gap-1.5 text-[10.5px] text-ink-600 min-w-0">
                            {t.priority && (
                              <span
                                className={cn(
                                  'flex items-center gap-1 shrink-0',
                                  priorityTone(t.priority)
                                )}
                              >
                                <span className="w-1 h-1 rounded-full bg-current" />
                                {t.priority}
                              </span>
                            )}
                            {t.priority && meta.length > 0 && <span className="shrink-0">·</span>}
                            <span className="truncate">{meta.join(' · ')}</span>
                          </div>
                        )}
                      </button>

                      <InspectRail onClick={() => onInspect(t)} ticketKey={t.key} />
                      </div>
                    );
                  })}

                  {lane.linked.map(({ ticket, spec, provider }) => (
                    <div
                      key={`${ticket.provider}-${ticket.key}`}
                      className="group flex border-b border-ink-850 hover:bg-raised transition"
                    >
                    <button
                      onClick={() => openSpec(spec.id)}
                      title={`${ticket.key} ya tiene spec — abrir ${spec.name}`}
                      className="flex-1 min-w-0 flex flex-col gap-0.5 justify-center pl-2.5 pr-2 py-2 min-h-[52px] text-left"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* this lane is the one place two trackers interleave,
                            so each row says which one it came from */}
                        <TrackerMark provider={provider} size={11} className="shrink-0" />
                        <span className="font-mono text-[11px] text-ink-600 shrink-0">
                          {ticket.key}
                        </span>
                        {/* the ticket's own title, so the row still says what
                            the work is and not only which spec swallowed it */}
                        {ticket.title && (
                          <span className="text-[11.5px] text-faint truncate">{ticket.title}</span>
                        )}
                        <div className="flex-1" />
                        <span className="flex items-center gap-1 text-[10.5px] text-accent-text shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          ir al spec
                          <ChevronRight size={11} strokeWidth={2.4} />
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12.5px] text-dim leading-snug min-w-0">
                        <Link2 size={11} className="text-accent shrink-0" />
                        <span className="truncate">
                          {spec.name} · {spec.phase}
                        </span>
                      </div>
                    </button>
                    <InspectRail onClick={() => onInspect(ticket)} ticketKey={ticket.key} />
                    </div>
                  ))}

                  {count === 0 && (
                    <div className="px-2.5 py-3 text-[11.5px] text-ink-600">
                      Nada abierto acá.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {lanes.length === 0 && (
          <p className="text-[11.5px] text-ink-600 shrink-0">
            {loading ? 'Buscando tickets…' : 'Ningún tracker devolvió tickets abiertos.'}
          </p>
        )}

        {errors.map((l) => (
          <p key={l.id} className="flex gap-2 text-[11.5px] text-dim leading-snug shrink-0">
            <AlertTriangle size={12} className="text-warn shrink-0 mt-0.5" />
            <span>
              <b className="text-ink-200 font-medium">{l.label}</b>: {l.error}{' '}
              <button onClick={() => openLibrary('tickets')} className="underline hover:text-ink-100">
                Configurar
              </button>
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
