#!/usr/bin/env node
/* Record a deck in autoplay mode as a 1920x1080 video.

   Usage: node export_video.cjs DECK.html [OUT.mp4] [--speed 1.0]
     OUT defaults to <deck folder>/video/<deck name>.mp4
     Produces .mp4 when ffmpeg is installed, otherwise keeps the .webm.

   Needs Playwright (npm i -g playwright && npx playwright install chromium).
   Set CHROMIUM_PATH to reuse an existing Chromium binary. */
const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');

function loadPlaywright() {
    try { return require('playwright'); } catch (e) { /* fall through */ }
    try { return require(execSync('npm root -g').toString().trim() + '/playwright'); } catch (e) { /* fall through */ }
    console.error('Playwright not found. Install it with: npm i -g playwright && npx playwright install chromium');
    process.exit(2);
}

function hasFfmpeg() {
    try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

(async () => {
    const args = process.argv.slice(2);
    const speedAt = args.indexOf('--speed');
    const speed = speedAt >= 0 ? parseFloat(args[speedAt + 1]) || 1 : 1;
    const positional = args.filter((a, i) => !a.startsWith('--') && (speedAt < 0 || i !== speedAt + 1));
    const deck = positional[0];
    if (!deck) { console.error('Usage: node export_video.cjs DECK.html [OUT.mp4] [--speed 1.0]'); process.exit(1); }
    const deckPath = path.resolve(deck);
    const out = path.resolve(positional[1] || path.join(path.dirname(deckPath), 'video', path.basename(deckPath, '.html') + '.mp4'));
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'dl-video-'));
    fs.mkdirSync(path.dirname(out), { recursive: true });

    const { chromium } = loadPlaywright();
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: tmpDir, size: { width: 1920, height: 1080 } }
    });
    const page = await context.newPage();
    const started = Date.now();
    await page.goto('file://' + deckPath + `?autoplay=1&speed=${speed}`);
    await page.waitForFunction(() => window.__DECK_DONE__ === true, null, { timeout: 30 * 60 * 1000, polling: 500 });
    const video = page.video();
    await context.close();
    await browser.close();
    const webm = await video.path();
    const seconds = Math.round((Date.now() - started) / 1000);

    if (hasFfmpeg() && out.endsWith('.mp4')) {
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`video: ${out} (~${seconds}s)`);
    } else {
        const target = out.replace(/\.mp4$/, '.webm');
        fs.renameSync(webm, target);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`video: ${target} (~${seconds}s)${out.endsWith('.mp4') ? ' — install ffmpeg to get .mp4' : ''}`);
    }
})().catch((e) => { console.error(e); process.exit(1); });
