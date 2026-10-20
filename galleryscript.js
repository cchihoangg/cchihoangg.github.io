/* ============================================================
   CHI. — Gallery
   One page, two views, real URLs:
     gallery.html                         → all three categories
     gallery.html?collection=design       → one category's index
     gallery.html?collection=design&id=x  → a project write-up
   Moving between them uses the History API (no reload, back button
   works, scroll position on the index is remembered). Without JS
   the same links still load normally.
   ============================================================ */
(function () {
    'use strict';

    const $ = sel => document.querySelector(sel);
    const { esc, rich, CATEGORIES, ORDER } = Chi;

    const state = {
        projects: [],
        view: null,        // 'index' | 'project'
        key: null,         // scroll-memory key for the current view
        currentId: null,
        scroll: new Map(),
        images: []         // lightbox set for the open project
    };
    let embedObserver = null;

    document.addEventListener('DOMContentLoaded', () => {
        Chi.mountGrain($('#grain'), 'quiet');
        Chi.fillYear();
        Chi.wireCopyLink();
        Chi.wireSurprise({ onPick: item => go(item.url), exclude: () => state.currentId });
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        initBar();
        initRouting();
        initLightbox();
        boot();
    });

    async function boot(force) {
        renderSkeleton();
        try {
            const all = await Chi.loadProjects({ force });
            state.projects = all.filter(p => p.visible);
            route();
            // a newer copy of the sheet arrived after we rendered from the saved one
            Chi.onProjectsUpdate(fresh => {
                state.projects = fresh.filter(p => p.visible);
                const y = window.scrollY;
                route({ quiet: true });
                window.scrollTo({ top: y, behavior: 'instant' });
            });
        } catch (err) {
            console.error('Gallery: could not load the sheet.', err);
            renderError();
        }
    }

    /* ---------- routing ---------- */
    function initRouting() {
        document.addEventListener('click', e => {
            const a = e.target.closest('a[data-route]');
            if (!a || e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
            e.preventDefault();
            go(a.href);
        });
        window.addEventListener('popstate', () => { rememberScroll(); route(); });
    }

    function go(url, opts = {}) {
        const next = new URL(url, location.href);
        if (next.pathname !== location.pathname) { location.href = next.href; return; }
        if (next.search === location.search && !opts.force) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        rememberScroll();
        history[opts.replace ? 'replaceState' : 'pushState'](null, '', next.pathname + next.search);
        route();
    }

    function rememberScroll() {
        if (state.view === 'index' && state.key) state.scroll.set(state.key, window.scrollY);
    }

    function route(opts = {}) {
        if (!state.projects.length) { renderEmpty(); return; }
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const cat = Chi.resolveCategory(params.get('collection'));
        const item = id ? state.projects.find(p => p.id === id) : null;

        if (item) renderProject(item, opts.quiet);
        else renderIndex(cat, id ? 'That project isn’t available right now. Here’s the rest of the work.' : '', opts.quiet);

        // Tidy old-style or stale URLs (?collection=fashion, unknown ids)
        // into the canonical form, without adding a history entry.
        const raw = params.get('collection');
        const stale = item ? raw !== item.cat : (id || (raw && raw !== cat));
        if (stale) history.replaceState(null, '', item ? Chi.projectUrl(item.cat, item.id) : Chi.categoryUrl(cat));
    }

    // Within a category, sources keep the order listed in CATEGORIES (Design:
// fashion before art); otherwise the sheet's own row order is kept.
const inCat = cat => {
        const order = CATEGORIES[cat].sources;
        return state.projects
            .map((p, i) => ({ p, i }))
            .filter(x => x.p.cat === cat)
            .sort((a, b) => (order.indexOf(a.p.source) - order.indexOf(b.p.source)) || a.i - b.i)
            .map(x => x.p);
    };

    function setNav(cat) {
        document.querySelectorAll('.bar-nav a[data-nav]').forEach(a => {
            if (a.dataset.nav === cat) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    function swap(html, focus, quiet) {
        const view = $('#view');
        view.classList.remove('is-entering');
        view.innerHTML = html;
        if (quiet) return;
        void view.offsetWidth; // restart the entrance animation
        view.classList.add('is-entering');
        if (focus) view.focus({ preventScroll: true });
    }

    /* ---------- index ---------- */
    function card(p, i) {
        const media = p.thumb
            ? `<img src="${esc(p.thumb)}" alt="" loading="${i < 6 ? 'eager' : 'lazy'}"${i < 3 ? ' fetchpriority="high"' : ''} decoding="async">`
            : '';
        return `
            <a class="card" href="${esc(p.url)}" data-route style="--i:${Math.min(i, 12)}">
                <span class="card-media${p.thumb ? '' : ' media-missing'}" data-media>${media}</span>
                <span class="card-meta"><span>${esc(p.tag)}</span><span class="card-num">${String(i + 1).padStart(2, '0')}</span></span>
                <span class="card-title">${esc(p.title)}</span>
                <span class="card-text">${esc(p.synopsis)}</span>
            </a>`;
    }

    function renderIndex(cat, notice, quiet) {
        const fromProject = state.view === 'project';
        state.view = 'index';
        state.key = `index:${cat || 'all'}`;
        state.currentId = null;
        setNav(cat);
        teardownEmbeds();

        const note = notice ? `<p class="notice">${esc(notice)}</p>` : '';
        let html;

        if (cat) {
            const meta = CATEGORIES[cat];
            const list = inCat(cat);
            document.title = `${meta.label} — Chi Hoang`;
            html = `
                <header class="index-head">
                    ${note}
                    <p class="eyebrow">${list.length} ${list.length === 1 ? 'project' : 'projects'}</p>
                    <h1 class="index-title">${esc(meta.label)}</h1>
                    <p class="index-blurb">${esc(meta.blurb)}</p>
                </header>
                ${list.length
                    ? `<div class="grid">${list.map(card).join('')}</div>`
                    : `<p class="state">Nothing here yet.</p>`}`;
        } else {
            document.title = 'Work — Chi Hoang';
            html = `
                <header class="index-head">
                    ${note}
                    <p class="eyebrow">${state.projects.length} projects</p>
                    <h1 class="index-title">Selected work</h1>
                    <p class="index-blurb">Three ways into the same question: how culture moves, and how to show it.</p>
                </header>
                ${ORDER.map(key => {
                    const list = inCat(key);
                    if (!list.length) return '';
                    return `
                        <section class="shelf" aria-labelledby="shelf-${key}">
                            <div class="shelf-head">
                                <h2 class="shelf-title" id="shelf-${key}">${esc(CATEGORIES[key].label)}</h2>
                                <a class="shelf-link" href="${esc(Chi.categoryUrl(key))}" data-route>View all ${list.length} <span aria-hidden="true">→</span></a>
                            </div>
                            <div class="grid">${list.map(card).join('')}</div>
                        </section>`;
                }).join('')}`;
        }

        swap(html, fromProject, quiet);
        if (quiet) return;
        const y = state.scroll.get(state.key) || 0;
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    }

    /* ---------- project ---------- */
    function figure(f, n, title, hero) {
        const long = f.cap && Chi.plainLength(f.cap) > 170;
        const alt = f.cap && !long ? Chi.tidy(f.cap).replace(/<[^>]+>/g, '') : `${title}, image ${n + 1}`;
        return `
            <figure class="fig${hero ? ' fig-hero' : ''}" data-media>
                <img class="zoomable" src="${esc(f.src)}" alt="${esc(alt)}" loading="${hero ? 'eager' : 'lazy'}"${hero ? ' fetchpriority="high"' : ''} decoding="async">
                ${f.cap && !long ? `<figcaption>${rich(f.cap).replace(/^<p>|<\/p>$/g, '')}</figcaption>` : ''}
            </figure>
            ${long ? `<div class="prose fig-note">${rich(f.cap)}</div>` : ''}`;
    }

    function renderProject(item, quiet) {
        state.view = 'project';
        state.key = `project:${item.id}`;
        state.currentId = item.id;
        setNav(item.cat);
        teardownEmbeds();

        const meta = CATEGORIES[item.cat];
        const list = inCat(item.cat);
        const idx = list.findIndex(p => p.id === item.id);
        const prev = list.length > 1 ? list[(idx - 1 + list.length) % list.length] : null;
        const next = list.length > 1 ? list[(idx + 1) % list.length] : null;

        // Lead media: the embed if there is one, else the first image, else the thumbnail.
        const figs = item.figures.slice();
        let lead = embed(item.embed, item.title);
        if (!lead && figs.length) lead = figure(figs.shift(), 0, item.title, true);
        else if (!lead && item.thumb) lead = figure({ src: item.thumb, cap: '' }, 0, item.title, true);

        const links = item.links.length
            ? `<div class="pills">${item.links.map(l => `
                <a class="pill" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} <span aria-hidden="true">↗</span></a>`).join('')}
               </div>`
            : '';

        const pager = (prev && next) ? `
            <nav class="pager" aria-label="More ${esc(meta.label)}">
                <a class="pager-link" href="${esc(prev.url)}" data-route>
                    <span class="pager-label"><span aria-hidden="true">←</span> Previous</span>
                    <span class="pager-title">${esc(prev.title)}</span>
                </a>
                <a class="pager-all" href="${esc(Chi.categoryUrl(item.cat))}" data-route>All ${esc(meta.label)}</a>
                <a class="pager-link is-next" href="${esc(next.url)}" data-route>
                    <span class="pager-label">Next <span aria-hidden="true">→</span></span>
                    <span class="pager-title">${esc(next.title)}</span>
                </a>
            </nav>` : `
            <nav class="pager is-solo" aria-label="More work">
                <a class="pager-all" href="${esc(Chi.categoryUrl(item.cat))}" data-route>All ${esc(meta.label)}</a>
            </nav>`;

        document.title = `${item.title} — Chi Hoang`;
        swap(`
            <article class="project">
                <header class="proj-head">
                    <a class="back" href="${esc(Chi.categoryUrl(item.cat))}" data-route><span aria-hidden="true">←</span> ${esc(meta.label)}</a>
                    <p class="eyebrow">${esc(item.tag || meta.label)}</p>
                    <h1 class="proj-title">${esc(item.title)}</h1>
                    ${item.synopsis && item.synopsis !== item.type ? `<p class="proj-lead">${esc(item.synopsis)}</p>` : ''}
                    ${links}
                </header>
                ${lead}
                ${item.content ? `<div class="prose">${rich(item.content)}</div>` : ''}
                ${item.tools ? `<aside class="prose tools"><p class="eyebrow">Tools</p><p>${esc(item.tools)}</p></aside>` : ''}
                ${figs.map((f, n) => figure(f, n + 1, item.title, false)).join('')}
                ${pager}
            </article>`, !quiet, quiet);

        if (!quiet) window.scrollTo({ top: 0, behavior: 'instant' });
        setupEmbeds();
        state.images = Array.from(document.querySelectorAll('#view img.zoomable'));
    }

    /* ---------- embeds ----------
       YouTube → responsive 16:9. Small fixed-size widgets (e.g. Behance)
       keep their own ratio. Anything else (p5.js sketches, web apps) is
       rendered on a 1280×800 "stage" and scaled down to fit, so it sees a
       desktop-sized viewport even on a phone. */
    const STAGE_W = 1280, STAGE_H = 800;

    function attr(html, name) {
        const m = html.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, 'i'));
        return m ? m[1] : '';
    }

    function youtubeId(str) {
        const m = str.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
        return m ? m[1] : '';
    }

    const ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture';

    function embed(raw, title) {
        const src0 = String(raw || '').trim().replace(/^["']|["']$/g, '');
        if (!src0) return '';
        const t = esc(title);

        const yt = youtubeId(src0);
        if (yt) {
            return `<div class="fig fig-hero"><div class="embed embed-video">
                <iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}" title="${t}" loading="lazy" allow="${ALLOW}" referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div></div>`;
        }

        let src = '', w = 0, h = 0;
        if (/<iframe/i.test(src0)) {
            src = attr(src0, 'src');
            w = parseInt(attr(src0, 'width'), 10) || 0;
            h = parseInt(attr(src0, 'height'), 10) || 0;
            if (!src) return `<div class="fig fig-hero"><div class="embed embed-raw">${src0}</div></div>`;
        } else if (/^https?:\/\//i.test(src0)) {
            src = src0;
        } else if (src0.includes('<')) {
            return `<div class="fig fig-hero"><div class="embed embed-raw">${src0}</div></div>`;
        } else return '';

        if (!/^https?:\/\//i.test(src)) return '';

        if (w && h && w < 900) {
            return `<div class="fig fig-hero"><div class="embed embed-widget" style="aspect-ratio:${w}/${h};max-width:${Math.round(w * 1.4)}px">
                <iframe src="${esc(src)}" title="${t}" loading="lazy" allow="${ALLOW}"></iframe>
            </div></div>`;
        }

        return `<div class="fig fig-hero">
            <div class="embed embed-stage" data-stage>
                <iframe src="${esc(src)}" title="${t}" loading="lazy" allow="${ALLOW}" style="width:${STAGE_W}px;height:${STAGE_H}px"></iframe>
            </div>
            <p class="embed-note"><a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Open full screen <span aria-hidden="true">↗</span></a></p>
        </div>`;
    }

    function setupEmbeds() {
        const stages = document.querySelectorAll('[data-stage]');
        if (!stages.length) return;
        const fit = el => {
            const frame = el.querySelector('iframe');
            if (frame) frame.style.transform = `scale(${el.clientWidth / STAGE_W})`;
        };
        stages.forEach(fit);
        if ('ResizeObserver' in window) {
            embedObserver = new ResizeObserver(entries => entries.forEach(en => fit(en.target)));
            stages.forEach(el => embedObserver.observe(el));
        } else {
            embedObserver = { disconnect: () => window.removeEventListener('resize', onResize) };
            const onResize = () => stages.forEach(fit);
            window.addEventListener('resize', onResize);
        }
    }
    function teardownEmbeds() {
        if (embedObserver) { embedObserver.disconnect(); embedObserver = null; }
    }

    /* ---------- states ---------- */
    function renderSkeleton() {
        const view = $('#view');
        view.innerHTML = `
            <div class="index-head" aria-hidden="true">
                <span class="skel skel-line" style="width:6rem"></span>
                <span class="skel skel-title"></span>
                <span class="skel skel-line" style="width:min(28rem,80%)"></span>
            </div>
            <div class="grid" aria-hidden="true">
                ${Array.from({ length: 6 }, () => `
                    <span class="card is-skel"><span class="card-media skel"></span>
                    <span class="skel skel-line" style="width:40%;margin-top:1rem"></span>
                    <span class="skel skel-line" style="width:75%"></span></span>`).join('')}
            </div>
            <p class="sr-only" role="status">Loading projects…</p>`;
    }

    function renderError() {
        state.view = null;
        swap(`
            <div class="state">
                <h1 class="state-title">The projects didn’t load.</h1>
                <p>The connection may have dropped. Try again, or come back in a minute.</p>
                <button type="button" class="pill pill-solid" data-retry>Try again</button>
            </div>`);
        $('[data-retry]').addEventListener('click', () => boot(true));
    }

    function renderEmpty() {
        swap(`<div class="state"><h1 class="state-title">New work is on its way.</h1>
            <p><a class="text-btn" href="index.html">Back to the start</a></p></div>`);
    }

    /* ---------- top bar ---------- */
    function initBar() {
        const bar = $('#bar');
        if (!bar) return;
        const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- lightbox ---------- */
    function initLightbox() {
        const lb = $('#lightbox'), img = $('#lbImg'), count = $('#lbCount');
        const btnClose = $('#lbClose'), btnPrev = $('#lbPrev'), btnNext = $('#lbNext');
        if (!lb || !img) return;
        let index = 0, opener = null;

        const show = i => {
            const set = state.images;
            if (!set.length) return;
            index = (i + set.length) % set.length;
            img.src = set[index].currentSrc || set[index].src;
            img.alt = set[index].alt;
            count.textContent = set.length > 1 ? `${index + 1} / ${set.length}` : '';
            btnPrev.hidden = btnNext.hidden = set.length < 2;
        };
        const open = el => {
            opener = el;
            show(state.images.indexOf(el));
            lb.hidden = false;
            requestAnimationFrame(() => lb.classList.add('is-open'));
            document.body.classList.add('no-scroll');
            btnClose.focus();
        };
        const close = () => {
            lb.classList.remove('is-open');
            document.body.classList.remove('no-scroll');
            setTimeout(() => { lb.hidden = true; img.removeAttribute('src'); }, 250);
            if (opener) opener.focus({ preventScroll: true });
        };

        document.addEventListener('click', e => {
            const el = e.target.closest('#view img.zoomable');
            if (el) open(el);
        });
        btnClose.addEventListener('click', close);
        btnPrev.addEventListener('click', () => show(index - 1));
        btnNext.addEventListener('click', () => show(index + 1));
        lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-figure')) close(); });
        document.addEventListener('keydown', e => {
            if (lb.hidden) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') show(index - 1);
            else if (e.key === 'ArrowRight') show(index + 1);
            else if (e.key === 'Tab') { // keep focus inside the dialog
                const f = [btnClose, btnPrev, btnNext].filter(b => !b.hidden);
                const at = f.indexOf(document.activeElement);
                e.preventDefault();
                f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
            }
        });
        // images are click targets; give keyboard users the same
        document.addEventListener('keydown', e => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#view img.zoomable')) {
                e.preventDefault(); open(e.target);
            }
        });
        new MutationObserver(() => {
            document.querySelectorAll('#view img.zoomable:not([tabindex])').forEach(im => {
                im.tabIndex = 0;
                im.setAttribute('role', 'button');
                im.setAttribute('aria-label', `Enlarge: ${im.alt}`);
            });
        }).observe($('#view'), { childList: true, subtree: true });
    }
})();
