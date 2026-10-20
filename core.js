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
        cacheKey: 'chi:sheet:v2',
        cacheTtl: 10 * 60 * 1000,     // reuse the sheet for 10 min within a tab
        timeout: 12000
    };

    // Three categories. `sources` = sheet "collection" values that feed each.
    const CATEGORIES = {
        design: {
            label: 'Design',
            blurb: 'Fashion lines, runway, upcycling, 3D and interactive work: making as a way of thinking.',
            sources: ['fashion', 'art']
        },
        writing: {
            label: 'Writing',
            blurb: 'Editorial, cultural analysis and research: writing as investigation and voice.',
            sources: ['writing']
        },
        strategy: {
            label: 'Strategy',
            blurb: 'Case studies, dashboards and data stories: analysis that turns into decisions.',
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

    /* ---------- data loading ---------- */
    let pending = null;

    function readCache() {
        try {
            const raw = sessionStorage.getItem(CONFIG.cacheKey);
            if (!raw) return null;
            const { t, csv } = JSON.parse(raw);
            return csv ? { csv, fresh: Date.now() - t < CONFIG.cacheTtl } : null;
        } catch (e) { return null; }
    }
    function writeCache(csv) {
        try { sessionStorage.setItem(CONFIG.cacheKey, JSON.stringify({ t: Date.now(), csv })); }
        catch (e) { /* storage full or blocked — fine, we just refetch next time */ }
    }
    function clearCache() {
        try { sessionStorage.removeItem(CONFIG.cacheKey); } catch (e) { /* ignore */ }
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
        if (cached && cached.fresh) {
            pending = Promise.resolve(build(cached.csv));
            return pending;
        }
        pending = fetchCSV()
            .then(csv => { writeCache(csv); return build(csv); })
            .catch(err => {
                if (cached) return build(cached.csv); // stale beats nothing
                pending = null;                       // allow a retry
                throw err;
            });
        return pending;
    }

    /* ---------- missing images → soft branded placeholder ---------- */
    document.addEventListener('error', e => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        const box = img.closest('[data-media]');
        if (box) { box.classList.add('media-missing'); img.remove(); }
        else img.classList.add('img-missing');
    }, true);

    /* ---------- grain blobs ----------
       The background is built in three depths so it reads as space,
       not a flat pattern:
         back  · paper grain, a faint vignette, soft cast shadows and
                 pink glow under each main blob, plus small pale blobs
                 that sit "far away" (lighter, sparser, cooler)
         front · the main blobs, stippled pixel by pixel and shaded
                 like lit spheres (bright upper-left, deep plum lower-right)
       On the landing page the two layers drift by different amounts
       with the cursor (parallax). Each layer is drawn once per size. */
    const GRAIN_PRESETS = {
        landing: {
            near: [
                { x: .52, y: .11, r: .15, sx: .95, sy: 1.15, rot: .15 },
                { x: .19, y: .80, r: .15, sx: .82, sy: 1.25, rot: -.4 },
                { x: .84, y: .71, r: .16, sx: .92, sy: 1.22, rot: .35 }
            ],
            far: [
                { x: .32, y: .25, r: .065, sx: 1, sy: 1.1, rot: .2 },
                { x: .94, y: .17, r: .06, sx: .9, sy: 1.2, rot: -.3 },
                { x: .05, y: .33, r: .05, sx: 1, sy: 1, rot: 0 },
                { x: .64, y: .93, r: .06, sx: 1.2, sy: .9, rot: .4 }
            ],
            paper: .06,
            parallax: true
        },
        quiet: {
            near: [
                { x: .99, y: -.04, r: .24, sx: 1.1, sy: .9, rot: .3 },
                { x: -.03, y: 1.03, r: .2, sx: 1, sy: 1.1, rot: -.2 }
            ],
            far: [
                { x: .82, y: .3, r: .05, sx: 1, sy: 1.1, rot: 0 },
                { x: .12, y: .62, r: .045, sx: 1, sy: 1, rot: 0 }
            ],
            paper: .045,
            parallax: false
        }
    };

    const PAL = {
        deep:  [150, 38, 138],   // shadow side of a blob
        core:  [204, 92, 204],   // magenta-violet
        high:  [240, 150, 228],  // lit side
        edge:  [236, 76, 108],   // coral specks at the rim
        far:   [214, 156, 214],  // distant blobs: paler, cooler
        farEdge: [232, 140, 168]
    };

    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
    function mix(a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    function geom(b, w, h, s) {
        return {
            cx: b.x * w, cy: b.y * h,
            rx: b.r * s * (b.sx || 1), ry: b.r * s * (b.sy || 1),
            cos: Math.cos(b.rot || 0), sin: Math.sin(b.rot || 0)
        };
    }

    // Stipple a set of blobs into ImageData. `kind` = 'near' | 'far'.
    function stipple(ctx, w, h, blobs, kind, paper) {
        const n = w * h;
        const dens = new Float32Array(n);
        const lit = new Float32Array(n);   // lighting term of the strongest blob
        const best = new Float32Array(n);
        const s = Math.min(w, h);
        const farK = kind === 'far';

        blobs.forEach((b, idx) => {
            const g = geom(b, w, h, s);
            const R = Math.max(g.rx, g.ry) * 2.5;
            const x0 = Math.max(0, Math.floor(g.cx - R)), x1 = Math.min(w - 1, Math.ceil(g.cx + R));
            const y0 = Math.max(0, Math.floor(g.cy - R)), y1 = Math.min(h - 1, Math.ceil(g.cy + R));
            const seed = idx * 2.17 + (farK ? 4.1 : 1.3), f = 6.5 / s;
            for (let y = y0; y <= y1; y++) {
                const dy = y - g.cy;
                for (let x = x0; x <= x1; x++) {
                    const dx = x - g.cx;
                    const u = (dx * g.cos + dy * g.sin) / g.rx;
                    const v = (-dx * g.sin + dy * g.cos) / g.ry;
                    const wob = 1 + .22 * Math.sin(x * f + seed) * Math.sin(y * f * 1.3 + seed * 1.7);
                    const q = (u * u + v * v) * wob;
                    if (q > 6) continue;
                    const val = Math.exp(-q * 1.25);
                    const i = y * w + x;
                    dens[i] = 1 - (1 - dens[i]) * (1 - val);
                    if (val > best[i]) {
                        best[i] = val;
                        // light from the upper-left, in screen space
                        const lx = dx / g.rx, ly = dy / g.ry;
                        lit[i] = clamp01(1.08 - Math.hypot(lx + .5, ly + .55) / 1.75);
                    }
                }
            }
        });

        const img = ctx.createImageData(w, h);
        const d = img.data;
        for (let i = 0; i < n; i++) {
            const p = dens[i] * (farK ? .7 : 1);
            const o = i * 4;
            if (p > .003 && Math.random() < Math.pow(p, 1.2) * .97) {
                let c;
                if (farK) {
                    c = mix(PAL.farEdge, PAL.far, clamp01(p * 1.6 + (Math.random() - .5) * .3));
                    d[o + 3] = 70 + Math.random() * 90;
                } else {
                    const L = clamp01(lit[i] + (Math.random() - .5) * .28);
                    const body = L > .5 ? mix(PAL.core, PAL.high, (L - .5) / .5) : mix(PAL.deep, PAL.core, L / .5);
                    const t = clamp01(p * 1.7 + (Math.random() - .5) * .3);
                    c = mix(PAL.edge, body, t);
                    d[o + 3] = 140 + Math.random() * 115;
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

    function drawBack(canvas, w, h, preset) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const s = Math.min(w, h);

        // far blobs + paper grain first (ImageData replaces pixels)
        ctx.putImageData(stipple(ctx, w, h, preset.far || [], 'far', preset.paper), 0, 0);

        // painted on top with soft gradients — they read as light & shadow
        ctx.globalCompositeOperation = 'destination-over';

        preset.near.forEach(b => {
            const g = geom(b, w, h, s);
            // cast shadow: offset down-right, wide and very soft
            ctx.save();
            ctx.translate(g.cx + g.rx * .35, g.cy + g.ry * .55);
            ctx.scale(g.rx * 1.25, g.ry * 1.05);
            let gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6);
            gr.addColorStop(0, 'rgba(96, 38, 84, .24)');
            gr.addColorStop(.55, 'rgba(96, 38, 84, .09)');
            gr.addColorStop(1, 'rgba(96, 38, 84, 0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // ambient pink bloom around the blob
            ctx.save();
            ctx.translate(g.cx, g.cy);
            ctx.scale(g.rx, g.ry);
            gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 2.8);
            gr.addColorStop(0, 'rgba(236, 130, 210, .22)');
            gr.addColorStop(.45, 'rgba(240, 160, 200, .10)');
            gr.addColorStop(1, 'rgba(240, 160, 200, 0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // gentle vignette so the centre feels lit and the edges recede
        const vg = ctx.createRadialGradient(w / 2, h * .45, s * .35, w / 2, h * .45, Math.hypot(w, h) * .62);
        vg.addColorStop(0, 'rgba(70, 50, 64, 0)');
        vg.addColorStop(1, 'rgba(70, 50, 64, .11)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawFront(canvas, w, h, preset) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.putImageData(stipple(ctx, w, h, preset.near, 'near', 0), 0, 0);
    }

    function mountGrain(front, presetName) {
        if (!front || !front.getContext) return;
        const preset = GRAIN_PRESETS[presetName] || GRAIN_PRESETS.landing;

        const back = document.createElement('canvas');
        back.className = front.className + ' grain-back';
        back.setAttribute('aria-hidden', 'true');
        front.classList.add('grain-front');
        front.parentNode.insertBefore(back, front);

        let lastW = 0, lastH = 0, timer = 0;
        const draw = () => {
            const rect = front.getBoundingClientRect();
            const cssW = Math.max(1, Math.round(rect.width));
            const cssH = Math.max(1, Math.round(rect.height));
            // ignore the small height jitter of mobile browser toolbars
            if (lastW && Math.abs(cssW - lastW) < 2 && Math.abs(cssH - lastH) < 120) return;
            lastW = cssW; lastH = cssH;
            const scale = Math.min(1, 1920 / cssW, 1400 / cssH);
            const w = Math.round(cssW * scale), h = Math.round(cssH * scale);
            [back, front].forEach(c => { c.width = w; c.height = h; });
            drawBack(back, w, h, preset);
            drawFront(front, w, h, preset);
            back.classList.add('is-ready');
            front.classList.add('is-ready');
        };

        draw();
        const schedule = () => { clearTimeout(timer); timer = setTimeout(draw, 160); };
        if ('ResizeObserver' in global) new ResizeObserver(schedule).observe(front);
        else global.addEventListener('resize', schedule);

        // parallax: front layer moves more than the back one
        const still = global.matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
        if (!preset.parallax || still.matches) return;
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        const tick = () => {
            cx += (tx - cx) * .06; cy += (ty - cy) * .06;
            front.style.translate = `${(-cx * 20).toFixed(2)}px ${(-cy * 15).toFixed(2)}px`;
            back.style.translate = `${(-cx * 6).toFixed(2)}px ${(-cy * 5).toFixed(2)}px`;
            raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .001 ? requestAnimationFrame(tick) : 0;
        };
        global.addEventListener('pointermove', e => {
            if (e.pointerType !== 'mouse') return;
            tx = e.clientX / global.innerWidth - .5;
            ty = e.clientY / global.innerHeight - .5;
            if (!raf) raf = requestAnimationFrame(tick);
        }, { passive: true });
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

    global.Chi = {
        CONFIG, CATEGORIES, ORDER,
        resolveCategory, categoryUrl, projectUrl,
        esc, rich, tidy, plainLength, safeUrl, parseCSV,
        loadProjects, randomProject,
        mountGrain, fillYear, wireSurprise, wireCopyLink
    };
})(window);
