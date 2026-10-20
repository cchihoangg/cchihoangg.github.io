/* ============================================================
   CHI. — core.js  (shared by every page; load before page scripts)

   What lives here
   · CONFIG ........ the published Google Sheet + image folders
   · CATEGORIES .... the three public categories and which sheet
                     "collection" values feed each one
   · loadProjects .. fetch → parse → normalise, cached per tab
   · helpers ....... escaping, rich text, links, embeds-safe URLs
   · mountGrain .... the grainy pink-blob background
   · wireSurprise / wireCopyLink / fillYear

   The sheet stays the CMS. Nothing in it has to change: the old
   four collections (fashion, art, writing, data) are mapped onto
   the three new categories below.
   ============================================================ */
(function (global) {
    'use strict';

    /* ---------- configuration ---------- */
    const CONFIG = {
        sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=18930479&single=true&output=csv',
        thumbDir: 'images/thumb/',   // image_main filenames live here
        imageDir: 'images/',          // pic1…pic20 paths are relative to here
        galleryPage: 'gallery.html',
        cacheKey: 'chi:sheet:v3',
        cacheTtl: 60 * 1000,          // saved copy counts as fresh for 1 min; older copies show instantly, then refresh
        timeout: 12000
    };

    // Three categories. `sources` = sheet "collection" values that feed each.
    const CATEGORIES = {
        design: {
            label: 'Design',
            blurb: 'Making culture visible: fashion lines, runway, upcycling, 3D and interactive work.',
            sources: ['fashion', 'art']
        },
        writing: {
            label: 'Writing',
            blurb: 'Making culture legible: editorial, cultural analysis and research.',
            sources: ['writing']
        },
        strategy: {
            label: 'Strategy',
            blurb: 'Making culture actionable: case studies, dashboards and data stories.',
            sources: ['data']
        }
    };
    const ORDER = Object.keys(CATEGORIES);
    const SOURCE_LABELS = { fashion: 'Fashion', art: 'Art' };

    // Old links (?collection=fashion / art / data) keep working.
    const ALIASES = {};
    ORDER.forEach(key => CATEGORIES[key].sources.forEach(src => { ALIASES[src] = key; }));

    function resolveCategory(value) {
        const key = String(value || '').trim().toLowerCase();
        if (CATEGORIES[key]) return key;
        return ALIASES[key] || null;
    }

    function categoryUrl(cat) {
        return cat ? `${CONFIG.galleryPage}?collection=${encodeURIComponent(cat)}` : CONFIG.galleryPage;
    }
    function projectUrl(cat, id) {
        return `${CONFIG.galleryPage}?collection=${encodeURIComponent(cat)}&id=${encodeURIComponent(id)}`;
    }

    /* ---------- text helpers ---------- */
    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function safeUrl(url) {
        const u = String(url || '').trim();
        return /^(https?:|mailto:)/i.test(u) || /^[\w./-]+$/.test(u) ? u : '';
    }

    // Strip leftovers pasted in from AI-assisted drafts, e.g. "[cite: 10]".
    function tidy(str) {
        return String(str || '')
            .replace(/\[cite_start\]/gi, '')
            .replace(/\[cite:[^\]]*\]/gi, '')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    const looksLikeHTML = str => /<\/?[a-z][\s\S]*?>/i.test(str);

    function linkify(html) {
        return html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
            '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    }

    // Sheet cells may hold plain prose or hand-written HTML. HTML goes in as-is
    // (it's the owner's own sheet); prose is escaped, linked and paragraphed.
    function rich(raw) {
        const text = tidy(raw);
        if (!text) return '';
        if (looksLikeHTML(text)) return text;
        return text.split(/\n{2,}/)
            .map(par => `<p>${linkify(esc(par).replace(/\n/g, '<br>'))}</p>`)
            .join('');
    }

    function plainLength(raw) {
        return tidy(raw).replace(/<[^>]+>/g, '').length;
    }

    /* ---------- CSV ----------
       A real parser: tracks quote state across the whole text so cells can
       hold commas, line breaks and escaped "" quotes. Duplicate headers
       (the sheet currently has two "cap6" columns) keep the first non-empty
       value instead of being silently overwritten. */
    function parseCSV(csv) {
        const text = String(csv).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
        const rows = [];
        let row = [], field = '', inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else field += ch;
            } else if (ch === '"') inQuotes = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else field += ch;
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        if (!rows.length) return [];

        const headers = rows[0].map(h => h.trim());
        return rows.slice(1)
            .filter(cols => cols.some(v => v.trim() !== ''))
            .map(cols => headers.reduce((obj, h, i) => {
                if (!h) return obj;
                const v = (cols[i] ?? '').trim();
                if (!(h in obj) || (!obj[h] && v)) obj[h] = v;
                return obj;
            }, {}));
    }

    function parseLinks(raw) {
        const str = String(raw || '').trim();
        if (!str) return [];
        // Split only on commas that start a new "label__url" entry, so a URL
        // with a comma in it doesn't get cut in half.
        const parts = str.includes('__') ? str.split(/,(?=[^,]*__)/) : str.split(',');
        return parts.map(part => {
            const p = part.trim();
            if (!p) return null;
            const [label, url] = p.includes('__') ? p.split('__').map(s => s.trim()) : [p, p];
            const href = safeUrl(url);
            return href ? { label: label || href, href } : null;
        }).filter(Boolean);
    }

    function collectFigures(row) {
        const figs = [];
        for (let i = 1; i <= 20; i++) {
            const src = (row[`pic${i}`] || '').trim();
            if (src) figs.push({ src: CONFIG.imageDir + src, cap: tidy(row[`cap${i}`]) });
        }
        return figs;
    }

    function normalize(row) {
        const id = (row.id || '').trim();
        const source = (row.collection || '').trim().toLowerCase();
        const cat = resolveCategory(source);
        if (!id || !cat) return null; // malformed / shifted rows are skipped
        const type = tidy(row.description);
        return {
            id,
            cat,
            catLabel: CATEGORIES[cat].label,
            source,
            title: tidy(row.title) || 'Untitled',
            // NOTE on the sheet's column names: "description" is a short type
            // label (e.g. "Internship"), "preview" is the synopsis, and
            // "image_main" is the thumbnail filename.
            type,
            tag: [SOURCE_LABELS[source] && cat === 'design' ? SOURCE_LABELS[source] : '', type].filter(Boolean).join(' · '),
            synopsis: tidy(row.preview) || type,
            thumb: row.image_main ? CONFIG.thumbDir + row.image_main.trim() : '',
            visible: (row.show || '').trim().toLowerCase() === 'y',
            embed: (row.embed || row.Embed || '').trim(),
            links: parseLinks(row.links),
            content: row.content || '',
            tools: tidy(row.tools),
            figures: collectFigures(row),
            url: projectUrl(cat, id)
        };
    }

    /* ---------- data loading ----------
       Stale-while-revalidate: the last copy of the sheet is kept in
       localStorage, so repeat visits render instantly from it while a
       fresh copy loads in the background. If the sheet changed, pages
       subscribed via onProjectsUpdate() quietly re-render. */
    let pending = null;
    const listeners = [];

    function readCache() {
        try {
            const raw = localStorage.getItem(CONFIG.cacheKey);
            if (!raw) return null;
            const { t, csv } = JSON.parse(raw);
            return csv ? { csv, fresh: Date.now() - t < CONFIG.cacheTtl } : null;
        } catch (e) { return null; }
    }
    function writeCache(csv) {
        try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ t: Date.now(), csv })); }
        catch (e) { /* storage full or blocked — fine, we just refetch next time */ }
    }
    function clearCache() {
        try { localStorage.removeItem(CONFIG.cacheKey); } catch (e) { /* ignore */ }
    }

    async function fetchCSV() {
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), CONFIG.timeout) : 0;
        try {
            const res = await fetch(CONFIG.sheetUrl, ctrl ? { signal: ctrl.signal } : undefined);
            if (!res.ok) throw new Error(`Sheet responded ${res.status}`);
            const text = await res.text();
            // A sign-in or error page comes back as HTML, not CSV.
            if (/^\s*</.test(text) || !text.includes(',')) throw new Error('Sheet did not return CSV');
            return text;
        } finally { clearTimeout(timer); }
    }

    const build = csv => parseCSV(csv).map(normalize).filter(Boolean);

    function loadProjects(opts = {}) {
        if (opts.force) { pending = null; clearCache(); }
        if (pending) return pending;
        const cached = readCache();

        if (cached) {
            pending = Promise.resolve(build(cached.csv));
            if (!cached.fresh) {
                fetchCSV().then(csv => {
                    writeCache(csv);
                    if (csv === cached.csv) return;
                    const data = build(csv);
                    pending = Promise.resolve(data);
                    listeners.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
                }).catch(err => console.warn('Sheet refresh failed; showing the saved copy.', err));
            }
            return pending;
        }

        pending = fetchCSV()
            .then(csv => { writeCache(csv); return build(csv); })
            .catch(err => { pending = null; throw err; }); // allow a retry
        return pending;
    }

    function onProjectsUpdate(fn) { listeners.push(fn); }

    /* ---------- missing images → soft branded placeholder ---------- */
    document.addEventListener('error', e => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        const box = img.closest('[data-media]');
        if (box) { box.classList.add('media-missing'); img.remove(); }
        else img.classList.add('img-missing');
    }, true);

    /* ---------- grain blobs ----------
       Stippled colour blobs: every pixel rolls against a soft density
       field, so the edges dissolve into specks like risograph print.

       Speed: drawing is ~1 million pixel operations, so it runs in a Web
       Worker on an OffscreenCanvas and never blocks the page from
       showing. Browsers without that support draw it after first paint
       instead, at a slightly lower resolution.

       Two layers: a back canvas (paper grain, light, shadows, distant
       blobs) and a front canvas (main blobs). Presets switch the depth
       effects on or off:
         landing · flat blobs, as in the original screenshot
         quiet   · gallery & project pages: shaded blobs that cast soft
                   shadows, distant pale blobs, a top light, vignette,
                   colour haze, and gentle scroll parallax */
    const GRAIN_PRESETS = {
        landing: {
            near: [
                { x: .52, y: .11, r: .15, sx: .95, sy: 1.15, rot: .15 },
                { x: .19, y: .80, r: .15, sx: .82, sy: 1.25, rot: -.4 },
                { x: .84, y: .71, r: .16, sx: .92, sy: 1.22, rot: .35 }
            ],
            far: [], haze: [],
            paper: .06,
            shade: false, shadow: false, light: false, vignette: 0,
            scroll: 0
        },
        quiet: {
            near: [
                { x: .97, y: .02, r: .25, sx: 1.1, sy: .9, rot: .3 },
                { x: .02, y: .97, r: .21, sx: 1, sy: 1.1, rot: -.2 }
            ],
            far: [
                { x: .9, y: .5, r: .05, sx: 1, sy: 1.15, rot: .2 },
                { x: .07, y: .3, r: .045, sx: 1.1, sy: 1, rot: 0 },
                { x: .76, y: .9, r: .04, sx: 1, sy: 1, rot: -.3 },
                { x: .2, y: .07, r: .035, sx: 1, sy: 1, rot: 0 }
            ],
            // large out-of-focus washes far behind everything
            haze: [
                { x: .1, y: .48, r: .55, c: '214, 120, 210', a: .14 },
                { x: .95, y: .72, r: .5, c: '236, 120, 150', a: .11 },
                { x: .62, y: .12, r: .45, c: '205, 150, 230', a: .09 }
            ],
            paper: .045,
            shade: true, shadow: true, light: true, vignette: .14,
            scroll: 70   // px the front layer travels across a full page scroll
        }
    };

    // Everything the painter needs lives inside this one function so the
    // same code can run in the worker (via toString) or on the main thread.
    function painterFactory() {
        const PAL = {
            deep: [150, 38, 138], core: [204, 92, 204], mid: [226, 86, 160],
            high: [240, 150, 228], edge: [236, 76, 108],
            far: [214, 156, 214], farEdge: [232, 140, 168]
        };
        const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
        const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const geom = (b, w, h, s) => ({
            cx: b.x * w, cy: b.y * h,
            rx: b.r * s * (b.sx || 1), ry: b.r * s * (b.sy || 1),
            cos: Math.cos(b.rot || 0), sin: Math.sin(b.rot || 0)
        });

        function stipple(ctx, w, h, blobs, kind, preset, paper) {
            const n = w * h;
            const dens = new Float32Array(n);
            const lit = preset.shade ? new Float32Array(n) : null;
            const best = preset.shade ? new Float32Array(n) : null;
            const s = Math.min(w, h);
            const far = kind === 'far';

            blobs.forEach((b, idx) => {
                const g = geom(b, w, h, s);
                const R = Math.max(g.rx, g.ry) * 2.5;
                const x0 = Math.max(0, Math.floor(g.cx - R)), x1 = Math.min(w - 1, Math.ceil(g.cx + R));
                const y0 = Math.max(0, Math.floor(g.cy - R)), y1 = Math.min(h - 1, Math.ceil(g.cy + R));
                const seed = idx * 2.17 + (far ? 4.1 : 1.3), f = 6.5 / s;
                for (let y = y0; y <= y1; y++) {
                    const dy = y - g.cy;
                    const wy = Math.sin(y * f * 1.3 + seed * 1.7);
                    for (let x = x0; x <= x1; x++) {
                        const dx = x - g.cx;
                        const u = (dx * g.cos + dy * g.sin) / g.rx;
                        const v = (-dx * g.sin + dy * g.cos) / g.ry;
                        const q = (u * u + v * v) * (1 + .22 * Math.sin(x * f + seed) * wy);
                        if (q > 6) continue;
                        const val = Math.exp(-q * 1.25);
                        const i = y * w + x;
                        dens[i] = 1 - (1 - dens[i]) * (1 - val);
                        if (lit && val > best[i]) {
                            best[i] = val;
                            lit[i] = clamp01(1.08 - Math.hypot(dx / g.rx + .5, dy / g.ry + .55) / 1.75);
                        }
                    }
                }
            });

            const img = ctx.createImageData(w, h);
            const d = img.data;
            for (let i = 0; i < n; i++) {
                const p = dens[i] * (far ? .7 : 1);
                const o = i * 4;
                if (p > .003 && Math.random() < Math.pow(p, 1.2) * .97) {
                    let c;
                    if (far) {
                        c = mix(PAL.farEdge, PAL.far, clamp01(p * 1.6 + (Math.random() - .5) * .3));
                        d[o + 3] = 70 + Math.random() * 90;
                    } else if (lit) {
                        const L = clamp01(lit[i] + (Math.random() - .5) * .28);
                        const body = L > .5 ? mix(PAL.core, PAL.high, (L - .5) / .5) : mix(PAL.deep, PAL.core, L / .5);
                        c = mix(PAL.edge, body, clamp01(p * 1.7 + (Math.random() - .5) * .3));
                        d[o + 3] = 140 + Math.random() * 115;
                    } else {
                        const t = Math.min(1, p * 1.25 + (Math.random() - .5) * .35);
                        c = t > .55 ? mix(PAL.mid, PAL.core, (t - .55) / .45) : mix(PAL.edge, PAL.mid, t / .55);
                        d[o + 3] = 130 + Math.random() * 125;
                    }
                    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
                } else if (paper && Math.random() < paper) {
                    const light = Math.random() < .55;
                    d[o] = d[o + 1] = d[o + 2] = light ? 255 : 70;
                    d[o + 3] = light ? 40 : 18;
                }
            }
            return img;
        }

        function ellipse(ctx, cx, cy, rx, ry, R, stops) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(rx, ry);
            const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            stops.forEach(([at, col]) => gr.addColorStop(at, col));
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        function paintBack(ctx, w, h, preset) {
            const s = Math.min(w, h);
            // ImageData replaces pixels, so it goes first; the rest is
            // painted *behind* it with destination-over.
            ctx.putImageData(stipple(ctx, w, h, preset.far || [], 'far', preset, preset.paper), 0, 0);
            ctx.globalCompositeOperation = 'destination-over';

            if (preset.shadow) preset.near.forEach(b => {
                const g = geom(b, w, h, s);
                ellipse(ctx, g.cx + g.rx * .35, g.cy + g.ry * .55, g.rx * 1.25, g.ry * 1.05, 1.6,
                    [[0, 'rgba(96, 38, 84, .24)'], [.55, 'rgba(96, 38, 84, .09)'], [1, 'rgba(96, 38, 84, 0)']]);
                ellipse(ctx, g.cx, g.cy, g.rx, g.ry, 2.8,
                    [[0, 'rgba(236, 130, 210, .22)'], [.45, 'rgba(240, 160, 200, .10)'], [1, 'rgba(240, 160, 200, 0)']]);
            });

            if (preset.vignette) {
                const vg = ctx.createRadialGradient(w / 2, h * .42, s * .35, w / 2, h * .42, Math.hypot(w, h) * .62);
                vg.addColorStop(0, 'rgba(70, 50, 64, 0)');
                vg.addColorStop(1, `rgba(70, 50, 64, ${preset.vignette})`);
                ctx.fillStyle = vg;
                ctx.fillRect(0, 0, w, h);
            }

            (preset.haze || []).forEach(z => {
                const R = z.r * Math.max(w, h);
                ellipse(ctx, z.x * w, z.y * h, R, R * .8, 1,
                    [[0, `rgba(${z.c}, ${z.a})`], [.5, `rgba(${z.c}, ${z.a * .45})`], [1, `rgba(${z.c}, 0)`]]);
            });

            if (preset.light) { // a soft pool of light from above
                ellipse(ctx, w * .5, -h * .05, w * .6, h * .45, 1,
                    [[0, 'rgba(255, 252, 246, .7)'], [.6, 'rgba(255, 252, 246, .25)'], [1, 'rgba(255, 252, 246, 0)']]);
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        function paint(backCtx, frontCtx, w, h, preset) {
            if (backCtx) paintBack(backCtx, w, h, preset);
            if (frontCtx) frontCtx.putImageData(stipple(frontCtx, w, h, preset.near, 'near', preset, 0), 0, 0);
        }

        return { paint };
    }

    let workerUrl = null;
    function grainWorker() {
        if (!('OffscreenCanvas' in global) || !('Worker' in global) || !HTMLCanvasElement.prototype.transferControlToOffscreen) return null;
        try {
            if (!workerUrl) {
                const src = `const P = (${painterFactory.toString()})();
                    let cv = null, preset = null;
                    self.onmessage = e => {
                        const m = e.data;
                        if (m.canvases) { cv = m.canvases; preset = m.preset; }
                        if (m.w && cv) {
                            cv.forEach(c => { c.width = m.w; c.height = m.h; });
                            P.paint(cv[0].getContext('2d'), cv[1].getContext('2d'), m.w, m.h, preset);
                            self.postMessage({ done: m.id });
                        }
                    };`;
                workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
            }
            return new Worker(workerUrl);
        } catch (e) { return null; }
    }

    function mountGrain(front, presetName) {
        if (!front || !front.getContext) return;
        const preset = GRAIN_PRESETS[presetName] || GRAIN_PRESETS.landing;

        const back = document.createElement('canvas');
        back.className = front.className + ' grain-back';
        back.setAttribute('aria-hidden', 'true');
        front.classList.add('grain-front');
        front.parentNode.insertBefore(back, front);

        const ready = () => { back.classList.add('is-ready'); front.classList.add('is-ready'); };
        let worker = grainWorker();
        if (worker) {
            try {
                const ob = back.transferControlToOffscreen();
                const of = front.transferControlToOffscreen();
                worker.postMessage({ canvases: [ob, of], preset }, [ob, of]);
                worker.onmessage = ready;
            } catch (e) { worker = null; }
        }
        const painter = worker ? null : painterFactory();

        let lastW = 0, lastH = 0, timer = 0, id = 0;
        const draw = () => {
            const rect = front.getBoundingClientRect();
            const cssW = Math.max(1, Math.round(rect.width));
            const cssH = Math.max(1, Math.round(rect.height));
            // ignore the small height jitter of mobile browser toolbars
            if (lastW && Math.abs(cssW - lastW) < 2 && Math.abs(cssH - lastH) < 120) return;
            lastW = cssW; lastH = cssH;
            const cap = worker ? 1 : .75;
            const scale = Math.min(cap, 1920 / cssW, 1400 / cssH);
            const w = Math.round(cssW * scale), h = Math.round(cssH * scale);
            if (worker) { worker.postMessage({ w, h, id: ++id }); return; }
            back.width = front.width = w; back.height = front.height = h;
            painter.paint(back.getContext('2d'), front.getContext('2d'), w, h, preset);
            ready();
        };

        // Main-thread fallback waits for first paint so text shows first.
        if (worker) draw();
        else (global.requestIdleCallback || (fn => setTimeout(fn, 60)))(() => requestAnimationFrame(draw), { timeout: 400 });

        const schedule = () => { clearTimeout(timer); timer = setTimeout(draw, 180); };
        if ('ResizeObserver' in global) new ResizeObserver(schedule).observe(front);
        else global.addEventListener('resize', schedule);

        // Scroll parallax (gallery & project pages): the front layer
        // travels further than the back as you read down the page.
        const still = global.matchMedia('(prefers-reduced-motion: reduce)');
        if (!preset.scroll || still.matches) return;
        let raf = 0;
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const max = Math.max(1, document.documentElement.scrollHeight - global.innerHeight);
                const p = Math.min(1, global.scrollY / max);
                front.style.translate = `0 ${(-p * preset.scroll).toFixed(1)}px`;
                back.style.translate = `0 ${(-p * preset.scroll * .3).toFixed(1)}px`;
            });
        };
        global.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- small shared widgets ---------- */
    function fillYear() {
        document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    }

    async function randomProject(excludeId) {
        const all = (await loadProjects()).filter(p => p.visible);
        const pool = all.length > 1 ? all.filter(p => p.id !== excludeId) : all;
        if (!pool.length) throw new Error('No projects to pick from');
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // <button data-surprise><span data-label>Surprise me</span></button>
    function wireSurprise(opts = {}) {
        document.querySelectorAll('[data-surprise]').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.preventDefault();
                if (btn.classList.contains('is-busy')) return;
                const label = btn.querySelector('[data-label]') || btn;
                const original = label.textContent;
                btn.classList.add('is-busy');
                label.textContent = 'Rolling…';
                try {
                    const pick = await randomProject(opts.exclude ? opts.exclude() : null);
                    if (opts.onPick) opts.onPick(pick);
                    else global.location.href = pick.url;
                } catch (err) {
                    console.error(err);
                } finally {
                    btn.classList.remove('is-busy');
                    label.textContent = original;
                }
            });
        });
    }

    function wireCopyLink() {
        document.querySelectorAll('[data-copy-link]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const label = btn.querySelector('[data-label]') || btn;
                const original = label.textContent;
                try {
                    await navigator.clipboard.writeText(global.location.href.split('#')[0]);
                    label.textContent = 'Copied';
                } catch (e) {
                    label.textContent = 'Copy failed';
                }
                setTimeout(() => { label.textContent = original; }, 1600);
            });
        });
    }

    // Start fetching the sheet right away, in parallel with fonts & images.
    loadProjects().catch(() => { /* pages handle errors when they ask */ });

    global.Chi = {
        CONFIG, CATEGORIES, ORDER,
        resolveCategory, categoryUrl, projectUrl,
        esc, rich, tidy, plainLength, safeUrl, parseCSV,
        loadProjects, onProjectsUpdate, randomProject,
        mountGrain, fillYear, wireSurprise, wireCopyLink
    };
})(window);
