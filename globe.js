(() => {
    const canvas = document.getElementById('globe');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const LAT_COUNT = 12;
    const LON_COUNT = 18;
    const ROTATION_PERIOD = 30;
    const LINE_COLOR = 'rgba(74, 144, 217, 0.17)';
    const ARC_COLOR = [74, 144, 217];
    const DOT_RADIUS = 3;

    let SIZE, R, CX, CY;

    function resize() {
        const container = canvas.parentElement;
        const dim = Math.min(container.offsetWidth, 400);
        canvas.width = dim;
        canvas.height = dim;
        SIZE = dim;
        R = dim * 0.42;
        CX = dim / 2;
        CY = dim / 2;
    }

    // 3D point on sphere from lat/lon (radians) + rotation offset
    function latLonTo3D(lat, lon, rot) {
        const l = lon + rot;
        return {
            x: Math.cos(lat) * Math.sin(l),
            y: -Math.sin(lat),
            z: Math.cos(lat) * Math.cos(l)
        };
    }

    // Simple perspective projection
    function project(p) {
        const s = 1 / (1 - p.z * 0.15);
        return { sx: CX + p.x * R * s, sy: CY + p.y * R * s, z: p.z };
    }

    // City locations (lat/lon in degrees)
    const CITIES = [
        { name: 'Washington DC', lat: 38.9, lon: -77.0 },
        { name: 'London',        lat: 51.5, lon: -0.1 },
        { name: 'Tokyo',         lat: 35.7, lon: 139.7 },
        { name: 'Tel Aviv',      lat: 32.1, lon: 34.8 },
        { name: 'Singapore',     lat: 1.3,  lon: 103.8 },
        { name: 'Sydney',        lat: -33.9, lon: 151.2 },
        { name: 'Dubai',         lat: 25.2, lon: 55.3 },
        { name: 'Berlin',        lat: 52.5, lon: 13.4 },
        { name: 'Seoul',         lat: 37.6, lon: 127.0 },
        { name: 'Mumbai',        lat: 19.1, lon: 72.9 },
    ].map(c => ({ ...c, latR: c.lat * Math.PI / 180, lonR: c.lon * Math.PI / 180 }));

    // Arcs connecting city pairs
    const ARCS = [
        [0, 1], // DC — London
        [1, 3], // London — Tel Aviv
        [3, 6], // Tel Aviv — Dubai
        [6, 9], // Dubai — Mumbai
        [4, 2], // Singapore — Tokyo
        [2, 8], // Tokyo — Seoul
        [5, 4], // Sydney — Singapore
    ];

    // Pulse state
    let pulseArc = -1, pulseTime = 0, nextPulse = 2;

    // ---- Drawing ----

    function drawWireframe(rot) {
        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = 0.7;

        // Latitude lines
        for (let i = 1; i < LAT_COUNT; i++) {
            const lat = (i / LAT_COUNT) * Math.PI - Math.PI / 2;
            ctx.beginPath();
            for (let j = 0; j <= 72; j++) {
                const lon = (j / 72) * Math.PI * 2;
                const p = project(latLonTo3D(lat, lon, rot));
                j === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            }
            ctx.stroke();
        }

        // Longitude lines
        for (let i = 0; i < LON_COUNT; i++) {
            const lon = (i / LON_COUNT) * Math.PI * 2;
            ctx.beginPath();
            for (let j = 0; j <= 48; j++) {
                const lat = (j / 48) * Math.PI - Math.PI / 2;
                const p = project(latLonTo3D(lat, lon, rot));
                j === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            }
            ctx.stroke();
        }
    }

    function drawCities(rot) {
        for (const c of CITIES) {
            const p3 = latLonTo3D(c.latR, c.lonR, rot);
            const p = project(p3);
            const opacity = Math.max(0, Math.min(1, (p3.z + 0.3) * 1.2)) * 0.8;
            if (opacity < 0.02) continue;

            ctx.beginPath();
            ctx.arc(p.sx, p.sy, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(74, 144, 217, ${opacity})`;
            ctx.fill();
        }
    }

    function drawArcs(rot, dt) {
        // Pulse timer
        nextPulse -= dt;
        if (nextPulse <= 0) {
            pulseArc = Math.floor(Math.random() * ARCS.length);
            pulseTime = 0;
            nextPulse = 3 + Math.random() * 4;
        }
        if (pulseArc >= 0) {
            pulseTime += dt;
            if (pulseTime > 1.2) pulseArc = -1;
        }

        const steps = 30;
        for (let ai = 0; ai < ARCS.length; ai++) {
            const [i0, i1] = ARCS[ai];
            const c0 = CITIES[i0], c1 = CITIES[i1];

            ctx.beginPath();
            let visible = false;

            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const lat = c0.latR + (c1.latR - c0.latR) * t;
                const lon = c0.lonR + (c1.lonR - c0.lonR) * t;
                const lift = 1 + 0.18 * Math.sin(t * Math.PI);

                const p3 = latLonTo3D(lat, lon, rot);
                const lifted = { x: p3.x * lift, y: p3.y * lift, z: p3.z * lift };
                const p = project(lifted);

                if (p3.z > -0.2) visible = true;
                s === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
            }

            if (!visible) continue;

            // Fade based on midpoint depth
            const midP3 = latLonTo3D(
                (c0.latR + c1.latR) / 2,
                (c0.lonR + c1.lonR) / 2,
                rot
            );
            const zFade = Math.max(0, Math.min(1, (midP3.z + 0.3) * 1.2));
            let arcOpacity = 0.3 * zFade;

            // Pulse
            if (ai === pulseArc && pulseTime <= 1.2) {
                arcOpacity += 0.3 * Math.sin((pulseTime / 1.2) * Math.PI) * zFade;
            }

            ctx.strokeStyle = `rgba(${ARC_COLOR.join(',')}, ${arcOpacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // ---- Loop ----
    let lastTime = null;

    function loop(ts) {
        if (lastTime === null) lastTime = ts;
        const dt = (ts - lastTime) / 1000;
        lastTime = ts;

        const rot = (ts / 1000 / ROTATION_PERIOD) * Math.PI * 2;

        ctx.clearRect(0, 0, SIZE, SIZE);
        drawWireframe(rot);
        drawArcs(rot, dt);
        drawCities(rot);

        requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
})();
