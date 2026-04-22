// ===========================
// THEME MANAGEMENT
// ===========================
(function initTheme() {
    const saved = localStorage.getItem('kf-theme') || 'dark';
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    // Expose for the module script to read before it runs
    window.__kfTheme = saved;
})();

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    // Smooth transition class
    html.classList.add('theme-transitioning');

    html.setAttribute('data-theme', next);
    localStorage.setItem('kf-theme', next);
    window.__kfTheme = next;

    // Update toggle icon
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = next === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Swap Three.js background
    if (window.__swapBackground) {
        window.__swapBackground(next);
    }

    // Update PolyLab charts if on that page
    if (window.__updatePolyLabTheme) {
        window.__updatePolyLabTheme();
    }

    // Remove transition class after animation
    setTimeout(() => html.classList.remove('theme-transitioning'), 600);
}

// Update icon on DOM ready (in case the HTML loads before this runs)
document.addEventListener('DOMContentLoaded', function() {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
});

// ===========================
// CUSTOM CURSOR
// ===========================
const cursor = document.querySelector('.cursor');
let cursorX = 0, cursorY = 0;
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.25;
    cursorY += (mouseY - cursorY) * 0.25;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(animateCursor);
}
animateCursor();

document.addEventListener('mousedown', () => cursor.classList.add('active'));
document.addEventListener('mouseup', () => cursor.classList.remove('active'));


// ===========================
// NAVIGATION — single source of truth
// ===========================

// 'desktopVisible: true' = shown in the nav bar on desktop as well as the drawer.
// All links always appear in the drawer (both desktop and mobile), defined once here.
const NAV_LINKS = [
    { label: 'Home',        href: 'index.html',         desktopVisible: true  },
    { label: 'Works',       href: 'works/',             desktopVisible: true  },
    { label: 'Contact',     href: '#contact',           desktopVisible: true  },
    { label: 'Resume',      href: 'resume/',            desktopVisible: false },
    { label: 'Resources',   href: 'resources/',         desktopVisible: false },
    { label: 'PolyLab',     href: 'polylab/',           desktopVisible: false },
    { label: 'Gallery',     href: 'gallery/',           desktopVisible: false },
    { label: 'Observatory', href: 'observatory/',       desktopVisible: false },
    { label: 'Blog',        href: 'blog/',              desktopVisible: false },
];

document.addEventListener('DOMContentLoaded', function () {
    const path = window.location.pathname;
    
    // Detect if we are in a subfolder (any directory level after the root)
    const isSubfolder = path.split('/').filter(Boolean).length > 1 && !path.endsWith('index.html');
    const isHome = path === '/' || path.endsWith('index.html');

    function resolveHref(href) {
        // Handle Anchor Links
        if (href === '#contact') {
            return isHome ? '#contact' : '../index.html#contact';
        }

        // Handle Home
        if (href === 'index.html') {
            return isHome ? 'index.html' : '../index.html';
        }

        // Handle Sub-pages (e.g., 'gallery/')
        // If we are already in a subfolder, go up one level first
        return isHome ? href : '../' + href;
    }

    function isActive(href) {
        if (href === '#contact') return false;
        // Checks if the current URL contains the folder name (e.g., /gallery/)
        return path.includes(href.replace('/', '')) && href !== 'index.html';
    }


    // ── Build desktop nav-links (only desktopVisible items) ──
    const navLinksEl = document.getElementById('nav-links');
    if (navLinksEl) {
        navLinksEl.innerHTML = NAV_LINKS
            .filter(link => link.desktopVisible)
            .map(link => {
                const active = isActive(link.href) ? ' class="active"' : '';
                return `<li><a href="${resolveHref(link.href)}"${active}>${link.label}</a></li>`;
            })
            .join('');
    }

    // ── Build drawer (all links) ──
    const drawer = document.getElementById('nav-drawer');
    if (drawer) {
        const linksHTML = NAV_LINKS.map(link => {
            const active = isActive(link.href) ? ' class="active"' : '';
            return `<a href="${resolveHref(link.href)}"${active}>${link.label}</a>`;
        }).join('');

        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const iconClass = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';

        drawer.innerHTML = `
            <div class="drawer-links">
                ${linksHTML}
            </div>
            <div class="drawer-divider"></div>
            <div class="drawer-theme" onclick="toggleTheme()">
                <span class="drawer-theme-label">Theme</span>
                <i id="theme-toggle-icon" class="${iconClass}"></i>
            </div>
        `;
    }

    // ── Hamburger open/close ──
    const hamburger = document.getElementById('nav-hamburger');
    const overlay   = document.getElementById('nav-overlay');

    function openDrawer() {
        drawer.classList.add('open');
        overlay.classList.add('open');
        const icon = hamburger.querySelector('i');
        if (icon) { icon.classList.replace('fa-bars', 'fa-times'); }
    }

    function closeDrawer() {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        const icon = hamburger.querySelector('i');
        if (icon) { icon.classList.replace('fa-times', 'fa-bars'); }
    }

    if (hamburger) {
        hamburger.addEventListener('click', function (e) {
            e.stopPropagation();
            drawer.classList.contains('open') ? closeDrawer() : openDrawer();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeDrawer);
    }

    // Close drawer when a link inside it is clicked
    if (drawer) {
        drawer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeDrawer);
        });
    }
});


// ===========================
// PARALLAX SCROLLING
// ===========================
let scrollY = 0;
window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    
    // Parallax only for hero elements
    const parallaxFast = document.querySelectorAll('.parallax-fast');
    const parallaxSlow = document.querySelectorAll('.parallax-slow');
    
    parallaxFast.forEach(el => {
        const speed = 0.5;
        const yPos = -(scrollY * speed);
        el.style.transform = `translateY(${yPos}px)`;
    });
    
    parallaxSlow.forEach(el => {
        const speed = 0.2;
        const yPos = -(scrollY * speed);
        el.style.transform = `translateY(${yPos}px)`;
    });
});

// ===========================
// SCROLL REVEAL ANIMATION
// ===========================
const revealElements = document.querySelectorAll('.glass-card, .work-card');

const revealOnScroll = () => {
    revealElements.forEach(el => {
        const elementTop = el.getBoundingClientRect().top;
        const elementBottom = el.getBoundingClientRect().bottom;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight * 0.92 && elementBottom > 0) {
            el.classList.add('reveal');
        }
    });
};

window.addEventListener('scroll', revealOnScroll);
revealOnScroll(); // Initial check

let statsAnimated = false;

function animateCount(el, target, suffix, duration) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for a satisfying deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);

        el.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function triggerStatsAnimation() {
    if (statsAnimated) return;

    const statsGrid = document.querySelector('.stats-grid');
    if (!statsGrid) return;

    const rect = statsGrid.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
        statsAnimated = true;

        // Stagger each counter with a small delay
        let delay = 0;
        document.querySelectorAll('.stat-number[data-target]').forEach(el => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const suffix = el.getAttribute('data-suffix') || '';
            const duration = Math.min(2000, Math.max(1200, target * 30));
            setTimeout(() => animateCount(el, target, suffix, duration), delay);
            delay += 150;
        });
    }
}

window.addEventListener('scroll', triggerStatsAnimation);
