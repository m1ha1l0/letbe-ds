#!/usr/bin/env node
/**
 * build-llms.js — regenerate /llms.txt and /llms-full.txt from
 * components/meta.json
 *
 * llms.txt is the AI-legibility entry point (https://llmstxt.org): a single
 * markdown file an agent can read to understand the whole system without
 * crawling the gallery. llms-full.txt is the same file with each
 * component's usage notes in full (markup, class combos, modifiers,
 * events, API), the companion that convention names for the complete
 * reference. Everything component-shaped is generated from meta.json so it
 * can never drift from the landing page; the fixed sections (tokens,
 * vendor manifest, principles) mirror the README's claims.
 *
 * Run after any meta.json change, alongside build-landing.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'components', 'meta.json'), 'utf8'));

let lines = [];
const push = (s = '') => lines.push(s);

// full = llms-full.txt: the same document with each component's usage
// notes written out under its own heading.
function build(full) {
  lines = [];
  push('# letbe-ds');
  push();
  push('> Application-grade UI in plain CSS + JS — no build, no dependencies, no');
  push('> framework. Tokens → components → templates, MIT.');
  push();
  push('letbe-ds is a complete design system in three plain files — design tokens,');
  push('component styles, one JavaScript runtime. No build step, no dependencies,');
  push('no framework: link the files and you own the entire stack. A three-tier');
  push('DTCG token architecture drives everything. From buttons, forms and cards');
  push('it scales to the application tier: data tables, dashboards, kanban boards,');
  push('calendars, media players, AI chat. Interactions are accessibility-first;');
  push('heavy engines (data layers, virtualizers, streaming, AI models) are');
  push('deliberately the consumer\'s choice. MIT-licensed, demo media included');
  push('(brand and third-party assets excluded — see NOTICE).');
  push();
  if (full) {
    push('This is llms-full.txt: llms.txt with every component\'s usage notes in');
    push('full — markup, class combos, modifiers, events and API. The short index');
    push('is [llms.txt](/llms.txt).');
  } else {
    push('Every component\'s markup, class combos, modifiers, events and API:');
    push('[llms-full.txt](/llms-full.txt) (this file with the usage notes in full).');
  }
  push();
  push('## Runtime — three files, then opt-in modules');
  push();
  push('Load order: `tokens/theme.css` → `components/components.css` → `js/lb.js`.');
  push('Components auto-initialise from `data-lb-*` attributes on DOMContentLoaded.');
  push('Heavier controllers are opt-in modules loaded AFTER `lb.js` (header, shell,');
  push('board, chat, media, timeline, selection — see the README vendor manifest');
  push('for the exact file list). If a `data-lb-*` root has no controller loaded,');
  push('`lb.js` logs a console warning naming the missing script.');
  push();
  push('Markup inserted after load stays uninitialised until `LB.init(container)`');
  push('runs on it (idempotent), or call `LB.observe()` once to initialise every');
  push('element added under `document.body` automatically.');
  push();
  push('Frameworks that render the DOM (React…): load `lb.js` with a `<script src>`');
  push('tag (that is how it finds `assets/icons/`; or call `LB.setIconBasePath`),');
  push('then call `LB.init(document.body)` and `LB.observe()` once after the first');
  push('render. lb.js then owns the DOM of every `data-lb-*` element (plus');
  push('`.lb-checkbox` frames, field-hint icons, icon SVGs): render those once with');
  push('a stable key, read their events, call their API. Plain-CSS components are');
  push('safe to render from state.');
  push();
  push('Motion: every component honours `prefers-reduced-motion`. `data-lb-motion="off"`');
  push('on `<html>`, a section or one component makes all letbe-ds motion inside');
  push('it instant (CSS and scripts); `LB.motion(el)` returns `\'off\'`, `\'reduce\'` or');
  push('`\'full\'` for your own scripts. `data-lb-motion="custom"` drops the built-in');
  push('overlay entry/exit so your own animation plays on the same leaving hooks');
  push('(the close waits for it). Retime with the `--lb-animation-*` tokens.');
  push();
  push('Events: every `lb-*` event bubbles, like the browser\'s `change`, so one');
  push('listener on a container or `document` serves components rendered later.');
  push('A listener on an outer component also hears a nested one of the same');
  push('kind (tabs in tabs): compare `e.target` with the element you mean.');
  push();
  push('Class combos are contracts: copy the full combo from each demo (base +');
  push('variant + size, e.g. `lb-btn lb-btn--secondary lb-btn--medium`; every table');
  push('cell carries `lb-table__cell`). Base classes alone render unstyled.');
  push();
  push('## Tokens — DTCG source, generated CSS');
  push();
  push('`tokens/source-tokens.json` is authored in the W3C Design Tokens Community');
  push('Group (DTCG) format — `$value`/`$type`, aliases as `{path.to.token}` — and');
  push('is the single source of truth. `node scripts/build-tokens.js` generates');
  push('`tokens/theme.css` (never edit it by hand). Three tiers: L1 primitives →');
  push('L2 semantic (`--lb-bg-*`, `--lb-fg-*`, `--lb-surface-*`) → L3 component');
  push('(`--lb-action-*`, `--lb-field-*`). L2/L3 never hold raw values, only');
  push('references. Role prefixes name what the pixel IS, not the CSS property:');
  push('`bg-*` = surfaces/fills (incl. value-display fills), `fg-*` = ink — text');
  push('AND icons (icons draw with currentColor), `border-*` = boundaries and');
  push('focus only; cross-role binding is forbidden outside documented cases.');
  push('Native light/dark themes (`[data-theme="dark"]`), responsive');
  push('S/M/L typography modes, ~500 tokens. The same tokens round-trip into Figma');
  push('variables through the letbe tokens plugin, published on Figma Community');
  push('(https://www.figma.com/community/plugin/1671570185456177314/letbe-tokens);');
  push('the Figma component library built on those variables is published at');
  push('https://www.figma.com/community/file/1672532598361033237');
  push();
  push('Theming: layer your own stylesheet after `theme.css` and re-declare token');
  push('values — the whole system re-themes, both modes, zero forks. Text on');
  push('saturated fills uses `--lb-fg-inverse-strong` (theme-stable on-color role).');

  const SECTION_NOTES = {
    foundation: 'Token-level pages — vocabulary and scales, not classed components.',
    charts: 'Hand-rolled SVG / pure CSS. No charting library; data via `data-lb-*` attributes or JS options.',
    components: 'Each page documents markup, variants, a11y behavior and JS API.',
    templates: 'Composed screens built exclusively from the components above — copy as starting points.',
  };

  for (const group of META.groups) {
    push();
    push(`## ${group.name} (${group.items.length})`);
    push();
    if (SECTION_NOTES[group.id]) { push(SECTION_NOTES[group.id]); push(); }
    for (const id of group.items) {
      const info = META.items[id];
      if (!info) continue;
      const status = info.status ? ` [${info.status}]` : '';
      if (!full) { push(`- [${info.name}](/${id}/)${status}: ${info.description}`); continue; }
      push(`### ${info.name}${status}`);
      push();
      push(`Page: [/${id}/](/${id}/)`);
      push();
      push(info.description);
      if (info.usage) { push(); push(`Usage: ${info.usage}`); }
      push();
    }
  }

  push();
  push('## Accessibility');
  push();
  push('Every interactive component ships its interaction model: WCAG 2.5.7-first');
  push('kanban (menu-move, pointer drag, keyboard grab-and-move + live-region');
  push('announcements), APG-patterned tables (`role=table`, `aria-sort`), focus-');
  push('trapped modal drawers, labelled comboboxes, `prefers-reduced-motion`');
  push('opt-outs. Each gallery page carries an "a11y (built in)" paragraph stating');
  push('exactly what the code does — claims are verified against the source.');
  push('Disabled controls keep the normal arrow pointer (`cursor: default`) and');
  push('show no hover effect; the disabled look alone carries the state.');
  push();
  push('## Files');
  push();
  push('- [README.md](/README.md): positioning, vendor manifest, theming guide, versioning policy');
  push('- [CHANGELOG.md](/CHANGELOG.md): versioned changes; token NAMES are API (renames = major)');
  push('- [LICENSE](/LICENSE) + [NOTICE](/NOTICE): MIT incl. demo media; brand + third-party excluded');
  push('- [tokens/source-tokens.json](/tokens/source-tokens.json): DTCG token source');
  push(full
    ? '- [llms.txt](/llms.txt): the short index of this file (one line per component)'
    : '- [llms-full.txt](/llms-full.txt): this file with every component\'s usage notes in full');
  push('- [components/meta.json](/components/meta.json): machine-readable component inventory (this file is generated from it)');
  push('- [privacy/](/privacy/): what the site does with visitor data — no cookies, no cross-site tracking; cookieless EU-hosted page analytics (Plausible) on letbe.design only; three device-local preferences; self-hosted fonts');
  push();
  return lines;
}

const entries = META.groups.reduce((n, g) => n + g.items.length, 0);
for (const [file, full] of [['llms.txt', false], ['llms-full.txt', true]]) {
  const out = build(full);
  fs.writeFileSync(path.join(ROOT, file), out.join('\n'));
  console.log(`✓ Wrote ${file} (${out.length} lines, ${entries} inventory entries)`);
}
