/* ============================================================
   CHI. — Landing page
   Grain blobs · three categories · featured-project hover cards

   Hovering (or focusing) a category waits a beat, then opens a card
   with that category's featured project beside the link, joined to it
   by a thin line. Leaving waits a beat too, so the cursor can travel
   into the card without it snapping shut. On touch screens the first
   tap opens the card as a bottom sheet and a second tap on the same
   category goes through to its gallery.
   ============================================================ */
(function () {
    'use strict';

    const OPEN_DELAY = 150;   // first open
    const SWITCH_DELAY = 40;  // moving between categories while a card is open
    const CLOSE_DELAY = 280;
    const GAP = 44;           // px between link and card (the connector line)
    const EDGE = 16;          // min distance from viewport edges
    const SHEET_BELOW = 760;  // below this width the card docks to the bottom

    document.addEventListener('DOMContentLoaded', () => {
        Chi.mountGrain(document.getElementById('grain'), 'landing');
        Chi.fillYear();
        Chi.wireSurprise();
        Chi.wireCopyLink();
        initToTop();
        initPeek();
    });

    function initToTop() {
        document.querySelectorAll('[data-to-top]').forEach(a => a.addEventListener('click', e => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }));
    }

    function initPeek() {
        const nav = document.getElementById('cats');
        const peek = document.getElementById('peek');
        if (!nav || !peek) return;

        const links = Array.from(nav.querySelectorAll('.cat[data-cat]'));
        const coarse = window.matchMedia('(hover: none), (pointer: coarse)');
        const isTouch = () => coarse.matches;

        const info = new Map();
        links.forEach(link => {
            const cat = Chi.resolveCategory(link.dataset.cat);
            if (!cat) return;
            link.href = Chi.categoryUrl(cat);
            info.set(link, { cat, item: null, count: 0, ready: false });
        });

        let active = null, openTimer = 0, closeTimer = 0, renderedKey = '';

        Chi.loadProjects().then(all => {
            const visible = all.filter(p => p.visible);
            info.forEach((rec, link) => {
                const ids = (link.dataset.featured || '').split(',').map(s => s.trim()).filter(Boolean);
                rec.item = ids.map(id => visible.find(p => p.id === id)).find(Boolean)
                    || visible.find(p => p.cat === rec.cat) || null;
                rec.count = visible.filter(p => p.cat === rec.cat).length;
                rec.ready = true;
                if (rec.item && rec.item.thumb) { const im = new Image(); im.src = rec.item.thumb; } // warm the cache
                describe(link, rec);
            });
            if (active) { renderedKey = ''; render(active); place(active); }
        }).catch(err => {
            console.warn('Landing: project data unavailable, cards show category notes only.', err);
            info.forEach(rec => { rec.ready = true; });
        });

        // Screen readers get the featured project as the link's description.
        function describe(link, rec) {
            if (!rec.item) return;
            const id = `cat-desc-${rec.cat}`;
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('span');
                el.id = id;
                el.className = 'sr-only';
                nav.appendChild(el);
            }
            el.textContent = `${rec.count} projects. Featured: ${rec.item.title}.`;
            link.setAttribute('aria-describedby', id);
        }

        function render(link) {
            const rec = info.get(link);
            if (!rec) return;
            const key = `${rec.cat}:${rec.item ? rec.item.id : 'none'}:${isTouch()}`;
            if (key === renderedKey) return;
            renderedKey = key;

            const meta = Chi.CATEGORIES[rec.cat];
            const it = rec.item;
            const href = it ? it.url : Chi.categoryUrl(rec.cat);
            const media = it && it.thumb
                ? `<span class="peek-media" data-media><img src="${Chi.esc(it.thumb)}" alt="" decoding="async"></span>`
                : `<span class="peek-media media-missing" data-media></span>`;
            const kicker = it ? `Featured${it.type ? ' · ' + Chi.esc(it.type) : ''}` : Chi.esc(meta.label);
            const title = it ? it.title : meta.label;
            const text = it ? it.synopsis : meta.blurb;
            const cta = it ? 'View project' : `Browse ${meta.label}`;
            const count = rec.count ? `${rec.count} projects` : '';
            const hint = isTouch()
                ? `<span class="peek-hint">Tap <b>${Chi.esc(meta.label)}</b> again for ${count ? 'all ' + count : 'the full collection'}</span>`
                : (count ? `<span class="peek-count">1 of ${count} in ${Chi.esc(meta.label)}</span>` : '');

            peek.innerHTML = `
                <a class="peek-card" href="${Chi.esc(href)}" tabindex="-1">
                    ${media}
                    <span class="peek-body">
                        <span class="peek-kicker">${kicker}</span>
                        <span class="peek-title">${Chi.esc(title)}</span>
                        <span class="peek-text">${Chi.esc(text)}</span>
                        <span class="peek-foot">
                            <span class="peek-cta">${cta}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
                            ${hint}
                        </span>
                    </span>
                </a>`;
        }

        function place(link) {
            const sheet = isTouch() || window.innerWidth < SHEET_BELOW;
            peek.classList.toggle('is-sheet', sheet);
            if (sheet) { peek.classList.remove('is-left'); return; }

            // The card sits in a fixed column beside the whole category list,
            // top-aligned with it (so it never covers the title), and stays
            // put while you move between categories. Only the connector line
            // moves, reaching from the hovered link to the card.
            const r = link.getBoundingClientRect();
            const n = nav.getBoundingClientRect();
            const W = peek.offsetWidth, H = peek.offsetHeight;
            let x = n.right + GAP, left = false;
            if (x + W > window.innerWidth - EDGE) { x = n.left - GAP - W; left = true; }
            x = Math.max(EDGE, x);
            const anchor = r.top + r.height / 2;
            const y = Math.min(Math.max(n.top - 8, EDGE), window.innerHeight - H - EDGE);
            const reach = left ? r.left - (x + W) : x - r.right;

            peek.classList.toggle('is-left', left);
            peek.style.setProperty('--x', `${Math.round(x)}px`);
            peek.style.setProperty('--y', `${Math.round(y)}px`);
            peek.style.setProperty('--line-y', `${Math.round(Math.min(Math.max(anchor - y, 12), H - 12))}px`);
            peek.style.setProperty('--gap', `${Math.max(12, Math.round(reach))}px`);
        }

        function open(link) {
            clearTimeout(openTimer); clearTimeout(closeTimer);
            active = link;
            render(link);
            place(link);
            peek.classList.add('is-open');
            nav.classList.add('is-engaged');
            links.forEach(l => l.classList.toggle('is-active', l === link));
        }

        function close() {
            clearTimeout(openTimer); clearTimeout(closeTimer);
            active = null;
            peek.classList.remove('is-open');
            nav.classList.remove('is-engaged');
            links.forEach(l => l.classList.remove('is-active'));
        }

        const scheduleOpen = link => {
            clearTimeout(closeTimer); clearTimeout(openTimer);
            if (active === link) return;
            openTimer = setTimeout(() => open(link), peek.classList.contains('is-open') ? SWITCH_DELAY : OPEN_DELAY);
        };
        const scheduleClose = () => {
            clearTimeout(openTimer); clearTimeout(closeTimer);
            closeTimer = setTimeout(close, CLOSE_DELAY);
        };
        const isMouse = e => e.pointerType === 'mouse' || e.pointerType === 'pen';

        links.forEach(link => {
            link.addEventListener('pointerenter', e => { if (isMouse(e)) scheduleOpen(link); });
            link.addEventListener('pointerleave', e => { if (isMouse(e)) scheduleClose(); });
            link.addEventListener('focus', () => { if (!isTouch()) scheduleOpen(link); });
            link.addEventListener('blur', () => { if (!isTouch()) scheduleClose(); });
            link.addEventListener('click', e => {
                // First tap previews, second tap goes through.
                if (isTouch() && active !== link) { e.preventDefault(); open(link); }
            });
        });

        peek.addEventListener('pointerenter', e => { if (isMouse(e)) clearTimeout(closeTimer); });
        peek.addEventListener('pointerleave', e => { if (isMouse(e)) scheduleClose(); });

        document.addEventListener('pointerdown', e => {
            if (active && !nav.contains(e.target) && !peek.contains(e.target)) close();
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && active) close(); });

        let raf = 0;
        const reflow = () => {
            if (!active) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                if (!active) return;
                const r = active.getBoundingClientRect();
                if (r.bottom < 0 || r.top > window.innerHeight) { close(); return; }
                place(active);
            });
        };
        window.addEventListener('resize', reflow);
        window.addEventListener('scroll', reflow, { passive: true });
        coarse.addEventListener?.('change', () => { renderedKey = ''; close(); });
    }
})();
