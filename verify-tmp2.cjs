const { chromium } = require('playwright');

function tex(bars) {
  return [
    '\\title "t"',
    '\\tempo 120',
    '\\track "t"',
    '\\staff{tabs}',
    '\\tuning (e4 b3 g3 d3 a2 e2)',
    '',
    ':4 ' + bars + ' |',
  ].join('\n');
}

const hypotheses = {
  g_string_run: tex('12.3 14.3{b (0 4)} 14.3{h} 12.3{h} | 14.3 r r r'),
  d_slide_then_note: tex('r r 10.4{sl} 14.4'),
  chord_bend_plus_plain: tex('(13.2 12.4) 12.2 10.2 12.3{b (0 4)}'),
  full_repro: tex(
    '(13.2 12.4) 12.2 10.2 r | r 13.2 12.2 10.2 | r r r (15.2 12.3) | r 12.3 14.3{b (0 4)} r | ' +
      '14.3{b (0 4)} 14.3{h} 12.3{h} 14.3 | r 12.3 14.3{b (0 4)} r | 14.3{b (0 4)} r 10.4{sl} 14.4 | ' +
      '12.3 14.3{b (0 4)} r 14.3{b (0 4)} | r r r 14.3{h}',
  ),
};

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /nova tablatura|new tab|criar/i }).first().click();
  await page.waitForTimeout(300);
  await page.locator('input').first().fill('Debug3');
  await page.getByRole('button', { name: /criar|salvar|confirmar|create/i }).last().click();
  await page.waitForTimeout(1000);

  const results = {};
  for (const [name, t] of Object.entries(hypotheses)) {
    const res = await page.evaluate(async (tt) => {
      const api = window.__debugApi;
      let caught = null;
      const handler = (e) => { caught = { message: e?.message ?? String(e) }; };
      api.error.on(handler);
      try { api.tex(tt); await new Promise((r) => setTimeout(r, 300)); } finally { api.error.off(handler); }
      return caught;
    }, t);
    results[name] = res;
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
