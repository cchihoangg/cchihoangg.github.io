// API Configuration - Replace with your Google Sheet URL
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=0&single=true&output=csv';

// Cache for loaded data
let portfolioData = null;
let currentPage = 'homepage';

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path.includes('post.html')) {
        currentPage = 'post';
        initPostPage();
    } else if (path.includes('gallery.html')) {
        currentPage = 'gallery';
        initGalleryPage();
    } else {
        currentPage = 'homepage';
        initHomepage();
    }
});

// --- Homepage ---
function initHomepage() {
    initPagination();
}

// --- Gallery Page ---
function initGalleryPage() {
    const collection = new URLSearchParams(window.location.search).get('collection');
    collection ? loadCollection(collection) : showError('No collection specified');
}

// --- Post Page ---
function initPostPage() {
    const postId = new URLSearchParams(window.location.search).get('id');
    postId ? loadPost(postId) : showError('No post ID specified');
}

// --- API Functions ---
async function loadData() {
    if (portfolioData) return portfolioData;
    
    try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const csv = await response.text();
        portfolioData = parseCSV(csv);
        return portfolioData;
    } catch (error) {
        console.error('API Error:', error);
        showError('Failed to load data');
        return null;
    }
}

// Fast CSV parser
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    });
}

// --- Gallery Functions ---
async function loadCollection(collection) {
    showLoading(true);
    
    try {
        const data = await loadData();
        if (!data) return;

        const items = data.filter(item => 
            item.collection === collection && 
            item.show?.toLowerCase() === 'y'
        );

        if (!items.length) {
            showError('No items found');
            return;
        }

        updateCollectionTitle(collection);
        renderGallery(items);
        initGalleryPagination();
        showLoading(false);
        
    } catch (error) {
        console.error('Collection Error:', error);
        showError('Failed to load collection');
        showLoading(false);
    }
}

function updateCollectionTitle(collection) {
    const titles = {
        'art': 'ART & DESIGN',
        'fashion': 'FASHION WORK', 
        'writing': 'WRITING',
        'data': 'DATA & DECKS'
    };
    
    const title = titles[collection] || collection.toUpperCase();
    
    const titleEl = document.getElementById('collectionTitle');
    const pageEl = document.getElementById('pageTitle');
    
    if (titleEl) titleEl.textContent = title;
    if (pageEl) pageEl.textContent = `Chi Hoang - ${title}`;
}

function renderGallery(items) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'grid';
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    items.forEach(item => {
        const card = createCard(item);
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

function createCard(item) {
    // Debug: Log the item to see what we're working with
    console.log('Creating card for:', item);
    
    const card = document.createElement('a');
    card.href = `post.html?id=${item.id}`;
    card.className = 'gallery-card';
    
    // Clean up image_main value (remove spaces, etc.)
    const imageFolderPath = 'images/thumb/';
    const imageFileName = item.image_main ? item.image_main.trim() : '';
    const imageUrl = imageFileName ? `${imageFolderPath}${imageFileName}` : '';
    
    // Debug: Log the final image URL
    console.log('Image URL:', imageUrl);
    
    card.innerHTML = `
        <div class="gallery-card-image">
            ${imageUrl 
                ? `<img src="${imageUrl}" alt="${item.title}" loading="lazy" onerror="this.parentElement.innerHTML='<p>Image not found: ${imageUrl}</p>'">`
                : '<p>No image specified</p>'
            }
        </div>
        <div class="gallery-card-content">
            <h3 class="gallery-card-title">${item.title}</h3>
            <p class="gallery-card-description">${item.description}</p>
            <p class="gallery-card-preview">${item.preview}</p>
        </div>
    `;
    
    return card;
}

// --- Post Functions ---
async function loadPost(postId) {
    showLoading(true);
    
    try {
        const data = await loadData();
        if (!data) return;

        const post = data.find(item => item.id === postId);
        
        if (!post) {
            showError('Post not found');
            return;
        }

        setBackLink(post.collection);
        renderPost(post);
        initPostPagination();
        showLoading(false);
        
    } catch (error) {
        console.error('Post Error:', error);
        showError('Failed to load post');
        showLoading(false);
    }
}

function setBackLink(collection) {
    const backLink = document.getElementById('backToGallery');
    if (backLink) backLink.href = `gallery.html?collection=${collection}`;
}

function renderPost(item) {
    const content = document.getElementById('postContent');
    const header = document.getElementById('postHeader');
    const main = document.getElementById('postMainContent');
    const pageTitle = document.getElementById('pageTitle');
    
    if (!content || !header || !main) return;

    // Update page title
    if (pageTitle) pageTitle.textContent = `Chi Hoang - ${item.title}`;

    // Build HTML efficiently
    let html = '';
    
    // Header
    header.innerHTML = `
        <h1 class="post-title">${item.title}</h1>
        <div class="post-meta">${item.category || item.collection || ''}</div>
    `;

    // Description
    if (item.description) {
        html += `<p>${item.description}</p>`;
    }
    
    // Embeds
    if (item.Embed) {
        if (item.Embed.includes('youtube') || item.Embed.includes('youtu.be')) {
            html += `<div style="margin: 2rem 0;"><iframe src="${item.Embed}" frameborder="0" allowfullscreen style="width: 100%; height: 400px; border-radius: 4px;"></iframe></div>`;
        } else if (item.Embed.includes('<')) {
            html += `<div style="margin: 2rem 0;">${item.Embed}</div>`;
        }
    }
    
    // Long content
    if (item.content) {
        html += `<div>${item.content.replace(/\n/g, '<br>')}</div>`;
    }
    
    // Tools
    if (item.tools) {
        html += `
            <div class="post-tools">
                <h3>Tools Used</h3>
                <p>${item.tools}</p>
            </div>
        `;
    }
    
    // Links
    if (item.links) {
        const links = item.links.split(',').map(link => 
            `<a href="${link.trim()}" target="_blank">${link.trim()}</a>`
        ).join('');
        html += `<div class="post-links">${links}</div>`;
    }
    
    // Images with captions
    for (let i = 1; i <= 5; i++) {
        const img = item[`pic${i}`];
        const cap = item[`cap${i}`];
        
        if (img) {
            html += `
                <img src="${img}" alt="Project Image ${i}" class="post-image" loading="lazy">
                ${cap ? `<p class="post-caption">${cap}</p>` : ''}
            `;
        }
    }

    main.innerHTML = html;
    content.style.display = 'block';
}

// --- Pagination Functions ---
function initPagination() {
    if (currentPage !== 'homepage') return;
    
    const main = document.getElementById('mainContent');
    const dots = document.querySelectorAll('.dot');
    const projects = document.querySelectorAll('.project');
    
    if (!main || !dots.length || !projects.length) return;

    // Scroll handler with throttling
    let scrollTimeout;
    main.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const threshold = main.getBoundingClientRect().top + (main.clientHeight * 0.2);
            const currentIndex = Array.from(projects).findIndex(project => 
                project.getBoundingClientRect().top > threshold
            ) - 1;
            
            const activeIndex = Math.max(0, currentIndex);
            dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
        }, 50);
    });

    // Click handlers
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            const project = projects[i];
            if (project) {
                const rect = project.getBoundingClientRect();
                const containerRect = main.getBoundingClientRect();
                const scrollTarget = main.scrollTop + rect.top - containerRect.top;
                main.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }
        });
    });
}

function initGalleryPagination() {
    if (currentPage !== 'gallery') return;
    
    const cards = document.querySelectorAll('.gallery-card');
    const pagination = document.getElementById('pagination');
    
    if (!pagination || !cards.length) return;
    
    pagination.innerHTML = '';
    
    // Create dots efficiently
    const fragment = document.createDocumentFragment();
    cards.forEach((card, i) => {
        const dot = document.createElement('div');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        fragment.appendChild(dot);
    });
    pagination.appendChild(fragment);
    
    // Scroll handler
    let scrollTimeout;
    const main = document.getElementById('mainContent');
    if (main) {
        main.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const threshold = main.getBoundingClientRect().top + (main.clientHeight * 0.3);
                const currentIndex = Array.from(cards).findIndex(card => 
                    card.getBoundingClientRect().top > threshold
                ) - 1;
                
                const activeIndex = Math.max(0, currentIndex);
                const dots = pagination.querySelectorAll('.dot');
                dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
            }, 50);
        });
    }
}

function initPostPagination() {
    if (currentPage !== 'post') return;
    
    const images = document.querySelectorAll('.post-image');
    const pagination = document.getElementById('pagination');
    
    if (!pagination || !images.length) {
        if (pagination) pagination.style.display = 'none';
        return;
    }
    
    pagination.innerHTML = '';
    
    // Create dots for images
    const fragment = document.createDocumentFragment();
    images.forEach((img, i) => {
        const dot = document.createElement('div');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => {
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        fragment.appendChild(dot);
    });
    pagination.appendChild(fragment);
    
    // Scroll handler
    let scrollTimeout;
    const main = document.getElementById('mainContent');
    if (main) {
        main.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const threshold = main.getBoundingClientRect().top + (main.clientHeight * 0.3);
                const currentIndex = Array.from(images).findIndex(img => 
                    img.getBoundingClientRect().top > threshold
                ) - 1;
                
                const activeIndex = Math.max(0, currentIndex);
                const dots = pagination.querySelectorAll('.dot');
                dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
            }, 50);
        });
    }
}

// --- UI Helpers ---
function showLoading(show) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    const content = currentPage === 'post' ? 
        document.getElementById('postContent') : 
        document.getElementById('galleryContainer');
    
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (error) error.style.display = 'none';
    if (content) content.style.display = show ? 'none' : 'block';
}

function showError(message) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    const content = currentPage === 'post' ? 
        document.getElementById('postContent') : 
        document.getElementById('galleryContainer');
    
    if (loading) loading.style.display = 'none';
    if (error) {
        error.style.display = 'block';
        error.innerHTML = `<p>${message}</p>`;
    }
    if (content) content.style.display = 'none';
}