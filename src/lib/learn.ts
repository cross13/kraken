// Learn — the interactive side of the guides.
//
// The guides answer "how do I do X"; this answers the question before it —
// "what do you want to do?" — and turns the answer into a path through the
// guides, each step with the action that performs it and examples you can use
// as-is. Everything here is bilingual because the guides are; the language is
// the reader's `guideLang`.
//
// The steps reference guides by id and take their title, summary and check
// from the guide itself, so this file never restates what a guide says.
// `npm run guides -- --check` does not see it, so the ids are checked at
// runtime too: `intentSteps` drops a step whose guide is missing rather than
// rendering a dead card.

import type { GuideGoto, GuideLang } from '../../guides/guides';
import { GUIDES } from './guides';

type L = Record<GuideLang, string>;

export type LearnAction =
  | { kind: 'goto'; goto: GuideGoto }
  /** Home with the composer focused. */
  | { kind: 'composer' }
  | { kind: 'pick-workspace' }
  | { kind: 'seed' }
  | { kind: 'terminal' }
  | { kind: 'travel' };

export interface LearnStep {
  guide: string;
  action?: LearnAction;
  label: L;
}

export interface LearnExample {
  title: L;
  /** What gets used or copied — in the reader's language where it is prose. */
  body: L;
  /** `composer` drops it into Home's composer; `copy` puts it on the clipboard. */
  use: 'composer' | 'copy';
  /** One line on why this example is shaped the way it is. */
  note?: L;
}

export interface LearnIntent {
  id: string;
  icon: 'feature' | 'bug' | 'ticket' | 'teach' | 'parallel' | 'review' | 'automate' | 'explore';
  title: L;
  blurb: L;
  /** Free-text matching, both languages, accents stripped before comparing. */
  keywords: string[];
  steps: LearnStep[];
  examples: LearnExample[];
  /** The one thing Claude can do for you here, with your repository in front of it. */
  claude: { label: L; prompt: L };
}

const go = (goto: GuideGoto): LearnAction => ({ kind: 'goto', goto });

export const INTENTS: LearnIntent[] = [
  {
    id: 'feature',
    icon: 'feature',
    title: { en: 'Build a new feature', es: 'Construir una feature nueva' },
    blurb: {
      en: 'From one sentence to requirements, a plan, parallel tasks and a pull request.',
      es: 'De una oración a requirements, un plan, tareas en paralelo y un pull request.',
    },
    keywords: ['feature', 'build', 'add', 'new', 'implement', 'create', 'construir', 'agregar', 'nueva', 'nuevo', 'crear', 'implementar', 'funcionalidad', 'spec'],
    steps: [
      { guide: 'first-spec', action: { kind: 'composer' }, label: { en: 'Write it on Home', es: 'Escribila en Home' } },
      { guide: 'approve-and-clarify', action: go('spec:plan'), label: { en: 'Open the plan', es: 'Abrir el plan' } },
      { guide: 'review-view', action: go('spec:plan'), label: { en: 'Open Review', es: 'Abrir Review' } },
      { guide: 'run-and-ship', action: go('spec:build'), label: { en: 'Open Build', es: 'Abrir Build' } },
    ],
    examples: [
      {
        title: { en: 'A UI feature with a clear outcome', es: 'Una feature de UI con un resultado claro' },
        body: {
          en: 'Add a dark mode toggle to the settings page. The choice persists across restarts and defaults to the system setting.',
          es: 'Agregar un toggle de modo oscuro en la página de configuración. La elección persiste entre reinicios y por defecto sigue la del sistema.',
        },
        use: 'composer',
        note: {
          en: 'Says what the user sees and what must stay true — that is what becomes acceptance criteria.',
          es: 'Dice qué ve el usuario y qué tiene que seguir siendo cierto — eso es lo que se vuelve criterio de aceptación.',
        },
      },
      {
        title: { en: 'A backend change with limits', es: 'Un cambio de backend con límites' },
        body: {
          en: 'Rate-limit the public API to 100 requests per minute per API key. Over the limit, respond 429 with a Retry-After header.',
          es: 'Limitar la API pública a 100 requests por minuto por API key. Pasado el límite, responder 429 con un header Retry-After.',
        },
        use: 'composer',
        note: {
          en: 'Numbers and status codes give the plan something to test against.',
          es: 'Números y códigos de estado le dan al plan algo contra qué testear.',
        },
      },
      {
        title: { en: 'A data export', es: 'Una exportación de datos' },
        body: {
          en: 'Let users export their projects as CSV from the account page, one row per project with name, owner and last-updated date.',
          es: 'Que los usuarios puedan exportar sus proyectos como CSV desde la página de cuenta, una fila por proyecto con nombre, dueño y fecha de última modificación.',
        },
        use: 'composer',
      },
    ],
    claude: {
      label: { en: 'Suggest 3 features for this repo', es: 'Sugerime 3 features para este repo' },
      prompt: {
        en: 'Read this repository (README, the main source folders, any TODOs or open issues you can see) and suggest three small, concrete features that would make sense to build next. For each one, write a single paragraph I can paste into Octo’s Home composer as a spec brief: what the user sees, and what must stay true. Do not edit any files.',
        es: 'Leé este repositorio (README, las carpetas principales, los TODOs o issues que veas) y sugerime tres features chicas y concretas que tenga sentido construir ahora. Para cada una, escribí un único párrafo que pueda pegar en el composer de Home de Octo como brief de un spec: qué ve el usuario y qué tiene que seguir siendo cierto. No edites ningún archivo.',
      },
    },
  },
  {
    id: 'bugfix',
    icon: 'bug',
    title: { en: 'Fix a bug', es: 'Arreglar un bug' },
    blurb: {
      en: 'A bugfix spec: reproduce, find the root cause, fix it, and guard against it coming back.',
      es: 'Un spec de bugfix: reproducir, encontrar la causa, arreglarlo y evitar que vuelva.',
    },
    keywords: ['bug', 'fix', 'error', 'crash', 'broken', 'fail', 'arreglar', 'falla', 'roto', 'anda', 'funciona', 'problema', 'regresion'],
    steps: [
      { guide: 'bugfix-spec', action: { kind: 'composer' }, label: { en: 'Describe it on Home', es: 'Describilo en Home' } },
      { guide: 'revise-improve', action: go('spec:define'), label: { en: 'Open the analysis', es: 'Abrir el análisis' } },
      { guide: 'run-and-ship', action: go('spec:build'), label: { en: 'Open Build', es: 'Abrir Build' } },
    ],
    examples: [
      {
        title: { en: 'Steps, expected, actual', es: 'Pasos, esperado, real' },
        body: {
          en: 'Bug: login fails for emails with uppercase letters. Steps: sign up as Ana@Example.com, log out, log in with the same address. Expected: logged in. Actual: "invalid credentials".',
          es: 'Bug: el login falla con emails en mayúsculas. Pasos: registrarse como Ana@Example.com, salir, entrar con la misma dirección. Esperado: entra. Real: "credenciales inválidas".',
        },
        use: 'composer',
        note: {
          en: 'Starting with "Bug:" makes Home open it as a bugfix spec — the kind is guessed from English words like bug, fix, crash or error.',
          es: 'Empezar con "Bug:" hace que Home lo abra como spec de bugfix — el tipo se adivina por palabras en inglés como bug, fix, crash o error.',
        },
      },
      {
        title: { en: 'A crash with a trace', es: 'Un crash con stack trace' },
        body: {
          en: 'Fix the crash when saving a draft with an empty title: TypeError: Cannot read properties of undefined (reading "trim") in saveDraft.',
          es: 'Fix: crash al guardar un borrador con el título vacío — TypeError: Cannot read properties of undefined (reading "trim") en saveDraft.',
        },
        use: 'composer',
      },
    ],
    claude: {
      label: { en: 'Find likely bugs in this repo', es: 'Buscá bugs probables en este repo' },
      prompt: {
        en: 'Look through this repository for two or three likely bugs — unhandled errors, edge cases with empty or missing input, race conditions. For each, write a bug report I can paste into Octo’s Home composer: start with "Bug:", then steps, expected and actual. Do not edit any files.',
        es: 'Revisá este repositorio buscando dos o tres bugs probables — errores sin manejar, casos borde con input vacío o faltante, race conditions. Para cada uno, escribí un reporte que pueda pegar en el composer de Home de Octo: empezá con "Bug:", después pasos, esperado y real. No edites ningún archivo.',
      },
    },
  },
  {
    id: 'ticket',
    icon: 'ticket',
    title: { en: 'Work from my tickets', es: 'Trabajar desde mis tickets' },
    blurb: {
      en: 'Connect Jira or your tracker, then turn an open ticket into a spec without retyping it.',
      es: 'Conectá Jira o tu tracker y convertí un ticket abierto en un spec sin reescribirlo.',
    },
    keywords: ['ticket', 'jira', 'tracker', 'issue', 'linear', 'mcp', 'backlog', 'tarea', 'tickets'],
    steps: [
      { guide: 'connect-tracker', action: go('library:tickets'), label: { en: 'Open Tickets', es: 'Abrir Tickets' } },
      { guide: 'spec-from-ticket', action: go('home'), label: { en: 'Open the inbox', es: 'Abrir la bandeja' } },
    ],
    examples: [],
    claude: {
      label: { en: 'Which tracker setup fits me?', es: '¿Qué tracker me conviene conectar?' },
      prompt: {
        en: 'Look at this repository for signs of the issue tracker it uses (links in the README or docs, ticket keys in commit messages or branch names like ABC-123, CI config). Tell me which tracker it most likely is and which Octo tracker preset fits — `jira`, `tracker` or `generic` — and what I will need to sign in. Do not edit any files.',
        es: 'Buscá en este repositorio señales del tracker que usa (links en el README o docs, claves de tickets en commits o branches tipo ABC-123, config de CI). Decime qué tracker es probablemente y qué preset de Octo le corresponde — `jira`, `tracker` o `generic` — y qué voy a necesitar para conectarlo. No edites ningún archivo.',
      },
    },
  },
  {
    id: 'teach',
    icon: 'teach',
    title: { en: 'Teach Claude my project', es: 'Enseñarle a Claude mi proyecto' },
    blurb: {
      en: 'Steering, agents and skills — the context that makes every run write code that fits.',
      es: 'Steering, agentes y skills — el contexto que hace que cada run escriba código que encaja.',
    },
    keywords: ['steering', 'context', 'contexto', 'agent', 'agente', 'skill', 'conventions', 'convenciones', 'stack', 'quality', 'calidad', 'claude.md', 'enseñar', 'teach', 'project', 'proyecto'],
    steps: [
      { guide: 'open-workspace', action: { kind: 'seed' }, label: { en: 'Install the defaults', es: 'Instalar los defaults' } },
      { guide: 'steering', action: go('library:steering'), label: { en: 'Open Steering', es: 'Abrir Steering' } },
      { guide: 'write-agent', action: go('library:agents'), label: { en: 'Open Agents', es: 'Abrir Agents' } },
      { guide: 'skills', action: go('library:skills'), label: { en: 'Open Skills', es: 'Abrir Skills' } },
    ],
    examples: [
      {
        title: { en: 'A filled-in tech.md', es: 'Un tech.md completo' },
        body: {
          en: `---
inclusion: always
description: Tech stack, frameworks, and engineering conventions.
---

# Tech

- **Languages / frameworks**: TypeScript, React 18, Express, PostgreSQL via Prisma.
- **Build / test / lint commands**: \`npm run build\`, \`npm test\` (Vitest), \`npm run lint\`.
- **Conventions**: errors are thrown as \`AppError\` and mapped to HTTP in one middleware; no default exports; components in PascalCase files.`,
          es: `---
inclusion: always
description: Tech stack, frameworks, and engineering conventions.
---

# Tech

- **Lenguajes / frameworks**: TypeScript, React 18, Express, PostgreSQL con Prisma.
- **Comandos de build / test / lint**: \`npm run build\`, \`npm test\` (Vitest), \`npm run lint\`.
- **Convenciones**: los errores se lanzan como \`AppError\` y se mapean a HTTP en un solo middleware; sin default exports; componentes en archivos PascalCase.`,
        },
        use: 'copy',
        note: {
          en: 'Paste into .octo/steering/tech.md. Commands and conventions are what Claude would otherwise guess.',
          es: 'Pegalo en .octo/steering/tech.md. Los comandos y convenciones son lo que Claude si no adivina.',
        },
      },
      {
        title: { en: 'An agent the router will pick', es: 'Un agente que el router va a elegir' },
        body: {
          en: `---
name: api-expert
description: Backend specialist for the REST API, server routes, endpoints and middleware.
---

You implement backend tasks in this repo. Routes live in src/server/routes/,
one file per resource. Validate input with zod at the route boundary.`,
          es: `---
name: api-expert
description: Backend specialist for the REST API, server routes, endpoints and middleware.
---

Implementás tareas de backend en este repo. Las rutas viven en src/server/routes/,
un archivo por recurso. Validá el input con zod en el borde de la ruta.`,
        },
        use: 'copy',
        note: {
          en: 'Save as .claude/agents/api-expert.md. The description uses only backend words — a generic one would win every task.',
          es: 'Guardalo como .claude/agents/api-expert.md. La description usa solo palabras de backend — una genérica ganaría todas las tareas.',
        },
      },
    ],
    claude: {
      label: { en: 'Write my steering docs', es: 'Escribí mis docs de steering' },
      prompt: {
        en: 'Read this repository and fill in Octo’s steering docs in `.octo/steering/`: `product.md` (purpose, users, goals and non-goals), `tech.md` (stack, the exact build/test/lint commands, conventions you can see in the code) and `structure.md` (how the code is organized). Keep each one short and only state what you verified in the repo. Keep each file’s front matter as it is; create the files with that front matter if they do not exist. Reply with a short list of what you wrote.',
        es: 'Leé este repositorio y completá los docs de steering de Octo en `.octo/steering/`: `product.md` (propósito, usuarios, objetivos y no-objetivos), `tech.md` (stack, los comandos exactos de build/test/lint, las convenciones que veas en el código) y `structure.md` (cómo está organizado el código). Cada uno corto y solo con lo que verificaste en el repo. Mantené el front matter de cada archivo; si no existen, crealos con ese front matter. Escribí el contenido en el idioma del repo. Respondé con una lista corta de lo que escribiste.',
      },
    },
  },
  {
    id: 'parallel',
    icon: 'parallel',
    title: { en: 'Run tasks in parallel', es: 'Correr tareas en paralelo' },
    blurb: {
      en: 'Waves of tasks, each its own agent, with the right specialist on each line.',
      es: 'Olas de tareas, cada una su propio agente, con el especialista justo en cada línea.',
    },
    keywords: ['parallel', 'paralelo', 'wave', 'ola', 'task', 'tareas', 'agent', 'concurrency', 'autopilot', 'run all', 'especialista', 'specialist'],
    steps: [
      { guide: 'task-agents', action: go('spec:build'), label: { en: 'Open the task list', es: 'Abrir las tareas' } },
      { guide: 'waves-concurrency', action: go('activity:runs'), label: { en: 'Open Runs', es: 'Abrir Runs' } },
      { guide: 'critical-decisions', action: go('spec:plan'), label: { en: 'Open the plan', es: 'Abrir el plan' } },
      { guide: 'travel-display', action: { kind: 'travel' }, label: { en: 'Open Travel Display', es: 'Abrir Travel Display' } },
    ],
    examples: [
      {
        title: { en: 'Two waves with specialists', es: 'Dos olas con especialistas' },
        body: {
          en: `## Wave 1
- [ ] T1 @database-expert: Add a migration for the exports table - _outcome: table exists with an index on user_id_
- [ ] T2 @frontend-expert: Add the Export button to the account page - _outcome: button renders, disabled while loading_

## Wave 2 (depends on T1)
- [ ] T3 @backend-expert: Add GET /exports that streams the CSV - _outcome: endpoint returns text/csv_`,
          es: `## Wave 1
- [ ] T1 @database-expert: Agregar una migración para la tabla exports - _outcome: la tabla existe con índice en user_id_
- [ ] T2 @frontend-expert: Agregar el botón Exportar en la página de cuenta - _outcome: el botón se ve, deshabilitado mientras carga_

## Wave 2 (depends on T1)
- [ ] T3 @backend-expert: Agregar GET /exports que devuelve el CSV en streaming - _outcome: el endpoint devuelve text/csv_`,
        },
        use: 'copy',
        note: {
          en: 'T1 and T2 touch different files, so they can share a wave. The @agent goes right after the id, nowhere else.',
          es: 'T1 y T2 tocan archivos distintos, así que pueden compartir ola. El @agente va justo después del id, en ningún otro lado.',
        },
      },
    ],
    claude: {
      label: { en: 'Which specialists does this repo need?', es: '¿Qué especialistas necesita este repo?' },
      prompt: {
        en: 'Look at how this repository is split (frontend, backend, database, docs, infra…) and at the agents already in `.claude/agents/`. Tell me which specialist agents would pay off for task routing in Octo, and for each one suggest a name and a one-line `description` that uses only words from its own domain, so it does not win unrelated tasks. Do not create the files.',
        es: 'Mirá cómo está dividido este repositorio (frontend, backend, base de datos, docs, infra…) y los agentes que ya hay en `.claude/agents/`. Decime qué agentes especialistas valdrían la pena para el routing de tareas de Octo, y para cada uno sugerí un nombre y una `description` de una línea que use solo palabras de su dominio, para que no gane tareas ajenas. No crees los archivos.',
      },
    },
  },
  {
    id: 'review',
    icon: 'review',
    title: { en: 'Review and ship code', es: 'Revisar y hacer ship' },
    blurb: {
      en: 'Review a spec’s branch or anyone’s pull request, then commit and open the PR.',
      es: 'Revisá el branch de un spec o el pull request de cualquiera, y después commiteá y abrí el PR.',
    },
    keywords: ['review', 'revisar', 'pr', 'pull request', 'github', 'commit', 'ship', 'merge', 'gh', 'code review'],
    steps: [
      { guide: 'github-setup', action: { kind: 'terminal' }, label: { en: 'Open a terminal', es: 'Abrir una terminal' } },
      { guide: 'code-review-branch', action: go('spec:build'), label: { en: 'Open Ship', es: 'Abrir Ship' } },
      { guide: 'review-pr', action: go('activity:reviews'), label: { en: 'Open Reviews', es: 'Abrir Reviews' } },
    ],
    examples: [
      {
        title: { en: 'Sign in to GitHub once', es: 'Conectarte a GitHub una vez' },
        body: { en: 'gh auth login', es: 'gh auth login' },
        use: 'copy',
        note: {
          en: 'Octo stores no GitHub token: every call goes through your local gh CLI.',
          es: 'Octo no guarda ningún token de GitHub: cada llamada pasa por tu gh CLI local.',
        },
      },
    ],
    claude: {
      label: { en: 'What should I review first?', es: '¿Qué reviso primero?' },
      prompt: {
        en: 'Run `gh pr list --limit 10` and `git log --oneline -15` in this repository and tell me which open pull request or recent change is the riskiest to leave unreviewed, and why, in two or three sentences each. Do not edit any files.',
        es: 'Corré `gh pr list --limit 10` y `git log --oneline -15` en este repositorio y decime qué pull request abierto o cambio reciente es el más riesgoso de dejar sin revisar, y por qué, en dos o tres oraciones cada uno. No edites ningún archivo.',
      },
    },
  },
  {
    id: 'automate',
    icon: 'automate',
    title: { en: 'Automate checks', es: 'Automatizar chequeos' },
    blurb: {
      en: 'Hooks that run Claude when a wave finishes or a spec ships, and the routing behind them.',
      es: 'Hooks que corren a Claude cuando termina una ola o se entrega un spec, y el routing detrás.',
    },
    keywords: ['hook', 'automate', 'automatizar', 'automatico', 'trigger', 'typecheck', 'lint', 'changelog', 'routing', 'ci'],
    steps: [
      { guide: 'hooks', action: go('library:hooks'), label: { en: 'Open Hooks', es: 'Abrir Hooks' } },
      { guide: 'routing', action: go('library:routing'), label: { en: 'Open Routing', es: 'Abrir Routing' } },
    ],
    examples: [
      {
        title: { en: 'Run the tests after every wave', es: 'Correr los tests después de cada ola' },
        body: {
          en: `{
  "id": "tests-after-wave",
  "title": "Run tests after each wave",
  "trigger": "wave-complete",
  "enabled": true,
  "blocking": true,
  "actionType": "ask-claude",
  "agent": "code-reviewer",
  "instructions": "Run npm test via Bash. If anything fails, fix only what this wave broke and report the rest."
}`,
          es: `{
  "id": "tests-after-wave",
  "title": "Correr tests después de cada ola",
  "trigger": "wave-complete",
  "enabled": true,
  "blocking": true,
  "actionType": "ask-claude",
  "agent": "code-reviewer",
  "instructions": "Corré npm test con Bash. Si algo falla, arreglá solo lo que rompió esta ola y reportá el resto."
}`,
        },
        use: 'copy',
        note: {
          en: 'Save as .octo/hooks/tests-after-wave.json. Blocking makes Run all wait for it between waves; Bash must be enabled in Settings.',
          es: 'Guardalo como .octo/hooks/tests-after-wave.json. Blocking hace que Run all lo espere entre olas; Bash tiene que estar habilitado en Settings.',
        },
      },
    ],
    claude: {
      label: { en: 'Suggest hooks for this repo', es: 'Sugerime hooks para este repo' },
      prompt: {
        en: 'Look at this repository’s scripts (package.json, Makefile, CI config) and suggest two Octo hooks worth having — for example a check after each wave or a changelog entry when a spec ships. For each, give the trigger (`wave-complete`, `spec-done`, `spec-advance`, `task-complete`, `file-save-in-app` or `manual`) and the instructions Claude should follow, using the repo’s real commands. Do not create the files.',
        es: 'Mirá los scripts de este repositorio (package.json, Makefile, config de CI) y sugerime dos hooks de Octo que valgan la pena — por ejemplo un chequeo después de cada ola o una entrada de changelog cuando se entrega un spec. Para cada uno, dame el trigger (`wave-complete`, `spec-done`, `spec-advance`, `task-complete`, `file-save-in-app` o `manual`) y las instrucciones que debería seguir Claude, con los comandos reales del repo. No crees los archivos.',
      },
    },
  },
  {
    id: 'explore',
    icon: 'explore',
    title: { en: 'Just show me around', es: 'Mostrame cómo funciona' },
    blurb: {
      en: 'Set up, then watch one small spec go all the way through the loop.',
      es: 'Configurá lo básico y mirá un spec chico recorrer todo el loop.',
    },
    keywords: ['learn', 'aprender', 'start', 'empezar', 'how', 'como', 'tour', 'explore', 'explorar', 'first', 'primera', 'nuevo', 'help', 'ayuda', 'setup', 'install', 'instalar'],
    steps: [
      { guide: 'install-connect', action: go('library:settings'), label: { en: 'Open Settings', es: 'Abrir Settings' } },
      { guide: 'open-workspace', action: { kind: 'pick-workspace' }, label: { en: 'Open a folder', es: 'Abrir una carpeta' } },
      { guide: 'quick-plan', action: { kind: 'composer' }, label: { en: 'Try Plan rápido', es: 'Probar Plan rápido' } },
      { guide: 'zen-reading', action: go('spec:define'), label: { en: 'Open the spec', es: 'Abrir el spec' } },
    ],
    examples: [
      {
        title: { en: 'A tiny spec to watch the loop', es: 'Un spec chiquito para ver el loop' },
        body: {
          en: 'Add a --version flag to the CLI that prints the version from package.json and exits.',
          es: 'Agregar un flag --version al CLI que imprima la versión de package.json y termine.',
        },
        use: 'composer',
        note: {
          en: 'Small enough to finish in a few minutes, real enough to see every stage. Adapt it to something your repo has.',
          es: 'Lo bastante chico para terminar en minutos, lo bastante real para ver cada etapa. Adaptalo a algo que tenga tu repo.',
        },
      },
    ],
    claude: {
      label: { en: 'Pick a first spec for this repo', es: 'Elegí un primer spec para este repo' },
      prompt: {
        en: 'Read this repository and propose one very small, low-risk change that would make a good first spec in Octo — something finished in one or two tasks. Write it as one paragraph I can paste into the Home composer. Do not edit any files.',
        es: 'Leé este repositorio y proponé un cambio muy chico y de bajo riesgo que sea un buen primer spec en Octo — algo que se termine en una o dos tareas. Escribilo como un párrafo que pueda pegar en el composer de Home. No edites ningún archivo.',
      },
    },
  },
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Rank intents against what the reader typed. Local and free — the point is to
 * answer instantly; Claude is the explicit second step, not the first.
 */
export function matchIntents(text: string): LearnIntent[] {
  const q = fold(text);
  if (q.trim().length < 3) return [];
  const words = q.split(/[^a-z0-9.]+/).filter((w) => w.length > 1);
  return INTENTS.map((intent) => {
    let score = 0;
    for (const k of intent.keywords) {
      const kf = fold(k);
      if (kf.includes(' ') ? q.includes(kf) : words.some((w) => w === kf || (kf.length > 3 && w.startsWith(kf))))
        score += 1;
    }
    return { intent, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.intent);
}

/** The intent's steps, joined to their guides; a step whose guide is missing is dropped. */
export function intentSteps(intent: LearnIntent, lang: GuideLang) {
  return intent.steps.flatMap((step) => {
    const guide = GUIDES.get(step.guide, lang);
    return guide ? [{ step, guide }] : [];
  });
}

/**
 * Context for a free-text question sent to the Assistant: what Octo is, the
 * index of guides, and the full text of the guides most likely to answer it.
 * Goes in as system context, so the chat shows only the question.
 */
export function questionContext(question: string, lang: GuideLang): string {
  const all = GUIDES.byLang[lang];
  const best = matchIntents(question)[0];
  const relevant = best ? intentSteps(best, lang).map((x) => x.guide) : all.filter((g) => g.track === 'start');
  return [
    'The user is asking how to use Octo (wordmark 0ct0), the desktop app you are running inside: a Spec-Driven Development workbench that runs requirements → plan → build with Claude. Answer from the guides below; they are accurate for this version. Be concrete: name the screen and the exact button. If the guides do not cover it, say so instead of guessing. If the question is really a request to do something in their repository, offer to do it.',
    `Reply in ${lang === 'es' ? 'Spanish (rioplatense, voseo), keeping UI labels in English as they appear in the app' : 'English'}.`,
    '## All guides\n' + all.map((g) => `- ${g.title} — ${g.summary}`).join('\n'),
    ...relevant.map((g) => `## Guide: ${g.title}\n\n${g.body}`),
  ].join('\n\n');
}
