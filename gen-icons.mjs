// Genereert de PWA-iconen door een SVG met Chromium naar PNG te renderen.
// Eenmalig build-hulpmiddel (niet nodig om te spelen).
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Tekent een afgeronde tegel met verloop en een mini-nonogram-patroon.
function svg({ size, padding = 0, radiusRatio = 0.22 }) {
  const s = size;
  const inner = s - padding * 2;
  const r = inner * radiusRatio;
  const cells = 5;
  const gap = inner * 0.045;
  const cs = (inner - gap * (cells + 1)) / cells;
  // Vast patroon (een "M"-achtige monogram-vorm).
  const pattern = [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ];
  let rects = '';
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const px = padding + gap + x * (cs + gap);
      const py = padding + gap + y * (cs + gap);
      const on = pattern[y][x] === 1;
      rects += `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${cs.toFixed(2)}" height="${cs.toFixed(2)}" rx="${(cs * 0.18).toFixed(2)}" fill="${on ? '#ffffff' : 'rgba(255,255,255,0.16)'}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="0.55" stop-color="#7c3aed"/>
        <stop offset="1" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${r}" fill="url(#g)"/>
    ${rects}
  </svg>`;
}

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();

async function render(name, cfg) {
  const markup = svg(cfg);
  await page.setViewportSize({ width: cfg.size, height: cfg.size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${markup}</body></html>`,
    { waitUntil: 'networkidle' }
  );
  const buf = await page.locator('svg').screenshot({ omitBackground: true });
  await writeFile(`/home/user/NonoGram/icons/${name}`, buf);
  console.log('geschreven:', name);
}

await render('icon-192.png', { size: 192 });
await render('icon-512.png', { size: 512 });
await render('icon-180.png', { size: 180 });
// Maskable: content binnen de veilige zone (padding rondom).
await render('icon-maskable-512.png', { size: 512, padding: 52, radiusRatio: 0.28 });

await browser.close();
console.log('klaar');
