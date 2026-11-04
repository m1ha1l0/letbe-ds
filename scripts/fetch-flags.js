#!/usr/bin/env node
/**
 * fetch-flags.js — One-off vendoring script.
 *
 * Downloads circle-flag SVGs for the full ISO 3166-1 alpha-2 set (plus
 * XK, Kosovo's widely used user-assigned code) and every country listed
 * in PHONE_COUNTRIES (parsed live from js/lb.js) into
 * assets/flags/{iso}.svg.
 *
 * Source: https://github.com/HatScripts/circle-flags (MIT)
 * Credit preserved in THIRD-PARTY-LICENSES.md + assets/flags/LICENSE.txt.
 *
 * Usage: node scripts/fetch-flags.js [--force]
 *   --force   re-download even if the file already exists
 */
const fs = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'js', 'lb.js');
const DEST = path.join(ROOT, 'assets', 'flags');
const BASE = 'https://hatscripts.github.io/circle-flags/flags/';
const CONCURRENCY = 8;
const force = process.argv.includes('--force');

// ISO 3166-1 alpha-2, all 249 officially assigned codes, plus XK.
const ISO_3166_1 = `ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi
bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy
cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn
gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh
ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo
mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl
pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv
sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn
vu wf ws ye yt za zm zw xk`.split(/\s+/);

async function main() {
  const lb = await fs.readFile(SRC, 'utf8');
  // Parse the PHONE_COUNTRIES block — entries look like `{ iso: 'xx', ... }`
  const phoneBlockStart = lb.indexOf('PHONE_COUNTRIES');
  const phoneBlockEnd   = lb.indexOf('];', phoneBlockStart);
  if (phoneBlockStart < 0 || phoneBlockEnd < 0) {
    console.error('Could not locate PHONE_COUNTRIES in js/lb.js');
    process.exit(1);
  }
  const block = lb.slice(phoneBlockStart, phoneBlockEnd);
  const isos = Array.from(block.matchAll(/\{\s*iso:\s*'([a-z]{2,3})'/g)).map(m => m[1]);
  console.log(`Found ${new Set(isos).size} ISO codes in PHONE_COUNTRIES.`);
  const unique = [...new Set([...ISO_3166_1, ...isos])];
  console.log(`${unique.length} flags in the set (ISO 3166-1 + XK + phone list).`);

  await fs.mkdir(DEST, { recursive: true });

  const toFetch = [];
  for (const iso of unique) {
    const file = path.join(DEST, `${iso}.svg`);
    if (!force) {
      try { await fs.access(file); continue; } catch {}
    }
    toFetch.push(iso);
  }
  console.log(`${toFetch.length} to download${force ? ' (--force)' : ' (skipping existing)'}.`);
  if (!toFetch.length) { console.log('Nothing to do.'); return; }

  let done = 0;
  const failed = [];
  async function fetchOne(iso) {
    try {
      const res = await fetch(`${BASE}${iso}.svg`);
      if (!res.ok) { failed.push({ iso, reason: `HTTP ${res.status}` }); return; }
      const svg = await res.text();
      await fs.writeFile(path.join(DEST, `${iso}.svg`), svg);
      done++;
    } catch (e) {
      failed.push({ iso, reason: e.message });
    }
  }

  const queue = toFetch.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const iso = queue.shift();
      await fetchOne(iso);
    }
  });
  const tick = setInterval(() => process.stdout.write(`  ${done}/${toFetch.length}\r`), 500);
  await Promise.all(workers);
  clearInterval(tick);
  process.stdout.write(`  ${done}/${toFetch.length}\n`);

  console.log(`\n✓ Downloaded ${done} flags.`);
  if (failed.length) {
    console.log(`✗ ${failed.length} failed:`);
    failed.forEach(f => console.log(`    ${f.iso} — ${f.reason}`));
    process.exit(1);
  }
}
main();
