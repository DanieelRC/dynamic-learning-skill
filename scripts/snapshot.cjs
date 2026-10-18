#!/usr/bin/env node
/* Screenshot every slide of a deck (each stepper at its last step) so the
   generated presentation can be reviewed visually before handing it over.

   Usage: node snapshot.cjs DECK.html OUT_DIR [--steps]
     --steps   also capture every step of trace slides
   Needs Playwright (npm i -g playwright && npx playwright install chromium).
   Set CHROMIUM_PATH to reuse an existing Chromium binary. */
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
    try { return require('playwright'); } catch (e) { /* fall through */ }
    try { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } catch (e) { /* fall through */ }
    console.error('Playwright not found. Install it with: npm i -g playwright && npx playwright install chromium');
    process.exit(2);
}

(async () => {
    const [deck, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const steps = process.argv.includes('--steps');
    if (!deck || !outDir) { console.error('Usage: node snapshot.cjs DECK.html OUT_DIR [--steps]'); process.exit(1); }
    fs.mkdirSync(outDir, { recursive: true });
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + path.resolve(deck));
    await page.waitForFunction(() => window.DLDeck && window.DLDeck.total > 0);
    const total = await page.evaluate(() => window.DLDeck.total);
    const overflow = [];
    for (let i = 0; i < total; i++) {
        const info = await page.evaluate((i) => {
            const d = window.DLDeck;
            d.go(i, 1);
            const r = d.slides[i];
            return { type: r.spec.type, steps: r.stepper ? r.stepper.steps : 1 };
        }, i);
        const shots = steps && info.type === 'trace' ? [...Array(info.steps).keys()] : [info.steps - 1];
        for (const s of shots) {
            await page.evaluate(([i, s]) => { const r = window.DLDeck.slides[i]; if (r.stepper) r.stepper.set(s); }, [i, s]);
            await page.waitForTimeout(900);
            const name = `${String(i + 1).padStart(2, '0')}-${info.type}${shots.length > 1 ? '-step' + String(s + 1).padStart(2, '0') : ''}.png`;
            await page.screenshot({ path: path.join(outDir, name) });
        }
        // Content that spills out of the 1920x1080 slide or out of its panels
        const spill = await page.evaluate((i) => {
            const sec = window.DLDeck.slides[i].section;
            const box = sec.getBoundingClientRect();
            const bad = [];
            sec.querySelectorAll('.slide-inner > *, .viz-pane, .viz, .code, .narration, .hints').forEach((n) => {
                const b = n.getBoundingClientRect();
                const limit = sec.classList.contains('trace-slide') ? 30 : 70;
                if (b.bottom > box.bottom - limit || b.right > box.right + 1) bad.push(n.className || n.tagName);
                if (n.scrollHeight > n.clientHeight + 4 && /viz|narration|hints/.test(n.className)) bad.push(n.className + ' (clipped)');
            });
            return bad;
        }, i);
        if (spill.length) overflow.push(`slide ${i + 1} (${info.type}): ${[...new Set(spill)].join(', ')}`);
    }
    await browser.close();
    console.log(`${total} slides -> ${outDir}`);
    if (overflow.length) console.log('LAYOUT WARNINGS:\n  ' + overflow.join('\n  '));
    if (errors.length) { console.log('JS ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }
})();
