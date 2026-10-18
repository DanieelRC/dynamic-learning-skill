#!/usr/bin/env python3
"""Fetch a coding problem from its URL and print normalized JSON.

Usage:
    python3 fetch_problem.py URL_OR_LEETCODE_SLUG [-o problem.json]

Supported:
    leetcode.com / leetcode.cn   official GraphQL endpoint (statement, examples, constraints,
                                 tags, hints, code snippets, similar questions)
    codeforces.com               problem page + contest API (rating, tags)
    atcoder.jp                   task page (English section)
    anything else                generic HTML extraction (status "partial")

Output "status":
    ok          everything needed to explain the problem was found
    partial     some text was found but it must be reviewed (or completed by the user)
    paid_only   premium problem: ask the user to paste the statement
    failed      nothing usable: ask the user to paste the statement
Only the Python standard library is used.
"""
import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
TIMEOUT = 20


def http(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")


class TextExtractor(HTMLParser):
    """HTML -> readable text that keeps <pre> blocks, `code`, x^y and list bullets."""
    BLOCK = {"p", "div", "br", "li", "ul", "ol", "pre", "h1", "h2", "h3", "h4", "tr", "section", "blockquote"}
    SKIP = {"script", "style", "noscript", "svg", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.pre, self.skip = [], 0, 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag == "pre":
            self.pre += 1
            self.out.append("\n```\n")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag == "sup":
            self.out.append("^")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag == "img":
            alt = dict(attrs).get("alt") or "image"
            self.out.append(f"[{alt}]")
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag == "pre":
            self.pre = max(0, self.pre - 1)
            self.out.append("\n```\n")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(data if self.pre else re.sub(r"\s+", " ", data))

    def text(self):
        t = "".join(self.out).replace("\xa0", " ")
        t = re.sub(r"[ \t]+\n", "\n", t)
        t = re.sub(r"\n{3,}", "\n\n", t)
        return t.strip()


def html_to_text(s):
    p = TextExtractor()
    p.feed(s or "")
    return p.text()


def split_sections(text):
    """Pull examples / constraints / follow-up out of a LeetCode-like statement."""
    parts = re.split(r"\n\s*(?=(?:\*\*)?(?:Example|Ejemplo|示例)\s*\d*\s*[:：])", text)
    statement = parts[0].strip()
    rest = "\n".join(parts[1:])
    constraints, follow_up = [], None
    m = re.search(r"(?:Constraints|Restricciones|提示)\s*[:：]\s*(.*?)(?=(?:Follow[- ]?up|进阶)|\Z)", text, re.S)
    if m:
        constraints = [c.strip(" -`").strip() for c in re.split(r"\n\s*-\s*|\n", m.group(1)) if c.strip(" -`").strip()]
    fm = re.search(r"(?:Follow[- ]?up|进阶)\s*[:：]?\s*(.*)\Z", text, re.S)
    if fm:
        follow_up = fm.group(1).strip()
    if m and not parts[1:]:
        statement = text[: m.start()].strip()
    examples = []
    for block in re.split(r"(?=(?:Example|Ejemplo|示例)\s*\d*\s*[:：])", rest):
        if not block.strip():
            continue
        block = re.split(r"(?:Constraints|Restricciones|提示)\s*[:：]", block)[0]
        inp = re.search(r"(?:Input|输入)\s*[:：]\s*(.*?)(?=\n?\s*(?:Output|输出)\s*[:：])", block, re.S)
        out = re.search(r"(?:Output|输出)\s*[:：]\s*(.*?)(?=\n?\s*(?:Explanation|解释)\s*[:：]|\n\s*```|\Z)", block, re.S)
        exp = re.search(r"(?:Explanation|解释)\s*[:：]\s*(.*?)(?=\n\s*```|\Z)", block, re.S)
        clean = lambda g: re.sub(r"\s+", " ", g.group(1)).strip(" `") if g else None
        if inp or out:
            examples.append({"input": clean(inp), "output": clean(out), "explanation": clean(exp)})
    return statement, examples, constraints, follow_up


def base_result(url, platform):
    return {"status": "failed", "platform": platform, "url": url, "id": None, "slug": None, "title": None,
            "difficulty": None, "tags": [], "statement": None, "examples": [], "constraints": [],
            "follow_up": None, "hints": [], "snippets": {}, "similar": [], "limits": {}, "error": None}


# ---------------------------------------------------------------- LeetCode
LC_QUERY = """query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty isPaidOnly content
    topicTags { name slug }
    hints similarQuestions exampleTestcaseList metaData
    codeSnippets { lang langSlug code }
  }
}"""


def fetch_leetcode(url, slug, host):
    res = base_result(url, "leetcode")
    res["slug"] = slug
    endpoint = f"https://{host}/graphql"
    query = LC_QUERY.replace("content", "content translatedContent translatedTitle") if host.endswith(".cn") else LC_QUERY
    body = json.dumps({"query": query, "variables": {"titleSlug": slug}}).encode()
    try:
        raw = http(endpoint, body, {"Content-Type": "application/json", "Referer": f"https://{host}/problems/{slug}/"})
        q = (json.loads(raw).get("data") or {}).get("question")
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError) as e:
        res["error"] = f"GraphQL request failed: {e}"
        return res
    if not q:
        res["error"] = "Problem not found (check the slug)"
        return res
    res.update({
        "id": q.get("questionFrontendId"), "title": q.get("translatedTitle") or q.get("title"),
        "difficulty": (q.get("difficulty") or "").lower() or None,
        "tags": [t["name"] for t in q.get("topicTags") or []],
        "hints": [html_to_text(h) for h in q.get("hints") or []],
        "snippets": {s["langSlug"]: s["code"] for s in q.get("codeSnippets") or []},
    })
    try:
        res["similar"] = [{"title": s["title"], "slug": s["titleSlug"], "difficulty": s["difficulty"].lower(),
                           "url": f"https://{host}/problems/{s['titleSlug']}/"}
                          for s in json.loads(q.get("similarQuestions") or "[]")]
    except (json.JSONDecodeError, KeyError, AttributeError):
        pass
    try:
        res["signature"] = json.loads(q.get("metaData") or "{}")
    except json.JSONDecodeError:
        pass
    content = q.get("translatedContent") or q.get("content")
    if q.get("isPaidOnly") and not content:
        res["status"] = "paid_only"
        res["error"] = "Premium problem: the statement is not public"
        return res
    if not content:
        res["status"] = "partial"
        res["error"] = "Empty statement"
        return res
    text = html_to_text(content)
    res["statement_full"] = text
    res["statement"], res["examples"], res["constraints"], res["follow_up"] = split_sections(text)
    res["status"] = "ok" if res["statement"] and res["examples"] else "partial"
    return res


# -------------------------------------------------------------- Codeforces
def cf_rating_to_difficulty(r):
    if not r:
        return None
    return "easy" if r < 1300 else "medium" if r < 1900 else "hard"


def fetch_codeforces(url, contest, index, gym=False):
    res = base_result(url, "codeforces")
    res["id"], res["slug"] = f"{contest}{index}", f"cf-{contest}{index}".lower()
    try:
        api = json.loads(http(f"https://codeforces.com/api/contest.standings?contestId={contest}&from=1&count=1"))
        for p in api.get("result", {}).get("problems", []):
            if p.get("index") == index:
                res["title"], res["tags"] = p.get("name"), p.get("tags", [])
                res["rating"] = p.get("rating")
                res["difficulty"] = cf_rating_to_difficulty(p.get("rating"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError) as e:
        res["error"] = f"API: {e}"
    page = f"https://codeforces.com/{'gym' if gym else 'contest'}/{contest}/problem/{index}"
    try:
        doc = http(page)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        res["error"] = (res["error"] or "") + f" | page: {e}"
        res["status"] = "partial" if res["title"] else "failed"
        return res
    m = re.search(r'<div class="problem-statement">(.*?)<script', doc, re.S)
    if not m:
        res["status"] = "partial" if res["title"] else "failed"
        res["error"] = "Statement block not found (Cloudflare challenge?)"
        return res
    block = m.group(1)
    grab = lambda cls: (re.search(rf'<div class="{cls}">(.*?)</div>\s*(?=<div class="|$)', block, re.S) or [None, ""])[1]
    tl = re.search(r'time-limit"><div class="property-title">.*?</div>(.*?)</div>', block, re.S)
    ml = re.search(r'memory-limit"><div class="property-title">.*?</div>(.*?)</div>', block, re.S)
    res["limits"] = {"time": html_to_text(tl.group(1)) if tl else None, "memory": html_to_text(ml.group(1)) if ml else None}
    legend = re.search(r'</div></div><div>(.*?)</div><div class="input-specification">', block, re.S)
    res["statement"] = html_to_text(legend.group(1)) if legend else None
    res["input_spec"] = html_to_text(grab("input-specification"))
    res["output_spec"] = html_to_text(grab("output-specification"))
    ins = re.findall(r'<div class="input">.*?<pre[^>]*>(.*?)</pre>', block, re.S)
    outs = re.findall(r'<div class="output">.*?<pre[^>]*>(.*?)</pre>', block, re.S)
    clean = lambda s: html.unescape(re.sub(r"<br\s*/?>|</div>", "\n", re.sub(r"<div[^>]*>", "", s))).strip()
    res["examples"] = [{"input": clean(i), "output": clean(o), "explanation": None} for i, o in zip(ins, outs)]
    note = re.search(r'<div class="note">(.*?)</div>\s*$', block, re.S)
    if note:
        res["note"] = html_to_text(note.group(1))
    res["constraints"] = [line.strip() for line in re.split(r"(?<=[.;])\s+", res["input_spec"] or "") if re.search(r"\d", line)]
    res["status"] = "ok" if res["statement"] and res["examples"] else "partial"
    return res


# ----------------------------------------------------------------- AtCoder
def fetch_atcoder(url):
    res = base_result(url, "atcoder")
    res["slug"] = url.rstrip("/").split("/")[-1]
    try:
        doc = http(url)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        res["error"] = str(e)
        return res
    title = re.search(r"<title>(.*?)</title>", doc, re.S)
    res["title"] = html.unescape(title.group(1)).split(" - ")[-1].strip() if title else None
    en = re.search(r'<span class="lang-en">(.*?)</span>\s*</div>\s*</div>', doc, re.S) or re.search(r'id="task-statement">(.*?)<hr', doc, re.S)
    text = html_to_text(en.group(1)) if en else html_to_text(doc)
    res["statement_full"] = text
    pm = re.search(r"Problem Statement\s*(.*?)(?=Constraints|\Z)", text, re.S)
    res["statement"] = pm.group(1).strip() if pm else text[:2000]
    cm = re.search(r"Constraints\s*(.*?)(?=Input\s*\n|\Z)", text, re.S)
    res["constraints"] = [c.strip(" -") for c in (cm.group(1).split("\n") if cm else []) if c.strip(" -")]
    samples = re.findall(r"Sample Input \d+\s*```\n(.*?)\n```.*?Sample Output \d+\s*```\n(.*?)\n```", text, re.S)
    res["examples"] = [{"input": i.strip(), "output": o.strip(), "explanation": None} for i, o in samples]
    res["status"] = "ok" if res["statement"] and res["examples"] else "partial"
    return res


# ----------------------------------------------------------------- generic
def fetch_generic(url):
    host = urllib.parse.urlparse(url).netloc.replace("www.", "")
    res = base_result(url, host.split(".")[0] or "web")
    try:
        doc = http(url)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        res["error"] = str(e)
        return res
    title = re.search(r"<title>(.*?)</title>", doc, re.S)
    res["title"] = html.unescape(title.group(1)).strip() if title else None
    main = re.search(r"<(main|article)[^>]*>(.*?)</\1>", doc, re.S)
    text = html_to_text(main.group(2) if main else doc)
    res["statement_full"] = text[:15000]
    res["statement"], res["examples"], res["constraints"], res["follow_up"] = split_sections(text[:15000])
    res["status"] = "partial" if len(text) > 200 else "failed"
    if res["status"] == "failed":
        res["error"] = "Page has almost no text (likely rendered with JavaScript or behind login)"
    return res


def fetch(target):
    target = target.strip()
    if not re.match(r"https?://", target):
        if re.fullmatch(r"[a-z0-9-]+", target):
            return fetch_leetcode(f"https://leetcode.com/problems/{target}/", target, "leetcode.com")
        return {**base_result(target, "unknown"), "error": "Not a URL"}
    u = urllib.parse.urlparse(target)
    host = u.netloc.lower().replace("www.", "")
    path = u.path
    if host in ("leetcode.com", "leetcode.cn"):
        m = re.search(r"/problems/([^/]+)", path)
        if m:
            return fetch_leetcode(target, m.group(1), host)
    if host.endswith("codeforces.com"):
        m = re.search(r"/(?:problemset/problem|contest)/(\d+)/(?:problem/)?([A-Za-z]\d?)", path)
        g = re.search(r"/gym/(\d+)/problem/([A-Za-z]\d?)", path)
        if m:
            return fetch_codeforces(target, m.group(1), m.group(2).upper())
        if g:
            return fetch_codeforces(target, g.group(1), g.group(2).upper(), gym=True)
    if host == "atcoder.jp":
        return fetch_atcoder(target)
    return fetch_generic(target)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="problem URL, or a LeetCode slug such as two-sum")
    ap.add_argument("-o", "--out", help="write JSON here instead of stdout")
    args = ap.parse_args()
    res = fetch(args.target)
    out = json.dumps(res, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out + "\n")
        print(f"{res['status']}: {res.get('title') or args.target} -> {args.out}", file=sys.stderr)
    else:
        print(out)
    sys.exit(0 if res["status"] in ("ok", "partial") else 2)


if __name__ == "__main__":
    main()
