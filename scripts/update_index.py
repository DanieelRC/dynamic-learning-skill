#!/usr/bin/env python3
"""Regenerate <root>/index.html: every exercise grouped by module and difficulty.

Usage:
    python3 update_index.py [ROOT]        # ROOT defaults to ./dynamic-learning

Scans ROOT/<module>/<difficulty>/<exercise>/meta.json (written by build_deck.py).
"""
import html
import json
import sys
from pathlib import Path

DIFFS = ["easy", "medium", "hard", "unrated"]
LABELS = {
    "es": {"title": "Mi historial de aprendizaje", "easy": "Fácil", "medium": "Media", "hard": "Difícil", "unrated": "Sin clasificar",
           "algorithms": "Algoritmos", "concepts": "Conceptos", "practice": "Práctica con pistas", "count": "ejercicios", "updated": "actualizado"},
    "en": {"title": "My learning history", "easy": "Easy", "medium": "Medium", "hard": "Hard", "unrated": "Unrated",
           "algorithms": "Algorithms", "concepts": "Concepts", "practice": "Practice with hints", "count": "exercises", "updated": "updated"},
    "pt": {"title": "Meu histórico de aprendizado", "easy": "Fácil", "medium": "Média", "hard": "Difícil", "unrated": "Sem classificação",
           "algorithms": "Algoritmos", "concepts": "Conceitos", "practice": "Prática com dicas", "count": "exercícios", "updated": "atualizado"},
}

CSS = """
:root{--bg:#0b1020;--surface:#121a2e;--line:#26314d;--ink:#e7ecf5;--ink2:#aeb9d0;--muted:#7a87a3;--accent:#f5b83d;--easy:#4ade80;--medium:#f5b83d;--hard:#f87171}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',system-ui,sans-serif;padding:56px 16px 96px}
main{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:40px}
h1{font-size:clamp(32px,5vw,52px);letter-spacing:-.02em}
h2{font-size:26px;display:flex;gap:12px;align-items:baseline}
h2 small,.meta{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--muted);font-weight:400}
h3{font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.12em;text-transform:uppercase;margin:8px 0 14px}
h3.easy{color:var(--easy)}h3.medium{color:var(--medium)}h3.hard{color:var(--hard)}h3.unrated{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px 22px;display:flex;flex-direction:column;gap:10px}
.card .t{font-size:20px;font-weight:600;color:#fff;text-decoration:none}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font-family:'JetBrains Mono',monospace;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--ink2)}
.files{list-style:none;display:flex;flex-direction:column;gap:6px;margin-top:4px}
.files a{color:var(--ink);text-decoration:none;display:flex;justify-content:space-between;gap:12px;padding:8px 12px;border-radius:10px;background:#18223a;font-size:15px}
.files a:hover{outline:1px solid var(--accent)}
.files .o{font-family:'JetBrains Mono',monospace;color:#ffd98a;font-size:13px;white-space:nowrap}
.files .practice{color:var(--accent)}
"""


SUP = str.maketrans("0123456789n", "⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ")


def esc(s):
    return html.escape(str(s if s is not None else ""))


def big_o(s):
    # O(n^2) -> O(n²) for display
    import re
    return re.sub(r"\^(\w+)", lambda m: m.group(1).translate(SUP), s)


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "dynamic-learning").resolve()
    metas = []
    for m in sorted(root.glob("*/*/*/meta.json")):
        try:
            data = json.loads(m.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        data["_dir"] = m.parent.relative_to(root).as_posix()
        metas.append(data)
    lang = next((m.get("lang") for m in metas if m.get("lang")), "en")
    L = {**LABELS["en"], **LABELS.get(str(lang).split("-")[0], {})}

    modules = {}
    for m in metas:
        diff = str((m.get("problem") or {}).get("difficulty") or "unrated").lower()
        diff = diff if diff in DIFFS else "unrated"
        modules.setdefault(m.get("module") or m["_dir"].split("/")[0], {}).setdefault(diff, []).append(m)

    out = [f"<!DOCTYPE html><html lang='{esc(lang)}'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>",
           f"<title>{esc(L['title'])}</title>",
           "<link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;600;700&display=swap'>",
           f"<style>{CSS}</style></head><body><main><h1>{esc(L['title'])}</h1>"]
    for module, by_diff in modules.items():
        total = sum(len(v) for v in by_diff.values())
        out.append(f"<section><h2>{esc(L.get(module, module.title()))} <small>{total} {esc(L['count'])}</small></h2>")
        for diff in DIFFS:
            items = sorted(by_diff.get(diff, []), key=lambda m: m.get("updated", ""), reverse=True)
            if not items:
                continue
            out.append(f"<h3 class='{diff}'>{esc(L[diff])} · {len(items)}</h3><div class='grid'>")
            for m in items:
                p = m.get("problem") or {}
                name = ". ".join(x for x in [str(p.get("id") or ""), p.get("title") or m["_dir"]] if x)
                tags = "".join(f"<span class='tag'>{esc(t)}</span>" for t in ([p.get("platform")] + (p.get("tags") or [])[:4]) if t)
                files = []
                for f in m.get("files", []):
                    label = f.get("approach") or f["file"]
                    o = big_o(" · ".join(x for x in [f.get("time"), f.get("space")] if x))
                    cls = " class='practice'" if f.get("kind") == "practice" else ""
                    files.append(f"<li><a href='{esc(m['_dir'])}/{esc(f['file'])}'><span{cls}>{esc(label)}</span><span class='o'>{esc(o)}</span></a></li>")
                link = f"<a class='t' href='{esc(p['url'])}' target='_blank' rel='noopener'>{esc(name)}</a>" if p.get("url") else f"<span class='t'>{esc(name)}</span>"
                out.append(f"<article class='card'>{link}<div class='tags'>{tags}</div><ul class='files'>{''.join(files)}</ul>"
                           f"<span class='meta'>{esc(L['updated'])} {esc(str(m.get('updated', ''))[:10])}</span></article>")
            out.append("</div>")
        out.append("</section>")
    out.append("</main></body></html>")
    root.mkdir(parents=True, exist_ok=True)
    (root / "index.html").write_text("\n".join(out), encoding="utf-8")
    print(f"index: {root / 'index.html'} ({len(metas)} exercises)")


if __name__ == "__main__":
    main()
