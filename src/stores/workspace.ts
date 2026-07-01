import { create } from 'zustand';
import type {
  AgentMeta,
  DirEntry,
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

  openWorkspace: (path: string) => Promise<void>;
  pickWorkspace: () => Promise<void>;
  restoreLast: () => Promise<void>;
  refreshAll: () => Promise<void>;
  createSpec: (name: string, kind: SpecKind) => Promise<SpecMeta>;
  deleteSpec: (id: string) => Promise<void>;
  seedDefaults: () => Promise<void>;
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

  pickWorkspace: async () => {
    const p = await window.kraken.workspace.pick();
    if (p) await get().openWorkspace(p);
  },

  restoreLast: async () => {
    const last = await window.kraken.workspace.getLast();
    if (last) await get().openWorkspace(last);
  },

  openWorkspace: async (path) => {
    set({ loading: true });
    await window.kraken.workspace.open(path);
    set({ root: path });
    await get().refreshAll();
    set({ loading: false });
  },

  refreshAll: async () => {
    const root = get().root;
    if (!root) return;
    const [tree, specs, skills, agents, steering, steeringPins, hooks] = await Promise.all([
      window.kraken.workspace.listTree(root),
      window.kraken.specs.list(root),
      window.kraken.skills.list(root),
      window.kraken.agents.list(root),
      window.kraken.steering.list(root),
      window.kraken.steering.getPins(root),
      window.kraken.hooks.list(root),
    ]);
    set({ tree, specs, skills, agents, steering, steeringPins, hooks });
  },

  createSpec: async (name, kind) => {
    const root = get().root!;
    const spec = await window.kraken.specs.create(root, name, kind);
    await get().refreshAll();
    return spec;
  },

  deleteSpec: async (id) => {
    const root = get().root;
    if (!root) return;
    await window.kraken.specs.delete(root, id);
    await get().refreshAll();
  },

  seedDefaults: async () => {
    const root = get().root;
    if (!root) return;
    await Promise.all([
      window.kraken.skills.seedDefaults(root),
      window.kraken.agents.seedDefaults(root),
      window.kraken.steering.seedDefaults(root),
      window.kraken.hooks.seedDefaults(root),
    ]);
    await get().refreshAll();
  },

  saveSteering: async (input) => {
    const root = get().root!;
    const saved = await window.kraken.steering.write(root, input);
    await get().refreshAll();
    return saved;
  },

  deleteSteering: async (filePath) => {
    const root = get().root!;
    await window.kraken.steering.remove(root, filePath);
    await get().refreshAll();
  },

  togglePin: async (name) => {
    const root = get().root;
    if (!root) return;
    const current = get().steeringPins;
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    const saved = await window.kraken.steering.setPins(root, next);
    set({ steeringPins: saved });
  },
}));
