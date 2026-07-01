import { useMemo, useState } from 'react';
import { Palette, Check, Plus, Trash2, Hash, WrapText, Search, Lock, Download } from 'lucide-react';
import { useSyntax } from '../../stores/syntax';
import {
  BUILTIN_THEMES,
  THEME_SLOTS,
  themeToCssVars,
  type SyntaxTheme,
} from '../../lib/syntaxThemes';
import {
  CORE_LANGUAGES,
  INSTALLABLE_LANGUAGES,
  ensureLanguage,
  highlight,
} from '../../lib/prism';
import { cn } from '../../lib/cn';
import { ModuleHeader, ModuleSection, Explainer, Callout } from '../ModuleShell';
import { LibDialogShell, LibField } from './AgentsStudio';

const EXPLAINER = [
  {
    heading: 'What this controls',
    body: 'How code files render in the Explorer\'s file viewer — the color theme and which language grammars are available for highlighting.',
  },
  {
    heading: 'Color themes',
    body: 'Pick a built-in scheme or install your own by defining the ten token colors. Themes are scoped to the file viewer, so they never disturb spec/markdown rendering.',
  },
  {
    heading: 'Installing languages',
    body: 'Core languages are always on. Extra grammars (Java, C#, PHP, Kotlin…) load on demand when installed — kept out of the initial bundle until you need them.',
  },
  {
    heading: 'Just-in-time install',
    body: 'Opening a file whose language isn\'t installed shows a one-click Install prompt right in the viewer, so you add exactly what you need.',
  },
];

const SAMPLE = `// fits the best agent to each task
function route(task: Task): Agent {
  const score = agents.map(a => a.match(task));
  return best(score) ?? fallback;  // local-first
}`;

const SAMPLE_HTML = highlight(SAMPLE, 'typescript');

export function SyntaxStudio() {
  const config = useSyntax((s) => s.config);
  const setTheme = useSyntax((s) => s.setTheme);
  const removeTheme = useSyntax((s) => s.removeTheme);
  const setLineNumbers = useSyntax((s) => s.setLineNumbers);
  const setWrap = useSyntax((s) => s.setWrap);
  const activeTheme = useSyntax((s) => s.activeTheme);
  const [installing, setInstalling] = useState(false);
  const [langQuery, setLangQuery] = useState('');

  const customEntries = Object.entries(config.customThemes);

  const installedCount = config.languages.length + CORE_LANGUAGES.length;
  const filteredLangs = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    return q
      ? INSTALLABLE_LANGUAGES.filter((l) => l.label.toLowerCase().includes(q) || l.id.includes(q))
      : INSTALLABLE_LANGUAGES;
  }, [langQuery]);

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <ModuleHeader
        icon={<Palette size={18} />}
        title="Syntax"
        subtitle={`${installedCount} languages available · file-viewer highlighting`}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-7 py-6">
          <Explainer points={EXPLAINER} />

          {/* live preview */}
          <ModuleSection title="Preview" desc="The active theme, exactly as the file viewer renders it.">
            <ThemePreview theme={activeTheme()} lineNumbers={config.lineNumbers} wrap={config.wrap} large />
          </ModuleSection>

          {/* themes */}
          <ModuleSection
            title="Color themes"
            desc="Click to activate. Install a custom theme to define your own colors."
            actions={
              <button
                onClick={() => setInstalling(true)}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg bg-accent text-accent-fg hover:opacity-90"
              >
                <Plus size={13} /> Install custom
              </button>
            }
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {BUILTIN_THEMES.map((t) => (
                <ThemeCard
                  key={t.id}
                  label={t.label}
                  theme={t.theme}
                  active={config.theme === t.id}
                  onSelect={() => setTheme(t.id)}
                />
              ))}
              {customEntries.map(([name, theme]) => (
                <ThemeCard
                  key={name}
                  label={name}
                  theme={theme}
                  active={config.theme === name}
                  custom
                  onSelect={() => setTheme(name)}
                  onRemove={() => removeTheme(name)}
                />
              ))}
            </div>
          </ModuleSection>

          {/* preferences */}
          <ModuleSection title="Preferences" desc="Rendering options for the file viewer.">
            <div className="space-y-1.5">
              <PrefToggle
                icon={<Hash size={14} />}
                label="Line numbers"
                hint="Show a line-number gutter (hidden while wrapping)."
                value={config.lineNumbers}
                onChange={setLineNumbers}
              />
              <PrefToggle
                icon={<WrapText size={14} />}
                label="Wrap long lines"
                hint="Soft-wrap instead of horizontal scroll."
                value={config.wrap}
                onChange={setWrap}
              />
            </div>
          </ModuleSection>

          {/* languages */}
          <ModuleSection
            title="Languages"
            desc="Core grammars are always available. Install extras — they load on demand."
          >
            <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-elev mb-3 max-w-xs">
              <Search size={13} className="text-faint" />
              <input
                value={langQuery}
                onChange={(e) => setLangQuery(e.target.value)}
                placeholder="Search languages…"
                className="flex-1 bg-transparent text-[12.5px] text-ink-50 outline-none placeholder:text-faint"
              />
            </div>

            {!langQuery && (
              <>
                <div className="font-mono text-[9.5px] tracking-[0.16em] text-ink-600 mb-1.5 uppercase">
                  Core · always on
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CORE_LANGUAGES.map((l) => (
                    <span
                      key={l.id}
                      className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-lg bg-elev/60 text-dim"
                    >
                      <Lock size={10} className="text-faint" /> {l.label}
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="font-mono text-[9.5px] tracking-[0.16em] text-ink-600 mb-1.5 uppercase">
              Installable · {config.languages.length} installed
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {filteredLangs.map((l) => (
                <LanguageRow key={l.id} id={l.id} label={l.label} />
              ))}
            </div>
            {config.languages.length > 0 && (
              <Callout>
                Installed grammars load the first time you open a matching file. Uninstalling just
                stops auto-highlighting — nothing is downloaded or deleted.
              </Callout>
            )}
          </ModuleSection>
        </div>
      </div>

      {installing && (
        <InstallThemeDialog base={activeTheme()} onClose={() => setInstalling(false)} />
      )}
    </div>
  );
}

function ThemePreview({
  theme,
  lineNumbers,
  wrap,
  large,
}: {
  theme: SyntaxTheme;
  lineNumbers: boolean;
  wrap?: boolean;
  large?: boolean;
}) {
  const numbers = SAMPLE.split('\n')
    .map((_, i) => i + 1)
    .join('\n');
  return (
    <div
      className={cn(
        'code-view flex rounded-xl overflow-hidden ring-1 ring-ink-800/60 px-4 py-3',
        wrap && 'wrap'
      )}
      style={{ ...themeToCssVars(theme), fontSize: large ? 12.5 : 10 }}
    >
      {lineNumbers && !wrap && <pre className="code-ln m-0">{numbers}</pre>}
      <pre className="code-lc m-0">
        <code dangerouslySetInnerHTML={{ __html: SAMPLE_HTML }} />
      </pre>
    </div>
  );
}

function ThemeCard({
  label,
  theme,
  active,
  custom,
  onSelect,
  onRemove,
}: {
  label: string;
  theme: SyntaxTheme;
  active: boolean;
  custom?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-2.5 cursor-pointer transition ring-1',
        active ? 'ring-accent/60 bg-accent/[0.06]' : 'ring-ink-800/50 hover:ring-ink-700'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12px] font-medium text-ink-100 flex-1 truncate">{label}</span>
        {custom && (
          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-ink-700/60 text-ink-300 uppercase">
            custom
          </span>
        )}
        {active && <Check size={13} className="text-accent" />}
        {custom && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-faint hover:text-bad"
            title="Remove theme"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <ThemePreview theme={theme} lineNumbers={false} />
    </div>
  );
}

function LanguageRow({ id, label }: { id: string; label: string }) {
  const installed = useSyntax((s) => s.config.languages.includes(id));
  const installLanguage = useSyntax((s) => s.installLanguage);
  const removeLanguage = useSyntax((s) => s.removeLanguage);

  const toggle = () => {
    if (installed) {
      removeLanguage(id);
    } else {
      installLanguage(id);
      ensureLanguage(id); // warm the grammar
    }
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition',
        installed ? 'bg-good/[0.08] ring-1 ring-good/25' : 'bg-elev/50 hover:bg-elev'
      )}
    >
      <span
        className={cn(
          'w-5 h-5 grid place-items-center rounded shrink-0',
          installed ? 'bg-good/20 text-good' : 'bg-ink-800 text-faint'
        )}
      >
        {installed ? <Check size={12} /> : <Download size={12} />}
      </span>
      <span className="text-[12.5px] text-ink-100 flex-1 truncate">{label}</span>
      <span className="text-[10px] text-faint">{installed ? 'installed' : 'install'}</span>
    </button>
  );
}

function PrefToggle({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elev/40 text-left"
    >
      <span className="text-dim shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-100">{label}</div>
        <div className="text-[11px] text-faint">{hint}</div>
      </div>
      <span className={cn('w-9 h-5 rounded-full p-0.5 transition shrink-0', value ? 'bg-accent' : 'bg-ink-700')}>
        <span className={cn('block w-4 h-4 rounded-full bg-white transition-transform', value && 'translate-x-4')} />
      </span>
    </button>
  );
}

function InstallThemeDialog({ base, onClose }: { base: SyntaxTheme; onClose: () => void }) {
  const installTheme = useSyntax((s) => s.installTheme);
  const existing = useSyntax((s) => s.config.customThemes);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<SyntaxTheme>({ ...base });

  const taken = name.trim().length > 0 && !!existing[name.trim()];
  const patch = (k: keyof SyntaxTheme, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const install = () => {
    const n = name.trim();
    if (!n || taken) return;
    installTheme(n, draft);
    onClose();
  };

  return (
    <LibDialogShell title="Install custom theme" onClose={onClose}>
      <p className="text-[12px] text-dim mb-4">
        Define the ten token colors. Starts from the current theme so you can tweak a few and save.
      </p>
      <LibField label="Theme name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Midnight"
          className="lib-input"
        />
      </LibField>
      {taken && <p className="text-[11px] text-bad -mt-2 mb-3">a theme with that name exists</p>}

      <div className="mb-4">
        <ThemePreview theme={draft} lineNumbers />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 max-h-[240px] overflow-y-auto pr-1">
        {THEME_SLOTS.map((slot) => (
          <div key={slot.key} className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeColor(draft[slot.key])}
              onChange={(e) => patch(slot.key, e.target.value)}
              className="w-7 h-7 rounded bg-transparent border border-ink-700 shrink-0 cursor-pointer"
              title={slot.label}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-dim">{slot.label}</div>
              <input
                value={draft[slot.key]}
                onChange={(e) => patch(slot.key, e.target.value)}
                className="w-full bg-transparent text-[11px] font-mono text-ink-200 outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-lg text-dim hover:text-ink-50">
          Cancel
        </button>
        <button
          onClick={install}
          disabled={!name.trim() || taken}
          className="text-[12px] font-semibold px-4 h-8 rounded-lg bg-accent text-accent-fg disabled:opacity-40"
        >
          Install theme
        </button>
      </div>
    </LibDialogShell>
  );
}

// <input type="color"> only accepts #rrggbb — coerce 'transparent'/named values.
function normalizeColor(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#1a1f2b';
}
