/* ============================================================
   CHI. — Post page
   Cinematic hero · body render · embeds · lightbox · binge nav
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

let portfolioData = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavScroll();
    initRandom();
    initProgress();
    initLightbox();
    initPostPage();
});

/* ---------- boot ---------- */
function initPostPage() {
    const postId = new URLSearchParams(window.location.search).get('id');
    if (!postId) { showError('No project specified.'); return; }
    loadPost(postId);
}

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

/* ---------- post ---------- */
async function loadPost(postId) {
    showLoading(true);
    try {
        const data = visible(await loadData());
        const post = data.find(i => i.id === postId);
        if (!post) { showError('This project could not be found.'); return; }

        setBackLink(post.collection);
        renderPost(post);
        setupBingeNav(data, postId);
        scaleEmbeds();
        showLoading(false);
    } catch (e) {
        console.error(e);
        showError('Could not load this project. Check your connection and refresh.');
    }
}

function setBackLink(collection) {
    const back = document.getElementById('backToGallery');
    if (back && collection) back.href = `gallery.html?collection=${collection}`;
    document.querySelectorAll('.topnav-links a[data-nav]').forEach(a => {
        a.classList.toggle('active', a.dataset.nav === collection);
    });
}

function renderPost(item) {
    const content = document.getElementById('postContent');
    const heroMedia = document.getElementById('postHeroMedia');
    const titleEl = document.getElementById('postTitle');
    const metaEl = document.getElementById('postMeta');
    const crumbTitle = document.getElementById('crumbTitle');
    const main = document.getElementById('postMainContent');
    const pageTitle = document.getElementById('pageTitle');
    if (!content || !main) return;

    const genre = GENRES[item.collection] ? item.collection : 'fashion';

    if (pageTitle) pageTitle.textContent = `Chi Hoang — ${item.title}`;
    if (titleEl) titleEl.textContent = item.title;
    if (crumbTitle) crumbTitle.textContent = item.title;

    if (metaEl) {
        metaEl.innerHTML =
            `<span class="genre">${GENRES[genre].label}</span>` +
            `<span class="sep">◆</span><span>Project</span>` +
            (item.category ? `<span class="sep">◆</span><span>${escapeHTML(item.category)}</span>` : '');
    }

    // hero image: first picture if available, else thumb
    let heroSrc = '';
    for (let i = 1; i <= 20 && !heroSrc; i++) {
        if (item[`pic${i}`]) heroSrc = `images/${item[`pic${i}`]}`;
    }
    if (!heroSrc && item.image_main) heroSrc = THUMB_DIR + item.image_main.trim();
    if (heroMedia) heroMedia.innerHTML = heroSrc ? `<img src="${heroSrc}" alt="">` : '';

    /* ---- body ---- */
    let html = '';

    if (item.description) html += `<p class="post-lead">${escapeHTML(item.description)}</p>`;

    // embeds (YouTube / iframe / direct URL)
    const embedRaw = (item.embed || item.Embed || '').trim().replace(/^["']|["']$/g, '');
    if (embedRaw) {
        const embedHTML = buildEmbed(embedRaw);
        if (embedHTML) html += `<div class="post-embed">${embedHTML}</div>`;
    }

    // links: "Display__url" format
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

    // long content
    if (item.content) {
        html += `<div class="post-long-content">${linkify(escapeHTML(item.content).replace(/\n/g, '<br>'))}</div>`;
    }

    // tools
    if (item.tools) {
        html += `
            <div class="post-tools">
                <h3>Tools used</h3>
                <p>${escapeHTML(item.tools)}</p>
            </div>`;
    }

    // pictures with captions (unlimited sequence)
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
    content.style.display = 'block';
    setTimeout(scaleEmbeds, 60);
}

/* ---------- embeds ---------- */
function buildEmbed(embedContent) {
    // YouTube
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
    // existing iframe tag → extract src
    if (embedContent.includes('<iframe')) {
        const m = embedContent.match(/src\s*=\s*["']([^"']+)["']/i) || embedContent.match(/src\s*=\s*([^\s>]+)/i);
        if (m) {
            return `<iframe src="${m[1]}" frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
        }
        return embedContent;
    }
    // direct URL (p5.js, codepen, storymaps…)
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

/* ---------- binge nav (prev / next) ---------- */
function setupBingeNav(data, currentPostId) {
    const idx = data.findIndex(i => i.id === currentPostId);
    const prev = document.getElementById('prevPost');
    const next = document.getElementById('nextPost');
    if (idx === -1 || !prev || !next) return;

    const set = (el, post, which) => {
        el.href = `post.html?id=${post.id}`;
        el.style.display = 'block';
        const img = el.querySelector('img');
        const title = el.querySelector('.binge-title');
        if (img) img.src = post.image_main ? THUMB_DIR + post.image_main.trim() : '';
        if (img) img.alt = post.title;
        if (title) title.textContent = post.title;
    };

    if (idx > 0) set(prev, data[idx - 1], 'prev'); else prev.style.display = 'none';
    if (idx < data.length - 1) set(next, data[idx + 1], 'next'); else next.style.display = 'none';
}

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

/* ---------- reading progress ---------- */
function initProgress() {
    const bar = document.getElementById('progressBar');
    if (!bar) return;
    const update = () => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
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
            window.location.href = `post.html?id=${pick.id}`;
        } catch (e) {
            console.error(e);
        } finally {
            btn.classList.remove('is-loading');
            lbl.textContent = orig;
        }
    });
}

/* ---------- misc ---------- */
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
    const content = document.getElementById('postContent');
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (show && error) error.style.display = 'none';
    if (content && show) content.style.display = 'none';
}

function showError(msg) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    if (loading) loading.style.display = 'none';
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
