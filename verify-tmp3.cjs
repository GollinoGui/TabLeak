const { chromium } = require('playwright');

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /nova tablatura|new tab|criar/i }).first().click();
  await page.waitForTimeout(300);
  await page.locator('input').first().fill('Debug4');
  await page.getByRole('button', { name: /criar|salvar|confirmar|create/i }).last().click();
  await page.waitForTimeout(1000);

  // Build a grid matching the screenshot pattern using the REAL module logic.
  const result = await page.evaluate(async () => {
    const mod = await import('/src/lib/tab-grid.ts');
    const { gridToAlphaTex, createEmptyGrid } = mod;

    function col(cells, beatEffects) {
      return { cells, beatEffects: beatEffects || [] };
    }
    function cell(fret, effects, bend) {
      const c = { fret, effects: effects || [] };
      if (bend) c.bend = bend;
      return c;
    }

    const grid = { columns: [
      col({ 2: cell(13, []), 4: cell(12, []) }),
      col({ 2: cell(12, []) }),
      col({ 2: cell(10, []) }),
      col({}),
      col({}),
      col({ 2: cell(13, []) }),
      col({ 2: cell(12, []) }),
      col({ 2: cell(10, []) }),
      col({}),
      col({}),
      col({}),
      col({ 2: cell(15, []), 3: cell(12, []) }),
      col({}),
      col({ 3: cell(12, []) }),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({}),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({ 3: cell(14, ['h']) }),
      col({ 3: cell(12, ['h']) }),
      col({ 3: cell(14, []) }),
      col({}),
      col({ 3: cell(12, []) }),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({}),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({}),
      col({ 4: cell(10, ['sl']) }),
      col({ 4: cell(14, []) }),
      col({ 3: cell(12, []) }),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({}),
      col({ 3: cell(14, [], { kind: 'bend', amount: 4 }) }),
      col({}),
      col({}),
      col({}),
      col({ 3: cell(14, ['h']) }),
    ] }

    const instrument = { strings: 6, tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], gauge: '.010' }
    const generatedTex = gridToAlphaTex('Debug4', instrument, grid, 120)

    const api = window.__debugApi
    let caught = null
    const handler = (e) => { caught = { message: e?.message ?? String(e) } }
    api.error.on(handler)
    api.tex(generatedTex)
    await new Promise((r) => setTimeout(r, 400))
    api.error.off(handler)

    return { generatedTex, caught }
  })

  console.log('TEX:\n', result.generatedTex)
  console.log('ERROR:', JSON.stringify(result.caught, null, 2))
  await browser.close()
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1) })
