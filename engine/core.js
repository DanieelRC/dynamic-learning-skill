/* ===========================================
   DYNAMIC LEARNING — core helpers
   Shared by visualizers.js and deck.js. No dependencies.
   =========================================== */
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Superscripts for prose like 10^4, n^2, 2^31 (only when glued, so `a ^ b` survives)
    const sup = (html) => html.replace(/([\w)\]])\^(-?[\w.]+)/g, '$1<sup>$2</sup>');

    /* Tiny inline markdown: `code`, **bold**, *em*, ==mark==, [text](url), x^y, \n */
    function md(s) {
        if (s == null) return '';
        const codes = [];
        let out = String(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
        out = esc(out)
            .replace(/\[([^\]]+)\]\((https?:[^)\s]+|[\w./#-]+\.html[^)\s]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/==(.+?)==/g, '<mark>$1</mark>')
            .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
        out = sup(out).replace(/\n/g, '<br>');
        return out.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + esc(codes[+i]) + '</code>');
    }

    // Monospace text with superscripts (constraints, examples)
    const mono = (s) => sup(esc(s));

    /* el('div.card.accent', {html, text, attrs, on}, children) */
    function el(spec, opts, children) {
        const [tag, ...classes] = spec.split('.');
        const node = document.createElement(tag || 'div');
        if (classes.length) node.className = classes.join(' ');
        if (opts) {
            if (opts.html != null) node.innerHTML = opts.html;
            if (opts.text != null) node.textContent = opts.text;
            if (opts.attrs) for (const k in opts.attrs) node.setAttribute(k, opts.attrs[k]);
            if (opts.style) Object.assign(node.style, opts.style);
            if (opts.on) for (const k in opts.on) node.addEventListener(k, opts.on[k]);
        }
        (children || []).forEach((c) => c && node.appendChild(c));
        return node;
    }

    const SVGNS = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs) {
        const node = document.createElementNS(SVGNS, tag);
        if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
        return node;
    }

    /* ---------- Syntax highlighting (per line, language-agnostic) ---------- */
    const KEYWORDS = new Set((
        'def return if elif else for while in not and or is None True False class import from as with try except ' +
        'finally raise lambda yield pass break continue global nonlocal self function const let var new this null ' +
        'undefined typeof instanceof of async await switch case default do throw throws catch public private protected ' +
        'static final void int long double float char boolean bool byte short unsigned signed String string auto struct ' +
        'template typename extends implements interface package namespace using nullptr include func type map chan go ' +
        'defer range nil fn mut impl pub use mod match loop where ref fun val when guard Some Ok Err ' +
        'true false enum record override virtual inline constexpr elseif end begin then local'
    ).split(' '));
    const BUILTINS = new Set((
        'len print enumerate sorted min max sum abs list dict set tuple heapq deque defaultdict Counter zip map filter ' +
        'Math console Integer Arrays Collections HashMap HashSet ArrayList LinkedList Queue Stack PriorityQueue Deque ' +
        'vector unordered_map unordered_set pair priority_queue std Map Set Array Object Number Infinity Vec ' +
        'append pop popleft appendleft push heappush heappop insert get put add remove contains size length'
    ).split(' '));
    const HASH_COMMENT = /^(python|py|ruby|rb|shell|bash|sh|r|perl|elixir|julia|coffee|yaml|toml)$/i;

    function highlightLine(line, lang) {
        const hash = HASH_COMMENT.test(lang || '');
        const re = hash
            ? /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g
            : /(\/\/.*$|\/\*.*?(?:\*\/|$)|^\s*\*.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([\s\S])/g;
        let out = '';
        let m;
        while ((m = re.exec(line)) !== null) {
            if (m[1]) out += '<span class="tok-c">' + esc(m[1]) + '</span>';
            else if (m[2]) out += '<span class="tok-s">' + esc(m[2]) + '</span>';
            else if (m[3]) out += '<span class="tok-n">' + m[3] + '</span>';
            else if (m[4]) {
                const w = m[4];
                const rest = line.slice(re.lastIndex);
                if (/^_{3,}$/.test(w)) out += '<span class="tok-blank">' + w + '</span>';
                else if (KEYWORDS.has(w)) out += '<span class="tok-k">' + w + '</span>';
                else if (BUILTINS.has(w)) out += '<span class="tok-b">' + w + '</span>';
                else if (/^\s*\(/.test(rest)) out += '<span class="tok-f">' + w + '</span>';
                else out += w;
            } else out += esc(m[5]);
            if (m[0] === '') re.lastIndex++;
        }
        return out;
    }

    // Line ranges: 5, [3, 8] or [[3, 8], [12, 14]] -> sorted list of [a, b]
    function ranges(spec) {
        if (spec == null) return [];
        if (typeof spec === 'number') return [[spec, spec]];
        if (spec.length && typeof spec[0] === 'number') return [[spec[0], spec[spec.length - 1]]];
        return spec.map((r) => (typeof r === 'number' ? [r, r] : [r[0], r[r.length - 1]]));
    }

    /* view (optional): { lines: ranges to show, folds: [{lines: [a, b], label}], foldText(a, b, label) }
       Hidden lines keep their element (so frames still address original line numbers) and each
       hidden block is replaced on screen by one fold row. */
    function codeBlock(source, lang, fit, view) {
        const lines = String(source || '').replace(/\t/g, '    ').replace(/\s+$/, '').split('\n');
        const n = lines.length;
        const visible = new Array(n + 2).fill(true);
        const labels = {};
        if (view && view.lines) {
            visible.fill(false);
            ranges(view.lines).forEach(([a, b]) => { for (let l = a; l <= b; l++) visible[l] = true; });
        }
        if (view && view.folds) view.folds.forEach((f) => {
            const [[a, b]] = ranges(f.lines);
            for (let l = a; l <= b; l++) visible[l] = false;
            labels[a] = f.label;
        });
        const pre = el('div.code', { attrs: { 'data-lang': lang || '' } });
        if (lang) pre.appendChild(el('span.code-lang', { text: lang }));
        let rows = 0;
        for (let i = 1; i <= n; i++) {
            const ln = el('span.ln', { html: highlightLine(lines[i - 1], lang) || ' ', attrs: { 'data-n': i } });
            if (!visible[i]) {
                ln.classList.add('hidden');
                if (i === 1 || visible[i - 1]) {
                    let b = i;
                    while (b < n && !visible[b + 1]) b++;
                    const label = Object.keys(labels).map(Number).filter((k) => k >= i && k <= b).map((k) => labels[k]).join(' · ');
                    const text = view && view.foldText ? view.foldText(i, b, label) : '⋯ ' + i + '–' + b;
                    pre.appendChild(el('span.fold', { text }));
                    rows++;
                }
            } else rows++;
            pre.appendChild(ln);
        }
        pre.lines = Array.from(pre.querySelectorAll('.ln'));
        if (fit) {
            const shown = lines.filter((l, i) => visible[i + 1]);
            const lens = shown.map((l) => l.length).sort((a, b) => a - b);
            const typical = lens[Math.floor((lens.length - 1) * 0.85)] || 10;
            const maxLen = Math.max(typical, Math.min(lens[lens.length - 1] || 10, 56), 10);
            pre.lines.forEach((ln, i) => { if (lines[i].length > maxLen + 2) ln.classList.add('wrap'); });
            const byH = (fit.height - 52) / Math.max(rows, 1) / 1.55;
            const byW = (fit.width - 130) / (maxLen * 0.61);
            const fs = Math.max(14, Math.min(fit.max || 30, byH, byW));
            pre.style.fontSize = fs.toFixed(1) + 'px';
            pre.style.lineHeight = (fs * 1.55).toFixed(1) + 'px';
        }
        pre.lines = Array.from(pre.querySelectorAll('.ln'));
        // Measured fit, once the block is laid out: shrink until every visible line fits its box
        pre.fit = () => {
            if (!pre.clientHeight) return;
            let fs = parseFloat(pre.style.fontSize) || 24;
            while ((pre.scrollHeight > pre.clientHeight + 1 || pre.scrollWidth > pre.clientWidth + 1) && fs > 13) {
                fs -= 0.5;
                pre.style.fontSize = fs + 'px';
                pre.style.lineHeight = (fs * 1.55).toFixed(1) + 'px';
            }
        };
        return pre;
    }

    /* ---------- UI strings ---------- */
    const I18N = {
        es: {
            step: 'Paso', of: 'de', play: 'Reproducir', pause: 'Pausa', prev: 'Anterior', next: 'Siguiente',
            reveal: 'Revelar', revealHint: 'Revelar pista', hint: 'Pista', answer: 'Ver respuesta',
            correct: '¡Correcto!', wrong: 'No exactamente', showSolution: 'Mostrar solución',
            top: 'tope', bottom: 'base', front: 'frente', back: 'final', empty: 'vacío',
            time: 'Tiempo', space: 'Espacio', approach: 'Enfoque', note: 'Notas', ops: 'operaciones',
            limit: '≈ límite 1 s (~10^8 ops)', input: 'Entrada', output: 'Salida', explanation: 'Por qué',
            sec_statement: 'El problema', sec_examples: 'Ejemplos', sec_constraints: 'Restricciones',
            sec_trace: 'Paso a paso', sec_code: 'Código', sec_complexity: 'Complejidad', sec_compare: 'Comparación',
            sec_quiz: 'Pon a prueba', sec_hints: 'Pistas', sec_checkpoint: 'Checkpoint', sec_related: 'Para practicar',
            sec_summary: 'Resumen', sec_bullets: 'Idea', sec_diagram: 'Visualízalo', sec_next: 'Siguiente paso',
            fullscreen: 'Pantalla completa', part: 'Parte', lines: 'líneas', autoplay: 'Autoplay'
        },
        en: {
            step: 'Step', of: 'of', play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next',
            reveal: 'Reveal', revealHint: 'Reveal hint', hint: 'Hint', answer: 'Show answer',
            correct: 'Correct!', wrong: 'Not quite', showSolution: 'Show solution',
            top: 'top', bottom: 'bottom', front: 'front', back: 'back', empty: 'empty',
            time: 'Time', space: 'Space', approach: 'Approach', note: 'Notes', ops: 'operations',
            limit: '≈ 1 s limit (~10^8 ops)', input: 'Input', output: 'Output', explanation: 'Why',
            sec_statement: 'The problem', sec_examples: 'Examples', sec_constraints: 'Constraints',
            sec_trace: 'Step by step', sec_code: 'Code', sec_complexity: 'Complexity', sec_compare: 'Comparison',
            sec_quiz: 'Check yourself', sec_hints: 'Hints', sec_checkpoint: 'Checkpoint', sec_related: 'Practice next',
            sec_summary: 'Summary', sec_bullets: 'Idea', sec_diagram: 'Picture it', sec_next: 'Next step',
            fullscreen: 'Fullscreen', part: 'Part', lines: 'lines', autoplay: 'Autoplay'
        },
        pt: {
            step: 'Passo', of: 'de', play: 'Reproduzir', pause: 'Pausar', prev: 'Anterior', next: 'Próximo',
            reveal: 'Revelar', revealHint: 'Revelar dica', hint: 'Dica', answer: 'Ver resposta',
            correct: 'Correto!', wrong: 'Não exatamente', showSolution: 'Mostrar solução',
            top: 'topo', bottom: 'base', front: 'frente', back: 'fim', empty: 'vazio',
            time: 'Tempo', space: 'Espaço', approach: 'Abordagem', note: 'Notas', ops: 'operações',
            limit: '≈ limite 1 s (~10^8 ops)', input: 'Entrada', output: 'Saída', explanation: 'Por quê',
            sec_statement: 'O problema', sec_examples: 'Exemplos', sec_constraints: 'Restrições',
            sec_trace: 'Passo a passo', sec_code: 'Código', sec_complexity: 'Complexidade', sec_compare: 'Comparação',
            sec_quiz: 'Teste-se', sec_hints: 'Dicas', sec_checkpoint: 'Checkpoint', sec_related: 'Para praticar',
            sec_summary: 'Resumo', sec_bullets: 'Ideia', sec_diagram: 'Visualize', sec_next: 'Próximo passo',
            fullscreen: 'Tela cheia', part: 'Parte', lines: 'linhas', autoplay: 'Autoplay'
        },
        fr: {
            step: 'Étape', of: 'sur', play: 'Lecture', pause: 'Pause', prev: 'Précédent', next: 'Suivant',
            reveal: 'Révéler', revealHint: "Révéler l'indice", hint: 'Indice', answer: 'Voir la réponse',
            correct: 'Correct !', wrong: 'Pas tout à fait', showSolution: 'Afficher la solution',
            top: 'sommet', bottom: 'base', front: 'tête', back: 'queue', empty: 'vide',
            time: 'Temps', space: 'Espace', approach: 'Approche', note: 'Notes', ops: 'opérations',
            limit: '≈ limite 1 s (~10^8 ops)', input: 'Entrée', output: 'Sortie', explanation: 'Pourquoi',
            sec_statement: 'Le problème', sec_examples: 'Exemples', sec_constraints: 'Contraintes',
            sec_trace: 'Pas à pas', sec_code: 'Code', sec_complexity: 'Complexité', sec_compare: 'Comparaison',
            sec_quiz: 'Testez-vous', sec_hints: 'Indices', sec_checkpoint: 'Checkpoint', sec_related: 'À pratiquer',
            sec_summary: 'Résumé', sec_bullets: 'Idée', sec_diagram: 'Visualisez', sec_next: 'Étape suivante',
            fullscreen: 'Plein écran', part: 'Partie', lines: 'lignes', autoplay: 'Autoplay'
        }
    };

    function uiFor(lang, overrides) {
        const base = String(lang || 'en').toLowerCase().split(/[-_]/)[0];
        return Object.assign({}, I18N.en, I18N[base] || {}, overrides || {});
    }

    window.DL = { esc, md, mono, sup, el, svg, highlightLine, codeBlock, ranges, uiFor, I18N };
})();
