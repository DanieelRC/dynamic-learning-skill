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
        // Check every step: content that spills out of the slide, gets clipped inside a box,
        // or only fits because the engine auto-shrank it (the text should be shortened instead)
        const spill = await page.evaluate(async (i) => {
            const r = window.DLDeck.slides[i];
            const sec = r.section;
            const bad = new Set();
            const steps = r.stepper ? r.stepper.steps : 1;
            for (let s = 0; s < steps; s++) {
                if (r.stepper) { r.stepper.set(s); window.DLDeck.fit(r); }
                await new Promise((res) => setTimeout(res, 60));
                const box = sec.getBoundingClientRect();
                const limit = sec.classList.contains('trace-slide') ? 30 : 70;
                sec.querySelectorAll('.slide-inner > *').forEach((n) => {
                    const b = n.getBoundingClientRect();
                    if (b.bottom > box.bottom - limit || b.right > box.right + 1) bad.add((n.className || n.tagName) + ' (off-slide)');
                });
                sec.querySelectorAll('.slide-inner *').forEach((n) => {
                    if (!n.clientHeight || n.closest('.ptrs, .bar')) return;
                    const ov = getComputedStyle(n).overflowY;
                    if (ov === 'visible') return;
                    if (n.closest('.notes.compact, .hints.compact')) return;
                    if (n.scrollHeight > n.clientHeight + 3 || n.scrollWidth > n.clientWidth + 3) bad.add((String(n.className).split(' ')[0] || n.tagName.toLowerCase()) + ' (clipped' + (r.stepper ? ' at step ' + (s + 1) : '') + ')');
                });
                [sec.dataset.autofitNotes, sec.dataset.autofitZoom].filter(Boolean).forEach((a) => bad.add('auto-fit: ' + a));
            }
            if (r.stepper) r.stepper.set(steps - 1);
            return [...bad];
        }, i);
        if (spill.length) overflow.push(`slide ${i + 1} (${info.type}): ${spill.join('; ')}`);
    }
    await browser.close();
    console.log(`${total} slides -> ${outDir}`);
    if (overflow.length) console.log('LAYOUT WARNINGS (shorten text, split the slide or use a smaller example):\n  ' + overflow.join('\n  '));
    if (errors.length) { console.log('JS ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }
})();
