/* ============================================================
   CHI. — Homepage
   Hero slideshow · selected-work reel · random
   Data: Google Sheets CSV (published) — used only by "Surprise me",
   which can land on anything in the full catalogue.
   ============================================================ */
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=18930479&single=true&output=csv';

const GENRES = {
    fashion: { label: 'Fashion work' },
    art:     { label: 'Art & design' },
    writing: { label: 'Writing' },
    data:    { label: 'Data & decks' }
};

const HERO_IDS = ['vogueau', 'fame20263', 'patagonia', 'upcycling'];
const HERO_META = {
    vogueau:   { kicker: 'Featured · Editorial', sub: 'Vogue Australia' },
    fame20263: { kicker: 'Featured · Capsule collection', sub: 'Collina Strada' },
    patagonia: { kicker: 'Featured · Data & GIS', sub: 'Patagonia Books' },
    upcycling: { kicker: 'Featured · Slow fashion', sub: '12 documented pieces' }
};
const HERO_IMGS = {
    vogueau:   'images/featured/vogue featured.png',
    fame20263: 'images/featured/strada featured.png',
    patagonia: 'images/featured/Patagonia featured.png',
    upcycling: 'images/featured/upcycle featured.png'
};
const HERO_TITLES = {
    vogueau: 'Internship at Vogue Australia',
    fame20263: 'Collina Strada AW 26/27 — Geo-Logic Capsule',
    patagonia: 'Patagonia Data Illustration',
    upcycling: 'Upcycled!'
};
const HERO_SYN = {
    vogueau: 'The clean-girl aesthetic as a cultural "norm" — tracing how effort shapes the idea of effortlessness. Daily editorial work, from pitching to commercial, with Gladys Lai and Nina Miyashita.',
    fame20263: 'A sustainable six-piece capsule for Collina Strada interpreting the WGSN "Geo-Logic" macro-trend — playful, organic ideas merged with technical accuracy and eco-friendly sourcing.',
    patagonia: 'Published, data-driven StoryMaps for Patagonia Books built with ESRI — a sophomore working with three geography seniors on commercial web apps that went live.',
    upcycling: 'Late nights of sewing, draping and problem-solving turned into a slow-fashion practice — 12 documented pieces and a national television feature.'
};
const HERO_GENRE = { vogueau: 'writing', fame20263: 'fashion', patagonia: 'data', upcycling: 'fashion' };

let portfolioData = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavScroll();
    initYear();
    initHero();
    initReel();
    initRandom();
    initCopyLink();
});

/* ---------- data (only "Surprise me" needs this) ---------- */
async function loadData() {
    if (portfolioData) return portfolioData;
    const res = await fetch(API_BASE_URL);
    if (!res.ok) throw new Error('Network error');
    portfolioData = parseCSV(await res.text());
    return portfolioData;
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

/* ---------- hero: automated slideshow, 4 dots, rotates on a timer ---------- */
function initHero() {
    const media = document.getElementById('heroMedia');
    const dotsEl = document.getElementById('heroDots');
    if (!media || !dotsEl) return;

    let idx = 0, timer = null;

    const paint = (i, animate = true) => {
        const id = HERO_IDS[i];
        media.innerHTML = `<img src="${HERO_IMGS[id]}" alt="">`;
        if (animate) {
            const img = media.querySelector('img');
            img.style.animation = 'none';
            requestAnimationFrame(() => { img.style.animation = ''; });
        }
        document.getElementById('heroKicker').textContent = HERO_META[id].kicker;
        document.getElementById('heroTitle').textContent = HERO_TITLES[id];
        document.getElementById('heroMeta').innerHTML =
            `<span>${GENRES[HERO_GENRE[id]].label}</span><span class="sep">◆</span>` +
            `<span>${HERO_META[id].sub}</span><span class="sep">◆</span><span>Project</span>`;
        document.getElementById('heroSynopsis').textContent = HERO_SYN[id];
        document.getElementById('heroCta').href = `post.html?id=${id}`;
        document.getElementById('heroMore').href = `post.html?id=${id}`;
        dotsEl.querySelectorAll('.hdot').forEach((d, j) => {
            d.classList.toggle('active', j === i);
            d.setAttribute('aria-selected', j === i);
        });
    };

    HERO_IDS.forEach((id, i) => {
        const b = document.createElement('button');
        b.className = 'hdot' + (i === 0 ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', `Show ${HERO_TITLES[id]}`);
        b.addEventListener('click', () => { idx = i; paint(i); restart(); });
        dotsEl.appendChild(b);
    });

    const goNext = () => { idx = (idx + 1) % HERO_IDS.length; paint(idx); restart(); };
    const goPrev = () => { idx = (idx - 1 + HERO_IDS.length) % HERO_IDS.length; paint(idx); restart(); };
    const restart = () => { clearInterval(timer); timer = setInterval(() => { idx = (idx + 1) % HERO_IDS.length; paint(idx); }, 7000); };

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
function initReel() {
    const grid = document.getElementById('reelGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.reel-card'));
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
            window.open(`post.html?id=${pick.id}`, '_blank');
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
