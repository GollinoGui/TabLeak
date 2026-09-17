const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
  const newTabBtn = page.getByRole('button', { name: /nova tablatura|new tab|criar/i }).first();
  await newTabBtn.click();
  await page.waitForTimeout(300);
  await page.locator('input').first().fill('Debug');
  await page.getByRole('button', { name: /criar|salvar|confirmar|create/i }).last().click();
  await page.waitForTimeout(1000);

  const hypotheses = {
    'chord_with_bend': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 (13.2 12.4{b (0 4)}) r r r |`,
    'hammer_at_last_note_of_piece': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 12.3{h} r r r |`,
    'two_bends_same_note_conflict': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 12.3{b (0 4)} 14.3{b (0 4)} 12.3{h} r |`,
    'slide_last_note': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 10.4{sl} r r r |`,
    'bend_value_8': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 12.3{b (0 8)} r r r |`,
    'prebend': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 12.3{b (4 0)} r r r |`,
    'many_bars_full_pattern': `\\title "t"\n\\tempo 120\n\\track "t"\n\\staff{tabs}\n\\tuning (e4 b3 g3 d3 a2 e2)\n\n:4 (13.2 12.4) 12.2 10.2 r | r 13.2 12.2 10.2 | r r r 15.2 | r 12.3{b (0 4)} 14.3{b (0 4)} r | 14.3{b (0 4)} 14.3{h} 12.3{h} 14.3 | r 12.3 14.3{b (0 4)} r | 14.3{b (0 4)} r 10.4{sl} 14.4 | 12.3 14.3{b (0 4)} r 14.3{b (0 4)} | r r r 14.3{h} |`,
  }

  const results = {};
  for (const [name, tex] of Object.entries(hypotheses)) {
    const res = await page.evaluate(async (t) => {
      const api = window.__debugApi;
      let caught = null;
      const handler = (e) => { caught = { message: e?.message ?? String(e), diagnostics: e?.semanticDiagnostics ? JSON.stringify([...e.semanticDiagnostics]) : null }; };
      api.error.on(handler);
      try {
        api.tex(t);
        await new Promise((r) => setTimeout(r, 300));
      } finally {
        api.error.off(handler);
      }
      return caught;
    }, tex);
    results[name] = res;
  }

  console.log(JSON.stringify(results, null, 2));
  console.log('LOGS:\n' + logs.join('\n'));
  await browser.close();
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(1);
});
