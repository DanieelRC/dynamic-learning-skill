# Video export (optional)

Every deck can play itself (`?autoplay=1`). Each slide stays on screen for a reading time based on its
text, traces advance frame by frame using their notes as narration, quizzes reveal their answer and
hints open one by one. `scripts/export_video.cjs` records that playback at 1920×1080.

```bash
node <skill>/scripts/export_video.cjs <exercise>/02-optimal.html            # → <exercise>/video/02-optimal.mp4
node <skill>/scripts/export_video.cjs <exercise>/02-optimal.html out.mp4 --speed 1.25
```

Requirements:
- Playwright: `npm i -g playwright && npx playwright install chromium`. `CHROMIUM_PATH=/path/to/chrome`
  reuses an existing browser.
- ffmpeg for `.mp4`. Without it, the `.webm` recording is kept.

Workflow:
1. Ask, or follow the `--video` flag, which decks to export. Default: all solution decks. The practice
   deck is interactive, so export it only when the user asks.
2. Export one deck at a time. A 12-slide deck takes about 3 minutes in real time at speed 1, because
   recording runs in real time. Tell the user the expected wait.
3. Report each file path and its duration. If Playwright or ffmpeg is missing, say what to install and
   give the exact command. Install only if the user agrees.

The video is silent: the on-screen narration bar carries the explanation. Voice-over (TTS) is on the roadmap.
