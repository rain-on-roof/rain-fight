// Build the portal version: dist/portal/ and dist/rain-fight-portal.zip.
//
//   node tools/build_portal.mjs
//   node tools/build_portal.mjs --y8-game-id ID --y8-host-id ID --y8-adsense-id ID
//
// The game itself does not change. The build copies only what ships (no
// tools, tests, docs or source art), loads Playgama Bridge before the game,
// sets `window.RF_PORTAL`, strips everything that points off the portal
// (share card tags, the studio link, the README's GitHub links), and writes
// playgama-bridge-config.json next to index.html. Bridge then talks to
// whichever portal hosts the zip: Playgama, Y8 and the rest of its list.
// Y8 needs its three ids from the Y8 developer account; without them the
// build still works everywhere else.
import { readFile, writeFile, mkdir, rm, readdir, stat, copyFile } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'portal');
const ZIP = join(ROOT, 'dist', 'rain-fight-portal.zip');
const SHIP = ['index.html', 'styles.css', 'favicon.svg', 'src', 'assets'];
// The share card is for the open web; the versus art is not used in the game.
const SKIP = new Set(['assets/og.jpg', 'assets/art/versus.jpg']);
const BRIDGE = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []),
);

async function files(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...(await files(p)));
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

function portalPage(html) {
  let out = html
    // Open Graph and Twitter tags describe the GitHub Pages copy.
    .replace(/\s*<meta (property="og:|name="twitter:)[^>]*>/g, '')
    .replace(/<a id="studio" class="studio"[^>]*>(.*?)<\/a>/s, '<span id="studio" class="studio">$1</span>');
  const boot = `  <script>window.RF_PORTAL = true;</script>\n  <script src="${BRIDGE}"></script>\n`;
  out = out.replace('  <script type="module" src="src/main.js"></script>', `${boot}  <script type="module" src="src/main.js"></script>`);
  if (!out.includes('RF_PORTAL')) throw new Error('index.html: could not find the main script tag');
  if (/https?:\/\/(?!bridge\.playgama\.com)/.test(out.replace(/<!--[\s\S]*?-->/g, ''))) {
    throw new Error('index.html still links off the portal: ' + out.match(/https?:\/\/(?!bridge\.playgama\.com)[^"' )]+/)[0]);
  }
  return out;
}

function bridgeConfig() {
  const y8 = { gameId: args['y8-game-id'] || '', hostId: args['y8-host-id'] || '', adsenseId: args['y8-adsense-id'] || '' };
  return {
    $schema: 'https://bridge.playgama.com/v1/stable/schema.json',
    device: { supportedOrientations: ['landscape', 'portrait'] },
    advertisement: {
      // At most one interstitial a minute; the game asks only between matches.
      minimumDelayBetweenInterstitial: 60,
      initialInterstitialDelay: 30,
      interstitial: { preloadOnStart: 'match_break', placementFallback: 'match_break' },
    },
    platforms: { y8 },
  };
}

/* ---------- a small zip writer (deflate, no dependencies) ---------- */

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const store = packed.length >= data.length; // webp, jpg, woff2 barely shrink
    const body = store ? data : packed;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(0x00210000, 10); // a fixed DOS date: builds are reproducible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(store ? 0 : 8, 10);
    cen.writeUInt32LE(0x00210000, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cenBuf, end]);
}

/* ---------- build ---------- */

await rm(join(ROOT, 'dist'), { recursive: true, force: true });
const entries = [];
for (const top of SHIP) {
  const p = join(ROOT, top);
  const list = (await stat(p)).isDirectory() ? await files(p) : [p];
  for (const f of list) {
    const name = rel(f);
    if (SKIP.has(name)) continue;
    let data = await readFile(f);
    if (name === 'index.html') data = Buffer.from(portalPage(data.toString('utf8')), 'utf8');
    await mkdir(dirname(join(OUT, name)), { recursive: true });
    if (name === 'index.html') await writeFile(join(OUT, name), data);
    else await copyFile(f, join(OUT, name));
    entries.push({ name, data });
  }
}
const config = Buffer.from(JSON.stringify(bridgeConfig(), null, 2) + '\n', 'utf8');
await writeFile(join(OUT, 'playgama-bridge-config.json'), config);
entries.push({ name: 'playgama-bridge-config.json', data: config });
entries.sort((a, b) => (a.name === 'index.html' ? -1 : b.name === 'index.html' ? 1 : a.name.localeCompare(b.name)));
const archive = zip(entries);
await writeFile(ZIP, archive);

const y8 = bridgeConfig().platforms.y8;
console.log(`dist/portal: ${entries.length} files`);
console.log(`dist/rain-fight-portal.zip: ${(archive.length / 1024 / 1024).toFixed(2)} MB`);
console.log(y8.gameId ? 'Y8 ids set.' : 'Y8 ids empty: fine for Playgama; pass --y8-game-id/--y8-host-id/--y8-adsense-id for a Y8 upload.');
