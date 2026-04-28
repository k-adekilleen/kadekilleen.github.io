(() => {
    try {
    const canvas = document.getElementById('globe');
    if (!canvas || typeof THREE === 'undefined') return;

    // ---- Config ----
    const BLUE = new THREE.Color(0x0F4392);
    const RED = new THREE.Color(0xFF4949);
    const GRID_COLOR = new THREE.Color(0x2a4a6a);
    const DIM_BLUE = new THREE.Color(0x0a1a35);
    const WHITE = new THREE.Color(0xffffff);
    const ROTATION_SPEED = 0.08;
    const GLOBE_RADIUS = 1.8;

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);
    camera.lookAt(0, 0, 0);

    // ---- Drag-to-rotate state ----
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };
    let velocityX = 0, velocityY = 0;          // angular velocity from flicks
    const DRAG_SPEED = 0.007;
    const DAMPING = 0.95;                       // inertia decay per frame
    const AUTO_SPEED = 0.12;                    // idle auto-rotation (rad/s on Y)
    const INERTIA_THRESHOLD = 0.0001;

    // We accumulate rotation as a quaternion so all axes work cleanly
    const rotQuat = new THREE.Quaternion();
    const autoQuat = new THREE.Quaternion();
    const dragQuat = new THREE.Quaternion();
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);

    // ---- Root group ----
    const root = new THREE.Group();
    scene.add(root);

    // ---- Wireframe sphere (low-poly geodesic) ----
    const sphereGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 3);
    const wireframeMat = new THREE.MeshBasicMaterial({
        color: GRID_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.35
    });
    const wireframe = new THREE.Mesh(sphereGeo, wireframeMat);
    root.add(wireframe);

    // Inner solid sphere — fully opaque to occlude back-side elements
    const innerGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS * 0.99, 4);
    const innerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x0c1a24),
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    innerSphere.renderOrder = 0;
    root.add(innerSphere);

    // ---- Orbital paths ----
    function createOrbit(radius, inclination, phase, color, opacity) {
        const points = [];
        for (let i = 0; i <= 128; i++) {
            const t = (i / 128) * Math.PI * 2;
            points.push(new THREE.Vector3(
                Math.cos(t) * radius,
                Math.sin(t) * Math.sin(inclination) * radius,
                Math.sin(t) * Math.cos(inclination) * radius
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        const line = new THREE.Line(geo, mat);
        line.rotation.y = phase;
        line.userData = { radius, inclination, phase };
        return line;
    }

    const orbits = [
        createOrbit(GLOBE_RADIUS * 1.20, 0.5, 0, BLUE, 0.40),
        createOrbit(GLOBE_RADIUS * 1.35, 1.1, 1.2, BLUE, 0.35),
        createOrbit(GLOBE_RADIUS * 1.28, 0.3, 2.5, RED, 0.35),
    ];
    orbits.forEach(o => root.add(o));

    // ---- Satellite / plane shapes ----
    function createPlaneShape(color) {
        const S = 1.8; // scale factor
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.06 * S);
        shape.lineTo(-0.04 * S, -0.02 * S);
        shape.lineTo(-0.01 * S, -0.01 * S);
        shape.lineTo(-0.015 * S, -0.05 * S);
        shape.lineTo(0, -0.035 * S);
        shape.lineTo(0.015 * S, -0.05 * S);
        shape.lineTo(0.01 * S, -0.01 * S);
        shape.lineTo(0.04 * S, -0.02 * S);
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 1, side: THREE.DoubleSide
        });
        return new THREE.Mesh(geo, mat);
    }

    function createSatShape(color) {
        const group = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.045, 0.045, 0.025);
        const bodyMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        group.add(new THREE.Mesh(bodyGeo, bodyMat));
        const panelGeo = new THREE.PlaneGeometry(0.09, 0.03);
        const panelMat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.7, side: THREE.DoubleSide
        });
        const leftPanel = new THREE.Mesh(panelGeo, panelMat);
        leftPanel.position.x = -0.07;
        group.add(leftPanel);
        const rightPanel = new THREE.Mesh(panelGeo, panelMat);
        rightPanel.position.x = 0.07;
        group.add(rightPanel);
        return group;
    }

    const satellites = [];

    function createSatellite(orbitIdx, speed, startAngle, color, type) {
        const mesh = type === 'plane' ? createPlaneShape(color) : createSatShape(color);
        const sat = { mesh, orbitIdx, speed, angle: startAngle, color: color.clone(), type };
        root.add(mesh);
        satellites.push(sat);
        return sat;
    }

    createSatellite(0, 0.4, 0, BLUE, 'plane');
    createSatellite(1, -0.3, 1.5, BLUE, 'satellite');
    createSatellite(2, 0.25, 3.0, RED, 'plane');

    // ---- Data nodes on globe surface ----
    const nodeData = [
        { lat: 38.9, lon: -77.0 },   // DC
        { lat: 51.5, lon: -0.1 },    // London
        { lat: 35.7, lon: 139.7 },   // Tokyo
        { lat: 32.1, lon: 34.8 },    // Tel Aviv
        { lat: 1.3, lon: 103.8 },    // Singapore
        { lat: -33.9, lon: 151.2 },  // Sydney
        { lat: 25.2, lon: 55.3 },    // Dubai
        { lat: 52.5, lon: 13.4 },    // Berlin
        { lat: 37.6, lon: 127.0 },   // Seoul
        { lat: 19.1, lon: 72.9 },    // Mumbai
        { lat: 55.7, lon: 37.6 },    // Moscow
        { lat: 39.9, lon: 116.4 },   // Beijing
    ];

    function latLonToVec3(lat, lon, r) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }

    const NODE_TEAL = new THREE.Color(0x00d4aa);
    const NODE_STEEL = new THREE.Color(0x4A90D9);
    const NODE_ORANGE = new THREE.Color(0xff6a35);
    // Assign colors: ensure at least 3 of each, distributed across 12 nodes
    const nodeColors = [
        NODE_TEAL,   // DC
        NODE_STEEL,  // London
        NODE_ORANGE, // Tokyo
        NODE_TEAL,   // Tel Aviv
        NODE_STEEL,  // Singapore
        NODE_ORANGE, // Sydney
        NODE_STEEL,  // Dubai
        NODE_TEAL,   // Berlin
        NODE_ORANGE, // Seoul
        NODE_STEEL,  // Mumbai
        NODE_TEAL,   // Moscow
        NODE_ORANGE, // Beijing
    ];

    const nodeGroup = new THREE.Group();
    root.add(nodeGroup);

    const nodes = nodeData.map((nd, i) => {
        const pos = latLonToVec3(nd.lat, nd.lon, GLOBE_RADIUS * 1.01);
        const color = nodeColors[i];

        // Core dot
        const dotGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        nodeGroup.add(dot);

        // Pulse ring
        const ringGeo = new THREE.RingGeometry(0.05, 0.07, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(0, 0, 0);
        nodeGroup.add(ring);

        return { dot, ring, pos, phase: Math.random() * Math.PI * 2, color };
    });

    // ---- Connection arcs between nodes ----
    const connections = [
        [0, 1], [1, 3], [3, 6], [6, 9], [4, 2], [2, 8], [5, 4],
        [0, 7], [7, 10], [2, 11], [8, 11]
    ];

    function createArc(p1, p2, color, opacity) {
        const points = [];
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dist = p1.distanceTo(p2);
        mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.25);

        for (let i = 0; i <= 48; i++) {
            const t = i / 48;
            const a = new THREE.Vector3().lerpVectors(p1, mid, t);
            const b = new THREE.Vector3().lerpVectors(mid, p2, t);
            points.push(new THREE.Vector3().lerpVectors(a, b, t));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        return new THREE.Line(geo, mat);
    }

    const arcs = connections.map(([i, j]) => {
        const arc = createArc(nodes[i].pos, nodes[j].pos, nodeColors[i], 0.35);
        nodeGroup.add(arc);
        return arc;
    });

    // ---- Intercept trajectories (radial threat lines) ----
    const threatLines = [];
    for (let i = 0; i < 5; i++) {
        const origin = latLonToVec3(
            (Math.random() - 0.5) * 120,
            Math.random() * 360 - 180,
            GLOBE_RADIUS * 1.6
        );
        const target = latLonToVec3(
            (Math.random() - 0.5) * 80,
            Math.random() * 360 - 180,
            GLOBE_RADIUS * 1.01
        );
        const points = [];
        for (let j = 0; j <= 24; j++) {
            points.push(new THREE.Vector3().lerpVectors(origin, target, j / 24));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: RED,
            transparent: true,
            opacity: 0
        });
        const line = new THREE.Line(geo, mat);
        root.add(line);
        threatLines.push({
            line,
            mat,
            phase: Math.random() * 20,
            duration: 2 + Math.random() * 3,
            interval: 8 + Math.random() * 12
        });
    }

    // ---- Scan sweep line ----
    const sweepGeo = new THREE.PlaneGeometry(GLOBE_RADIUS * 1.8, 0.01);
    const sweepMat = new THREE.MeshBasicMaterial({
        color: BLUE,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide
    });
    const sweep = new THREE.Mesh(sweepGeo, sweepMat);
    sweep.rotation.x = Math.PI / 2;
    root.add(sweep);

    // ---- Resize ----
    function resize() {
        const container = canvas.parentElement;
        const w = container.offsetWidth || container.clientWidth || 400;
        const dim = Math.min(w, 560) || 400;
        renderer.setSize(dim, dim, false);
        canvas.style.width = dim + 'px';
        canvas.style.height = dim + 'px';
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    }

    // Ensure layout is ready before first resize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resize);
    } else {
        resize();
    }
    window.addEventListener('resize', resize);
    // Catch late layout shifts
    requestAnimationFrame(resize);

    // ---- Drag interaction ----
    function pointerPos(e) {
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX, y: t.clientY };
    }

    function onDown(e) {
        isDragging = true;
        velocityX = 0;
        velocityY = 0;
        prevPointer = pointerPos(e);
        canvas.style.cursor = 'grabbing';
    }

    function onMove(e) {
        if (!isDragging) return;
        const p = pointerPos(e);
        const dx = p.x - prevPointer.x;
        const dy = p.y - prevPointer.y;
        prevPointer = p;

        velocityX = dx * DRAG_SPEED;
        velocityY = dy * DRAG_SPEED;

        // Apply drag rotation immediately
        dragQuat.identity();
        dragQuat.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, velocityX));
        dragQuat.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, velocityY));
        rotQuat.premultiply(dragQuat);
    }

    function onUp() {
        isDragging = false;
        canvas.style.cursor = 'grab';
    }

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // ---- Hover scan effect ----
    let scanIntensity = 0;
    canvas.parentElement.addEventListener('mouseenter', () => { scanIntensity = 1; });
    canvas.parentElement.addEventListener('mouseleave', () => { scanIntensity = 0; });

    // ---- Animation loop ----
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // Inertia: keep spinning after release, decaying over time
        if (!isDragging) {
            if (Math.abs(velocityX) > INERTIA_THRESHOLD || Math.abs(velocityY) > INERTIA_THRESHOLD) {
                dragQuat.identity();
                dragQuat.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, velocityX));
                dragQuat.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, velocityY));
                rotQuat.premultiply(dragQuat);
                velocityX *= DAMPING;
                velocityY *= DAMPING;
            }

            // Gentle auto-rotation when idle / low inertia
            autoQuat.setFromAxisAngle(yAxis, AUTO_SPEED * dt);
            rotQuat.premultiply(autoQuat);
        }

        rotQuat.normalize();
        root.quaternion.copy(rotQuat);

        // Scan sweep animation
        sweep.position.y = Math.sin(elapsed * 0.7) * GLOBE_RADIUS * 0.9;
        sweepMat.opacity = 0.04 + scanIntensity * 0.06;

        // Pulse data nodes
        for (const node of nodes) {
            const pulse = Math.sin(elapsed * 2 + node.phase) * 0.5 + 0.5;
            node.ring.scale.setScalar(1 + pulse * 0.6);
            node.ring.material.opacity = 0.15 + pulse * 0.35;
            node.dot.material.opacity = 0.5 + pulse * 0.4;
        }

        // Animate satellites along orbits (analytical positioning)
        const _yAxis = new THREE.Vector3(0, 1, 0);
        const _prevPos = new THREE.Vector3();
        const _curPos = new THREE.Vector3();
        const _dir = new THREE.Vector3();
        const _up = new THREE.Vector3();
        const _mat4 = new THREE.Matrix4();
        for (const sat of satellites) {
            // Previous position for direction
            const od = orbits[sat.orbitIdx].userData;
            const tPrev = sat.angle;
            _prevPos.set(
                Math.cos(tPrev) * od.radius,
                Math.sin(tPrev) * Math.sin(od.inclination) * od.radius,
                Math.sin(tPrev) * Math.cos(od.inclination) * od.radius
            );
            _prevPos.applyAxisAngle(_yAxis, od.phase);

            sat.angle += sat.speed * dt;
            const t = sat.angle;
            _curPos.set(
                Math.cos(t) * od.radius,
                Math.sin(t) * Math.sin(od.inclination) * od.radius,
                Math.sin(t) * Math.cos(od.inclination) * od.radius
            );
            _curPos.applyAxisAngle(_yAxis, od.phase);

            sat.mesh.position.copy(_curPos);

            // Orient along travel direction, facing outward from globe
            _dir.subVectors(_curPos, _prevPos).normalize();
            _up.copy(_curPos).normalize();
            const right = new THREE.Vector3().crossVectors(_dir, _up).normalize();
            _up.crossVectors(right, _dir).normalize();
            _mat4.makeBasis(right, _dir, _up);
            sat.mesh.quaternion.setFromRotationMatrix(_mat4);

            const glow = Math.sin(elapsed * 3 + sat.angle) * 0.3 + 0.7;
            sat.mesh.scale.setScalar(0.8 + glow * 0.4);
            // Set opacity on child materials
            sat.mesh.traverse(child => {
                if (child.material) child.material.opacity = glow;
            });
        }

        // Threat/intercept lines flash
        for (const tl of threatLines) {
            const cycle = (elapsed + tl.phase) % tl.interval;
            if (cycle < tl.duration) {
                const t = cycle / tl.duration;
                tl.mat.opacity = Math.sin(t * Math.PI) * 0.25;
            } else {
                tl.mat.opacity = 0;
            }
        }

        // Arc pulse
        for (let i = 0; i < arcs.length; i++) {
            const pulse = Math.sin(elapsed * 1.5 + i * 0.8) * 0.5 + 0.5;
            arcs[i].material.opacity = 0.2 + pulse * 0.25;
        }

        // Scan hover boost on wireframe
        wireframeMat.opacity = 0.3 + scanIntensity * 0.1 * Math.sin(elapsed * 4) * 0.5;

        renderer.render(scene, camera);
    }

    animate();
    } catch (e) { /* WebGL unavailable */ }
})();
