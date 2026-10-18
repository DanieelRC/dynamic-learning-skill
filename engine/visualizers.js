/* ===========================================
   DYNAMIC LEARNING — visualizers
   DLViz.render(container, components, ui) draws a list of data-structure
   components and keeps their DOM between calls (keyed by `name`), so
   moving pointers, windows and highlights animate from frame to frame.

   Component types: array | string | map | set | stack | queue | linkedlist |
                    tree | heap | graph | grid | intervals | text
   Shared state fields (any subset):
     highlight | seen | ok | bad | dim : lists of indices / keys / ids / [r,c]
     classes: { key: 'hl'|'seen'|'ok'|'bad'|'dim'|'wall' }
     pointers: { label: index | id | null }
     label: panel caption (defaults to name)
   =========================================== */
(function () {
    'use strict';
    const { el, svg, esc } = window.DL;

    const keyOf = (k) => (Array.isArray(k) ? k.join(',') : String(k));
    const fmt = (v) => {
        if (v === null || v === undefined) return '·';
        if (typeof v === 'number' && !Number.isInteger(v)) return String(+v.toFixed(2));
        if (Array.isArray(v)) return '[' + v.map(fmt).join(',') + ']';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    };

    function classFor(c, key) {
        const k = keyOf(key);
        if (c.classes && c.classes[k]) return c.classes[k];
        const has = (list) => Array.isArray(list) && list.some((x) => keyOf(x) === k);
        if (has(c.ok)) return 'ok';
        if (has(c.bad)) return 'bad';
        if (has(c.highlight)) return 'hl';
        if (has(c.seen)) return 'seen';
        if (has(c.dim)) return 'dim';
        return '';
    }

    // Stable color per pointer label inside one panel
    function ptrColor(state, label) {
        state.ptrColors = state.ptrColors || {};
        if (!(label in state.ptrColors)) state.ptrColors[label] = Object.keys(state.ptrColors).length % 5;
        return 'c' + state.ptrColors[label];
    }

    function panelShell(c) {
        const panel = el('div.viz-panel');
        const label = el('div.viz-label');
        panel.appendChild(label);
        return { panel, label };
    }
    const setLabel = (shell, c) => { shell.label.textContent = c.label != null ? c.label : (c.name || ''); shell.label.style.display = shell.label.textContent ? '' : 'none'; };

    /* ---------------- array / string ---------------- */
    function ArrayPanel() {
        const shell = panelShell();
        const wrap = el('div.arr');
        const win = el('div.arr-window', { style: { opacity: 0 } });
        const cells = el('div.arr-cells');
        const ptrs = el('div.ptrs');
        wrap.append(win, cells, ptrs);
        shell.panel.appendChild(wrap);
        const st = { cells: [], ptrs: {}, values: [] };

        function update(c, width, ui, maxH) {
            setLabel(shell, c);
            const values = typeof c.values === 'string' ? c.values.split('') : (c.values || []);
            const n = values.length;
            const gap = 8;
            const size = Math.max(30, Math.min(c.cellSize || 92, Math.floor((width - gap * Math.max(n - 1, 0)) / Math.max(n, 1)), maxH ? maxH - 70 : 92));
            const maxLen = Math.max(1, ...values.map((v) => fmt(v).length));
            const fs = Math.max(12, Math.min(size * 0.42, (size * 1.5) / maxLen));
            cells.style.gap = gap + 'px';

            if (st.cells.length !== n) {
                cells.innerHTML = '';
                st.cells = values.map((v, i) => {
                    const cell = el('div.cell', {}, [el('span.idx', { text: i }), el('span.val')]);
                    cells.appendChild(cell);
                    return cell;
                });
                st.values = [];
            }
            values.forEach((v, i) => {
                const cell = st.cells[i];
                cell.style.width = cell.style.height = size + 'px';
                cell.style.fontSize = fs + 'px';
                const val = cell.querySelector('.val');
                const txt = fmt(v);
                if (val.textContent !== txt) {
                    val.textContent = txt;
                    if (st.values.length) { cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash'); }
                }
                cell.querySelector('.idx').style.display = c.showIndex === false ? 'none' : '';
                cell.className = 'cell ' + classFor(c, i) + (cell.classList.contains('flash') ? ' flash' : '');
            });
            st.values = values.map(fmt);

            const pitch = size + gap;
            if (Array.isArray(c.window) && c.window.length === 2 && c.window[0] != null) {
                const [l, r] = c.window;
                win.style.opacity = r >= l ? 1 : 0.5;
                win.style.left = (l * pitch - 6) + 'px';
                win.style.width = Math.max(0, (r - l + 1) * pitch - gap + 12) + 'px';
                win.style.height = (size + 20) + 'px';
            } else win.style.opacity = 0;

            const pointers = c.pointers || {};
            const stackAt = {};
            let maxStack = 0;
            Object.keys(pointers).forEach((label) => {
                let p = st.ptrs[label];
                if (!p) {
                    p = el('div.ptr', { text: label });
                    p.classList.add(ptrColor(st, label));
                    ptrs.appendChild(p);
                    st.ptrs[label] = p;
                }
                const idx = pointers[label];
                const valid = typeof idx === 'number' && idx >= 0 && idx <= n;
                const level = valid ? (stackAt[idx] = (stackAt[idx] || 0) + 1) - 1 : 0;
                maxStack = Math.max(maxStack, level + 1);
                p.style.opacity = valid ? 1 : 0;
                if (valid) p.style.transform = `translate(${idx * pitch + size / 2}px, ${level * 46}px) translateX(-50%)`;
            });
            Object.keys(st.ptrs).forEach((label) => { if (!(label in pointers)) st.ptrs[label].style.opacity = 0; });
            ptrs.style.height = (maxStack ? maxStack * 46 + 14 : 0) + 'px';
        }
        return { el: shell.panel, update };
    }

    /* ---------------- map / set ---------------- */
    function MapPanel() {
        const shell = panelShell();
        const box = el('div.map');
        shell.panel.appendChild(box);
        const st = { items: new Map() };

        function update(c, width, ui) {
            setLabel(shell, c);
            let entries;
            if (c.type === 'set') entries = (c.values || []).map((v) => [v, undefined]);
            else if (Array.isArray(c.entries)) entries = c.entries;
            else entries = Object.entries(c.entries || {});
            const seen = new Set();
            entries.forEach(([k, v]) => {
                const key = keyOf(k);
                seen.add(key);
                let item = st.items.get(key);
                if (!item) {
                    item = el('div.kv', {}, [el('span.k', { text: fmt(k) })]);
                    if (c.type !== 'set') item.appendChild(el('span.v'));
                    st.items.set(key, item);
                    box.appendChild(item);
                }
                const vEl = item.querySelector('.v');
                if (vEl) vEl.textContent = fmt(v);
                item.className = 'kv ' + classFor(c, k);
            });
            for (const [key, item] of st.items) if (!seen.has(key)) { item.remove(); st.items.delete(key); }
            let empty = box.querySelector('.empty');
            if (!entries.length && !empty) box.appendChild(el('span.empty', { text: c.type === 'set' ? '{ }' : '{ } ' + ui.empty }));
            if (entries.length && empty) empty.remove();
        }
        return { el: shell.panel, update };
    }

    /* ---------------- stack / queue ---------------- */
    function SeqPanel(kind) {
        const shell = panelShell();
        const box = el('div.seq' + (kind === 'stack' ? '.stack' : ''));
        shell.panel.appendChild(box);
        const start = el('span.end');
        const end = el('span.end');
        box.append(start, end);
        const st = { prev: [], els: [] };
        const common = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };

        // Only new items animate in; pops from either end keep the rest in place
        function update(c, width, ui) {
            setLabel(shell, c);
            const txt = (c.items || c.values || []).map(fmt);
            let drop = 0, keep = common(st.prev, txt);
            for (let d = 1; d <= Math.min(2, st.prev.length); d++) {
                const k = common(st.prev.slice(d), txt);
                if (k > keep) { keep = k; drop = d; }
            }
            st.els.splice(0, drop).forEach((n) => n.remove());
            st.els.splice(keep).forEach((n) => n.remove());
            for (let i = keep; i < txt.length; i++) {
                const item = el('div.item', { text: txt[i] });
                box.insertBefore(item, end);
                st.els.push(item);
            }
            st.els.forEach((n, i) => { n.className = 'item ' + classFor(c, i); });
            start.textContent = txt.length ? (kind === 'stack' ? ui.bottom : ui.front) : ui.empty;
            end.textContent = txt.length ? (kind === 'stack' ? '← ' + ui.top : ui.back) : '';
            st.prev = txt;
        }
        return { el: shell.panel, update };
    }

    /* ---------------- SVG helpers ---------------- */
    function SvgPanel() {
        const shell = panelShell();
        const s = svg('svg');
        const defs = svg('defs');
        ['', 'hl', 'seen', 'ok'].forEach((cls) => {
            const m = svg('marker', { id: 'arrow' + cls + Math.random().toString(36).slice(2, 7), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
            const color = { '': '#3b4766', hl: '#f5b83d', seen: '#5cc8ff', ok: '#4ade80' }[cls];
            m.appendChild(svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
            m.dataset.cls = cls;
            defs.appendChild(m);
        });
        const gEdges = svg('g');
        const gNodes = svg('g');
        const gLabels = svg('g');
        s.append(defs, gEdges, gNodes, gLabels);
        shell.panel.appendChild(s);
        const markers = {};
        defs.querySelectorAll('marker').forEach((m) => { markers[m.dataset.cls] = m.id; });
        const pools = { nodes: new Map(), edges: new Map(), labels: new Map() };

        function keyed(pool, parent, key, make) {
            let node = pools[pool].get(key);
            if (!node) { node = make(); parent.appendChild(node); pools[pool].set(key, node); }
            node.__used = true;
            return node;
        }
        function sweep() {
            for (const pool of Object.values(pools)) for (const [k, n] of pool) {
                if (!n.__used) { n.remove(); pool.delete(k); } else n.__used = false;
            }
        }
        return { shell, s, gEdges, gNodes, gLabels, keyed, sweep, markers };
    }

    function drawNode(P, id, x, y, text, cls, shape) {
        const g = P.keyed('nodes', P.gNodes, 'n:' + id, () => {
            const g = svg('g', { class: 'v-node' });
            g.appendChild(shape === 'rect' ? svg('rect', { x: -44, y: -32, width: 88, height: 64, rx: 14 }) : svg('circle', { r: 32 }));
            g.appendChild(svg('text'));
            return g;
        });
        g.setAttribute('class', 'v-node ' + (cls || ''));
        g.style.transform = `translate(${x}px, ${y}px)`;
        const t = g.querySelector('text');
        const txt = fmt(text);
        t.textContent = txt;
        t.style.fontSize = (txt.length > 3 ? Math.max(14, 24 - (txt.length - 3) * 3) : 24) + 'px';
        return g;
    }

    function drawPointers(P, c, pos, offsetY) {
        const pointers = c.pointers || {};
        const stack = {};
        const st = P.ptrState || (P.ptrState = {});
        Object.keys(pointers).forEach((label) => {
            const id = pointers[label];
            const p = pos[keyOf(id)];
            const t = P.keyed('labels', P.gLabels, 'p:' + label, () => svg('text', { class: 'v-ptr' }));
            t.setAttribute('class', 'v-ptr ' + ptrColor(st, label));
            t.textContent = label;
            if (!p) { t.style.opacity = 0; return; }
            const lvl = (stack[keyOf(id)] = (stack[keyOf(id)] || 0) + 1) - 1;
            t.style.opacity = 1;
            t.style.transform = `translate(${p[0]}px, ${p[1] + offsetY + lvl * 24}px)`;
        });
    }

    function drawNodeLabels(P, c, pos) {
        const labels = c.labels || {};
        Object.keys(labels).forEach((id) => {
            const p = pos[id];
            if (!p) return;
            const t = P.keyed('labels', P.gLabels, 'l:' + id, () => svg('text', { class: 'v-weight' }));
            t.textContent = fmt(labels[id]);
            t.setAttribute('x', p[0] + 44);
            t.setAttribute('y', p[1] - 30);
        });
    }

    function fitSvg(P, W, H, width, maxH) {
        P.s.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const scale = Math.min(1.5, width / W, maxH / H);
        P.s.style.width = (W * scale) + 'px';
        P.s.style.height = (H * scale) + 'px';
    }

    function edgeClass(c, a, b) {
        const ec = c.edgeClasses || {};
        return ec[a + '-' + b] || ec[b + '-' + a] || ec[a + '->' + b] || '';
    }

    /* ---------------- linked list ---------------- */
    function ListPanel() {
        const P = SvgPanel();
        function update(c, width, ui, maxH) {
            setLabel(P.shell, c);
            const nodes = (c.nodes || []).map((n, i) => (typeof n === 'object' ? n : { id: i, val: n }));
            const idx = {};
            nodes.forEach((n, i) => { idx[keyOf(n.id)] = i; });
            const step = 150;
            const W = Math.max(400, nodes.length * step + 80);
            const H = 230;
            const y = 80;
            const pos = {};
            nodes.forEach((n, i) => { pos[keyOf(n.id)] = [60 + i * step, y]; });
            nodes.forEach((n, i) => {
                const from = keyOf(n.id);
                let to = c.next ? c.next[from] : (i + 1 < nodes.length ? nodes[i + 1].id : null);
                const cls = edgeClass(c, from, to);
                const path = P.keyed('edges', P.gEdges, 'e:' + from, () => svg('path'));
                const [x1, y1] = pos[from];
                if (to === null || to === undefined || !(keyOf(to) in pos)) {
                    path.setAttribute('d', `M${x1 + 44},${y1} L${x1 + 84},${y1}`);
                    path.setAttribute('class', 'v-edge ' + cls);
                    path.setAttribute('marker-end', 'url(#' + P.markers[''] + ')');
                    const nul = P.keyed('labels', P.gLabels, 'null:' + from, () => svg('text', { class: 'v-null' }));
                    nul.textContent = 'null';
                    nul.setAttribute('x', x1 + 88); nul.setAttribute('y', y1);
                    if (i + 1 < nodes.length) { nul.textContent = '→ null'; nul.setAttribute('x', x1 - 34); nul.setAttribute('y', y1 - 50); path.setAttribute('d', ''); }
                    return;
                }
                const [x2] = pos[keyOf(to)];
                let d;
                if (idx[keyOf(to)] === i + 1) d = `M${x1 + 44},${y1} L${x2 - 46},${y1}`;
                else if (idx[keyOf(to)] === i - 1) d = `M${x1 - 44},${y1} L${x2 + 46},${y1}`;
                else {
                    const up = idx[keyOf(to)] > i;
                    d = `M${x1},${y1 + (up ? -32 : 32)} Q${(x1 + x2) / 2},${y1 + (up ? -110 : 110)} ${x2},${y1 + (up ? -34 : 34)}`;
                }
                path.setAttribute('d', d);
                path.setAttribute('class', 'v-edge ' + cls);
                path.setAttribute('marker-end', 'url(#' + P.markers[cls in P.markers ? cls : ''] + ')');
            });
            nodes.forEach((n) => { const p = pos[keyOf(n.id)]; drawNode(P, keyOf(n.id), p[0], p[1], n.val, classFor(c, n.id), 'rect'); });
            drawPointers(P, c, pos, 70);
            P.sweep();
            fitSvg(P, W, H, width, maxH);
        }
        return { el: P.shell.panel, update };
    }

    /* ---------------- tree / heap ---------------- */
    function TreePanel() {
        const P = SvgPanel();
        function update(c, width, ui, maxH) {
            setLabel(P.shell, c);
            let nodes = c.nodes || [];
            let comp = c;
            if (c.type === 'heap') {
                const vals = c.values || [];
                nodes = vals.map((v, i) => ({ id: i, val: v, left: 2 * i + 1 < vals.length ? 2 * i + 1 : null, right: 2 * i + 2 < vals.length ? 2 * i + 2 : null }));
            } else if (Array.isArray(c.level)) {
                // LeetCode-style level order: [3,9,20,null,null,15,7]
                const lv = c.level;
                const out = [];
                if (lv.length && lv[0] !== null) {
                    out.push({ id: 0, val: lv[0] });
                    const q = [out[0]];
                    let i = 1;
                    while (q.length && i < lv.length) {
                        const cur = q.shift();
                        for (const side of ['left', 'right']) {
                            if (i < lv.length && lv[i] !== null) { const n = { id: i, val: lv[i] }; out.push(n); cur[side] = i; q.push(n); }
                            i++;
                        }
                    }
                }
                nodes = out;
            }
            const byId = {};
            nodes.forEach((n) => { byId[keyOf(n.id)] = n; });
            const childIds = new Set();
            nodes.forEach((n) => [n.left, n.right, ...(n.children || [])].forEach((k) => k != null && childIds.add(keyOf(k))));
            const root = c.root != null ? keyOf(c.root) : (nodes.find((n) => !childIds.has(keyOf(n.id))) || {}).id;
            const nary = nodes.some((n) => Array.isArray(n.children));
            const pos = {};
            let col = 0;
            let depthMax = 0;
            const kids = (n) => (nary ? (n.children || []) : [n.left, n.right]).map((k) => (k == null ? null : byId[keyOf(k)]));

            // Binary: in-order slot; n-ary: leaves get slots, parents center on children
            function place(n, depth) {
                if (!n) return null;
                depthMax = Math.max(depthMax, depth);
                const ks = kids(n);
                if (nary) {
                    const xs = ks.map((k) => place(k, depth + 1)).filter((x) => x != null);
                    const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : col++;
                    pos[keyOf(n.id)] = [x, depth];
                    return x;
                }
                place(ks[0], depth + 1);
                const x = col++;
                pos[keyOf(n.id)] = [x, depth];
                place(ks[1], depth + 1);
                return x;
            }
            if (root != null && byId[keyOf(root)]) place(byId[keyOf(root)], 0);
            const slots = Math.max(col, 1);
            const dx = Math.max(64, Math.min(120, 1100 / slots));
            const dy = 104;
            const W = slots * dx + 80;
            const H = (depthMax + 1) * dy + 60;
            Object.keys(pos).forEach((k) => { pos[k] = [40 + dx / 2 + pos[k][0] * dx, 50 + pos[k][1] * dy]; });

            nodes.forEach((n) => {
                const a = keyOf(n.id);
                if (!pos[a]) return;
                kids(n).forEach((k) => {
                    if (!k || !pos[keyOf(k.id)]) return;
                    const b = keyOf(k.id);
                    const line = P.keyed('edges', P.gEdges, a + '>' + b, () => svg('line'));
                    line.setAttribute('x1', pos[a][0]); line.setAttribute('y1', pos[a][1]);
                    line.setAttribute('x2', pos[b][0]); line.setAttribute('y2', pos[b][1]);
                    line.setAttribute('class', 'v-edge ' + edgeClass(comp, a, b));
                });
            });
            nodes.forEach((n) => { const p = pos[keyOf(n.id)]; if (p) drawNode(P, keyOf(n.id), p[0], p[1], n.val, classFor(comp, n.id)); });
            drawNodeLabels(P, comp, pos);
            drawPointers(P, comp, pos, 58);
            P.sweep();
            fitSvg(P, W, H + 40, width, maxH);
        }
        return { el: P.shell.panel, update };
    }

    /* ---------------- graph ---------------- */
    function GraphPanel() {
        const P = SvgPanel();
        function update(c, width, ui, maxH) {
            setLabel(P.shell, c);
            const nodes = (c.nodes || []).map((n) => (typeof n === 'object' ? n : { id: n }));
            const W = c.width || 820;
            const H = c.height || 460;
            const pos = {};
            nodes.forEach((n, i) => {
                const auto = nodes.length > 1;
                const ang = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
                const x = n.x != null ? 50 + n.x * (W - 100) : (auto ? W / 2 + Math.cos(ang) * (W / 2 - 80) : W / 2);
                const y = n.y != null ? 50 + n.y * (H - 100) : (auto ? H / 2 + Math.sin(ang) * (H / 2 - 60) : H / 2);
                pos[keyOf(n.id)] = [x, y];
            });
            (c.edges || []).forEach((e) => {
                const [a, b, w] = Array.isArray(e) ? e : [e.from, e.to, e.w];
                const A = pos[keyOf(a)], B = pos[keyOf(b)];
                if (!A || !B) return;
                const cls = edgeClass(c, keyOf(a), keyOf(b));
                const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
                const ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len;
                const r = 34;
                const line = P.keyed('edges', P.gEdges, keyOf(a) + '>' + keyOf(b), () => svg('line'));
                line.setAttribute('x1', A[0] + ux * r); line.setAttribute('y1', A[1] + uy * r);
                line.setAttribute('x2', B[0] - ux * (r + (c.directed ? 4 : 0))); line.setAttribute('y2', B[1] - uy * (r + (c.directed ? 4 : 0)));
                line.setAttribute('class', 'v-edge ' + cls);
                if (c.directed) line.setAttribute('marker-end', 'url(#' + P.markers[cls in P.markers ? cls : ''] + ')');
                else line.removeAttribute('marker-end');
                if (w != null) {
                    const t = P.keyed('labels', P.gLabels, 'w:' + keyOf(a) + '>' + keyOf(b), () => svg('text', { class: 'v-weight' }));
                    t.textContent = fmt(w);
                    t.setAttribute('x', (A[0] + B[0]) / 2 - uy * 16); t.setAttribute('y', (A[1] + B[1]) / 2 + ux * 16);
                }
            });
            nodes.forEach((n) => { const p = pos[keyOf(n.id)]; drawNode(P, keyOf(n.id), p[0], p[1], n.label != null ? n.label : n.id, classFor(c, n.id)); });
            drawNodeLabels(P, c, pos);
            drawPointers(P, c, pos, 58);
            P.sweep();
            fitSvg(P, W, H + 30, width, maxH);
        }
        return { el: P.shell.panel, update };
    }

    /* ---------------- grid / dp table / matrix ---------------- */
    function GridPanel() {
        const shell = panelShell();
        const box = el('div.grid');
        shell.panel.appendChild(box);
        const st = { dims: '', cells: {} };

        function update(c, width, ui, maxH) {
            setLabel(shell, c);
            const rows = c.rows || c.values || [];
            const R = rows.length;
            const C = Math.max(0, ...rows.map((r) => (typeof r === 'string' ? r.length : r.length)));
            const hasRL = Array.isArray(c.rowLabels), hasCL = Array.isArray(c.colLabels);
            const cols = C + (hasRL ? 1 : 0), rws = R + (hasCL ? 1 : 0);
            const gap = 6;
            const size = Math.max(24, Math.min(c.cellSize || 78, Math.floor((width - gap * cols) / Math.max(cols, 1)), Math.floor((maxH - 40 - gap * rws) / Math.max(rws, 1))));
            const dims = [R, C, hasRL, hasCL].join('x');
            if (dims !== st.dims) {
                box.innerHTML = '';
                st.cells = {};
                box.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
                if (hasCL) {
                    if (hasRL) box.appendChild(el('div.gl'));
                    for (let j = 0; j < C; j++) box.appendChild(el('div.gl', { text: fmt(c.colLabels[j]) }));
                }
                for (let i = 0; i < R; i++) {
                    if (hasRL) box.appendChild(el('div.gl', { text: fmt(c.rowLabels[i]) }));
                    for (let j = 0; j < C; j++) { const g = el('div.g'); st.cells[i + ',' + j] = g; box.appendChild(g); }
                }
                st.dims = dims;
            }
            box.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
            box.querySelectorAll('.g, .gl').forEach((n) => { n.style.width = n.style.height = size + 'px'; });
            const maxLen = Math.max(1, ...rows.flatMap((r) => Array.from(r).map((v) => fmt(v).length)));
            const fs = Math.max(11, Math.min(size * 0.4, (size * 1.4) / maxLen));
            for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
                const g = st.cells[i + ',' + j];
                const v = rows[i][j];
                g.textContent = v === undefined ? '' : fmt(v);
                g.style.fontSize = fs + 'px';
                let cls = classFor(c, [i, j]);
                if (Array.isArray(c.current) && c.current[0] === i && c.current[1] === j) cls = 'hl';
                g.className = 'g ' + cls;
            }
            if (hasRL || hasCL) {
                const labels = box.querySelectorAll('.gl');
                labels.forEach((n) => { n.style.fontSize = Math.min(22, size * 0.4) + 'px'; });
            }
        }
        return { el: shell.panel, update };
    }

    /* ---------------- intervals ---------------- */
    function IntervalsPanel() {
        const shell = panelShell();
        const box = el('div.intervals');
        shell.panel.appendChild(box);
        function update(c, width) {
            setLabel(shell, c);
            const items = (c.items || []).map((it) => (Array.isArray(it) ? { s: it[0], e: it[1] } : it));
            const lo = c.min != null ? c.min : Math.min(0, ...items.map((i) => i.s));
            const hi = c.max != null ? c.max : Math.max(1, ...items.map((i) => i.e));
            const span = Math.max(1, hi - lo);
            const px = (v) => ((v - lo) / span) * (width - 20) + 10;
            const lanes = c.lanes === false ? 1 : items.length;
            const laneH = 50;
            box.innerHTML = '';
            box.style.height = (lanes * laneH + 40) + 'px';
            items.forEach((it, i) => {
                const lane = c.lanes === false ? 0 : i;
                box.appendChild(el('div.iv.' + (classFor(c, i) || 'x'), {
                    text: it.label != null ? it.label : `[${it.s},${it.e}]`,
                    style: { left: px(it.s) + 'px', width: Math.max(28, px(it.e) - px(it.s)) + 'px', top: (lane * laneH) + 'px' }
                }));
            });
            const axis = el('div.iv-axis');
            const stepV = Math.max(1, Math.ceil(span / 12));
            for (let v = Math.ceil(lo); v <= hi; v += stepV) axis.appendChild(el('span.iv-tick', { text: v, style: { left: px(v) + 'px' } }));
            box.appendChild(axis);
        }
        return { el: shell.panel, update };
    }

    /* ---------------- text ---------------- */
    function TextPanel() {
        const shell = panelShell();
        const box = el('div.vtext');
        shell.panel.appendChild(box);
        return { el: shell.panel, update(c) { setLabel(shell, c); box.innerHTML = window.DL.md(c.value != null ? String(c.value) : ''); } };
    }

    const FACTORY = {
        array: ArrayPanel, string: ArrayPanel, list: ArrayPanel, bits: ArrayPanel,
        map: MapPanel, dict: MapPanel, hashmap: MapPanel, set: MapPanel, counter: MapPanel,
        stack: () => SeqPanel('stack'), callstack: () => SeqPanel('stack'),
        queue: () => SeqPanel('queue'), deque: () => SeqPanel('queue'),
        linkedlist: ListPanel, tree: TreePanel, heap: TreePanel, trie: TreePanel,
        graph: GraphPanel, grid: GridPanel, matrix: GridPanel, dp: GridPanel, table: GridPanel,
        intervals: IntervalsPanel, text: TextPanel
    };

    // Compact panels (arrays, maps...) take what they need; drawings (tree, graph, grid, list) share the rest
    const FLEX = new Set(['linkedlist', 'tree', 'heap', 'trie', 'graph', 'grid', 'matrix', 'dp', 'table']);

    function render(container, components, ui) {
        const panels = container.__panels || (container.__panels = new Map());
        const cs = getComputedStyle(container);
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const width = Math.max(200, (container.clientWidth || 780) - padX);
        const totalH = Math.max(200, (container.clientHeight || 600) - padY);
        const gap = parseFloat(cs.rowGap) || 26;
        const list = (components || []).filter(Boolean);
        const used = new Set();
        const items = list.map((c, i) => {
            const type = String(c.type || 'array').toLowerCase();
            const key = (c.name || type + i) + '|' + type;
            used.add(key);
            let p = panels.get(key);
            if (!p) { p = (FACTORY[type] || TextPanel)(); panels.set(key, p); }
            if (container.children[i] !== p.el) container.insertBefore(p.el, container.children[i] || null);
            const comp = type === 'string' || type === 'bits' ? Object.assign({}, c, { values: c.values != null ? c.values : c.value }) : c;
            return { p, type, comp: Object.assign({ type }, comp) };
        });
        for (const [key, p] of panels) if (!used.has(key)) { p.el.remove(); panels.delete(key); }
        const run = (it, h) => { try { it.p.update(it.comp, width, ui, h); } catch (err) { console.error('[DLViz]', it.type, err); } };
        const flex = items.filter((it) => FLEX.has(it.type));
        items.filter((it) => !FLEX.has(it.type)).forEach((it) => run(it, totalH / items.length));
        const fixedH = items.filter((it) => !FLEX.has(it.type)).reduce((a, it) => a + it.p.el.offsetHeight, 0);
        const free = totalH - fixedH - gap * Math.max(0, items.length - 1);
        flex.forEach((it) => run(it, Math.max(140, free / flex.length - 52)));
    }

    window.DLViz = { render, types: Object.keys(FACTORY) };
})();
