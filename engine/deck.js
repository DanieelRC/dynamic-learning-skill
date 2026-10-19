/* ===========================================
   DYNAMIC LEARNING — deck runtime
   Reads the JSON spec embedded in <script id="deck-spec"> and renders
   every slide. Slides may expose a "stepper" (trace frames, code notes,
   hints, quiz answer); arrow keys walk the steps before changing slide.

   URL flags:  ?autoplay=1  plays the whole deck by itself (used for video)
               &speed=1.25   playback speed multiplier
               #5            open at slide 5
   Slide controller adapted from frontend-slides by Zara Zhang (MIT).
   =========================================== */
(function () {
    'use strict';
    const { el, md, mono, codeBlock, uiFor } = window.DL;
    const foldText = (a, b, label) => `⋯ L${a}–${b}` + (label ? ' · ' + label : '');

    const SPEC = JSON.parse(document.getElementById('deck-spec').textContent);
    const UI = uiFor(SPEC.lang, SPEC.ui);
    const META = SPEC.meta || {};
    const PROBLEM = META.problem || {};
    const params = new URLSearchParams(location.search);
    const AUTOPLAY = params.get('autoplay') === '1';
    const SPEED = Math.max(0.25, parseFloat(params.get('speed') || '1') || 1);

    const readMs = (text, min) => Math.max(min || 2200, Math.min(12000, 1400 + String(text || '').length * 42)) / SPEED;
    // Height the slide content needs, from layout offsets: unaffected by entrance-animation transforms.
    // Call it with zoom cleared (zoom distorts offsets).
    const contentNeed = (inner) => Math.max(0, ...Array.from(inner.children).map((k) => k.offsetTop + k.offsetHeight));
    const unzoom = (inner) => Array.from(inner.children).forEach((k) => { k.style.zoom = ''; });

    const diffClass = (d) => String(d || '').toLowerCase().replace(/[^a-z]/g, '');

    /* ---------- slide frame ---------- */
    function frame(slide, cls, defaultEyebrow) {
        const section = el('section.slide' + (cls ? '.' + cls : ''));
        const inner = el('div.slide-inner');
        const eyebrow = slide.eyebrow != null ? slide.eyebrow : defaultEyebrow;
        if (eyebrow) inner.appendChild(el('div.eyebrow.reveal', { html: md(eyebrow) }));
        if (slide.title && cls !== 'title-slide') inner.appendChild(el('h2.reveal', { html: md(slide.title) }));
        section.appendChild(inner);
        const footer = el('div.slide-footer', {}, [
            el('span', { text: [PROBLEM.id, PROBLEM.title].filter(Boolean).join('. ') + (META.approach ? ' · ' + META.approach : '') }),
            el('div.bar', {}, [el('i')]),
            el('span.count')
        ]);
        section.appendChild(footer);
        return { section, inner };
    }

    const listEl = (items, numbered) => el('ul.list.reveal' + (numbered ? '.numbered' : ''), {},
        (items || []).map((t) => el('li', { html: md(t) })));

    function calloutEl(c) {
        if (!c) return null;
        const o = typeof c === 'string' ? { text: c } : c;
        return el('div.card.callout.reveal.' + (o.tone || 'accent'), {}, [
            el('span.icon', { text: o.icon || '💡' }),
            el('div', { html: md(o.text) })
        ]);
    }

    /* ---------- renderers: each returns { section, stepper? } ---------- */
    const R = {};

    R.title = (s) => {
        const { section, inner } = frame(s, 'title-slide', s.eyebrow || PROBLEM.platform);
        const num = s.number || PROBLEM.id;
        if (num) inner.appendChild(el('div.problem-no.reveal', { text: '#' + num }));
        inner.appendChild(el('h1.reveal', { html: md(s.title || PROBLEM.title) }));
        if (s.approach || META.approach) inner.appendChild(el('div.approach.reveal', { html: md(s.approach || META.approach) }));
        if (s.subtitle) inner.appendChild(el('p.lead.reveal', { html: md(s.subtitle) }));
        const badges = s.badges || [PROBLEM.difficulty].concat(PROBLEM.tags || []).filter(Boolean);
        inner.appendChild(el('div.badges.reveal', {}, badges.map((b) => el('span.badge.' + (diffClass(b) || 'x'), { text: b }))));
        return { section };
    };

    R.statement = (s) => {
        const { section, inner } = frame(s, '', UI.sec_statement);
        if (s.body) inner.appendChild(el('p.lead.reveal', { html: md(s.body) }));
        const cols = [];
        if (s.points) cols.push(listEl(s.points));
        if (s.signature) cols.push(el('div.reveal', {}, [codeBlock(s.signature, s.language || META.language, { width: 820, height: 300, max: 28 })]));
        if (cols.length) inner.appendChild(cols.length > 1 ? el('div.grid-2', {}, cols) : cols[0]);
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };

    R.examples = (s) => {
        const { section, inner } = frame(s, '', UI.sec_examples);
        const exs = s.examples || [];
        const long = exs.some((e) => String(e.input || '').length > 26 || String(e.output || '').length > 26);
        const wrap = el('div.examples' + (exs.length > 1 && !s.stacked && !long ? '.grid-' + Math.min(exs.length, 2) : ''));
        exs.forEach((e, i) => {
            wrap.appendChild(el('div.card.example.reveal', {}, [
                el('span.k', { text: UI.input }), el('span.v', { html: mono(e.input) }),
                el('span.k', { text: UI.output }), el('span.v.out', { html: mono(e.output) }),
                e.explanation ? el('div.why', { html: md(e.explanation) }) : null
            ]));
        });
        inner.appendChild(wrap);
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };

    function opsEl(ops) {
        if (!ops || !ops.length) return null;
        const max = Math.max(...ops.map((o) => o.value), 1e9);
        const logw = (v) => (Math.log10(Math.max(1, v)) / Math.log10(max)) * 100;
        const wrap = el('div.ops.card.reveal');
        ops.forEach((o) => {
            const fill = el('div.fill');
            const track = el('div.track', {}, [fill, el('span.limit', { style: { left: logw(1e8) + '%' } })]);
            const row = el('div.op-row.' + (o.value > 1e8 ? 'over' : 'fits'), {}, [
                el('span', { html: md(o.label) }), track,
                el('span.val', { html: o.note ? md(o.note) : mono('≈ 10^' + Math.round(Math.log10(Math.max(1, o.value))) + ' ' + UI.ops) })
            ]);
            fill.dataset.w = logw(o.value) + '%';
            wrap.appendChild(row);
        });
        wrap.appendChild(el('div.limit-label', { html: mono('│ ' + UI.limit) }));
        return wrap;
    }

    R.constraints = (s) => {
        const { section, inner } = frame(s, '', UI.sec_constraints);
        const list = el('div.constraints');
        (s.items || []).forEach((it) => {
            const o = typeof it === 'string' ? { rule: it } : it;
            list.appendChild(el('div.card.constraint.reveal', {}, [
                el('span.rule', { html: mono(o.rule) }),
                o.insight ? el('span.insight', { html: md(o.insight) }) : el('span')
            ]));
        });
        inner.appendChild(list);
        const ops = opsEl(s.ops);
        if (ops) inner.appendChild(ops);
        if (s.takeaway) inner.appendChild(calloutEl({ icon: '🎯', text: s.takeaway }));
        return { section };
    };

    R.bullets = (s) => {
        const { section, inner } = frame(s, '', UI.sec_bullets);
        if (s.lead) inner.appendChild(el('p.lead.reveal', { html: md(s.lead) }));
        const left = s.items ? listEl(s.items, s.numbered) : null;
        let right = null;
        if (s.code) right = el('div.reveal', {}, [codeBlock(s.code, s.language || META.language, { width: 800, height: 560, max: 28 })]);
        else if (s.aside) right = calloutEl(s.aside);
        if (left && right) inner.appendChild(el('div.grid-2', {}, [left, right]));
        else if (left || right) inner.appendChild(left || right);
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };
    R.intuition = R.idea = R.pattern = R.interview = R.bullets;

    R.diagram = (s) => {
        const { section, inner } = frame(s, '', UI.sec_diagram);
        const viz = el('div.viz.card');
        const side = el('div.side', {}, [
            s.lead ? el('p.lead.reveal', { html: md(s.lead) }) : null,
            s.caption ? calloutEl({ icon: '👀', text: s.caption, tone: 'info' }) : null
        ]);
        inner.appendChild(el('div.diagram-body.reveal' + (s.lead || s.caption ? '' : '.wide'), {}, [s.lead || s.caption ? side : null, viz]));
        return { section, onEnter: () => window.DLViz.render(viz, s.viz, UI) };
    };

    /* ----- code with annotation stepper ----- */
    R.code = (s) => {
        const { section, inner } = frame(s, '', UI.sec_code);
        const notes = s.notes || [];
        const code = codeBlock(s.source, s.language || META.language, { width: notes.length ? 1010 : 1696, height: 700, max: 30 }, { lines: s.lines, folds: s.folds, foldText });
        let body = code;
        if (s.spoiler) {
            const sp = el('div.spoiler', {}, [el('div.spoiler-body', {}, [code])]);
            const btn = el('button.btn', { text: UI.showSolution, on: { click: (e) => { e.stopPropagation(); stepper.set(1); } } });
            sp.appendChild(el('div.spoiler-cover', {}, [btn]));
            body = sp;
        }
        const noteEls = notes.map((n) => {
            const lines = [].concat(n.lines || []);
            return el('div.note', {}, [
                el('span.lines', { text: lines.length ? 'L' + lines.join('–') : '' }),
                el('span', { html: md(n.text) })
            ]);
        });
        const notesEl = el('div.notes', {}, noteEls);
        inner.appendChild(notes.length
            ? el('div.walk.reveal', {}, [body, notesEl])
            : el('div.reveal', { style: { flex: '1', minHeight: '0' } }, [body]));

        // Notes must always fit: shrink the text, then collapse inactive notes, and keep the active one in view
        const over = () => notesEl.scrollHeight > notesEl.clientHeight + 1;
        function fitNotes(k) {
            if (!notes.length || !notesEl.clientHeight) return;
            notesEl.classList.remove('compact');
            let fs = 27;
            notesEl.style.setProperty('--note-fs', fs + 'px');
            while (over() && fs > 21) notesEl.style.setProperty('--note-fs', --fs + 'px');
            const compact = over();
            notesEl.classList.toggle('compact', compact);
            section.dataset.autofitNotes = compact ? 'notes compacted to one line each (too much note text)' : (fs < 27 ? 'notes shrunk to ' + fs + 'px' : '');
            const a = noteEls[k];
            if (!a) { notesEl.scrollTop = 0; return; }
            if (a.offsetTop + a.offsetHeight > notesEl.scrollTop + notesEl.clientHeight) notesEl.scrollTop = a.offsetTop + a.offsetHeight - notesEl.clientHeight;
            if (a.offsetTop < notesEl.scrollTop) notesEl.scrollTop = a.offsetTop;
        }

        const offset = s.spoiler ? 1 : 0;
        const stepper = {
            steps: 1 + offset + notes.length,
            at: 0,
            set(i) {
                this.at = i;
                if (s.spoiler) body.classList.toggle('open', i >= 1);
                const k = i - offset - 1;
                code.classList.toggle('focus', k >= 0);
                code.lines.forEach((ln) => ln.classList.remove('active'));
                noteEls.forEach((n, j) => n.classList.toggle('active', j === k));
                fitNotes(k);
                if (k >= 0) {
                    const ls = [].concat(notes[k].lines || []);
                    const [a, b] = [ls[0], ls[ls.length - 1] || ls[0]];
                    for (let l = a; l <= b; l++) code.lines[l - 1] && code.lines[l - 1].classList.add('active');
                }
            },
            dwell(i) { return i === 0 ? readMs(s.source, 3500) * 0.6 : readMs((notes[i - offset - 1] || {}).text, 2600); }
        };
        return { section, stepper: stepper.steps > 1 ? stepper : null, onEnter: () => { code.fit(); fitNotes(stepper.at - offset - 1); } };
    };

    /* ----- trace: code + animated diagram, synced line by line ----- */
    R.trace = (s) => {
        const section = el('section.slide.trace-slide');
        const inner = el('div.slide-inner');
        section.appendChild(inner);
        const head = el('div.trace-head', {}, [
            el('div', {}, [
                el('div.eyebrow', {}, [
                    el('span', { html: md(s.eyebrow != null ? s.eyebrow : UI.sec_trace) }),
                    s.part ? el('span.part', { text: ` · ${UI.part} ${s.part}/${s.parts || s.part}` + (s.partLabel ? ' · ' + s.partLabel : '') }) : null
                ]),
                el('h2', { html: md(s.title || '') })
            ])
        ]);
        const counter = el('span.count');
        const playBtn = el('button', { text: '▶', attrs: { title: UI.play } });
        const stepperUi = el('div.stepper', {}, [
            el('button', { text: '⏮', on: { click: () => stepper.set(0) } }),
            el('button', { text: '◀', on: { click: () => stepper.set(Math.max(0, stepper.at - 1)) } }),
            playBtn,
            el('button', { text: '▶|', on: { click: () => stepper.set(Math.min(stepper.steps - 1, stepper.at + 1)) } }),
            el('button', { text: '⏭', on: { click: () => stepper.set(stepper.steps - 1) } }),
            counter
        ]);
        head.appendChild(stepperUi);
        inner.appendChild(head);

        const code = codeBlock(s.source, s.language || META.language, { width: 820, height: 640, max: 28 }, { lines: s.lines, folds: s.folds, foldText });
        code.classList.add('focus');
        const viz = el('div.viz');
        const vizPane = el('div.viz-pane', {}, [viz]);
        const note = el('div.note-text');
        const vars = el('div.vars');
        const narration = el('div.narration', {}, [note, vars]);
        inner.appendChild(el('div.trace', {}, [code, vizPane, narration]));

        // Frames inherit components (by name) from the previous frame unless reset
        const frames = [];
        let carry = [];
        let carryVars = {};
        (s.frames || []).forEach((f) => {
            let comps = f.reset ? [] : carry.slice();
            (f.viz || []).forEach((c) => {
                const key = (c.name || c.type) + '|' + (c.type || 'array');
                const i = comps.findIndex((x) => ((x.name || x.type) + '|' + (x.type || 'array')) === key);
                if (c.remove) { if (i >= 0) comps.splice(i, 1); return; }
                if (i >= 0) comps[i] = c; else comps.push(c);
            });
            const v = f.resetVars ? Object.assign({}, f.vars) : Object.assign({}, carryVars, f.vars || {});
            frames.push({ line: f.line, note: f.note, viz: comps, vars: v });
            carry = comps;
            carryVars = v;
        });

        let timer = null;
        const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = '▶'; };
        playBtn.addEventListener('click', () => {
            if (timer) return stop();
            if (stepper.at >= stepper.steps - 1) stepper.set(0);
            playBtn.textContent = '❚❚';
            timer = setInterval(() => { if (stepper.at >= stepper.steps - 1) stop(); else stepper.set(stepper.at + 1); }, 1700 / SPEED);
        });

        let prevVars = {};
        let prevLines = [];
        const stepper = {
            steps: Math.max(1, frames.length),
            at: 0,
            set(i) {
                this.at = i;
                const f = frames[i] || { viz: [], vars: {} };
                const lines = [].concat(f.line || []);
                code.lines.forEach((ln) => ln.classList.remove('active', 'prev'));
                prevLines.forEach((l) => code.lines[l - 1] && code.lines[l - 1].classList.add('prev'));
                lines.forEach((l) => code.lines[l - 1] && code.lines[l - 1].classList.add('active'));
                const first = code.lines[(lines[0] || 1) - 1];
                if (first) {
                    const top = first.offsetTop - code.clientHeight / 2 + first.offsetHeight;
                    code.scrollTo ? code.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }) : (code.scrollTop = top);
                }
                prevLines = lines;
                note.innerHTML = md(f.note || '');
                note.classList.remove('flash'); void note.offsetWidth; note.classList.add('flash');
                vars.innerHTML = '';
                Object.keys(f.vars || {}).forEach((k) => {
                    const val = typeof f.vars[k] === 'object' ? JSON.stringify(f.vars[k]) : String(f.vars[k]);
                    const changed = i > 0 && prevVars[k] !== val;
                    vars.appendChild(el('span.var' + (changed ? '.changed' : ''), {}, [el('b', { text: k }), document.createTextNode(val)]));
                });
                prevVars = {};
                Object.keys(f.vars || {}).forEach((k) => { prevVars[k] = typeof f.vars[k] === 'object' ? JSON.stringify(f.vars[k]) : String(f.vars[k]); });
                window.DLViz.render(viz, f.viz, UI);
                counter.textContent = `${UI.step} ${i + 1} ${UI.of} ${this.steps}`;
            },
            dwell(i) { return readMs((frames[i] || {}).note, 1900); },
            leave: stop
        };
        return { section, stepper, onEnter: () => code.fit() };
    };

    R.complexity = (s) => {
        const { section, inner } = frame(s, '', UI.sec_complexity);
        inner.appendChild(el('div.big-o', {}, [
            el('div.card.accent.reveal', {}, [el('span.label', { text: UI.time }), el('span.value', { html: mono(s.time) }), s.timeWhy ? el('span', { html: md(s.timeWhy) }) : null]),
            el('div.card.info.reveal', {}, [el('span.label', { text: UI.space }), el('span.value', { html: mono(s.space) }), s.spaceWhy ? el('span', { html: md(s.spaceWhy) }) : null])
        ]));
        const ops = opsEl(s.ops);
        if (ops) inner.appendChild(ops);
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };

    R.compare = (s) => {
        const { section, inner } = frame(s, '', UI.sec_compare);
        const head = el('tr', {}, [UI.approach, UI.time, UI.space, UI.note].map((h) => el('th', { text: h })));
        const rows = (s.rows || []).map((r) => el('tr' + (r.current ? '.current' : ''), {}, [
            el('td', { html: md(r.approach) }), el('td.mono', { html: mono(r.time) }), el('td.mono', { html: mono(r.space) }), el('td', { html: md(r.note || '') })
        ]));
        inner.appendChild(el('table.table.reveal', {}, [el('thead', {}, [head]), el('tbody', {}, rows)]));
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };

    R.quiz = (s) => {
        const { section, inner } = frame(s, '', UI.sec_quiz);
        if (s.question) inner.appendChild(el('p.lead.reveal', { html: md(s.question), style: { color: 'var(--ink)' } }));
        const quiz = el('div.quiz.reveal');
        const opts = (s.options || []).map((o, i) => {
            const b = el('button.opt', { on: { click: (e) => { e.stopPropagation(); if (!quiz.classList.contains('answered')) { b.classList.add('picked'); stepper.set(1); } } } }, [
                el('span.letter', { text: String.fromCharCode(65 + i) }), el('span', { html: md(o) })
            ]);
            if (i === s.answer) b.classList.add('correct');
            quiz.appendChild(b);
            return b;
        });
        const verdict = el('strong');
        const explain = el('div.explain.card.ok', {}, [verdict, el('span', { html: ' ' + md(s.explanation || '') })]);
        quiz.appendChild(explain);
        inner.appendChild(quiz);
        const stepper = {
            steps: 2, at: 0,
            set(i) {
                this.at = i;
                quiz.classList.toggle('answered', i === 1);
                if (i === 0) opts.forEach((b) => b.classList.remove('picked'));
                const picked = opts.find((b) => b.classList.contains('picked'));
                verdict.textContent = !picked || picked.classList.contains('correct') ? UI.correct : UI.wrong;
                explain.className = 'explain card ' + (!picked || picked.classList.contains('correct') ? 'ok' : 'bad');
            },
            dwell(i) { return i === 0 ? readMs(s.question + (s.options || []).join(' '), 4000) : readMs(s.explanation, 3000); }
        };
        return { section, stepper };
    };

    R.hints = (s) => {
        const { section, inner } = frame(s, '', UI.sec_hints);
        if (s.intro) inner.appendChild(el('p.lead.reveal', { html: md(s.intro) }));
        const list = el('div.hints');
        const hints = (s.hints || []).map((h, i) => {
            const o = typeof h === 'string' ? { body: h } : h;
            const btn = el('button.btn.ghost', { text: UI.revealHint + ' ' + (i + 1), on: { click: (e) => { e.stopPropagation(); stepper.set(Math.max(stepper.at, i + 1)); } } });
            const node = el('div.hint.reveal', {}, [
                el('span.n', { text: UI.hint + ' ' + (i + 1) }),
                el('div.body', {}, [
                    el('div.locked', {}, [btn]),
                    el('div.content', {}, [o.title ? el('span.title', { html: md(o.title) }) : null, el('span', { html: md(o.body) })])
                ])
            ]);
            list.appendChild(node);
            return { node, text: (o.title || '') + ' ' + o.body };
        });
        inner.appendChild(list);
        const stepper = {
            steps: hints.length + 1, at: 0,
            set(i) {
                this.at = i;
                hints.forEach((h, j) => { h.node.classList.toggle('open', j < i); h.node.classList.toggle('latest', j === i - 1); });
                // Too much text: earlier hints collapse to one line, the newest stays complete
                list.classList.remove('compact');
                const inner = section.querySelector('.slide-inner');
                unzoom(inner);
                const compact = contentNeed(inner) > inner.clientHeight + 2;
                list.classList.toggle('compact', compact);
                section.dataset.autofitNotes = compact ? 'earlier hints collapsed to one line (too much hint text)' : '';
            },
            dwell(i) { return i === 0 ? 2500 / SPEED : readMs(hints[i - 1].text, 3500); }
        };
        return { section, stepper };
    };

    R.checkpoint = (s) => {
        const { section, inner } = frame(s, '', UI.sec_checkpoint);
        if (s.body) inner.appendChild(el('p.lead.reveal', { html: md(s.body) }));
        if (s.checklist) {
            inner.appendChild(el('ul.checklist.reveal', {}, s.checklist.map((t) => {
                const li = el('li', { on: { click: () => li.classList.toggle('done') } }, [el('span.box'), el('span', { html: md(t) })]);
                return li;
            })));
        }
        if (s.links) inner.appendChild(el('div.links.reveal', {}, s.links.map((l, i) =>
            el('a.btn' + (i ? '.ghost' : ''), { text: l.label, attrs: { href: l.href } }))));
        if (s.callout) inner.appendChild(calloutEl(s.callout));
        return { section };
    };
    R.next = (s) => R.checkpoint(Object.assign({ eyebrow: UI.sec_next }, s));

    R.related = (s) => {
        const { section, inner } = frame(s, '', UI.sec_related);
        inner.appendChild(el('div.related', {}, (s.items || []).map((it) => {
            const card = el('div.card.reveal', {}, [
                el('div.badges', {}, [it.difficulty ? el('span.badge.' + diffClass(it.difficulty), { text: it.difficulty }) : null, it.pattern ? el('span.badge', { text: it.pattern }) : null]),
                el('span.t', { html: md(it.title) }),
                it.why ? el('span.w', { html: md(it.why) }) : null
            ]);
            return it.url ? el('a', { attrs: { href: it.url, target: '_blank', rel: 'noopener' } }, [card]) : card;
        })));
        return { section };
    };

    R.summary = (s) => {
        const { section, inner } = frame(s, '', UI.sec_summary);
        if (s.items) inner.appendChild(listEl(s.items, true));
        if (s.takeaway) inner.appendChild(calloutEl({ icon: '🧠', text: s.takeaway }));
        if (s.links) inner.appendChild(el('div.links.reveal', {}, s.links.map((l, i) => el('a.btn' + (i ? '.ghost' : ''), { text: l.label, attrs: { href: l.href } }))));
        return { section };
    };

    /* ---------- deck controller ---------- */
    class Deck {
        constructor() {
            this.stage = document.getElementById('deckStage');
            this.slides = (SPEC.slides || []).map((s) => {
                const r = (R[s.type] || R.bullets)(s);
                r.spec = s;
                this.stage.appendChild(r.section);
                return r;
            });
            this.total = this.slides.length;
            this.slides.forEach((r, i) => {
                const c = r.section.querySelector('.slide-footer .count');
                if (c) c.textContent = `${i + 1} / ${this.total}`;
                const bar = r.section.querySelector('.slide-footer .bar > i');
                if (bar) bar.style.width = ((i + 1) / this.total * 100) + '%';
            });
            this.current = -1;
            this.scale();
            window.addEventListener('resize', () => this.scale());
            this.bind();
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.refit());
            // Buttons inside slides (reveal hint, show solution, quiz) change content: refit right after
            this.stage.addEventListener('click', () => requestAnimationFrame(() => this.fit(this.slides[this.current])), true);
            const start = parseInt((location.hash || '').slice(1), 10);
            this.go(Number.isFinite(start) ? start - 1 : 0, 1);
            if (AUTOPLAY) { document.body.classList.add('autoplay'); this.autoplay(); }
        }

        scale() {
            const f = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
            const x = (window.innerWidth - 1920 * f) / 2;
            const y = (window.innerHeight - 1080 * f) / 2;
            this.stage.style.transform = `translate(${x}px, ${y}px) scale(${f})`;
        }

        go(index, dir) {
            const i = Math.max(0, Math.min(this.total - 1, index));
            const old = this.slides[this.current];
            if (old && old.stepper && old.stepper.leave) old.stepper.leave();
            this.slides.forEach((r, j) => r.section.classList.toggle('active', j === i));
            this.current = i;
            const r = this.slides[i];
            r.section.querySelectorAll('.op-row .fill').forEach((f) => { f.style.width = '0'; setTimeout(() => { f.style.width = f.dataset.w; }, 60); });
            const inner = r.section.querySelector('.slide-inner');
            if (inner) unzoom(inner);
            if (r.onEnter) r.onEnter();
            if (r.stepper) r.stepper.set(dir < 0 ? r.stepper.steps - 1 : 0);
            this.fit(r);
            if (!AUTOPLAY) history.replaceState(null, '', '#' + (i + 1));
        }

        // Last line of defense against overflow: scale the slide's content blocks down (min 70%).
        // It sets data-autofit so snapshot.cjs can report it and the text gets shortened at the source.
        fit(r) {
            const inner = r.section.querySelector('.slide-inner');
            if (!inner) return;
            unzoom(inner);
            const kids = Array.from(inner.children);
            const need = contentNeed(inner);
            const avail = inner.clientHeight;
            let z = 1;
            // Under zoom, offsets come back in the zoomed elements' own units: visual height = offsets × z
            while (z > 0.7 && (z === 1 ? need : contentNeed(inner) * z) > avail + 2) {
                z = Math.round((z - 0.05) * 100) / 100;
                kids.forEach((k) => { k.style.zoom = z; });
            }
            if (z === 0.7 && contentNeed(inner) * z <= avail + 2) z = 0.7001;
            r.section.dataset.autofitZoom = z < 1 ? 'content scaled to ' + Math.round(z * 100) + '%' + (z === 0.7 ? ' and STILL overflowing' : '') : '';
        }

        refit() {
            const r = this.slides[this.current];
            if (r.onEnter) r.onEnter();
            this.fit(r);
        }

        next() {
            const r = this.slides[this.current];
            if (r.stepper && r.stepper.at < r.stepper.steps - 1) { r.stepper.set(r.stepper.at + 1); return this.fit(r); }
            if (this.current < this.total - 1) this.go(this.current + 1, 1);
        }

        prev() {
            const r = this.slides[this.current];
            if (r.stepper && r.stepper.at > 0) { r.stepper.set(r.stepper.at - 1); return this.fit(r); }
            if (this.current > 0) this.go(this.current - 1, -1);
        }

        bind() {
            document.addEventListener('keydown', (e) => {
                if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
                const k = e.key;
                if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); this.next(); }
                else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); this.prev(); }
                else if (k === 'Home') this.go(0, 1);
                else if (k === 'End') this.go(this.total - 1, 1);
                else if (k === 'f' || k === 'F') this.fullscreen();
                else if (k === 'p' || k === 'P') { const b = this.slides[this.current].section.querySelector('.stepper button:nth-child(3)'); if (b) b.click(); }
            });
            let x0 = null;
            document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
            document.addEventListener('touchend', (e) => {
                if (x0 == null) return;
                const dx = e.changedTouches[0].clientX - x0;
                if (Math.abs(dx) > 50) (dx < 0 ? this.next() : this.prev());
                x0 = null;
            });
            const controls = el('nav.deck-controls', { attrs: { 'aria-label': 'Deck controls' } }, [
                el('button', { text: '←', attrs: { title: UI.prev }, on: { click: () => this.prev() } }),
                el('button', { text: '→', attrs: { title: UI.next }, on: { click: () => this.next() } }),
                el('button', { text: '⛶', attrs: { title: UI.fullscreen }, on: { click: () => this.fullscreen() } }),
                el('button', { text: '▶ ' + UI.autoplay, on: { click: () => { location.search = '?autoplay=1'; } } })
            ]);
            document.body.appendChild(controls);
        }

        fullscreen() {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
            else document.exitFullscreen && document.exitFullscreen();
        }

        async autoplay() {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            await wait(900);
            for (let i = 0; i < this.total; i++) {
                this.go(i, 1);
                const r = this.slides[i];
                if (r.stepper) {
                    for (let s = 0; s < r.stepper.steps; s++) { r.stepper.set(s); this.fit(r); await wait(r.stepper.dwell(s)); }
                } else {
                    await wait(readMs(r.section.querySelector('.slide-inner').textContent, 3200));
                }
            }
            await wait(800);
            window.__DECK_DONE__ = true;
        }
    }

    window.DLDeck = new Deck();
})();
