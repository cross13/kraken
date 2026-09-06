import { useCallback, useEffect, useState } from 'react';
import {
  Ticket,
  Plug,
  Loader2,
  Check,
  AlertTriangle,
  Trash2,
  KeyRound,
  Plus,
  RotateCcw,
  LogIn,
  Copy,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { cn } from '../../lib/cn';
import { JIRA_TOOLS } from '../../../electron/shared/jira';
import { ModuleHeader } from '../ModuleShell';
import type {
  McpServerMeta,
  McpToolMeta,
  TicketCapability,
  TicketProviderConfig,
} from '../../../electron/shared/types';

/**
 * Tickets — one tab per tracker, and inside it the setup in the order you do it.
 *
 * The previous version put every control on one flat page: preset, endpoint,
 * sign-in, token, scope, project, enable, remove and a ten-row tool table, with
 * nothing saying which of them was the reason nothing worked. That is fine to
 * build and miserable to use.
 *
 * Two ideas fix it. **One status line per tab** answers the only question
 * anyone actually has — can this list my tickets, and if not what is missing —
 * with the button that fixes it right there. And the rest is **three numbered
 * steps in dependency order**: you cannot pick a project before you have signed
 * in, so the panel stops presenting those as equals. The tool mapping is real
 * but advanced, so it collapses.
 */

/**
 * A first guess at which tracker this is, from what the server calls itself and
 * where it points. Only a guess — the preset is editable, because it decides
 * how every argument is shaped and getting it wrong is a schema rejection with
 * no obvious cause.
 */
function presetFor(server: McpServerMeta): TicketProviderConfig['preset'] {
  const hay = `${server.name} ${server.url ?? ''}`.toLowerCase();
  if (hay.includes('atlassian') || hay.includes('jira')) return 'jira';
  if (server.name === 'tracker') return 'tracker';
  return 'generic';
}

const PRESETS: { value: TicketProviderConfig['preset']; label: string; hint: string }[] = [
  { value: 'jira', label: 'Jira', hint: 'Atlassian Rovo MCP — pinned tool names, JQL, cloudId' },
  { value: 'tracker', label: 'Tracker', hint: 'tasks with a plan and validation criteria' },
  { value: 'generic', label: 'Generic', hint: 'discovered tools, best-effort argument names' },
];

/** Which scope field a preset calls its own, and what a human calls it. */
function scopeField(preset: TicketProviderConfig['preset']): {
  key: string;
  label: string;
  placeholder: string;
} {
  return preset === 'jira'
    ? { key: 'cloudId', label: 'Atlassian site', placeholder: 'https://acme.atlassian.net' }
    : { key: 'client', label: 'Client / project', placeholder: 'e.g. aps' };
}

/** The capabilities Octo drives, in the order a spec reaches them. */
const CAPABILITIES: { cap: TicketCapability; label: string; when: string }[] = [
  { cap: 'create', label: 'Create ticket', when: 'a spec is created' },
  { cap: 'set-plan', label: 'Write plan', when: 'the plan is approved' },
  { cap: 'approve-plan', label: 'Approve plan', when: 'the plan is approved' },
  { cap: 'comment', label: 'Comment', when: 'a phase is approved' },
  { cap: 'link-branch', label: 'Link branch', when: 'a branch is created' },
  { cap: 'link-pr', label: 'Link pull request', when: 'a PR is opened' },
  { cap: 'transition', label: 'Change status', when: 'every task is done' },
  { cap: 'check-criteria', label: 'Tick criteria', when: 'manually, from the spec' },
  { cap: 'get', label: 'Read ticket', when: 'seeding a spec from a ticket' },
  { cap: 'search', label: 'Search', when: 'listing open work on Home' },
  { cap: 'scopes', label: 'List sites / clients', when: 'choosing what to scope to' },
];

export function TicketsStudio() {
  const root = useWorkspace((s) => s.root);
  const [servers, setServers] = useState<McpServerMeta[]>([]);
  const [providers, setProviders] = useState<TicketProviderConfig[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!root) return;
    const [s, p] = await Promise.all([
      window.octo.mcp.list(root),
      window.octo.tickets.listProviders(root),
    ]);
    setServers(s);
    setProviders(p);
    setSelected((cur) => (cur && p.some((x) => x.id === cur) ? cur : (p[0]?.id ?? null)));
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProvider = async (server: McpServerMeta) => {
    if (!root) return;
    const provider: TicketProviderConfig = {
      id: `${server.name}-${Date.now().toString(36)}`,
      label: server.name,
      server: server.name,
      preset: presetFor(server),
      enabled: false,
      defaults: {},
      tools: {},
    };
    setProviders(await window.octo.tickets.saveProvider({ root, provider }));
    setSelected(provider.id);
  };

  const current = providers.find((p) => p.id === selected) ?? null;
  const unconfigured = servers.filter((s) => !providers.some((p) => p.server === s.name));

  return (
    <div className="h-full flex flex-col">
      <ModuleHeader
        icon={<Ticket size={16} />}
        title="Tickets"
        subtitle="Keep each spec linked to its tracker, over the MCP servers you already have."
      />

      {!root ? (
        <p className="k-wide py-6 text-[12.5px] text-dim">Open a workspace first.</p>
      ) : providers.length === 0 && unconfigured.length === 0 ? (
        <div className="k-wide py-6">
          <p className="text-[12.5px] text-dim max-w-[62ch] leading-relaxed">
            No MCP servers are configured for this workspace. Octo reads them from{' '}
            <code className="font-mono text-[11.5px]">.mcp.json</code> and from{' '}
            <code className="font-mono text-[11.5px]">~/.claude.json</code> — including the
            per-project entries, which is where <code className="font-mono text-[11.5px]">claude
            mcp add</code> puts them when you run it inside a repo.
          </p>
        </div>
      ) : (
        <>
          {/* One tab per tracker. The dot is the answer to "does this work". */}
          <div className="k-chrome shrink-0 flex items-end gap-1 px-7 border-b border-ink-800/50 overflow-x-auto">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 pb-2.5 pt-2 text-[12.5px] whitespace-nowrap transition',
                  p.id === selected ? 'text-ink-50' : 'text-faint hover:text-ink-200'
                )}
              >
                <StatusDot provider={p} />
                {p.label}
                {p.id === selected && (
                  <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" />
                )}
              </button>
            ))}
            {unconfigured.map((s) => (
              <button
                key={s.name}
                onClick={() => void addProvider(s)}
                title={`Add ${s.name} as a tracker`}
                className="flex items-center gap-1.5 px-3 pb-2.5 pt-2 text-[12.5px] text-faint hover:text-accent transition whitespace-nowrap"
              >
                <Plus size={12} /> {s.name}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {current && (
              <ProviderTab
                key={current.id}
                root={root}
                provider={current}
                server={servers.find((s) => s.name === current.server)}
                onChange={setProviders}
                onRemoved={() => setSelected(null)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Green when this tracker is set up and syncing, amber when something is missing. */
function StatusDot({ provider }: { provider: TicketProviderConfig }) {
  const field = scopeField(provider.preset);
  const configured = Boolean(provider.defaults?.[field.key]);
  const tone = !configured ? 'text-warn' : provider.enabled ? 'text-ok' : 'text-ink-600';
  return <Circle size={7} className={cn('shrink-0 fill-current', tone)} />;
}

function ProviderTab({
  root,
  provider,
  server,
  onChange,
  onRemoved,
}: {
  root: string;
  provider: TicketProviderConfig;
  server?: McpServerMeta;
  onChange: (list: TicketProviderConfig[]) => void;
  onRemoved: () => void;
}) {
  const [draft, setDraft] = useState<TicketProviderConfig>(provider);
  const [tools, setTools] = useState<McpToolMeta[] | null>(null);
  const [probe, setProbe] = useState<{ busy: boolean; error?: string; ok?: boolean; report?: string }>(
    { busy: false }
  );
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [auth, setAuth] = useState<{ mode: 'none' | 'manual' | 'oauth'; account?: string; expiresAt?: number } | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [scopes, setScopes] = useState<{ key: string; label: string }[] | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scopeRaw, setScopeRaw] = useState<string | null>(null);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const field = scopeField(draft.preset);
  const endpoint = draft.url ?? server?.url ?? '';

  const readAuth = useCallback(() => {
    window.octo.tickets.hasToken(provider.server).then(setHasToken).catch(() => setHasToken(false));
    window.octo.tickets.authStatus(provider.server).then(setAuth).catch(() => setAuth(null));
  }, [provider.server]);

  useEffect(() => {
    readAuth();
  }, [readAuth]);

  const save = async (next: TicketProviderConfig) => {
    setDraft(next);
    onChange(await window.octo.tickets.saveProvider({ root, provider: next }));
  };

  const connect = async () => {
    setProbe({ busy: true });
    const res = await window.octo.mcp.listTools({
      root,
      server: draft.server,
      url: draft.url || undefined,
    });
    if (!res.ok) {
      setTools(null);
      // Assembled here rather than left for the user to transcribe: the failure
      // is a remote exchange, and its useful parts (which endpoint answered,
      // whether a session existed, what the server actually said) are nowhere
      // on screen.
      const report = [
        'Octo — MCP connection report',
        `when:     ${new Date().toISOString()}`,
        `provider: ${draft.label} (preset: ${draft.preset})`,
        `server:   ${res.server?.name ?? draft.server}`,
        `url:      ${endpoint || '(none)'}`,
        `declared: ${res.server?.type ?? '?'} · scope ${res.server?.scope ?? '?'}`,
        `auth:     ${res.auth ?? 'unknown'}`,
        '',
        `error:    ${res.error ?? '(none)'}`,
        ...Object.entries(res.detail ?? {}).map(([k, v]) => `${(k + ':').padEnd(10)}${String(v)}`),
      ].join('\n');
      setProbe({ busy: false, error: res.error ?? 'Could not reach the server', report });
      return;
    }
    setTools(res.tools);
    setProbe({ busy: false, ok: true });
    // Discovery fills blanks only; a mapping the user corrected stays corrected.
    // Jira's names are pinned rather than discovered — see `JIRA_TOOLS`.
    const merged =
      draft.preset === 'jira'
        ? { ...JIRA_TOOLS, ...(draft.tools ?? {}) }
        : { ...(res.map ?? {}), ...(draft.tools ?? {}) };
    await save({ ...draft, tools: merged });
    void loadScopes();
  };

  const signIn = async () => {
    setSigningIn(true);
    setProbe({ busy: false });
    try {
      const res = await window.octo.tickets.signIn({ root, server: draft.server });
      if (!res.ok) setProbe({ busy: false, error: res.error ?? 'Sign-in failed' });
      else {
        readAuth();
        void connect();
      }
    } finally {
      setSigningIn(false);
    }
  };

  const loadScopes = async () => {
    setLoadingScopes(true);
    setScopeError(null);
    try {
      const res = await window.octo.tickets.listScopes({ root, providerId: draft.id });
      setScopes(res.scopes);
      setScopeRaw(null);
      if (!res.ok) setScopeError(res.error ?? 'Could not read the list');
      else if (!res.scopes.length) {
        setScopeError(
          `${res.raw?.tool ?? 'The tool'} answered, but Octo could not read a list out of it — either the account has no sites, or the response has a shape Octo does not know. It is below; paste the value you need into the field.`
        );
        setScopeRaw(
          res.raw
            ? (res.raw.structured
                ? JSON.stringify(res.raw.structured, null, 2)
                : res.raw.text) || '(the server returned an empty response)'
            : null
        );
      }
    } finally {
      setLoadingScopes(false);
    }
  };

  const saveToken = async () => {
    await window.octo.tickets.setToken({ server: draft.server, token: token.trim() || null });
    setToken('');
    readAuth();
  };

  // Atlassian still publishes /v1/sse, the legacy transport, whose POST endpoint
  // is a different path carrying a session id — posting Streamable HTTP at it
  // fails complaining about a missing session, which says nothing about why.
  const suggested = (() => {
    if (!endpoint) return null;
    if (endpoint.includes('mcp.atlassian.com') && !endpoint.includes('/authv2')) {
      return endpoint.replace(/\/v1\/(sse|mcp)\b.*$/, '/v1/mcp/authv2');
    }
    return server?.type === 'sse' && endpoint.includes('/sse')
      ? endpoint.replace(/\/sse\b/, '/mcp')
      : null;
  })();

  const mapped = CAPABILITIES.filter((c) => draft.tools?.[c.cap]).length;
  const scopeSet = Boolean(draft.defaults?.[field.key]);

  /** The one line that answers "does this work", and the button that fixes it. */
  const status: { tone: 'ok' | 'warn' | 'idle'; line: string; cta?: React.ReactNode } = probe.error
    ? { tone: 'warn', line: 'The last connection attempt failed — details below.' }
    : auth?.mode === 'none' && !hasToken
      ? {
          tone: 'idle',
          line: 'Not connected yet. Sign in, or paste a token if your admin issued one.',
          cta: (
            <Btn primary onClick={() => void signIn()} busy={signingIn} icon={<LogIn size={12} />}>
              Sign in
            </Btn>
          ),
        }
      : !tools
        ? {
            tone: 'idle',
            line: 'Connected. Read the server’s tool list to finish setting this up.',
            cta: (
              <Btn primary onClick={connect} busy={probe.busy} icon={<Plug size={12} />}>
                Connect &amp; read tools
              </Btn>
            ),
          }
        : !scopeSet
          ? { tone: 'warn', line: `Choose a ${field.label.toLowerCase()} below — nothing can be listed without one.` }
          : !draft.enabled
            ? { tone: 'idle', line: 'Set up, but sync is off. Octo will not write to this tracker.' }
            : { tone: 'ok', line: `Ready — ${mapped} of ${CAPABILITIES.length} steps mapped.` };

  return (
    <div className="k-wide py-6 space-y-7">
      {/* the answer to the only question */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 ring-1',
          status.tone === 'ok'
            ? 'bg-good/[0.07] ring-good/25'
            : status.tone === 'warn'
              ? 'bg-warn/[0.07] ring-warn/25'
              : 'bg-card ring-ink-700/70'
        )}
      >
        {status.tone === 'ok' ? (
          <Check size={15} className="text-ok shrink-0" />
        ) : status.tone === 'warn' ? (
          <AlertTriangle size={15} className="text-warn shrink-0" />
        ) : (
          <Circle size={13} className="text-faint shrink-0" />
        )}
        <span className="flex-1 text-[12.5px] text-ink-100">{status.line}</span>
        {status.cta}
      </div>

      {probe.error && (
        <div className="rounded-xl bg-warn/[0.05] ring-1 ring-warn/20 p-3.5 space-y-2.5">
          <p className="text-[11.5px] text-warn leading-snug select-text">{probe.error}</p>
          {probe.report && (
            <>
              <pre className="select-text overflow-x-auto rounded-lg bg-bg px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-dim whitespace-pre-wrap">
                {probe.report}
              </pre>
              <div className="flex items-center gap-2">
                <Btn
                  onClick={async () => {
                    await window.octo.shell.copy(probe.report!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  icon={copied ? <Check size={11} /> : <Copy size={11} />}
                >
                  {copied ? 'Copied' : 'Copy report'}
                </Btn>
                <Btn onClick={connect} busy={probe.busy} icon={<RotateCcw size={11} />}>
                  Try again
                </Btn>
              </div>
            </>
          )}
        </div>
      )}

      <Step n={1} title="Connect" hint="Where this tracker lives, and who Octo is when it calls.">
        <Field label="What kind of tracker" hint={PRESETS.find((p) => p.value === draft.preset)?.hint}>
          <select
            value={draft.preset}
            onChange={(e) =>
              void save({
                ...draft,
                preset: e.target.value as TicketProviderConfig['preset'],
                // The scope key differs per preset; carrying the old one over
                // would look configured while being unreadable.
                defaults: {},
                tools: e.target.value === 'jira' ? {} : draft.tools,
              })
            }
            className="lib-input"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Endpoint"
          hint={
            draft.url
              ? 'Overridden in Octo — your MCP config is untouched.'
              : 'Read from your MCP config.'
          }
        >
          <div className="flex gap-1.5">
            <input
              value={endpoint}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              onBlur={() => void save(draft)}
              spellCheck={false}
              placeholder={server?.url ?? 'https://…/mcp'}
              className="lib-input flex-1 font-mono text-[11.5px]"
            />
            {draft.url && (
              <Btn onClick={() => void save({ ...draft, url: undefined })}>Reset</Btn>
            )}
          </div>
          {suggested && endpoint !== suggested && (
            <p className="flex gap-1.5 mt-1.5 text-[11px] text-warn leading-snug">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>
                This is the vendor&rsquo;s older endpoint and speaks a transport Octo does not —
                which surfaces as a complaint about a missing session.{' '}
                <button
                  onClick={() => void save({ ...draft, url: suggested })}
                  className="text-accent underline hover:text-accent-2"
                >
                  Use {suggested}
                </button>
              </span>
            </p>
          )}
        </Field>

        <Field
          label="Sign-in"
          hint={
            auth?.mode === 'oauth'
              ? `Signed in${auth.account ? ` as ${auth.account}` : ''}${auth.expiresAt ? ' · renews automatically' : ''}`
              : auth?.mode === 'manual'
                ? 'Using the token below.'
                : 'Opens your browser, then comes back on its own.'
          }
        >
          <div className="flex items-center gap-2">
            <Btn primary onClick={() => void signIn()} busy={signingIn} icon={<LogIn size={12} />}>
              {auth?.mode === 'oauth' ? 'Sign in again' : 'Sign in'}
            </Btn>
            {auth?.mode === 'oauth' && (
              <Btn
                onClick={async () => {
                  await window.octo.tickets.signOut(draft.server);
                  readAuth();
                }}
              >
                Sign out
              </Btn>
            )}
            <Btn onClick={connect} busy={probe.busy} icon={<Plug size={12} />}>
              Connect &amp; read tools
            </Btn>
          </div>
        </Field>

        <Field
          label={
            <>
              <KeyRound size={9} className="inline -mt-px mr-1" />
              Token, if you have one instead
            </>
          }
          hint="Encrypted with the OS keychain, like the API key. Accepts `Bearer …`, `Basic …`, or a bare token."
        >
          <div className="flex gap-1.5">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? '•••••••• (replace)' : 'only for remote servers'}
              className="lib-input flex-1"
            />
            <Btn onClick={saveToken}>Save</Btn>
          </div>
        </Field>
      </Step>

      <Step n={2} title="Scope" hint="Which site and project this workspace's specs belong to.">
        <Field label={field.label} hint={!scopeSet ? 'Required — nothing can be listed without it.' : undefined}>
          <div className="flex gap-1.5">
            {scopes?.length ? (
              <select
                value={draft.defaults?.[field.key] ?? ''}
                onChange={(e) =>
                  void save({ ...draft, defaults: { ...draft.defaults, [field.key]: e.target.value } })
                }
                className="lib-input flex-1"
              >
                <option value="">— pick one —</option>
                {scopes.map((sc) => (
                  <option key={sc.key} value={sc.key}>
                    {sc.label === sc.key ? sc.key : `${sc.label} (${sc.key})`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={draft.defaults?.[field.key] ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, defaults: { ...draft.defaults, [field.key]: e.target.value } })
                }
                onBlur={() => void save(draft)}
                placeholder={field.placeholder}
                className="lib-input flex-1"
              />
            )}
            <Btn onClick={() => void loadScopes()} busy={loadingScopes} icon={<RotateCcw size={11} />}>
              Read list
            </Btn>
          </div>
          {scopeError && (
            <div className="mt-1.5 space-y-2">
              <p className="flex gap-1.5 text-[11px] text-warn leading-snug">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span className="select-text">{scopeError}</span>
              </p>
              {scopeRaw && (
                <>
                  <pre className="select-text max-h-[220px] overflow-auto rounded-lg bg-bg px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-dim whitespace-pre-wrap">
                    {scopeRaw}
                  </pre>
                  <Btn
                    onClick={async () => {
                      await window.octo.shell.copy(scopeRaw);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    icon={copied ? <Check size={11} /> : <Copy size={11} />}
                  >
                    {copied ? 'Copied' : 'Copy response'}
                  </Btn>
                </>
              )}
            </div>
          )}
        </Field>

        {draft.preset === 'jira' && (
          <Field label="Project key" hint="Only needed to create issues.">
            <input
              value={draft.defaults?.projectKey ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, defaults: { ...draft.defaults, projectKey: e.target.value } })
              }
              onBlur={() => void save(draft)}
              placeholder="PROJ"
              className="lib-input max-w-[200px]"
            />
          </Field>
        )}
      </Step>

      <Step n={3} title="Sync" hint="What Octo is allowed to write back, and when.">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => void save({ ...draft, enabled: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-[12.5px] text-ink-100">Keep tickets in step with specs</span>
            <span className="block text-[11.5px] text-faint leading-snug max-w-[64ch]">
              Creating a spec, approving a phase, opening a PR and finishing the tasks each propose
              a write. Every one is shown as the literal call it would make, and nothing is sent
              until you confirm it.
            </span>
          </span>
        </label>
      </Step>

      {/* Real, but advanced: ten rows of selects should not dominate the page. */}
      <div>
        <button
          onClick={() => setShowTools((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold hover:text-ink-300 transition"
        >
          <ChevronRight size={12} className={cn('transition', showTools && 'rotate-90')} />
          Tool mapping
          <span className="normal-case tracking-normal text-faint font-normal">
            {tools ? `· ${mapped} of ${CAPABILITIES.length} mapped` : '· connect first'}
          </span>
        </button>
        {showTools && (
          <div className="mt-3 space-y-1">
            {!tools && (
              <p className="text-[12px] text-dim">
                The list of tools comes from the server itself — connect above.
              </p>
            )}
            {tools &&
              CAPABILITIES.map((c) => (
                <div key={c.cap} className="flex items-center gap-3 py-1">
                  <span className="w-[160px] shrink-0">
                    <span className="block text-[12px] text-ink-100">{c.label}</span>
                    <span className="block text-[10.5px] text-faint">when {c.when}</span>
                  </span>
                  <select
                    value={draft.tools?.[c.cap] ?? ''}
                    onChange={(e) =>
                      void save({
                        ...draft,
                        tools: { ...draft.tools, [c.cap]: e.target.value || undefined },
                      })
                    }
                    className="lib-input flex-1 max-w-[340px] font-mono text-[11.5px]"
                  >
                    <option value="">— not mapped —</option>
                    {tools.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10.5px] text-faint truncate flex-1 min-w-0">
                    {tools.find((t) => t.name === draft.tools?.[c.cap])?.description?.split('\n')[0] ??
                      ''}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-ink-800/60">
        <button
          onClick={async () => {
            onChange(await window.octo.tickets.deleteProvider({ root, id: draft.id }));
            onRemoved();
          }}
          className="flex items-center gap-1.5 text-[11.5px] text-dim hover:text-danger-text transition"
        >
          <Trash2 size={12} /> Remove this tracker from the workspace
        </button>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full bg-elev text-[11px] font-mono text-faint tabular-nums mt-0.5">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] font-medium text-ink-50">{title}</h3>
        <p className="text-[11.5px] text-faint mb-3">{hint}</p>
        <div className="space-y-3.5">{children}</div>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block max-w-[560px]">
      <span className="block text-[10px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-1">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-faint mt-1 leading-snug">{hint}</span>}
    </label>
  );
}

function Btn({
  onClick,
  children,
  icon,
  busy,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        'shrink-0 flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg transition disabled:opacity-50',
        primary
          ? 'bg-accent text-accent-fg font-semibold hover:opacity-90'
          : 'bg-elev text-ink-100 hover:bg-line'
      )}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
