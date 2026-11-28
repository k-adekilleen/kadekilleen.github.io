// Shared behaviour for every page: mobile nav, scroll reveals, line-art
// draw-in, and the live UTC clock in the HUD labels.
(() => {
    // ---- Mobile nav ----
    const toggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('open')) {
                navLinks.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
    }

    // ---- Line-art: measure each stroke so it can "draw" itself ----
    document.querySelectorAll('.draw').forEach((svg) => {
        svg.querySelectorAll('path, line, circle, rect, polyline, ellipse').forEach((el) => {
            if (el.getAttribute('stroke-dasharray')) return; // keep intentional dashes
            try {
                const len = Math.ceil(el.getTotalLength()) + 2;
                el.style.setProperty('--len', len);
            } catch (e) { /* not measurable: leave solid */ }
        });
    });

    // ---- Reveal on scroll ----
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        reveals.forEach((el) => io.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('in'));
    }

    // ---- Live UTC clock ----
    const clocks = document.querySelectorAll('[data-utc]');
    if (clocks.length) {
        const pad = (n) => String(n).padStart(2, '0');
        const tick = () => {
            const d = new Date();
            const t = `UTC ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
            clocks.forEach((c) => { c.textContent = t; });
        };
        tick();
        setInterval(tick, 1000);
    }
})();
