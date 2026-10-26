// Prove the guides are one body of content in two languages.
//
// The same markdown feeds the public site and the app, and a guide that exists
// in English only — or whose `goto` names a screen that was renamed — fails
// silently in both: the site shows a hole in the Spanish index, the app's
// *Take me there* goes nowhere. Nothing type-checks markdown, so this does.
//
//   npm run guides            # print the index
//   npm run guides -- --check # exit 1 on any problem (CI-able)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDE_LANGS, parseGuide, compareGuides } from '../guides/guides.ts';

const ROOT = new URL('../guides/', import.meta.url).pathname;
const check = process.argv.includes('--check');
const errors = [];
const byLang = {};

for (const lang of GUIDE_LANGS) {
  byLang[lang] = new Map();
  let files = [];
  try {
    files = readdirSync(join(ROOT, lang)).filter((f) => f.endsWith('.md'));
  } catch {
    errors.push(`guides/${lang}/ is missing`);
  }
  for (const f of files) {
    const file = `guides/${lang}/${f}`;
    const { guide, errors: errs } = parseGuide(readFileSync(join(ROOT, lang, f), 'utf8'), lang, file);
    errors.push(...errs);
    if (!guide) continue;
    if (`${guide.id}.md` !== f) errors.push(`${file}: id "${guide.id}" does not match the file name`);
    if (guide.summary.length > 160) errors.push(`${file}: summary is ${guide.summary.length} chars (max 160)`);
    if (/<[a-z][^>]*>/i.test(guide.body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')))
      errors.push(`${file}: raw HTML in the body — the renderers escape it`);
    byLang[lang].set(guide.id, guide);
  }
}

// Parity: the same ids, and the same structural fields, in every language.
const [base, ...others] = GUIDE_LANGS;
for (const lang of others) {
  for (const id of byLang[base].keys())
    if (!byLang[lang].has(id)) errors.push(`guides/${lang}/${id}.md is missing (exists in ${base})`);
  for (const id of byLang[lang].keys())
    if (!byLang[base].has(id)) errors.push(`guides/${base}/${id}.md is missing (exists in ${lang})`);
  for (const [id, a] of byLang[base]) {
    const b = byLang[lang].get(id);
    if (!b) continue;
    for (const k of ['track', 'order', 'area', 'minutes', 'goto', 'check'])
      if (a[k] !== b[k]) errors.push(`${id}: "${k}" is ${a[k]} in ${base} but ${b[k]} in ${lang}`);
  }
}

// Ordering: the start track is a path, so its positions must be unique; a
// how-to's order only has to be unique within its area.
const seen = new Map();
for (const g of byLang[base].values()) {
  const key = g.track === 'start' ? `start:${g.order}` : `${g.area}:${g.order}`;
  if (seen.has(key)) errors.push(`${g.id} and ${seen.get(key)} share position ${key}`);
  else seen.set(key, g.id);
}

const list = [...byLang[base].values()].sort(compareGuides);
for (const g of list) {
  const langs = GUIDE_LANGS.filter((l) => byLang[l].has(g.id)).join('+');
  console.log(
    `  ${g.track.padEnd(6)} ${g.area.padEnd(9)} ${String(g.order).padStart(2)}  ${g.id.padEnd(22)} ${g.goto.padEnd(20)} ${langs}`
  );
}
console.log(`\n${list.length} guides`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n  ${errors.join('\n  ')}`);
  if (check) process.exit(1);
} else console.log('✓ guides are consistent');
