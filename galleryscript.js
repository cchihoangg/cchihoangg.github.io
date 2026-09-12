/* ============================================================
   CHI. — Gallery / Browse page
   Work rail (click to select) · inline detail panel · random
   Data: Google Sheets CSV (published)
   ============================================================ */
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=18930479&single=true&output=csv';

const THUMB_DIR = 'images/thumb/';
const GENRES = {
    fashion: { label: 'Fashion work' },
    art:     { label: 'Art & design' },
    writing: { label: 'Writing' },
    data:    { label: 'Data & decks' }
};
const COLLECTION_DESC = {
    all:     'Every visible project across fashion, art, data and writing — the full catalogue.',
    fashion: 'Lines development, sketches, shows and upcycling — fashion as making and as system.',
    art:     '3D multimedia, interactive visuals and generative pieces — art as experiment.',
    writing: 'Creative, academic and opinion pieces — writing as research and voice.',
    data:    'Case studies, dashboards and decks — data as storytelling.'
};

let portfolioData = null;
let currentFilter = 'all';
let items = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavScroll();
    initRandom();
    initLightbox();
    initRailArrows();
    initScrollCue();
    loadGallery();
});

/* ---------- data ---------- */
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

/* ---------- main ---------- */
async function loadGallery() {
    showLoading(true);
    try {
        const data = visible(await loadData());
        const params = new URLSearchParams(window.location.search);
        const requested = (params.get('collection') || 'all').toLowerCase();
        currentFilter = GENRES[requested] ? requested : 'all';
        items = currentFilter === 'all' ? data : data.filter(i => i.collection === currentFilter);

        updateHead();

        if (!items.length) {
            showError('No projects in this collection yet.');
            return;
        }

        renderRail();
        showLoading(false);

        const requestedId = params.get('id');
        const initial = items.find(i => i.id === requestedId) || items[0];
        selectWork(initial, { scroll: false, updateUrl: false });
    } catch (e) {
        console.error(e);
        showError('Could not load the catalogue. Check your connection and refresh.');
    }
}

function updateHead() {
    const title = currentFilter === 'all' ? 'Browse everything' : GENRES[currentFilter].label;
    const titleEl = document.getElementById('collectionTitle');
    const descEl = document.getElementById('collectionDesc');
    const crumb = document.getElementById('crumbCurrent');
    const pageTitle = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = COLLECTION_DESC[currentFilter];
    if (crumb) crumb.textContent = title;
    if (pageTitle) pageTitle.textContent = `Chi Hoang — ${title}`;

    document.querySelectorAll('.topnav-links a[data-nav]').forEach(a => {
        a.classList.toggle('active', a.dataset.nav === currentFilter);
    });
}

/* ---------- work rail ---------- */
function renderRail() {
    const rail = document.getElementById('workRail');
    if (!rail) return;

    const countEl = document.getElementById('railCount');
    if (countEl) countEl.textContent = items.length === 1 ? '1 project' : `${items.length} projects`;

    rail.innerHTML = items.map(item => {
        const genre = GENRES[item.collection] ? item.collection : 'fashion';
        const img = item.image_main ? THUMB_DIR + item.image_main.trim() : '';
        return `
            <button type="button" class="work-card" data-id="${item.id}" data-genre="${genre}" aria-pressed="false" aria-label="Open ${escapeAttr(item.title)}">
                <span class="work-media">
                    ${img ? `<img src="${img}" alt="" loading="lazy">` : ''}
                    <span class="work-shade"></span>
                    <span class="work-open" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
                    </span>
                    <span class="work-cap">
                        <span class="work-tag"><span class="puck"></span>${GENRES[genre].label}</span>
                        <span class="work-title">${escapeHTML(item.title)}</span>
                    </span>
                </span>
            </button>`;
    }).join('');

    rail.querySelectorAll('.work-card').forEach(card => {
        card.addEventListener('click', () => {
            const item = items.find(i => i.id === card.dataset.id);
            if (item) selectWork(item, { scroll: true, updateUrl: true });
        });
    });

    const wrap = document.getElementById('railWrap');
    if (wrap) wrap.style.display = 'flex';
    updateRailArrows();
}

function initRailArrows() {
    const rail = document.getElementById('workRail');
    const prev = document.getElementById('railPrev');
    const next = document.getElementById('railNext');
    if (!rail || !prev || !next) return;
    prev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * 0.85, behavior: 'smooth' }));
    next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * 0.85, behavior: 'smooth' }));
    rail.addEventListener('scroll', updateRailArrows, { passive: true });
    window.addEventListener('resize', updateRailArrows);
}

function updateRailArrows() {
    const rail = document.getElementById('workRail');
    const prev = document.getElementById('railPrev');
    const next = document.getElementById('railNext');
    if (!rail || !prev || !next) return;

    const scrollable = rail.scrollWidth > rail.clientWidth + 4;
    prev.style.display = scrollable ? 'grid' : 'none';
    next.style.display = scrollable ? 'grid' : 'none';
    if (!scrollable) return;

    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 4;
}

/* ---------- scroll cue — invites the reader from the rail down to the write-up ---------- */
function initScrollCue() {
    const cue = document.getElementById('scrollCue');
    if (!cue) return;
    cue.addEventListener('click', () => {
        const detail = document.getElementById('detail');
        if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function updateScrollCue(item) {
    const cue = document.getElementById('scrollCue');
    const label = document.getElementById('scrollCueLabel');
    if (!cue) return;
    if (label) label.textContent = `Read “${item.title}”`;
    cue.style.display = 'inline-flex';
}

/* ---------- selection → inline detail ---------- */
function selectWork(item, opts = {}) {
    document.querySelectorAll('.work-card').forEach(card => {
        const active = card.dataset.id === item.id;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-pressed', String(active));
        if (active && opts.centerRail) {
            card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });

    renderDetail(item);

    if (opts.updateUrl !== false) {
        const params = new URLSearchParams(window.location.search);
        if (currentFilter === 'all') params.delete('collection'); else params.set('collection', currentFilter);
        params.set('id', item.id);
        history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    }

    if (opts.scroll) {
        const detail = document.getElementById('detail');
        if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderDetail(item) {
    const detail = document.getElementById('detail');
    const heroMedia = document.getElementById('detailHeroMedia');
    const titleEl = document.getElementById('detailTitle');
    const metaEl = document.getElementById('detailMeta');
    const main = document.getElementById('detailMain');
    if (!detail || !main) return;

    const genre = GENRES[item.collection] ? item.collection : 'fashion';

    document.title = `Chi Hoang — ${item.title}`;
    if (titleEl) titleEl.textContent = item.title;
    if (metaEl) {
        metaEl.innerHTML =
            `<span class="genre">${GENRES[genre].label}</span>` +
            `<span class="sep">◆</span><span>Project</span>` +
            (item.category ? `<span class="sep">◆</span><span>${escapeHTML(item.category)}</span>` : '');
    }

    let heroSrc = '';
    for (let i = 1; i <= 20 && !heroSrc; i++) {
        if (item[`pic${i}`]) heroSrc = `images/${item[`pic${i}`]}`;
    }
    if (!heroSrc && item.image_main) heroSrc = THUMB_DIR + item.image_main.trim();
    if (heroMedia) heroMedia.innerHTML = heroSrc ? `<img src="${heroSrc}" alt="">` : '';

    let html = '';
    if (item.description) html += `<p class="post-lead">${escapeHTML(item.description)}</p>`;

    const embedRaw = (item.embed || item.Embed || '').trim().replace(/^["']|["']$/g, '');
    if (embedRaw) {
        const embedHTML = buildEmbed(embedRaw);
        if (embedHTML) html += `<div class="post-embed">${embedHTML}</div>`;
    }

    if (item.links) {
        const links = item.links.split(',').map(s => s.trim()).filter(Boolean);
        html += `<div class="post-links">` + links.map(entry => {
            if (entry.includes('__')) {
                const [display, url] = entry.split('__').map(s => s.trim());
                return `<a class="btn-pill" href="${url}" target="_blank" rel="noopener noreferrer">↗ ${escapeHTML(display)}</a>`;
            }
            return `<a class="btn-pill" href="${entry}" target="_blank" rel="noopener noreferrer">↗ ${escapeHTML(entry)}</a>`;
        }).join('') + `</div>`;
    }

    if (item.content) {
        html += `<div class="post-long-content">${linkify(escapeHTML(item.content).replace(/\n/g, '<br>'))}</div>`;
    }

    if (item.tools) {
        html += `
            <div class="post-tools">
                <h3>Tools used</h3>
                <p>${escapeHTML(item.tools)}</p>
            </div>`;
    }

    let i = 1;
    while (item[`pic${i}`]) {
        const imgPath = `images/${item[`pic${i}`]}`;
        const cap = item[`cap${i}`];
        html += `
            <figure class="post-figure">
                <img src="${imgPath}" alt="${escapeAttr(cap || `Project image ${i}`)}" class="post-image" loading="lazy">
                ${cap ? `<figcaption class="post-caption">${escapeHTML(cap)}</figcaption>` : ''}
            </figure>`;
        i++;
    }

    main.innerHTML = html;
    detail.style.display = 'block';
    renderWorkNav(item);
    updateScrollCue(item);
    setTimeout(scaleEmbeds, 60);
}

/* prev / next within the currently loaded collection */
function renderWorkNav(item) {
    const nav = document.getElementById('workNav');
    if (!nav) return;
    const idx = items.findIndex(i => i.id === item.id);
    const prevItem = idx > 0 ? items[idx - 1] : null;
    const nextItem = idx < items.length - 1 ? items[idx + 1] : null;

    nav.innerHTML =
        (prevItem ? `<button type="button" class="btn-pill work-nav-btn" data-dir="prev">← ${escapeHTML(prevItem.title)}</button>` : '<span></span>') +
        (nextItem ? `<button type="button" class="btn-pill work-nav-btn" data-dir="next">${escapeHTML(nextItem.title)} →</button>` : '<span></span>');

    const prevBtn = nav.querySelector('[data-dir="prev"]');
    const nextBtn = nav.querySelector('[data-dir="next"]');
    if (prevBtn) prevBtn.addEventListener('click', () => selectWork(prevItem, { scroll: true, updateUrl: true, centerRail: true }));
    if (nextBtn) nextBtn.addEventListener('click', () => selectWork(nextItem, { scroll: true, updateUrl: true, centerRail: true }));
}

/* ---------- embeds ---------- */
function buildEmbed(embedContent) {
    if (/youtube\.com|youtu\.be/.test(embedContent)) {
        let videoId = '';
        if (embedContent.includes('watch?v=')) videoId = embedContent.split('v=')[1]?.split('&')[0] || '';
        else if (embedContent.includes('youtu.be/')) videoId = embedContent.split('youtu.be/')[1]?.split('?')[0] || '';
        else if (embedContent.includes('embed/')) videoId = embedContent.split('embed/')[1]?.split('?')[0] || '';
        if (videoId) {
            return `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
        }
    }
    if (embedContent.includes('<iframe')) {
        const m = embedContent.match(/src\s*=\s*["']([^"']+)["']/i) || embedContent.match(/src\s*=\s*([^\s>]+)/i);
        if (m) {
            return `<iframe src="${m[1]}" frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
        }
        return embedContent;
    }
    if (/^https?:\/\//i.test(embedContent)) {
        return `<iframe src="${embedContent}" frameborder="0" allowfullscreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
    }
    if (embedContent.includes('<')) return embedContent;
    return '';
}

function scaleEmbeds() {
    const baseWidth = 1920;
    document.querySelectorAll('.post-embed').forEach(container => {
        const iframe = container.querySelector('iframe');
        if (!iframe) return;
        const scale = container.offsetWidth / baseWidth;
        iframe.style.transform = `scale(${Math.min(scale, 1)})`;
    });
}
window.addEventListener('resize', scaleEmbeds);

/* ---------- lightbox ---------- */
function initLightbox() {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lbImg');
    const close = document.getElementById('lbClose');
    if (!lb) return;

    document.addEventListener('click', e => {
        const img = e.target.closest('.post-image');
        if (img) {
            lbImg.src = img.src;
            lbImg.alt = img.alt;
            lb.classList.add('open');
            lb.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
    });
    const shut = () => {
        lb.classList.remove('open');
        lb.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };
    if (close) close.addEventListener('click', shut);
    lb.addEventListener('click', e => { if (e.target === lb) shut(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
}

/* ---------- random ---------- */
function initRandom() {
    const btn = document.getElementById('randomBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const lbl = btn.querySelector('.lbl');
        const orig = lbl.textContent;
        btn.classList.add('is-loading');
        lbl.textContent = 'Rolling…';
        try {
            const data = visible(await loadData());
            if (!data.length) throw new Error('empty');
            const pick = data[Math.floor(Math.random() * data.length)];
            window.location.href = `gallery.html?collection=${pick.collection}&id=${pick.id}`;
        } catch (e) {
            console.error(e);
        } finally {
            btn.classList.remove('is-loading');
            lbl.textContent = orig;
        }
    });
}

/* ---------- ui helpers ---------- */
function initNavScroll() {
    const nav = document.getElementById('topnav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function showLoading(show) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    const wrap = document.getElementById('railWrap');
    const detail = document.getElementById('detail');
    const cue = document.getElementById('scrollCue');
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (show && error) error.style.display = 'none';
    if (show && wrap) wrap.style.display = 'none';
    if (show && detail) detail.style.display = 'none';
    if (show && cue) cue.style.display = 'none';
}

function showError(msg) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    const wrap = document.getElementById('railWrap');
    const detail = document.getElementById('detail');
    const cue = document.getElementById('scrollCue');
    if (loading) loading.style.display = 'none';
    if (wrap) wrap.style.display = 'none';
    if (detail) detail.style.display = 'none';
    if (cue) cue.style.display = 'none';
    if (error) {
        error.style.display = 'block';
        error.innerHTML = `<p>${escapeHTML(msg)}</p>`;
    }
}

function escapeHTML(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) { return escapeHTML(s).replace(/"/g, '&quot;'); }

/* turn bare URLs in text into links */
function linkify(text) {
    return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
