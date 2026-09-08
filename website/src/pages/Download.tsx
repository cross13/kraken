import { Section, Reveal, Eyebrow, Panel } from '../components/ui';
import { Button } from '../components/Button';
import { GITHUB_URL } from '../components/site';
import { Terminal, Cpu, HardDrive, Package, AlertTriangle } from 'lucide-react';

const REQS = [
  {
    icon: HardDrive,
    label: 'OS',
    value: 'macOS · Windows · Linux',
    note: 'Developed and packaged primarily on macOS (Apple Silicon). Windows and Linux builds exist but get less testing.',
  },
  {
    icon: Package,
    label: 'Node.js',
    value: '20.x or newer',
    note: '22.x recommended. Needed to build and run from source; not needed for a packaged binary. npm 10 or newer.',
  },
  {
    icon: Terminal,
    label: 'Claude access',
    value: 'CLI or API key',
    note: 'One of the two backends below. Without one, the app cannot talk to Claude at all.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Get a backend',
    body: 'The local CLI is the default and the cheaper option — free if you already pay for Claude Pro or Max. An Anthropic key is the alternative, and also unlocks verified model discovery.',
    code: `npm install -g @anthropic-ai/claude-code
claude          # log in interactively, one time`,
  },
  {
    n: '02',
    title: 'Clone and install',
    body: 'The postinstall hook rebuilds the two native modules for Electron: better-sqlite3 (the run-history database) and node-pty (the interactive terminals).',
    code: `git clone ${GITHUB_URL}.git
cd ${GITHUB_URL.split('/').pop()}
npm install`,
  },
  {
    n: '03',
    title: 'Run it',
    body: 'Dev mode gives you the Vite renderer with HMR inside Electron. Or build a real app bundle for your platform.',
    code: `npm run dev            # electron-vite dev + HMR
npm run package:mac    # or package:win / package:linux`,
  },
];

export function Download() {
  return (
    <>
      <Section className="pt-20 pb-12 sm:pt-24">
        <Reveal>
          <div className="flex max-w-3xl flex-col gap-5">
            <Eyebrow>Install</Eyebrow>
            <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink-50 sm:text-5xl">
              Build it from source.
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-300">
              There are no signed installers yet — this is pre-1.0 and the honest way to run it is
              from the repo. Three steps, and the first one you may already have done.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href={GITHUB_URL}>Open the repo</Button>
              <Button to="/docs" variant="ghost">
                Docs
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section className="py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {REQS.map((r, i) => (
            <Reveal key={r.label} delay={0.05 * i} className="h-full">
              <div className="card h-full p-5">
                <div className="flex items-center gap-2.5 text-ink-400">
                  <r.icon size={16} strokeWidth={1.75} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{r.label}</span>
                </div>
                <div className="mt-3 font-display text-lg font-semibold tracking-tight text-ink-50">
                  {r.value}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{r.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-10">
        <div className="flex flex-col gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={0.05 * i}>
              <Panel>
                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:gap-10">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-3xl font-bold leading-none text-accent-text">
                        {s.n}
                      </span>
                      <h2 className="font-display text-lg font-semibold tracking-tight text-ink-50">
                        {s.title}
                      </h2>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-400">{s.body}</p>
                  </div>
                  <pre className="min-w-0 overflow-x-auto border border-line bg-rail p-4 font-mono text-[12.5px] leading-relaxed text-ink-300">
                    <code>{s.code}</code>
                  </pre>
                </div>
              </Panel>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-10">
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal className="h-full">
            <div className="card h-full p-6">
              <div className="flex items-center gap-2.5 text-accent-text">
                <Cpu size={17} strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-ink-100">
                  Using the API instead
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Create a key at{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text underline underline-offset-2 hover:text-accent-num"
                >
                  console.anthropic.com
                </a>{' '}
                and paste it into Settings › Connection. It is encrypted through Electron{' '}
                <code className="font-mono text-[13px] text-ink-200">safeStorage</code> into your OS
                keychain, and only ever sent to{' '}
                <code className="font-mono text-[13px] text-ink-200">api.anthropic.com</code>. Where
                no keychain is available — a Linux box with no keyring running — it currently falls
                back to base64, which is encoding and not encryption.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.05} className="h-full">
            <div className="card h-full p-6">
              <div className="flex items-center gap-2.5 text-agent-text">
                <AlertTriangle size={17} strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-ink-100">
                  If the CLI is not found
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Electron inherits a much narrower{' '}
                <code className="font-mono text-[13px] text-ink-200">PATH</code> than your shell, so
                the app extends it with <code className="font-mono text-[13px] text-ink-200">~/.claude/local/</code>,{' '}
                <code className="font-mono text-[13px] text-ink-200">~/.local/bin</code>,{' '}
                <code className="font-mono text-[13px] text-ink-200">/opt/homebrew/bin</code> and the
                usual system directories. If detection still fails, hit{' '}
                <b className="text-ink-200">Re-detect</b> in Settings › Connection.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
