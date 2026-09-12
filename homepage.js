/* ============================================================
   CHI. — Homepage
   Hero slideshow · selected-work reel · random
   Data: Google Sheets CSV (published) — the hero and reel both read
   straight from it now; "Surprise me" can land on anything in it.
   ============================================================ */
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=18930479&single=true&output=csv';

// All of the sheet's image_main filenames (e.g. "vogueau_thumb.jpg") live
// in the "images/thumb/" folder (same place gallery.html reads them from).
const IMAGE_BASE = 'images/thumb/';

const GENRES = {
    fashion: { label: 'Fashion work' },
    art:     { label: 'Art & design' },
    writing: { label: 'Writing' },
    data:    { label: 'Data & decks' }
};

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

document.addEventListener('DOMContentLoaded', () => {
    initNavScroll();
    initYear();
    initHero();
    initReel();
    initRandom();
    initCopyLink();
});

/* ---------- data (shared by hero, reel, and "Surprise me") ---------- */
let dataPromise = null;
function loadData() {
    if (!dataPromise) {
        dataPromise = fetch(API_BASE_URL)
            .then(res => { if (!res.ok) throw new Error('Network error'); return res.text(); })
            .then(csv => parseCSV(csv))
            .catch(err => { dataPromise = null; throw err; }); // let a later call retry on failure
    }
    return dataPromise;
}

function parseCSV(csv) {
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = splitLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
        const values = splitLine(line);
        return headers.reduce((obj, h, i) => { obj[h] = (values[i] || '').trim(); return obj; }, {});
    });
}

/* CSV splitter that respects quotes */
function splitLine(line) {
    const values = []; let cur = '', inQ = false;
    for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { values.push(cur); cur = ''; }
        else cur += ch;
    }
    values.push(cur);
    return values;
}

const visible = items => items.filter(i => (i.show || '').toLowerCase() === 'y');

/* ---------- hero: automated slideshow, dots, rotates on a timer ----------
   Which projects appear is set by data-ids on the <section id="hero">;
   everything shown for each one (title, genre, image, synopsis) is pulled
   from the matching row in the sheet. */
async function initHero() {
    const heroEl = document.getElementById('hero');
    const media = document.getElementById('heroMedia');
    const dotsEl = document.getElementById('heroDots');
    if (!heroEl || !media || !dotsEl) return;

    const ids = (heroEl.dataset.ids || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;

    let allItems;
    try {
        allItems = await loadData();
    } catch (err) {
        console.error('Hero: could not load project data', err);
        return;
    }
    const byId = Object.fromEntries(allItems.map(it => [it.id, it]));
    const slides = ids.map(id => byId[id]).filter(Boolean); // ids with no matching row are skipped
    if (!slides.length) return;

    let idx = 0, timer = null;

    const paint = (i, animate = true) => {
        const item = slides[i];
        const genreKey = (item.collection || '').toLowerCase();
        const genreLabel = (GENRES[genreKey] && GENRES[genreKey].label) || item.collection || '';
        const type = item.description || ''; // sheet's short subtitle, e.g. "Internship"
        const synopsis = item.preview || item.description || ''; // sheet's "preview" holds the long synopsis
        const imgSrc = item.image_main ? `${IMAGE_BASE}${item.image_main}` : '';

        media.innerHTML = `<img src="${escapeHtml(imgSrc)}" alt="">`;
        if (animate) {
            const img = media.querySelector('img');
            img.style.animation = 'none';
            requestAnimationFrame(() => { img.style.animation = ''; });
        }
        document.getElementById('heroKicker').textContent = 'Featured';
        document.getElementById('heroTitle').textContent = item.title || '';
        document.getElementById('heroMeta').innerHTML =
            `<span>${escapeHtml(genreLabel)}</span><span class="sep">◆</span>` +
            `<span>${escapeHtml(type)}</span><span class="sep">◆</span><span>Project</span>`;
        document.getElementById('heroSynopsis').textContent = synopsis;
        const targetUrl = `gallery.html?collection=${encodeURIComponent(genreKey)}&id=${encodeURIComponent(item.id)}`;
        document.getElementById('heroCta').href = targetUrl;
        media.href = targetUrl;
        const heroMoreEl = document.getElementById('heroMore');
        if (heroMoreEl) heroMoreEl.href = targetUrl;
        dotsEl.querySelectorAll('.hdot').forEach((d, j) => {
            d.classList.toggle('active', j === i);
            d.setAttribute('aria-selected', j === i);
        });
    };

    dotsEl.innerHTML = '';
    slides.forEach((item, i) => {
        const b = document.createElement('button');
        b.className = 'hdot' + (i === 0 ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', `Show ${item.title || item.id}`);
        b.addEventListener('click', () => { idx = i; paint(i); restart(); });
        dotsEl.appendChild(b);
    });

    const goNext = () => { idx = (idx + 1) % slides.length; paint(idx); restart(); };
    const goPrev = () => { idx = (idx - 1 + slides.length) % slides.length; paint(idx); restart(); };
    const restart = () => { clearInterval(timer); timer = setInterval(() => { idx = (idx + 1) % slides.length; paint(idx); }, 7000); };

    paint(0, false);
    restart();

    const prevBtn = document.getElementById('heroPrev');
    const nextBtn = document.getElementById('heroNext');
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
    if (nextBtn) nextBtn.addEventListener('click', goNext);

    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft')  goPrev();
    });
}

/* ---------- selected work (reel) ----------
   Four landscape thumbnails, always visible together as one scene —
   nothing resizes or scrolls. Hovering, focusing, or tapping a
   thumbnail holds for a beat, then opens a compact tooltip with its
   synopsis. Leaving does the same in reverse, so a passing cursor
   doesn't flicker it open or shut. */
async function initReel() {
    const grid = document.getElementById('reelGrid');
    if (!grid) return;

    // index.html only sets data-id on each card now — everything else
    // (title, genre, image, synopsis) is pulled from the matching sheet row.
    const cardEls = Array.from(grid.querySelectorAll('.reel-card[data-id]'));
    if (!cardEls.length) return;

    let items;
    try {
        items = await loadData();
    } catch (err) {
        console.error('Reel: could not load project data', err);
        return;
    }
    const byId = Object.fromEntries(items.map(it => [it.id, it]));

    const liveCards = [];
    cardEls.forEach(card => {
        const item = byId[card.dataset.id];
        if (!item) { card.remove(); return; } // id in the HTML no longer matches a row — drop the slot
        paintReelCard(card, item);
        liveCards.push(card);
    });

    wireReelInteractions(grid, liveCards);
}

// NOTE on the sheet's column names: "preview" actually holds the long
// synopsis text, and "image_main" actually holds the thumbnail filename.
// "description" is really just a short subtitle (e.g. "Internship").
function paintReelCard(card, item) {
    const genreKey = (item.collection || '').toLowerCase();
    const genreLabel = (GENRES[genreKey] && GENRES[genreKey].label) || item.collection || '';
    const title = item.title || '';
    const synopsis = item.preview || item.description || '';
    const imgSrc = item.image_main ? `${IMAGE_BASE}${item.image_main}` : '';
    const detailId = `reel-detail-${item.id}`;

    card.dataset.genre = genreKey;
    card.setAttribute('aria-describedby', detailId);
    card.setAttribute('aria-expanded', 'false');

    card.innerHTML = `
        <a class="reel-media" href="gallery.html?collection=${encodeURIComponent(genreKey)}&id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(title)}">
            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(title)}">
            <div class="reel-shade"></div>
            <span class="work-open" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
            </span>
            <div class="reel-cap">
                <span class="reel-tag"><span class="puck"></span>${escapeHtml(genreLabel)}</span>
                <h3 class="reel-title">${escapeHtml(title)}</h3>
            </div>
        </a>
        <div class="reel-detail" id="${detailId}">
            <p class="reel-desc">${escapeHtml(synopsis)}</p>
            <span class="reel-cta">View project →</span>
        </div>
    `;
}

function wireReelInteractions(grid, cards) {
    const OPEN_DELAY = 320;
    const CLOSE_DELAY = 220;
    const isTouch = window.matchMedia('(hover: none)').matches;
    let openTimer = null;
    let closeTimer = null;

    const setActive = (card) => {
        cards.forEach(c => {
            const active = c === card;
            c.classList.toggle('is-active', active);
            c.setAttribute('aria-expanded', String(active));
        });
        grid.classList.add('is-engaged');
    };
    const clearActive = () => {
        cards.forEach(c => { c.classList.remove('is-active'); c.setAttribute('aria-expanded', 'false'); });
        grid.classList.remove('is-engaged');
    };
    const scheduleOpen = (card) => { clearTimeout(closeTimer); openTimer = setTimeout(() => setActive(card), OPEN_DELAY); };
    const scheduleClose = () => { clearTimeout(openTimer); closeTimer = setTimeout(clearActive, CLOSE_DELAY); };

    cards.forEach(card => {
        if (!isTouch) {
            card.addEventListener('mouseenter', () => scheduleOpen(card));
            card.addEventListener('mouseleave', scheduleClose);
            card.addEventListener('focusin', () => scheduleOpen(card));
            card.addEventListener('focusout', e => { if (!card.contains(e.relatedTarget)) scheduleClose(); });
            card.addEventListener('keydown', e => { if (e.key === 'Escape') clearActive(); });
        } else {
            // First tap opens the tooltip; a second tap on the link follows through,
            // so a stray tap while scrolling doesn't send someone straight off the page.
            card.addEventListener('click', e => {
                if (!card.classList.contains('is-active')) { e.preventDefault(); setActive(card); }
            });
        }
    });

    grid.addEventListener('mouseleave', scheduleClose);
}

/* ---------- random ---------- */
function initRandom() {
    const btn = document.getElementById('randomBtn');
    const foot = document.getElementById('footerRandom');
    if (!btn) return;

    const go = async (e) => {
        if (e) e.preventDefault();
        const lbl = btn.querySelector('.lbl');
        const orig = lbl.textContent;
        btn.classList.add('is-loading');
        lbl.textContent = 'Rolling…';
        try {
            const data = visible(await loadData());
            if (!data.length) throw new Error('empty');
            const pick = data[Math.floor(Math.random() * data.length)];
            window.open(`gallery.html?collection=${encodeURIComponent(pick.collection)}&id=${encodeURIComponent(pick.id)}`, '_blank');
        } catch (err) {
            console.error(err);
        } finally {
            btn.classList.remove('is-loading');
            lbl.textContent = orig;
        }
    };

    btn.addEventListener('click', go);
    if (foot) foot.addEventListener('click', go);
}

/* ---------- misc ---------- */
function initCopyLink() {
    const btn = document.getElementById('copyLinkBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1600);
        } catch (e) { console.warn(e); }
    });
}

function initNavScroll() {
    const nav = document.getElementById('topnav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function initYear() {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
}
