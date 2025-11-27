// API Configuration 
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=18930479&single=true&output=csv';

// Cache for loaded data
let portfolioData = null;

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
    initPostPage();
});

// --- Initialize Post Page ---
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

// --- Post Functions ---
async function loadPost(postId) {
    showLoading(true);
    
    try {
        const data = await loadData();
        if (!data) return;

        // Filter only items with show = 'y'
        const visibleData = data.filter(item => item.show?.toLowerCase() === 'y');

        const post = visibleData.find(item => item.id === postId);
        
        if (!post) {
            showError('Post not found');
            return;
        }

        setBackLink(post.collection);
        renderPost(post);
        setupPostNavigation(visibleData, postId);
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
    
    // Preview (centered)
    if (item.preview) {
        html += `<p class="post-preview">${item.preview}</p>`;
    }
    
   // Embeds (YouTube, HTML, or iframes)
    if (item.embed || item.Embed) { 
        // Handle capitalization difference in CSV headers (Embed vs embed)
        let embedContent = (item.embed || item.Embed).trim();
        
        // Remove any extra quotes that might have been added during CSV parsing
        embedContent = embedContent.replace(/^["']|["']$/g, '');
        
        let embedHTML = '';
        
        // 1. Check if it's a YouTube URL
        if (embedContent.includes('youtube.com') || embedContent.includes('youtu.be')) {
            let videoId = '';
            if (embedContent.includes('youtube.com/watch?v=')) {
                videoId = embedContent.split('v=')[1]?.split('&')[0];
            } else if (embedContent.includes('youtu.be/')) {
                videoId = embedContent.split('youtu.be/')[1]?.split('?')[0];
            } else if (embedContent.includes('youtube.com/embed/')) {
                videoId = embedContent.split('embed/')[1]?.split('?')[0];
            }
            
            if (videoId) {
                // REMOVED INLINE STYLES. CSS controls size now.
                embedHTML = `
                    <iframe src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" 
                            allowfullscreen 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                    </iframe>
                `;
            }
        } 
        // 2. Check if it's already an iframe element
        else if (embedContent.includes('<iframe')) {
            // Try to extract src attribute
            let src = null;
            
            const srcMatch = embedContent.match(/src\s*=\s*["']([^"']+)["']/i);
            if (srcMatch) src = srcMatch[1];
            
            if (!src) {
                const urlMatch = embedContent.match(/src\s*=\s*([^\s>]+)/i);
                if (urlMatch) src = urlMatch[1];
            }
            
            if (src) {
                // Rebuild clean iframe without hardcoded dimensions
                embedHTML = `
                    <iframe src="${src}" 
                            frameborder="0" 
                            allowfullscreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                    </iframe>
                `;
            } else {
                // If we can't extract src, use content as-is but strip existing width/height if possible
                // We rely on the CSS .post-embed iframe { width: 100%; height: 100%; } to override attributes
                embedHTML = embedContent;
            }
        }
        // 3. Check if it's a direct URL (for p5js, codepen, etc.)
        else if (embedContent.match(/^https?:\/\//i)) {
            embedHTML = `
                <iframe src="${embedContent}" 
                        frameborder="0" 
                        allowfullscreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
            `;
        }
        // 4. Other HTML tags
        else if (embedContent.includes('<')) {
            embedHTML = embedContent;
        }
        
        // WRAPPER: This applies the aspect-ratio from CSS
        if (embedHTML) {
            html += `<div class="post-embed">${embedHTML}</div>`;
        }
    }
       
    // Links (formatted as: display text__url)
    if (item.links) {
        html += `<div class="post-links">`;
        
        const linkEntries = item.links.split(',').map(link => link.trim());
        linkEntries.forEach(entry => {
            // Check if link uses the display__url format
            if (entry.includes('__')) {
                const [display, url] = entry.split('__').map(s => s.trim());
                html += `<a href="${url}" target="_blank" rel="noopener noreferrer">${display}</a>`;
            } else {
                // Fallback to showing the URL as-is
                html += `<a href="${entry}" target="_blank" rel="noopener noreferrer">${entry}</a>`;
            }
        });
        
        html += `</div>`;
    }
    
    // Long content
    if (item.content) {
        html += `<div class="post-long-content">${item.content.replace(/\n/g, '<br>')}</div>`;
    }
    
    // Images with captions (Gallery sequence - unlimited)
    // Loop through all properties looking for pic1, pic2, pic3, etc.
    let imageIndex = 1;
    while (item[`pic${imageIndex}`]) {
        const imgFileName = item[`pic${imageIndex}`];
        const cap = item[`cap${imageIndex}`];
        
        // Construct full image path
        const imgPath = `images/${imgFileName}`;
        
        html += `
            <img src="${imgPath}" alt="Project Image ${imageIndex}" class="post-image" loading="lazy">
            ${cap ? `<p class="post-caption">${cap}</p>` : ''}
        `;
        
        imageIndex++;
    }

    main.innerHTML = html;
    content.style.display = 'block';
    setTimeout(scaleEmbeds, 50);
}

// --- Post Navigation (Prev/Next Arrows) ---
function setupPostNavigation(data, currentPostId) {
    const currentIndex = data.findIndex(item => item.id === currentPostId);
    
    const prevPost = document.getElementById('prevPost');
    const nextPost = document.getElementById('nextPost');
    
    if (!prevPost || !nextPost) return;
    
    // Find previous post (in sheet row order)
    if (currentIndex > 0) {
        const prev = data[currentIndex - 1];
        prevPost.href = `post.html?id=${prev.id}`;
        prevPost.innerHTML = `
            <span class="post-nav-arrow">←</span>
            <div class="post-nav-text">
                <span class="post-nav-label">Previous</span>
                <span class="post-nav-title">${prev.title}</span>
            </div>
        `;
        prevPost.style.display = 'flex';
    } else {
        prevPost.style.display = 'none';
    }
    
    // Find next post (in sheet row order)
    if (currentIndex < data.length - 1) {
        const next = data[currentIndex + 1];
        nextPost.href = `post.html?id=${next.id}`;
        nextPost.innerHTML = `
            <div class="post-nav-text">
                <span class="post-nav-label">Next</span>
                <span class="post-nav-title">${next.title}</span>
            </div>
            <span class="post-nav-arrow">→</span>
        `;
        nextPost.style.display = 'flex';
    } else {
        nextPost.style.display = 'none';
    }
}

// --- Pagination for Images ---
function initPostPagination() {
    const images = document.querySelectorAll('.post-image');
    const pagination = document.getElementById('pagination');
    
    if (!pagination || !images.length) {
        if (pagination) pagination.style.display = 'none';
        return;
    }
    
    pagination.innerHTML = '';
    pagination.style.display = 'flex';
    
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
    
    // Scroll handler with throttling
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
    const content = document.getElementById('postContent');
    
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (error) error.style.display = 'none';
    if (content) content.style.display = show ? 'none' : 'block';
}

function showError(message) {
    const loading = document.getElementById('loadingState');
    const error = document.getElementById('errorState');
    const content = document.getElementById('postContent');
    
    if (loading) loading.style.display = 'none';
    if (error) {
        error.style.display = 'block';
        error.innerHTML = `<p>${message}</p>`;
    }
    if (content) content.style.display = 'none';
}
/**
 * Scales iframes to fit their container.
 * Simulates a "zoom out" by shrinking a 1920px iframe to fit the screen.
 */
function scaleEmbeds() {
    const embeds = document.querySelectorAll('.post-embed');
    const baseWidth = 1920; // Must match the CSS width we set

    embeds.forEach(container => {
        const iframe = container.querySelector('iframe');
        if (!iframe) return;

        // Calculate the ratio: Current Container Width / 1920
        const containerWidth = container.offsetWidth;
        const scale = containerWidth / baseWidth;

        // Apply the zoom
        iframe.style.transform = `scale(${scale})`;
    });
}

// 1. Listen for window resize to adjust scale dynamically
window.addEventListener('resize', scaleEmbeds);