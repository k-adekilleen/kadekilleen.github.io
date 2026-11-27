// Cost-exchange globe for "The Microeconomics of Modern War".
// A light, dependency-free orthographic globe on a 2D canvas: dot-matrix land,
// a graticule, and orange markers for documented cost-exchange inversions.
// Drag to rotate; pick an event in the list (or tap a marker) to fly to it.
(() => {
    const canvas = document.getElementById('war-globe');
    const stage = document.getElementById('globe-stage');
    const list = document.getElementById('events');
    if (!canvas || !stage || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');

    const BLUE = '#1E37C8';
    const OCEAN = '#1A2FB0';
    const CREAM = '238, 233, 222';
    const SIGNAL = '#E8552A';
    const DEG = Math.PI / 180;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Real, sourced cases from the writeup.
    const EVENTS = [
        { lat: 44.6, lon: 33.5, name: 'Black Sea', ratio: '$250K sea drone vs $65M warship' },
        { lat: 48.6, lon: 38.5, name: 'Donbas', ratio: '$500 FPV vs $1.5–4.5M tank' },
        { lat: 13.5, lon: 43.2, name: 'Red Sea', ratio: '$2K drone vs $2M interceptor' },
        { lat: 39.9, lon: 46.7, name: 'Nagorno-Karabakh', ratio: '245 tanks lost vs 36 (2020)' },
    ];

    // Simplified continent outlines [lat, lon].
    const LAND = [
        [[60,-140],[65,-168],[72,-168],[71,-155],[60,-140],[55,-130],[48,-125],[35,-120],[30,-115],[25,-110],[20,-105],[15,-95],[18,-88],[20,-87],[22,-85],[25,-80],[30,-82],[28,-77],[35,-75],[40,-72],[45,-67],[47,-60],[50,-57],[52,-56],[55,-60],[58,-65],[60,-70],[63,-75],[65,-85],[68,-95],[70,-105],[72,-120],[70,-140],[65,-145],[60,-148],[60,-140]],
        [[12,-70],[10,-75],[7,-77],[2,-80],[-5,-80],[-7,-78],[-15,-76],[-20,-70],[-25,-65],[-30,-60],[-35,-57],[-40,-62],[-45,-65],[-50,-68],[-55,-67],[-55,-64],[-50,-60],[-45,-55],[-40,-50],[-35,-48],[-30,-48],[-25,-45],[-20,-40],[-15,-38],[-10,-35],[-5,-35],[0,-50],[5,-60],[8,-62],[10,-67],[12,-70]],
        [[36,-10],[38,-8],[40,-5],[43,0],[46,2],[48,5],[50,4],[52,5],[54,8],[55,12],[57,10],[58,12],[60,5],[62,5],[65,12],[68,15],[70,20],[70,28],[65,28],[60,30],[57,28],[55,25],[54,20],[52,15],[50,14],[48,16],[46,15],[44,12],[42,14],[40,20],[38,22],[36,28],[35,25],[36,22],[38,18],[37,15],[38,12],[36,5],[36,0],[36,-5],[36,-10]],
        [[35,-5],[37,-2],[37,10],[32,13],[30,10],[31,20],[31,32],[28,34],[22,37],[15,40],[12,43],[11,51],[5,48],[0,42],[-5,40],[-10,40],[-15,40],[-20,35],[-25,33],[-30,31],[-35,25],[-35,20],[-30,17],[-25,15],[-20,12],[-15,12],[-10,13],[-5,12],[0,9],[5,5],[5,-5],[5,-8],[8,-12],[10,-15],[15,-17],[20,-17],[25,-15],[30,-10],[32,-8],[35,-5]],
        [[42,28],[41,36],[37,36],[33,35],[30,33],[28,34],[22,39],[15,43],[13,45],[17,52],[22,59],[25,56],[26,52],[30,48],[25,57],[25,62],[24,67],[20,73],[15,74],[8,77],[10,80],[15,80],[20,86],[22,90],[22,92],[16,95],[16,98],[10,98],[5,100],[1,104],[5,103],[10,105],[18,106],[22,108],[23,115],[25,120],[30,122],[35,120],[38,121],[40,118],[40,122],[39,126],[35,127],[35,129],[38,129],[42,130],[45,135],[50,140],[53,141],[55,135],[60,140],[63,145],[60,150],[62,160],[65,170],[68,180],[72,180],[73,160],[72,140],[73,120],[76,110],[73,95],[73,80],[70,70],[68,60],[65,55],[66,45],[69,40],[66,36],[62,30],[60,30],[57,28],[55,25],[54,20],[50,30],[47,33],[46,30],[45,30],[42,28]],
        [[-12,130],[-15,125],[-18,122],[-22,114],[-28,114],[-32,116],[-35,118],[-38,145],[-37,150],[-33,152],[-28,153],[-24,150],[-20,148],[-18,146],[-16,145],[-14,142],[-12,137],[-12,130]],
        [[60,-45],[62,-50],[65,-53],[68,-55],[70,-55],[72,-52],[75,-50],[78,-55],[80,-60],[82,-45],[82,-30],[80,-20],[78,-18],[75,-20],[72,-22],[70,-25],[68,-30],[65,-38],[62,-42],[60,-45]],
        [[50,-6],[51,-5],[52,-4],[53,-3],[54,-3],[56,-5],[58,-5],[58,-3],[57,-2],[55,-1],[54,0],[52,1],[51,1],[50,-1],[50,-6]],
        [[31,131],[33,130],[35,133],[36,136],[37,137],[38,140],[40,140],[42,141],[43,145],[42,143],[40,140],[38,139],[36,137],[35,136],[34,135],[33,132],[31,131]],
        [[-12,49],[-16,50],[-25,47],[-25,44],[-20,44],[-16,45],[-12,49]],
        [[6,95],[-6,106],[-8,114],[-8,125],[-3,120],[2,118],[7,117],[1,110],[-3,106],[6,95]],
    ];

    // Dot-matrix land: sample a lat/lon grid and keep points inside an outline.
    function inside(lat, lon, poly) {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [yi, xi] = poly[i], [yj, xj] = poly[j];
            if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
    }
    // Interior Europe: fills the gap between the outlines above; dots only, no coastline.
    const FILL = [
        [[54,20],[60,30],[66,36],[69,40],[66,45],[65,55],[55,55],[50,50],[47,40],[46,30],[45,29],[42,28],[40,22],[40,20],[42,14],[44,12],[46,15],[48,16],[50,14],[52,15],[54,20]],
    ];

    // Inland seas to keep clear of land dots (Black Sea, Caspian).
    const WATER = [
        [[41.2,28.5],[41.8,32],[41.2,36],[41.5,41.5],[43.5,40.5],[45.2,37.5],[46.8,38.5],[46.5,36],[45.2,33],[46.2,31],[44.2,28.7]],
        [[47,49.5],[45,47],[42.5,47.8],[40.5,49.5],[37.5,49.5],[37,53.5],[41,53],[44.5,51],[46.5,53],[47,49.5]],
    ];
    const DOTS = [];
    for (let lat = -58; lat <= 82; lat += 2.4) {
        const dLon = 2.4 / Math.max(0.25, Math.cos(lat * DEG));
        for (let lon = -180; lon < 180; lon += dLon) {
            if (WATER.some((p) => inside(lat, lon, p))) continue;
            for (const poly of LAND.concat(FILL)) {
                if (inside(lat, lon, poly)) { DOTS.push([lat * DEG, lon * DEG]); break; }
            }
        }
    }

    // ---- View state ----
    const view = { lon: 40 * DEG, lat: 22 * DEG };
    let target = null;          // {lon, lat} we are flying toward
    let active = 0;
    let userTookOver = false;
    let dragging = false, last = null, vel = 0;

    let w = 0, h = 0, dpr = 1, R = 0, cx = 0, cy = 0;
    function resize() {
        const r = stage.getBoundingClientRect();
        w = Math.max(1, r.width); h = Math.max(1, r.height);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        R = Math.min(w, h) * 0.38;
        cx = w / 2; cy = h / 2 + h * 0.02;
        requestDraw();
    }

    // Orthographic projection. Returns [x, y, z]; z > 0 is the visible face.
    function project(lat, lon) {
        const cl = Math.cos(lat), dl = lon - view.lon;
        const x = cl * Math.sin(dl);
        const y = Math.cos(view.lat) * Math.sin(lat) - Math.sin(view.lat) * cl * Math.cos(dl);
        const z = Math.sin(view.lat) * Math.sin(lat) + Math.cos(view.lat) * cl * Math.cos(dl);
        return [cx + R * x, cy - R * y, z];
    }

    function polyline(points, close) {
        let pen = false;
        for (let i = 0; i < points.length; i++) {
            const [x, y, z] = points[i];
            if (z > 0) {
                pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                pen = true;
            } else pen = false;
        }
        if (close && pen && points[0][2] > 0) ctx.lineTo(points[0][0], points[0][1]);
    }

    function draw(now) {
        const t = now || performance.now();
        ctx.clearRect(0, 0, w, h);

        // outer range rings (static HUD)
        ctx.strokeStyle = `rgba(${CREAM}, 0.22)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 6]);
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            const l = i % 6 === 0 ? 10 : 4;
            ctx.moveTo(cx + Math.cos(a) * R * 1.24, cy + Math.sin(a) * R * 1.24);
            ctx.lineTo(cx + Math.cos(a) * (R * 1.24 + l), cy + Math.sin(a) * (R * 1.24 + l));
        }
        ctx.stroke();

        // ocean disc
        ctx.fillStyle = OCEAN;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

        // graticule
        ctx.strokeStyle = `rgba(${CREAM}, 0.14)`;
        ctx.beginPath();
        for (let lat = -75; lat <= 75; lat += 15) {
            const pts = [];
            for (let lon = -180; lon <= 180; lon += 4) pts.push(project(lat * DEG, lon * DEG));
            polyline(pts, false);
        }
        for (let lon = -180; lon < 180; lon += 15) {
            const pts = [];
            for (let lat = -90; lat <= 90; lat += 4) pts.push(project(lat * DEG, lon * DEG));
            polyline(pts, false);
        }
        ctx.stroke();

        // land dots (fade toward the limb for depth)
        const ds = Math.max(1.1, R / 170);
        for (let i = 0; i < DOTS.length; i++) {
            const p = project(DOTS[i][0], DOTS[i][1]);
            if (p[2] <= 0.02) continue;
            ctx.fillStyle = `rgba(${CREAM}, ${(0.25 + 0.65 * p[2]).toFixed(2)})`;
            ctx.fillRect(p[0] - ds / 2, p[1] - ds / 2, ds, ds);
        }

        // coastlines
        ctx.strokeStyle = `rgba(${CREAM}, 0.45)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const poly of LAND.concat(WATER)) polyline(poly.map(([la, lo]) => project(la * DEG, lo * DEG)), true);
        ctx.stroke();

        // limb
        ctx.strokeStyle = `rgba(${CREAM}, 0.8)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

        // events
        const pulse = reduceMotion ? 0.5 : (t % 2200) / 2200;
        EVENTS.forEach((ev, i) => {
            const p = project(ev.lat * DEG, ev.lon * DEG);
            ev.screen = p;
            if (p[2] <= 0) return;
            const on = i === active;
            ctx.fillStyle = SIGNAL;
            ctx.beginPath(); ctx.arc(p[0], p[1], on ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = SIGNAL;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 1 - pulse;
            ctx.beginPath(); ctx.arc(p[0], p[1], 4 + pulse * (on ? 26 : 14), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // label leader for the active event
        const ev = EVENTS[active];
        const p = ev.screen;
        if (p && p[2] > 0) {
            const right = p[0] < cx + R * 0.2;
            const lx = right ? Math.min(w - 16, p[0] + R * 0.55) : Math.max(16, p[0] - R * 0.55);
            const ly = Math.max(64, p[1] - R * 0.42);
            ctx.strokeStyle = `rgba(${CREAM}, 0.9)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(p[0] + (lx - p[0]) * 0.35, ly);
            ctx.lineTo(lx, ly);
            ctx.stroke();
            ctx.fillStyle = `rgb(${CREAM})`;
            ctx.textAlign = right ? 'right' : 'left';
            ctx.font = `600 ${Math.round(Math.max(16, R * 0.1))}px "Cormorant Garamond", Georgia, serif`;
            ctx.fillText(ev.name, lx, ly - 8);
            ctx.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace';
            ctx.fillStyle = `rgba(${CREAM}, 0.75)`;
            ctx.fillText(ev.ratio.toUpperCase(), lx, ly + 16);
            ctx.textAlign = 'left';
        }
    }

    // ---- Animation ----
    let raf = 0, visible = true, needs = true;
    function requestDraw() { needs = true; if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
        raf = 0;
        let moving = false;
        if (target) {
            let dLon = ((target.lon - view.lon + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const dLat = target.lat - view.lat;
            const k = reduceMotion ? 1 : 0.07;
            view.lon += dLon * k; view.lat += dLat * k;
            if (Math.abs(dLon) < 0.0008 && Math.abs(dLat) < 0.0008) target = null;
            moving = true;
        } else if (!dragging && Math.abs(vel) > 0.00005) {
            view.lon -= vel; vel *= 0.94; moving = true;
        } else if (!dragging && !userTookOver && !reduceMotion) {
            view.lon += 0.0006; moving = true;   // slow idle drift
        }
        draw(now);
        needs = false;
        // keep animating for marker pulses while on screen
        if (visible && !document.hidden && (!reduceMotion || moving)) raf = requestAnimationFrame(frame);
    }

    function setActive(i, fly) {
        active = i;
        if (list) list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.ev === i)));
        if (fly) {
            target = { lon: EVENTS[i].lon * DEG, lat: Math.max(-0.5, Math.min(0.8, EVENTS[i].lat * DEG - 0.18)) };
        }
        requestDraw();
    }

    // Briefing mode: cycle through events until the visitor interacts.
    let cycle = 0;
    function startCycle() {
        if (reduceMotion) return;
        cycle = setInterval(() => {
            if (userTookOver || !visible) return;
            setActive((active + 1) % EVENTS.length, true);
        }, 5200);
    }
    function takeOver() { userTookOver = true; clearInterval(cycle); }

    if (list) {
        list.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-ev]');
            if (!b) return;
            takeOver();
            setActive(+b.dataset.ev, true);
        });
    }

    // ---- Pointer: drag to rotate, tap a marker to select ----
    let downAt = null;
    stage.addEventListener('pointerdown', (e) => {
        dragging = true; target = null; vel = 0;
        last = { x: e.clientX, y: e.clientY };
        downAt = { x: e.clientX, y: e.clientY };
        stage.setPointerCapture(e.pointerId);
        takeOver();
    });
    stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        const k = 1 / R;
        view.lon -= dx * k;
        view.lat = Math.max(-1.2, Math.min(1.2, view.lat + dy * k));
        vel = dx * k;
        requestDraw();
    });
    const end = (e) => {
        if (!dragging) return;
        dragging = false;
        if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
            const r = canvas.getBoundingClientRect();
            const mx = e.clientX - r.left, my = e.clientY - r.top;
            let best = -1, bd = 22;
            EVENTS.forEach((ev, i) => {
                const p = ev.screen;
                if (!p || p[2] <= 0) return;
                const d = Math.hypot(p[0] - mx, p[1] - my);
                if (d < bd) { bd = d; best = i; }
            });
            if (best >= 0) setActive(best, true);
        }
        requestDraw();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible) requestDraw();
        }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestDraw(); });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    if (document.fonts) document.fonts.ready.then(requestDraw);

    resize();
    setActive(0, true);
    startCycle();
})();
