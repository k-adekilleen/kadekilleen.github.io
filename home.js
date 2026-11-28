// Home hero: a temple rising out of a line-drawn sea.
// Plain 2D canvas, no libraries. Waves are drawn back-to-front and each one is
// filled underneath, so nearer swells hide the ones (and the temple) behind them.
// Moving the cursor through the sea leaves a wake: a dip under the cursor and
// small ripples shed along its path. Rendering pauses when the hero is off screen.
(() => {
    const canvas = document.getElementById('sea');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;

    const BLUE = '#1D31B4';
    const CREAM = '238, 233, 222';
    const SIGNAL = '#E8552A';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, dpr = 1, small = false;
    let horizon = 0, lines = 0, step = 8;
    let temple = null;

    const mouse = { x: -9999, y: -9999, inside: false, sx: -9999, sy: -9999, presence: 0 };
    const ripples = [];           // {x, y, t0, amp}
    const RIPPLE_LIFE = 1700;     // ms
    const RIPPLE_SPEED = 0.11;    // px per ms
    const MAX_RIPPLES = 48;
    let lastDrop = null;
    const start = performance.now();

    function resize() {
        const r = hero.getBoundingClientRect();
        w = Math.max(1, Math.round(r.width));
        h = Math.max(1, Math.round(r.height));
        small = w < 720;
        dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        horizon = h * (small ? 0.74 : 0.68);
        lines = small ? 26 : 42;
        step = small ? 9 : 7;

        const tw = small ? Math.min(w * 0.72, 340) : Math.min(w * 0.36, 540);
        temple = {
            cx: small ? w * 0.5 : w * 0.72,
            w: tw,
            base: horizon + tw * 0.035,
        };
        if (reduceMotion) draw(performance.now());
    }

    // ---- Temple (front elevation, hexastyle) ----
    function drawTemple(rise, t) {
        const T = temple;
        const tw = T.w;
        const colN = 6;
        const colH = tw * 0.4;
        const stepH = tw * 0.022;
        const entH = tw * 0.075;
        const pedH = tw * 0.16;
        const yOff = (1 - rise) * (colH + entH + pedH) * 0.9;

        const left = T.cx - tw / 2;
        const right = T.cx + tw / 2;
        const stylobate = T.base - stepH * 3 + yOff;
        const colTop = stylobate - colH;
        const entTop = colTop - entH;
        const apex = entTop - pedH;

        ctx.save();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = `rgba(${CREAM}, 0.92)`;
        ctx.fillStyle = BLUE;

        // body fill so the sky graticule doesn't show through
        ctx.beginPath();
        ctx.moveTo(left - tw * 0.03, T.base + yOff);
        ctx.lineTo(left - tw * 0.03, entTop);
        ctx.lineTo(T.cx, apex);
        ctx.lineTo(right + tw * 0.03, entTop);
        ctx.lineTo(right + tw * 0.03, T.base + yOff);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        // steps
        for (let s = 0; s < 3; s++) {
            const y = T.base + yOff - stepH * s;
            const inset = tw * 0.012 * s;
            ctx.moveTo(left - tw * 0.03 + inset, y);
            ctx.lineTo(right + tw * 0.03 - inset, y);
        }
        ctx.moveTo(left - tw * 0.03 + tw * 0.024, stylobate);
        ctx.lineTo(right + tw * 0.03 - tw * 0.024, stylobate);

        // columns with flutes
        const span = tw * 0.92;
        const colW = span / colN * 0.42;
        for (let i = 0; i < colN; i++) {
            const cx = T.cx - span / 2 + span / colN * (i + 0.5);
            const x0 = cx - colW / 2, x1 = cx + colW / 2;
            // shaft (slight taper)
            ctx.moveTo(x0, stylobate);
            ctx.lineTo(x0 + colW * 0.06, colTop + entH * 0.32);
            ctx.moveTo(x1, stylobate);
            ctx.lineTo(x1 - colW * 0.06, colTop + entH * 0.32);
            // flutes
            for (let f = 1; f < 4; f++) {
                const fx = x0 + (colW / 4) * f;
                ctx.moveTo(fx, stylobate - 2);
                ctx.lineTo(fx + (cx - fx) * 0.06, colTop + entH * 0.4);
            }
            // capital (echinus + abacus)
            ctx.moveTo(x0 - colW * 0.18, colTop);
            ctx.lineTo(x1 + colW * 0.18, colTop);
            ctx.moveTo(x0 - colW * 0.18, colTop);
            ctx.lineTo(x0 - colW * 0.18, colTop + entH * 0.16);
            ctx.lineTo(x1 + colW * 0.18, colTop + entH * 0.16);
            ctx.lineTo(x1 + colW * 0.18, colTop);
            ctx.moveTo(x0 - colW * 0.1, colTop + entH * 0.16);
            ctx.quadraticCurveTo(cx, colTop + entH * 0.5, x1 + colW * 0.1, colTop + entH * 0.16);
        }

        // entablature: architrave, frieze with triglyphs, cornice
        const eL = left - tw * 0.02, eR = right + tw * 0.02;
        ctx.moveTo(eL, colTop); ctx.lineTo(eR, colTop);
        ctx.moveTo(eL, colTop - entH * 0.38); ctx.lineTo(eR, colTop - entH * 0.38);
        ctx.moveTo(eL, entTop + entH * 0.12); ctx.lineTo(eR, entTop + entH * 0.12);
        ctx.moveTo(eL - tw * 0.012, entTop); ctx.lineTo(eR + tw * 0.012, entTop);
        ctx.moveTo(eL, colTop); ctx.lineTo(eL, entTop);
        ctx.moveTo(eR, colTop); ctx.lineTo(eR, entTop);
        const tri = 13;
        for (let i = 0; i <= tri; i++) {
            const x = eL + (eR - eL) * (i / tri);
            const y0 = colTop - entH * 0.38, y1 = entTop + entH * 0.12;
            ctx.moveTo(x - tw * 0.006, y0); ctx.lineTo(x - tw * 0.006, y1);
            ctx.moveTo(x + tw * 0.006, y0); ctx.lineTo(x + tw * 0.006, y1);
        }

        // pediment
        ctx.moveTo(eL - tw * 0.012, entTop);
        ctx.lineTo(T.cx, apex);
        ctx.lineTo(eR + tw * 0.012, entTop);
        ctx.moveTo(eL + tw * 0.04, entTop - pedH * 0.12);
        ctx.lineTo(T.cx, apex + pedH * 0.24);
        ctx.lineTo(eR - tw * 0.04, entTop - pedH * 0.12);
        ctx.closePath();
        ctx.stroke();

        // acroterion beacon at the apex (a nod to a mast light)
        const blink = 0.55 + 0.45 * Math.sin(t * 0.0025);
        ctx.fillStyle = SIGNAL;
        ctx.globalAlpha = rise * blink;
        ctx.beginPath();
        ctx.arc(T.cx, apex - 6, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        return { apex, cx: T.cx, top: entTop };
    }

    // ---- Astrolabe ring behind the temple ----
    function drawRing(t, rise) {
        const T = temple;
        const r = T.w * 0.56;
        const cy = horizon - T.w * 0.3;
        const rot = reduceMotion ? 0 : t * 0.00002;
        ctx.save();
        ctx.translate(T.cx, cy);
        ctx.globalAlpha = 0.55 * rise;
        ctx.strokeStyle = `rgba(${CREAM}, 0.55)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([1, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.rotate(rot);
        ctx.beginPath();
        for (let i = 0; i < 120; i++) {
            const a = (i / 120) * Math.PI * 2;
            const len = i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5;
            ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
        }
        ctx.stroke();

        // orbiting signal: a single orange dot on the limb
        const oa = reduceMotion ? -0.9 : t * -0.00018;
        ctx.rotate(-rot);
        ctx.fillStyle = SIGNAL;
        ctx.globalAlpha = rise;
        ctx.beginPath();
        ctx.arc(Math.cos(oa) * r, Math.sin(oa) * r, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ---- Survey crosses in the sky ----
    function drawGrid() {
        const gap = small ? 56 : 72;
        ctx.save();
        ctx.strokeStyle = `rgba(${CREAM}, 0.16)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = gap; y < horizon - 10; y += gap) {
            for (let x = gap / 2; x < w; x += gap) {
                ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
                ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // ---- Sea ----
    function waveY(x, i, t, baseY, k) {
        const s = t * 0.001;
        const freq = 1 / (0.35 + k * 1.4);
        const amp = 1.5 + 22 * Math.pow(k, 1.6);
        let v =
            Math.sin(x * 0.011 * freq + s * 0.9 + i * 0.43) * 0.55 +
            Math.sin(x * 0.027 * freq - s * 1.3 + i * 0.21) * 0.3 +
            Math.sin(x * 0.004 * freq + s * 0.35 + i * 0.07) * 0.6;
        let y = baseY + v * amp;

        // wake: ripples shed along the cursor's path (only those near this line)
        const near = lineRipples;
        let wake = 0;
        for (let p = 0; p < near.length; p++) {
            const rp = near[p];
            const age = t - rp.t0;
            const radius = 6 + age * RIPPLE_SPEED;
            const dx = x - rp.x;
            if (dx > radius + 40 || dx < -radius - 40) continue;
            const dy = (baseY - rp.y) * 2.4;
            const off = Math.sqrt(dx * dx + dy * dy) - radius;
            if (off > 44 || off < -44) continue;
            const fade = 1 - age / RIPPLE_LIFE;
            wake += Math.exp(-(off * off) / 520) * Math.cos(off * 0.13) * fade * fade * rp.amp;
        }
        if (wake) {
            const cap = 1.6;
            wake = wake > cap ? cap : wake < -cap ? -cap : wake;
            y -= wake * (3 + 11 * k);
        }
        // the hull: water pressed down right under the cursor, piled up around it
        if (mouse.presence > 0.01) {
            const dx = x - mouse.sx;
            const dy = (baseY - mouse.sy) * 2.4;
            const d2 = dx * dx + dy * dy;
            if (d2 < 9000) {
                const d = Math.sqrt(d2);
                y += mouse.presence * (4 + 10 * k) * (Math.exp(-d2 / 450) - 0.45 * Math.exp(-((d - 34) * (d - 34)) / 220));
            }
        }
        return y;
    }

    const lineRipples = [];
    function drawSea(t) {
        for (let p = ripples.length - 1; p >= 0; p--) if (t - ripples[p].t0 > RIPPLE_LIFE) ripples.splice(p, 1);
        const depth = h - horizon + 24;
        for (let i = 0; i < lines; i++) {
            const k = i / (lines - 1);
            const baseY = horizon + depth * Math.pow(k, 1.75);
            lineRipples.length = 0;
            for (let p = 0; p < ripples.length; p++) {
                const rp = ripples[p];
                const reach = 6 + (t - rp.t0) * RIPPLE_SPEED + 40;
                if (Math.abs(baseY - rp.y) * 2.4 < reach) lineRipples.push(rp);
            }
            ctx.beginPath();
            ctx.moveTo(-10, waveY(-10, i, t, baseY, k));
            for (let x = -10 + step; x <= w + 10; x += step) {
                ctx.lineTo(x, waveY(x, i, t, baseY, k));
            }
            ctx.lineTo(w + 10, h + 10);
            ctx.lineTo(-10, h + 10);
            ctx.closePath();
            ctx.fillStyle = BLUE;
            ctx.fill();
            ctx.strokeStyle = `rgba(${CREAM}, ${(0.18 + 0.62 * Math.pow(k, 0.8)).toFixed(3)})`;
            ctx.lineWidth = i === 0 ? 1.1 : 1;
            ctx.stroke();
        }
    }

    // ---- Reticle ----
    function drawReticle() {
        if (!mouse.inside || small) return;
        const { x, y } = mouse;
        ctx.save();
        ctx.strokeStyle = `rgba(${CREAM}, 0.85)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.moveTo(x - 26, y); ctx.lineTo(x - 18, y);
        ctx.moveTo(x + 18, y); ctx.lineTo(x + 26, y);
        ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 18);
        ctx.moveTo(x, y + 18); ctx.lineTo(x, y + 26);
        ctx.stroke();
        const brg = String(Math.round((x / w) * 360)).padStart(3, '0');
        const rng = (Math.max(0, h - y) / h * 12).toFixed(1);
        ctx.fillStyle = `rgba(${CREAM}, 0.85)`;
        ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillText(`BRG ${brg}°  RNG ${rng} NM`, x + 22, y - 18);
        ctx.restore();
    }

    function draw(now) {
        const t = now - start;
        const rise = reduceMotion ? 1 : Math.min(1, Math.max(0, (t - 250) / 2600));
        const eased = 1 - Math.pow(1 - rise, 3);


        const overSea = mouse.inside && mouse.y > horizon - 6;
        mouse.presence += ((overSea ? 1 : 0) - mouse.presence) * 0.08;
        if (mouse.sx < -999) { mouse.sx = mouse.x; mouse.sy = mouse.y; }
        mouse.sx += (mouse.x - mouse.sx) * 0.25;
        mouse.sy += (Math.max(mouse.y, horizon) - mouse.sy) * 0.25;

        ctx.fillStyle = BLUE;
        ctx.fillRect(0, 0, w, h);
        drawGrid();
        drawRing(t, eased);
        drawTemple(eased, t);
        drawSea(reduceMotion ? 0 : t);
        drawReticle();
    }

    // ---- Loop control ----
    let raf = 0, visible = true;
    function loop(now) {
        draw(now);
        raf = requestAnimationFrame(loop);
    }
    function play() { if (!raf && !reduceMotion && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            visible ? play() : pause();
        }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

    // ---- Pointer: hover only, so scrolling and tapping are never affected ----
    hero.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        mouse.x = x; mouse.y = y; mouse.inside = true;
        if (reduceMotion || y < horizon - 6) { lastDrop = null; return; }
        const now = performance.now() - start;
        if (!lastDrop) { lastDrop = { x, y, t: now }; return; }
        const dist = Math.hypot(x - lastDrop.x, y - lastDrop.y);
        if (dist >= 22) {
            const speed = dist / Math.max(16, now - lastDrop.t); // px per ms
            ripples.push({ x, y: Math.max(y, horizon + 4), t0: now, amp: Math.min(1, 0.3 + speed * 0.6) });
            if (ripples.length > MAX_RIPPLES) ripples.shift();
            lastDrop = { x, y, t: now };
        }
    });
    hero.addEventListener('pointerleave', () => { mouse.inside = false; lastDrop = null; });

    let rt = 0;
    window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(resize, 120);
    });

    resize();
    if (reduceMotion) {
        draw(performance.now());
        if (document.fonts) document.fonts.ready.then(() => draw(performance.now()));
    } else {
        play();
    }
})();
