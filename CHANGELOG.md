# Changelog

All notable changes to letbe-ds. Follows [Semantic Versioning](https://semver.org/)
— see "What counts as breaking" in the README before relying on an update.

## [Unreleased]

Minor (token values changed, no names): typography defaults now follow the
two-face model.

- **Typography — two-face default.** `typography.family.display` and
  `.heading` now alias `{font.family.2}` (the headline face);
  `typography.family.action` moves to `{font.family.1}` — buttons share the
  text face, as every shipped preset already assumed. **Visual delta: none**
  — slot 2 ships the same Inter stack as slot 1, so nothing changes until a
  brand picks a headline font. Themes exported earlier carry their own full
  mapping and are unaffected. Slot semantics: 1 = text face, 2 = headline
  face, 3 = mono.
- **Theme editor.** The role→slot map is a first-class section (no longer
  collapsed under "Advanced"), slot captions derive live from the effective
  mapping, and the `code` role joins the map (all 7 L2 family roles
  editable). Presets shed their now-redundant family mappings.
- **Monospace micro-UI follows the code role.** Six spots (datepicker time
  colon, color-picker hex/number inputs, code-block title, calendar times)
  re-bind from the L1 slot to `--lb-typography-family-code` — identical
  rendering by default; remapping the code role now moves them too.
- **Typography page.** Missing specimens added (heading-xs/2xs, overline,
  code s/m/l); the role→slot table gains the code row and an overline note.

## [Unreleased → v1.0.0]

First public release. What ships:

- **Tokens**: 3-tier DTCG architecture (`tokens/source-tokens.json` → generated
  `theme.css`), ~500 tokens, native light/dark, responsive S/M/L typography modes,
  8-group/28-style type ramp (incl. overline + code tiers). Role-prefix doctrine
  is documented and normative — `bg-*` surfaces and fills, `fg-*` ink (text and
  icons), `border-*` boundaries; the prefix names what the pixel *is*, not the CSS
  property that draws it. Accent is a signal, not a skin: neutral at rest, accent
  only for primary action, links, selection, focus and value-display fills — the
  latter via the `bg.*-value` role family, tuned against its track rather than
  against text.
- **Components**: ~60 component families — forms, overlays, navigation, data viz
  (stat/sparkline/bar-list/donut/bar-chart/line-chart), media player, timeline,
  chat, command palette, tree, calendar, data table (density/search/filters/
  column visibility/resize/pinning/expansion/chunked append), kanban board
  (menu-move + pointer drag + keyboard, WCAG 2.5.7-first), toasts (four status
  variants plus a neutral actionable flavor carrying one Undo action).
- **Templates**: header, footer, auth (6 flows), app shell (3 styles + peek rail),
  AI chat, library view, inspector, playbar, composer dock, data-table view,
  dashboard (incl. the Store-overview commerce skeleton).
- **Theme editor**: live token editing across every gallery page — brand colour
  (a measured brand engine plans the whole primary interaction chain in both
  modes), radius, strokes, type slots and role map, viewport preview — with
  eight out-of-the-box presets (Letbe, Mono, Neon, Candy, Terra, Ocean,
  Editorial, Ink), each contrast-verified in both themes. Themes travel four
  ways through one import path: file (Import/Export), clipboard (Copy/Paste),
  link (`#theme=…`), and the Figma plugin round-trip.
- **Accessibility, with receipts**: every meaningful token pairing measured in
  both themes and published in `tokens/CONTRAST.md` (regenerated on every token
  change, exit-code-gated); every gallery page passes axe-core with zero
  violations; every component page carries an "a11y (built in)" paragraph whose
  claims are verified against the source. Interaction models are built to spec:
  dragging alternatives, focus-trapped drawers, live-region announcements,
  labelled comboboxes, reduced-motion opt-outs, undo over confirmation for
  reversible actions.
- **Documentation**: every component, chart and template page carries the same
  triad — intro, a11y, Usage — plus live code samples; `components/meta.json`
  is the machine-readable inventory (name, description, usage for all 80
  entries) that generates the landing page and `llms.txt`; the About page and
  the Token Architecture page carry the reasoning behind the system.
- **Principles**: no build step, zero dependencies, pluggable engines (the DS
  ships chrome/state/events; you bring data layers, virtualizers, AI models,
  streaming engines), accessibility-first interaction models throughout.
- **Media**: demo tracks and the brand film are served from the companion
  `letbe-media` repo via CDN (also MIT); the gallery ships only its own images.
