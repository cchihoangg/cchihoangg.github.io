/*
 * === Homepage Pagination Script ===
 * Handles pagination dots for the featured projects on homepage
 */
const API_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSPkrIyHaNBs3UJdpLAa9OrGxSFzUHtxuzSPZd-aeqIff8U0KILjsYAaa5SSHNP431bIZ7Ae7aTYHnx/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize both features
    initPagination();
    initRandomExplore();
});

// --- 1. Pagination Logic ---
function initPagination() {
    const paginationContainer = document.getElementById('pagination-dots'); 
    const scrollContainer = document.querySelector('.scrollable-content');
    
    // Exit if elements don't exist
    if (!paginationContainer || !scrollContainer) return;

    // Get all project sections
    const projects = document.querySelectorAll('.project');
    
    if (projects.length === 0) return;

    // Create pagination dots
    const dotsHTML = Array.from(projects).map((project) => 
        `<span class="dot" data-target="${project.id}"></span>`
    ).join('');
    
    paginationContainer.innerHTML = dotsHTML;
    
    // Set first dot as active
    const dots = paginationContainer.querySelectorAll('.dot');
    if (dots.length > 0) {
        dots[0].classList.add('active');
    }

    // Handle dot clicks
    paginationContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('dot')) return;
        
        const targetId = e.target.dataset.target;
        const targetProject = document.getElementById(targetId);
        
        if (targetProject) {
            targetProject.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Update active dot on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const targetId = entry.target.id;
                const correspondingDot = paginationContainer.querySelector(`[data-target="${targetId}"]`);
                
                if (correspondingDot) {
                    dots.forEach(d => d.classList.remove('active'));
                    correspondingDot.classList.add('active');
                }
            }
        });
    }, { 
        root: scrollContainer, 
        threshold: 0.6 
    });

    // Observe all projects
    projects.forEach(project => observer.observe(project));
}

// --- 2. Explore Randomly Logic (Weighted) ---
function initRandomExplore() {
        const randomLinks = document.querySelectorAll('a[href="#random"]');
    
    if (randomLinks.length === 0) return;

    // Attach listener to all matching elements (in case you have it in nav AND footer)
    randomLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault(); // Stop anchor jump or default action
            
            const originalText = link.textContent;
            link.textContent = 'Loading...';
            link.style.cursor = 'wait';

            try {
                const response = await fetch(API_BASE_URL);
                const csvText = await response.text();
                
                // Parse CSV to get Weighted Pool of IDs
                const randomId = getWeightedRandomId(csvText);

                if (randomId) {
                    // Open in new tab (simulating target="_blank")
                    window.open(`post.html?id=${randomId}`, '_blank');
                    
                    // Reset text immediately since new tab opens
                    link.textContent = originalText;
                    link.style.cursor = 'pointer';
                } else {
                    alert('No visible projects found.');
                    link.textContent = originalText;
                    link.style.cursor = 'pointer';
                }

            } catch (error) {
                console.error('Random Explore Error:', error);
                link.textContent = originalText;
                link.style.cursor = 'pointer';
            }
        });
    });
}

// Helper: Parse CSV and return a SINGLE random ID based on "prob" weights
function getWeightedRandomId(csv) {
    const lines = csv.split('\n');
    if (lines.length < 2) return null;

    // Clean headers to find indices
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const idIndex = headers.indexOf('id');
    const showIndex = headers.indexOf('show');
    const probIndex = headers.indexOf('prob'); // Look for the new "prob" column

    if (idIndex === -1 || showIndex === -1) return null;

    const lotteryPool = [];

    // Loop through rows
    for (let i = 1; i < lines.length; i++) {
        // Simple split (be careful if your CSV descriptions have commas!)
        // If descriptions have commas, you might need a regex splitter instead.
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
        
        if (row.length > Math.max(idIndex, showIndex)) {
            const id = row[idIndex].trim();
            const show = row[showIndex].trim().toLowerCase();
            
            // Get Probability (Default to 2 if missing or invalid)
            let prob = 2; 
            if (probIndex !== -1 && row[probIndex]) {
                const parsedProb = parseInt(row[probIndex].trim());
                if (!isNaN(parsedProb)) {
                    prob = parsedProb;
                }
            }

            // Only include if show == 'y'
            if (show === 'y' && id) {
                // Add to pool 'prob' times (1, 2, or 3 times)
                for (let w = 0; w < prob; w++) {
                    lotteryPool.push(id);
                }
            }
        }
    }

    if (lotteryPool.length === 0) return null;

    // Pick one random winner from the weighted pool
    const randomIndex = Math.floor(Math.random() * lotteryPool.length);
    return lotteryPool[randomIndex];
}