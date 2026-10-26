import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bug,
  Check,
  Copy,
  CornerDownLeft,
  BookOpen,
  Compass,
  GitPullRequest,
  Layers,
  Lightbulb,
  MessageSquare,
  Rocket,
  Sparkles,
  Ticket,
  Wand2,
  Zap,
  GraduationCap,
} from 'lucide-react';
import { useUi } from '../../stores/ui';
import { useWorkspace } from '../../stores/workspace';
import { useChat } from '../../stores/chat';
import { cn } from '../../lib/cn';
import { OctoMascot } from '../wide/OctoMascot';
import { LangToggle } from './GuideView';
import { goTo } from '../../lib/guides';
import { useSetupSteps } from '../../lib/useSetupSteps';
import {
  INTENTS,
  intentSteps,
  matchIntents,
  questionContext,
  type LearnAction,
  type LearnExample,
  type LearnIntent,
} from '../../lib/learn';
import type { GuideLang } from '../../../guides/guides';

const ICONS: Record<LearnIntent['icon'], React.ReactNode> = {
  feature: <Rocket size={16} />,
  bug: <Bug size={16} />,
  ticket: <Ticket size={16} />,
  teach: <Compass size={16} />,
  parallel: <Layers size={16} />,
  review: <GitPullRequest size={16} />,
  automate: <Zap size={16} />,
  explore: <GraduationCap size={16} />,
};

const T: Record<GuideLang, Record<string, string>> = {
  en: {
    title: 'What do you want to work on?',
    sub: 'Tell me in your own words, or pick one below. You get a path through the app — each step with the button that does it — and examples you can use as they are.',
    placeholder: 'e.g. “fix a bug in the login”, “connect Jira”, “make Claude follow our conventions”…',
    looksLike: 'Sounds like',
    ask: 'Ask Claude',
    askHint: 'Answers from the guides, in the Assistant',
    noMatch: 'Nothing here matches that yet — ask Claude, it reads the guides for you.',
    setup: 'Setup',
    setupOf: 'of',
    quickStart: 'Open Quick Start',
    path: 'Your path',
    examples: 'Examples',
    use: 'Use on Home',
    copy: 'Copy',
    copied: 'Copied',
    read: 'Read the guide',
    withClaude: 'Do it with Claude',
    withClaudeSub: 'Claude reads your repository and does this for you, in the Assistant.',
    needsWorkspace: 'Open a workspace first.',
    noExamples: 'No examples for this one — the steps do the work.',
    choose: 'Pick what you want to do',
  },
  es: {
    title: '¿Con qué querés trabajar?',
    sub: 'Contámelo con tus palabras, o elegí una opción. Te armo un camino por la app — cada paso con el botón que lo hace — y ejemplos que podés usar tal cual.',
    placeholder: 'p. ej. “arreglar un bug del login”, “conectar Jira”, “que Claude siga nuestras convenciones”…',
    looksLike: 'Parece que querés',
    ask: 'Preguntale a Claude',
    askHint: 'Responde con las guías, en el Assistant',
    noMatch: 'Todavía no hay nada que coincida — preguntale a Claude, lee las guías por vos.',
    setup: 'Configuración',
    setupOf: 'de',
    quickStart: 'Abrir Quick Start',
    path: 'Tu camino',
    examples: 'Ejemplos',
    use: 'Usar en Home',
    copy: 'Copiar',
    copied: 'Copiado',
    read: 'Leer la guía',
    withClaude: 'Hacelo con Claude',
    withClaudeSub: 'Claude lee tu repositorio y lo hace por vos, en el Assistant.',
    needsWorkspace: 'Primero abrí un workspace.',
    noExamples: 'Sin ejemplos para esta — los pasos hacen el trabajo.',
    choose: 'Elegí qué querés hacer',
  },
};

const INTENT_KEY = 'octo.learnIntent';

/**
 * Learn — the interactive guide.
 *
 * It starts from a question instead of an index: *what do you want to work
 * on?* Free text is matched against the intents locally (instant, no run);
 * asking Claude is the explicit second step and carries the relevant guides as
 * system context. Each intent becomes a path of guides whose steps carry the
 * action that performs them and the same verified checks as Quick Start, plus
 * examples shaped the way Octo's parsers and router want them.
 */
export function LearnView() {
  const lang = useUi((s) => s.guideLang);
  const setLang = useUi((s) => s.setGuideLang);
  const openOverlay = useUi((s) => s.openOverlay);
  const setQuickStart = useUi((s) => s.setQuickStart);
  const root = useWorkspace((s) => s.root);
  const { steps: setup } = useSetupSteps();
  const t = T[lang];

  const [query, setQuery] = useState('');
  const [intentId, setIntentId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(INTENT_KEY);
    } catch {
      return null;
    }
  });

  // Picking an intent puts its path on screen; restoring the last one on mount
  // does not scroll, so the question stays the first thing you see.
  const panelRef = useRef<HTMLDivElement>(null);
  const [scrollNonce, setScrollNonce] = useState(0);
  useEffect(() => {
    if (scrollNonce) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollNonce]);

  const pick = (id: string) => {
    setIntentId(id);
    setScrollNonce((n) => n + 1);
    try {
      localStorage.setItem(INTENT_KEY, id);
    } catch {
      // ignore (e.g. storage disabled)
    }
  };

  const matches = useMemo(() => matchIntents(query), [query]);
  const intent = INTENTS.find((i) => i.id === intentId) ?? null;
  const required = setup.filter((s) => !s.optional);
  const setupDone = required.filter((s) => s.done).length;

  const askClaude = (question: string, context?: string) => {
    useUi.getState().setAssistantOpen(true);
    useChat.getState().setPendingPrompt(question, context ?? null);
  };

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (matches[0]) pick(matches[0].id);
    else askClaude(q, questionContext(q, lang));
  };

  return (
    <div className="k-scroll">
      <div className="k-wide py-9 space-y-9">
        {/* the question */}
        <header className="flex items-start gap-5">
          <div className="w-[72px] shrink-0 k-mascot-think">
            <div className="k-mascot-bob">
              <OctoMascot state="think" seed={3} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink-50 flex-1">
                {t.title}
              </h1>
              <LangToggle lang={lang} onChange={setLang} />
            </div>
            <p className="mt-1.5 text-[13px] text-dim leading-relaxed max-w-[70ch]">{t.sub}</p>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-card ring-1 ring-ink-800 focus-within:ring-accent/50 px-3.5 h-12 max-w-[820px] transition">
              <MessageSquare size={15} className="text-faint shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={t.placeholder}
                className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink-50 placeholder:text-faint focus:outline-none"
              />
              <button
                onClick={() => query.trim() && askClaude(query.trim(), questionContext(query.trim(), lang))}
                disabled={!query.trim()}
                title={t.askHint}
                className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition disabled:opacity-40"
              >
                <Sparkles size={12} /> {t.ask}
              </button>
              <CornerDownLeft size={13} className="text-faint shrink-0" />
            </div>

            {query.trim().length >= 3 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                {matches.length ? (
                  <>
                    <span className="text-faint">{t.looksLike}:</span>
                    {matches.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => pick(m.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition',
                          m.id === intentId
                            ? 'bg-accent/15 text-accent'
                            : 'bg-elev text-ink-100 hover:bg-accent/10 hover:text-accent'
                        )}
                      >
                        {ICONS[m.icon]} {m.title[lang]}
                      </button>
                    ))}
                  </>
                ) : (
                  <span className="text-faint">{t.noMatch}</span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* where you are */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[13px] bg-card/60 border border-ink-800 px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold">
            {t.setup}
          </span>
          <div className="h-1.5 w-[140px] rounded-full bg-elev overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-bar"
              style={{ width: `${(setupDone / Math.max(1, required.length)) * 100}%` }}
            />
          </div>
          <span className="text-[11.5px] text-faint tabular-nums">
            {setupDone} {t.setupOf} {required.length}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {required.map((s) => (
              <span
                key={s.id}
                title={s.done ? s.detail : s.why}
                className={cn(
                  'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md',
                  s.done ? 'bg-good/10 text-ok' : 'bg-elev text-dim'
                )}
              >
                {s.done && <Check size={10} />}
                {s.title}
              </span>
            ))}
          </div>
          {setupDone < required.length && (
            <button
              onClick={() => setQuickStart(true)}
              className="ml-auto text-[12px] text-accent hover:underline"
            >
              {t.quickStart}
            </button>
          )}
        </div>

        {/* the choices */}
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-3">
            {t.choose}
          </h2>
          <div className="k-cards" style={{ '--k-card': '230px' } as React.CSSProperties}>
            {INTENTS.map((i) => (
              <button
                key={i.id}
                onClick={() => pick(i.id)}
                className={cn(
                  'text-left rounded-[13px] border p-4 transition',
                  i.id === intentId
                    ? 'border-accent/60 bg-accent/[0.07]'
                    : 'border-ink-800 bg-card hover:border-ink-600'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 grid place-items-center rounded-lg mb-2.5',
                    i.id === intentId ? 'bg-accent/20 text-accent' : 'bg-elev text-dim'
                  )}
                >
                  {ICONS[i.icon]}
                </span>
                <h3 className="text-[13px] font-medium text-ink-50">{i.title[lang]}</h3>
                <p className="mt-1 text-[11.5px] text-dim leading-snug">{i.blurb[lang]}</p>
              </button>
            ))}
          </div>
        </section>

        <div ref={panelRef} className="scroll-mt-6" />
        {intent && (
          <IntentPanel
            key={intent.id}
            intent={intent}
            lang={lang}
            setup={setup}
            hasWorkspace={Boolean(root)}
            onRead={(id) => openOverlay({ kind: 'guide', id })}
            onClaude={(prompt) => askClaude(prompt)}
          />
        )}
      </div>
    </div>
  );
}

function IntentPanel({
  intent,
  lang,
  setup,
  hasWorkspace,
  onRead,
  onClaude,
}: {
  intent: LearnIntent;
  lang: GuideLang;
  setup: ReturnType<typeof useSetupSteps>['steps'];
  hasWorkspace: boolean;
  onRead: (guideId: string) => void;
  onClaude: (prompt: string) => void;
}) {
  const t = T[lang];
  const steps = intentSteps(intent, lang);
  const run = useAction();

  return (
    <section className="k-split" style={{ '--k-aside': '420px' } as React.CSSProperties}>
      <div>
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold mb-3">
          <span className="text-accent">{ICONS[intent.icon]}</span>
          {t.path} · {intent.title[lang]}
        </h2>
        <ol className="space-y-2">
          {steps.map(({ step, guide }, n) => {
            const done = guide.check ? setup.find((s) => s.id === guide.check)?.done : false;
            return (
              <li
                key={guide.id}
                className={cn(
                  'flex items-start gap-3.5 rounded-[13px] border p-4',
                  done ? 'border-ink-800 bg-card/50' : 'border-ink-700 bg-card'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 w-6 h-6 grid place-items-center rounded-full mt-px text-[11px] tabular-nums',
                    done ? 'bg-good/15 text-ok' : 'bg-accent/12 text-accent'
                  )}
                >
                  {done ? <Check size={12} /> : n + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={cn('text-[13px] font-medium', done ? 'text-dim' : 'text-ink-50')}>
                    {guide.title}
                  </h3>
                  <p className="mt-1 text-[12px] text-dim leading-relaxed">{guide.summary}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {step.action && (
                      <button
                        onClick={() => run(step.action!)}
                        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition"
                      >
                        {step.label[lang]} <ArrowRight size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onRead(guide.id)}
                      className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition"
                    >
                      <BookOpen size={12} /> {t.read} · {guide.minutes} min
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="space-y-3">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.07em] text-ink-500 font-semibold">
          <span className="text-accent">
            <Lightbulb size={13} />
          </span>
          {t.examples}
        </h2>
        {intent.examples.length === 0 && <p className="text-[12px] text-faint">{t.noExamples}</p>}
        {intent.examples.map((ex) => (
          <ExampleCard key={ex.title.en} example={ex} lang={lang} />
        ))}

        <div className="rounded-[13px] border border-accent/25 bg-accent/[0.05] p-4">
          <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink-50">
            <Wand2 size={13} className="text-accent" /> {t.withClaude}
          </h3>
          <p className="mt-1 text-[11.5px] text-dim leading-snug">{t.withClaudeSub}</p>
          <button
            onClick={() => onClaude(intent.claude.prompt[lang])}
            disabled={!hasWorkspace}
            title={hasWorkspace ? intent.claude.prompt[lang] : t.needsWorkspace}
            className="mt-3 flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg bg-accent text-accent-fg font-semibold hover:opacity-90 transition disabled:opacity-40"
          >
            <Sparkles size={13} /> {intent.claude.label[lang]}
          </button>
          {!hasWorkspace && <p className="mt-2 text-[11px] text-faint">{t.needsWorkspace}</p>}
        </div>
      </aside>
    </section>
  );
}

function ExampleCard({ example, lang }: { example: LearnExample; lang: GuideLang }) {
  const t = T[lang];
  const focusComposer = useUi((s) => s.focusComposer);
  const [copied, setCopied] = useState(false);
  const text = example.body[lang];
  const multiline = text.includes('\n');

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="rounded-[13px] bg-card border border-ink-800 p-4">
      <h3 className="text-[12.5px] font-medium text-ink-50 mb-2">{example.title[lang]}</h3>
      {multiline ? (
        <pre className="max-h-[220px] overflow-auto rounded-lg bg-ink-950 ring-1 ring-ink-800 p-3 font-mono text-[11px] leading-relaxed text-ink-200 whitespace-pre">
          {text}
        </pre>
      ) : (
        <p className="rounded-lg bg-ink-950 ring-1 ring-ink-800 px-3 py-2.5 text-[12px] leading-relaxed text-ink-100">
          {text}
        </p>
      )}
      {example.note && (
        <p className="mt-2 text-[11.5px] text-dim leading-snug">{example.note[lang]}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {example.use === 'composer' && (
          <button
            onClick={() => focusComposer(text)}
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 transition"
          >
            {t.use} <ArrowRight size={12} />
          </button>
        )}
        <button
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => setCopied(true));
          }}
          className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg text-dim hover:text-ink-50 hover:bg-elev transition"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t.copied : t.copy}
        </button>
      </div>
    </div>
  );
}

/** What a step's button does — each one the same action the app's own UI takes. */
function useAction() {
  const pickWorkspace = useWorkspace((s) => s.pickWorkspace);
  const seedDefaults = useWorkspace((s) => s.seedDefaults);
  const focusComposer = useUi((s) => s.focusComposer);
  const addTerminal = useUi((s) => s.addTerminal);
  return (a: LearnAction) => {
    if (a.kind === 'goto') goTo(a.goto);
    else if (a.kind === 'composer') focusComposer();
    else if (a.kind === 'pick-workspace') void pickWorkspace();
    else if (a.kind === 'seed') void seedDefaults();
    else if (a.kind === 'terminal') addTerminal('shell');
    else if (a.kind === 'travel') void window.octo.win.toggleWide();
  };
}
