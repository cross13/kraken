import { create } from 'zustand';
import { bridgeReady } from '../lib/bridge';
import type {
  AgentMeta,
  DirEntry,
  SeedReport,
  SkillMeta,
  SpecMeta,
  SpecKind,
  SteeringFile,
  SteeringWriteInput,
  HookConfig,
} from '../../electron/shared/types';

interface WorkspaceStore {
  root: string | null;
  tree: DirEntry[];
  specs: SpecMeta[];
  skills: SkillMeta[];
  agents: AgentMeta[];
  steering: SteeringFile[];
  steeringPins: string[];
  hooks: HookConfig[];
  loading: boolean;
  /**
   * What the on-open upgrade pass rewrote, until dismissed. Only ever set when
   * something actually changed — an up-to-date workspace says nothing.
   */
  libraryUpgrade: SeedReport | null;

  openWorkspace: (path: string) => Promise<void>;
  pickWorkspace: () => Promise<void>;
  restoreLast: () => Promise<void>;
  refreshAll: () => Promise<void>;
  createSpec: (name: string, kind: SpecKind, brief?: string) => Promise<SpecMeta>;
  deleteSpec: (id: string) => Promise<void>;
  /** Install/upgrade the bundled library; resolves with what changed. */
  seedDefaults: () => Promise<SeedReport>;
  dismissLibraryUpgrade: () => void;
  saveSteering: (input: SteeringWriteInput) => Promise<SteeringFile>;
  deleteSteering: (filePath: string) => Promise<void>;
  togglePin: (name: string) => Promise<void>;
}

export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  root: null,
  tree: [],
  specs: [],
  skills: [],
  agents: [],
  steering: [],
  steeringPins: [],
  hooks: [],
  loading: false,
  libraryUpgrade: null,

  pickWorkspace: async () => {
    const p = await window.octo.workspace.pick();
    if (p) await get().openWorkspace(p);
  },

  restoreLast: async () => {
    const last = await window.octo.workspace.getLast();
    if (last) await get().openWorkspace(last);
  },

  openWorkspace: async (path) => {
    set({ loading: true });
    await window.octo.workspace.open(path);
    set({ root: path });
    // Bring an already-seeded library up to date before the first read, so the
    // studios show the new agents and skills straight away. Upgrade-only, and a
    // no-op once this workspace is on the current version.
    // Guarded, not just `.catch`-ed: on a preload that predates this method the
    // property access throws before a promise exists, which would take the whole
    // workspace-open path down with it.
    const upgrade = bridgeReady('workspace', 'seedUpgrade')
      ? await window.octo.workspace.seedUpgrade(path).catch(() => null)
      : null;
    set({ libraryUpgrade: upgrade?.upgraded.length ? upgrade : null });
    await get().refreshAll();
    set({ loading: false });
  },

  dismissLibraryUpgrade: () => set({ libraryUpgrade: null }),

  refreshAll: async () => {
    const root = get().root;
    if (!root) return;
    const [tree, specs, skills, agents, steering, steeringPins, hooks] = await Promise.all([
      window.octo.workspace.listTree(root),
      window.octo.specs.list(root),
      window.octo.skills.list(root),
      window.octo.agents.list(root),
      window.octo.steering.list(root),
      window.octo.steering.getPins(root),
      window.octo.hooks.list(root),
    ]);
    set({ tree, specs, skills, agents, steering, steeringPins, hooks });
  },

  createSpec: async (name, kind, brief) => {
    const root = get().root!;
    const spec = await window.octo.specs.create(root, name, kind, brief);
    await get().refreshAll();
    return spec;
  },

  deleteSpec: async (id) => {
    const root = get().root;
    if (!root) return;
    await window.octo.specs.delete(root, id);
    await get().refreshAll();
  },

  seedDefaults: async () => {
    const empty: SeedReport = { created: [], upgraded: [], kept: [] };
    const root = get().root;
    if (!root) return empty;
    const reports = await Promise.all([
      window.octo.skills.seedDefaults(root),
      window.octo.agents.seedDefaults(root),
      window.octo.steering.seedDefaults(root),
      window.octo.hooks.seedDefaults(root),
    ]);
    await get().refreshAll();
    // One report for the four namespaces: a shipped default the user never
    // edited is rewritten (`upgraded`); one they edited is left alone (`kept`).
    return reports.reduce<SeedReport>(
      (acc, r) => ({
        created: [...acc.created, ...r.created],
        upgraded: [...acc.upgraded, ...r.upgraded],
        kept: [...acc.kept, ...r.kept],
      }),
      empty
    );
  },

  saveSteering: async (input) => {
    const root = get().root!;
    const saved = await window.octo.steering.write(root, input);
    await get().refreshAll();
    return saved;
  },

  deleteSteering: async (filePath) => {
    const root = get().root!;
    await window.octo.steering.remove(root, filePath);
    await get().refreshAll();
  },

  togglePin: async (name) => {
    const root = get().root;
    if (!root) return;
    const current = get().steeringPins;
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    const saved = await window.octo.steering.setPins(root, next);
    set({ steeringPins: saved });
  },
}));
