// Home hero: a temple rising out of a line-drawn sea.
// Plain 2D canvas, no libraries. Waves are drawn back-to-front and each one is
// filled underneath, so nearer swells hide the ones (and the temple) behind them.
// Clicking or tapping the sea sends out a sonar ping that ripples across the
// waves. Rendering pauses when the hero is off screen.
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

    const mouse = { x: -9999, y: -9999, inside: false };
    const pings = [];             // {x, y, t0}
    const PING_LIFE = 2600;       // ms
    const PING_SPEED = 0.5;       // px per ms
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

        // sonar pings: an expanding ring, flattened by the sea's perspective
        for (let p = 0; p < pings.length; p++) {
            const pg = pings[p];
            const age = t - pg.t0;
            if (age < 0 || age > PING_LIFE) continue;
            const radius = age * PING_SPEED;
            const dx = x - pg.x;
            const dy = (baseY - pg.y) * 2.6;
            const d = Math.sqrt(dx * dx + dy * dy);
            const off = d - radius;
            if (off > 60 || off < -60) continue;
            const fade = 1 - age / PING_LIFE;
            y -= Math.exp(-(off * off) / (2 * 18 * 18)) * fade * fade * (10 + 22 * k);
        }
        return y;
    }

    function drawSea(t) {
        const depth = h - horizon + 24;
        for (let i = 0; i < lines; i++) {
            const k = i / (lines - 1);
            const baseY = horizon + depth * Math.pow(k, 1.75);
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

    // ---- Ping rings drawn on top of the sea ----
    function drawPings(t) {
        for (let i = pings.length - 1; i >= 0; i--) {
            const pg = pings[i];
            const age = t - pg.t0;
            if (age > PING_LIFE) { pings.splice(i, 1); continue; }
            if (age < 0) continue;
            const fade = 1 - age / PING_LIFE;
            const r = age * PING_SPEED;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, horizon + 2, w, h);
            ctx.clip();
            ctx.strokeStyle = `rgba(${CREAM}, ${(0.45 * fade).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(pg.x, pg.y, r, r / 2.6, 0, 0, Math.PI * 2);
            ctx.stroke();
            // origin marker + readout
            ctx.fillStyle = SIGNAL;
            ctx.globalAlpha = Math.min(1, fade * 1.6);
            ctx.beginPath();
            ctx.arc(pg.x, pg.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(${CREAM}, 0.9)`;
            ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
            ctx.fillText(`PING ${String(pg.n).padStart(2, '0')} \u00B7 ${(r / 40).toFixed(1)} NM`, pg.x + 10, pg.y + 16);
            ctx.restore();
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


        ctx.fillStyle = BLUE;
        ctx.fillRect(0, 0, w, h);
        drawGrid();
        drawRing(t, eased);
        drawTemple(eased, t);
        drawSea(reduceMotion ? 0 : t);
        drawPings(t);
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

    // ---- Pointer ----
    hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.inside = e.pointerType === 'mouse';
        if (reduceMotion) draw(performance.now());
    });
    hero.addEventListener('pointerleave', () => { mouse.inside = false; });

    let pingCount = 0;
    function ping(x, y, delay) {
        if (reduceMotion) return;
        pings.push({ x, y: Math.max(y, horizon + 14), t0: performance.now() - start + (delay || 0), n: ++pingCount });
        if (pings.length > 5) pings.shift();
    }
    hero.addEventListener('pointerdown', (e) => {
        if (e.target.closest('a, button')) return;
        const r = canvas.getBoundingClientRect();
        ping(e.clientX - r.left, e.clientY - r.top);
    });

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
        // one ping once the temple has risen, so visitors see what the sea does
        ping(temple.cx - temple.w * 0.15, horizon + (h - horizon) * 0.45, 3000);
    }
})();
