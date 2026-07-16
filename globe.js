(() => {
    try {
    const canvas = document.getElementById('globe');
    if (!canvas || typeof THREE === 'undefined') return;

    // ---- Config ----
    const BLUE = new THREE.Color(0x6BB0EE);
    const RED = new THREE.Color(0xFF5252);
    const GRID_COLOR = new THREE.Color(0x6a8aaa);
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
    camera.position.set(0, 0, 8.4);
    camera.lookAt(0, 0, 0);

    // ---- Star field (parallax background) ----
    function makeStarLayer(count, radius, size, opacity) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = radius + Math.random() * 4;
            pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
            pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i*3+2] = r * Math.cos(phi);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size,
            transparent: true,
            opacity,
            sizeAttenuation: true,
            depthWrite: false,
        });
        return new THREE.Points(geo, mat);
    }
    const starsFar = makeStarLayer(300, 28, 0.04, 0.5);
    const starsNear = makeStarLayer(120, 18, 0.06, 0.75);
    scene.add(starsFar);
    scene.add(starsNear);

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

    // ---- Atmospheric rim glow (does not rotate with globe) ----
    const atmoMat = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
            glowColor: { value: new THREE.Color(0x4A90D9) },
            glowStrength: { value: 1.0 }
        },
        vertexShader: `
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                intensity = pow(0.62 + dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform float glowStrength;
            varying float intensity;
            void main() {
                gl_FragColor = vec4(glowColor, 1.0) * intensity * glowStrength;
            }
        `
    });
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 48, 48);
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // ---- Wireframe sphere (low-poly geodesic) ----
    const sphereGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 3);
    const wireframeMat = new THREE.MeshBasicMaterial({
        color: GRID_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.55
    });
    const wireframe = new THREE.Mesh(sphereGeo, wireframeMat);
    root.add(wireframe);

    // Inner solid sphere — fully opaque to occlude back-side elements
    const innerGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS * 0.99, 4);
    const innerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x1d3247),
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    innerSphere.renderOrder = 0;
    root.add(innerSphere);

    // ---- Lat/lon to 3D helper ----
    function latLonToVec3(lat, lon, r) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }

    // ---- Continent outlines (simplified) ----
    // Each continent is an array of [lat, lon] pairs forming a rough outline
    const continents = [
        // North America
        [[60,-140],[65,-168],[72,-168],[71,-155],[60,-140],[55,-130],[48,-125],[35,-120],
         [30,-115],[25,-110],[20,-105],[15,-95],[18,-88],[20,-87],[22,-85],[25,-80],
         [30,-82],[28,-77],[35,-75],[40,-72],[45,-67],[47,-60],[50,-57],[52,-56],
         [55,-60],[58,-65],[60,-70],[63,-75],[65,-85],[68,-95],[70,-105],[72,-120],
         [70,-140],[65,-145],[60,-148],[60,-140]],
        // South America
        [[12,-70],[10,-75],[7,-77],[2,-80],[-5,-80],[-7,-78],[-15,-76],[-20,-70],
         [-25,-65],[-30,-60],[-35,-57],[-40,-62],[-45,-65],[-50,-68],[-55,-67],
         [-55,-64],[-50,-60],[-45,-55],[-40,-50],[-35,-48],[-30,-48],[-25,-45],
         [-20,-40],[-15,-38],[-10,-35],[-5,-35],[0,-50],[5,-60],[8,-62],[10,-67],[12,-70]],
        // Europe
        [[36,-10],[38,-8],[40,-5],[43,0],[46,2],[48,5],[50,4],[52,5],[54,8],[55,12],
         [57,10],[58,12],[60,5],[62,5],[65,12],[68,15],[70,20],[70,28],[65,28],
         [60,30],[57,28],[55,25],[54,20],[52,15],[50,14],[48,16],[46,15],[44,12],
         [42,14],[40,20],[38,22],[36,28],[35,25],[36,22],[38,18],[37,15],[38,12],
         [36,5],[36,0],[36,-5],[36,-10]],
        // Africa
        [[35,-5],[37,-2],[37,10],[32,13],[30,10],[25,18],[20,17],[15,18],[10,15],
         [5,10],[2,10],[0,9],[-5,12],[-10,14],[-15,17],[-20,25],[-25,30],[-30,32],
         [-35,28],[-35,20],[-30,18],[-25,15],[-20,12],[-15,12],[-10,10],[-5,8],
         [0,2],[5,-5],[5,-8],[8,-10],[10,-15],[15,-17],[20,-17],[25,-15],[30,-10],
         [32,-5],[35,-5]],
        // Asia (simplified)
        [[42,28],[45,35],[42,45],[38,48],[35,52],[25,55],[20,58],[15,62],[10,68],
         [8,77],[10,80],[15,80],[20,85],[25,90],[22,100],[18,105],[10,105],[5,103],
         [1,104],[-8,115],[-5,120],[0,120],[5,115],[10,115],[15,120],[20,115],
         [25,120],[30,122],[35,130],[38,135],[40,140],[42,145],[45,143],[50,140],
         [53,142],[55,135],[60,140],[63,145],[65,150],[67,160],[68,170],[70,170],
         [72,160],[72,140],[70,130],[68,120],[65,100],[62,80],[60,65],[58,55],
         [55,40],[50,38],[45,30],[42,28]],
        // Australia
        [[-12,130],[-15,125],[-18,122],[-22,114],[-28,114],[-32,116],[-35,118],
         [-38,145],[-37,150],[-33,152],[-28,153],[-24,150],[-20,148],[-18,146],
         [-16,145],[-14,142],[-12,137],[-12,130]],
        // Greenland
        [[60,-45],[62,-50],[65,-53],[68,-55],[70,-55],[72,-52],[75,-50],[78,-55],
         [80,-60],[82,-45],[82,-30],[80,-20],[78,-18],[75,-20],[72,-22],[70,-25],
         [68,-30],[65,-38],[62,-42],[60,-45]],
        // UK/Ireland
        [[50,-6],[51,-5],[52,-4],[53,-3],[54,-3],[56,-5],[58,-5],[58,-3],[57,-2],
         [55,-1],[54,0],[52,1],[51,1],[50,-1],[50,-6]],
        // Japan
        [[31,131],[33,130],[35,133],[36,136],[37,137],[38,140],[40,140],[42,141],
         [43,145],[42,143],[40,140],[38,139],[36,137],[35,136],[34,135],[33,132],[31,131]],
    ];

    const CONTINENT_R = GLOBE_RADIUS * 1.001; // just above inner sphere
    const FILL_R = GLOBE_RADIUS * 1.0005;    // fill sits between inner sphere and outline

    // Landmass fills — slightly lighter than ocean to distinguish land
    const landFillMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x355370),
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
    });

    for (const coords of continents) {
        // Create filled landmass shape by triangulating from centroid
        const center = [0, 0];
        for (const [lat, lon] of coords) { center[0] += lat; center[1] += lon; }
        center[0] /= coords.length;
        center[1] /= coords.length;
        const centerV = latLonToVec3(center[0], center[1], FILL_R);

        for (let k = 0; k < coords.length - 1; k++) {
            const a = latLonToVec3(coords[k][0], coords[k][1], FILL_R);
            const b = latLonToVec3(coords[k + 1][0], coords[k + 1][1], FILL_R);
            const triGeo = new THREE.BufferGeometry();
            const verts = new Float32Array([
                centerV.x, centerV.y, centerV.z,
                a.x, a.y, a.z,
                b.x, b.y, b.z
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            triGeo.computeVertexNormals();
            const tri = new THREE.Mesh(triGeo, landFillMat);
            root.add(tri);
        }
    }

    // Continent outline strokes
    const continentMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
    });

    for (const coords of continents) {
        const points = coords.map(([lat, lon]) => latLonToVec3(lat, lon, CONTINENT_R));
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        root.add(new THREE.Line(geo, continentMat));
    }

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
        createOrbit(GLOBE_RADIUS * 1.20, 0.5, 0, BLUE, 0.65),
        createOrbit(GLOBE_RADIUS * 1.35, 1.1, 1.2, BLUE, 0.60),
        createOrbit(GLOBE_RADIUS * 1.28, 0.3, 2.5, RED, 0.60),
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

    // ---- Satellite fading trails ----
    const TRAIL_LEN = 32;
    for (const sat of satellites) {
        const positions = new Float32Array(TRAIL_LEN * 3);
        const colors = new Float32Array(TRAIL_LEN * 3);
        for (let i = 0; i < TRAIL_LEN; i++) {
            const fade = i / (TRAIL_LEN - 1); // 0 at tail, 1 at head
            colors[i*3]   = sat.color.r * fade;
            colors[i*3+1] = sat.color.g * fade;
            colors[i*3+2] = sat.color.b * fade;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const trail = new THREE.Line(geo, mat);
        root.add(trail);
        sat.trail = trail;
        sat.trailPositions = positions;
        sat.trailInitialized = false;
    }

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

    const NODE_STEEL = new THREE.Color(0x4A90D9);
    const NODE_RED = new THREE.Color(0xd83838);
    // Network nodes are all steel blue — red is reserved for cost-exchange events
    const nodeColors = nodeData.map(() => NODE_STEEL);

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

    function buildArcPoints(p1, p2) {
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
        return points;
    }

    const arcs = connections.map(([i, j]) => {
        const points = buildArcPoints(nodes[i].pos, nodes[j].pos);
        const color = nodeColors[i];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
        const line = new THREE.Line(geo, lineMat);
        nodeGroup.add(line);

        // Glowing data packet traveling along the arc
        const packetGeo = new THREE.SphereGeometry(0.028, 10, 10);
        const packetMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const packet = new THREE.Mesh(packetGeo, packetMat);
        nodeGroup.add(packet);

        return {
            line,
            material: lineMat,
            packet,
            packetMat,
            points,
            speed: 0.18 + Math.random() * 0.12,
            phase: Math.random(),
        };
    });

    // ---- Cost-exchange events ----
    // Real, sourced cases from "The Microeconomics of Modern War" — the red
    // markers are documented cost-exchange inversions, not decoration.
    const WRITEUP_URL = 'https://github.com/k-adekilleen/research-pipeline/blob/main/projects/microeconomics-of-war/output/draft.md';
    const eventData = [
        { lat: 44.6, lon: 33.5, name: 'Black Sea — naval drone swarm', ratio: '$250K sea drone vs $65M warship' },
        { lat: 48.6, lon: 38.5, name: 'Donbas — the FPV economy', ratio: '$500 FPV vs $1.5–4.5M tank' },
        { lat: 13.5, lon: 43.2, name: 'Red Sea — the defender’s bill', ratio: '$2K drone vs $2M interceptor' },
        { lat: 39.9, lon: 46.7, name: 'Nagorno-Karabakh — proof of concept', ratio: '245 tanks lost vs 36 (2020)' },
    ];

    const eventGroup = new THREE.Group();
    root.add(eventGroup);

    const events = eventData.map((ev, i) => {
        const pos = latLonToVec3(ev.lat, ev.lon, GLOBE_RADIUS * 1.02);

        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 10, 10),
            new THREE.MeshBasicMaterial({ color: NODE_RED, transparent: true, opacity: 0.95 })
        );
        dot.position.copy(pos);
        eventGroup.add(dot);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.07, 0.095, 24),
            new THREE.MeshBasicMaterial({ color: NODE_RED, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
        );
        ring.position.copy(pos);
        ring.lookAt(0, 0, 0);
        eventGroup.add(ring);

        // Invisible-but-raycastable hit target so hover/tap has a generous area
        const hit = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hit.position.copy(pos);
        hit.userData.eventIndex = i;
        eventGroup.add(hit);

        // Incoming strike line, anchored to the event instead of random
        const origin = pos.clone().normalize().multiplyScalar(GLOBE_RADIUS * 1.7)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
        const pts = [];
        for (let j = 0; j <= 24; j++) {
            pts.push(new THREE.Vector3().lerpVectors(origin, pos, j / 24));
        }
        const lineMat = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0 });
        eventGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));

        return {
            name: ev.name,
            ratio: ev.ratio,
            dot,
            ring,
            hit,
            lineMat,
            phase: i * 4.7,
            interval: 9 + i * 2.3,
            duration: 2.2,
        };
    });

    // ---- Event tooltip (HTML overlay) ----
    const globeContainer = canvas.parentElement;
    const tooltip = document.createElement('div');
    tooltip.className = 'globe-tooltip';
    tooltip.innerHTML =
        '<span class="tt-name"></span>' +
        '<span class="tt-ratio"></span>' +
        '<span class="tt-hint">Click for the research →</span>';
    globeContainer.appendChild(tooltip);
    const ttName = tooltip.querySelector('.tt-name');
    const ttRatio = tooltip.querySelector('.tt-ratio');

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(-2, -2);
    const eventHitMeshes = events.map(ev => ev.hit);
    let hoveredEvent = null;

    function updateNDC(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        mouseNDC.set(
            ((clientX - r.left) / r.width) * 2 - 1,
            -(((clientY - r.top) / r.height) * 2 - 1)
        );
    }

    canvas.addEventListener('mousemove', (e) => updateNDC(e.clientX, e.clientY));

    // ---- Random node ping pool (occasional expanding rings) ----
    const PING_COUNT = 5;
    const pingPool = [];
    for (let i = 0; i < PING_COUNT; i++) {
        const ringGeo = new THREE.RingGeometry(0.05, 0.075, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        nodeGroup.add(ring);
        pingPool.push({ mesh: ring, mat: ringMat, active: false, t: 0 });
    }
    let nextPingTime = 1.0;

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

    let downPointer = null;

    function onDown(e) {
        isDragging = true;
        velocityX = 0;
        velocityY = 0;
        prevPointer = pointerPos(e);
        downPointer = { x: prevPointer.x, y: prevPointer.y };
        updateNDC(prevPointer.x, prevPointer.y); // so taps can hit event markers
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
        // A press that barely moved is a click/tap — open the research if it
        // landed on an event marker
        if (downPointer) {
            const moved = Math.hypot(prevPointer.x - downPointer.x, prevPointer.y - downPointer.y);
            downPointer = null;
            if (moved < 6 && hoveredEvent) {
                window.open(WRITEUP_URL, '_blank', 'noopener');
            }
        }
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

            // Fading trail: shift positions, push new head
            const tp = sat.trailPositions;
            if (!sat.trailInitialized) {
                for (let k = 0; k < TRAIL_LEN; k++) {
                    tp[k*3]   = _curPos.x;
                    tp[k*3+1] = _curPos.y;
                    tp[k*3+2] = _curPos.z;
                }
                sat.trailInitialized = true;
            } else {
                for (let k = 0; k < TRAIL_LEN - 1; k++) {
                    tp[k*3]   = tp[(k+1)*3];
                    tp[k*3+1] = tp[(k+1)*3+1];
                    tp[k*3+2] = tp[(k+1)*3+2];
                }
                tp[(TRAIL_LEN-1)*3]   = _curPos.x;
                tp[(TRAIL_LEN-1)*3+1] = _curPos.y;
                tp[(TRAIL_LEN-1)*3+2] = _curPos.z;
            }
            sat.trail.geometry.attributes.position.needsUpdate = true;
        }

        // Cost-exchange events: pulse markers, flash incoming strike lines
        for (const ev of events) {
            const pulse = Math.sin(elapsed * 2.4 + ev.phase) * 0.5 + 0.5;
            ev.ring.scale.setScalar(1 + pulse * 0.8);
            ev.ring.material.opacity = 0.2 + pulse * 0.4;
            ev.dot.material.opacity = 0.65 + pulse * 0.35;

            const cycle = (elapsed + ev.phase) % ev.interval;
            ev.lineMat.opacity = cycle < ev.duration
                ? Math.sin((cycle / ev.duration) * Math.PI) * 0.3
                : 0;
        }

        // Event hover: raycast against hit targets, front hemisphere only
        const _evWorld = new THREE.Vector3();
        raycaster.setFromCamera(mouseNDC, camera);
        const evHits = raycaster.intersectObjects(eventHitMeshes);
        let hitEvent = null;
        if (evHits.length) {
            const cand = events[evHits[0].object.userData.eventIndex];
            cand.hit.getWorldPosition(_evWorld);
            if (_evWorld.z > 0.3) hitEvent = cand;
        }
        if (hitEvent !== hoveredEvent) {
            hoveredEvent = hitEvent;
            if (hitEvent) {
                ttName.textContent = hitEvent.name;
                ttRatio.textContent = hitEvent.ratio;
                tooltip.classList.add('visible');
            } else {
                tooltip.classList.remove('visible');
            }
        }
        if (hoveredEvent) {
            hoveredEvent.dot.getWorldPosition(_evWorld);
            _evWorld.project(camera);
            const dim = canvas.clientWidth;
            tooltip.style.left = (canvas.offsetLeft + (_evWorld.x * 0.5 + 0.5) * dim) + 'px';
            tooltip.style.top = (canvas.offsetTop + (-_evWorld.y * 0.5 + 0.5) * dim) + 'px';
        }
        if (!isDragging) {
            canvas.style.cursor = hoveredEvent ? 'pointer' : 'grab';
        }

        // Arc pulse + traveling data packets
        for (let i = 0; i < arcs.length; i++) {
            const arc = arcs[i];
            const pulse = Math.sin(elapsed * 1.5 + i * 0.8) * 0.5 + 0.5;
            arc.material.opacity = 0.25 + pulse * 0.3;

            const t = (elapsed * arc.speed + arc.phase) % 1;
            const fIdx = t * (arc.points.length - 1);
            const idx = Math.floor(fIdx);
            const frac = fIdx - idx;
            const p1 = arc.points[idx];
            const p2 = arc.points[Math.min(idx + 1, arc.points.length - 1)];
            arc.packet.position.lerpVectors(p1, p2, frac);
            // Bright in the middle of the run, fade near endpoints
            const edge = Math.sin(t * Math.PI);
            arc.packetMat.opacity = 0.4 + edge * 0.6;
            arc.packet.scale.setScalar(0.8 + edge * 0.6);
        }

        // Random node pings: occasionally trigger an expanding ring at a node
        if (elapsed > nextPingTime) {
            const free = pingPool.find(p => !p.active);
            if (free) {
                const n = nodes[Math.floor(Math.random() * nodes.length)];
                free.active = true;
                free.t = 0;
                free.mesh.position.copy(n.pos);
                free.mesh.lookAt(0, 0, 0);
                free.mat.color.copy(n.color);
            }
            nextPingTime = elapsed + 0.7 + Math.random() * 1.4;
        }
        for (const p of pingPool) {
            if (!p.active) continue;
            p.t += dt * 0.7;
            if (p.t >= 1) {
                p.active = false;
                p.mat.opacity = 0;
                continue;
            }
            const eased = 1 - Math.pow(1 - p.t, 2); // ease-out
            p.mesh.scale.setScalar(1 + eased * 7);
            p.mat.opacity = (1 - p.t) * 0.55;
        }

        // Scan hover boost on wireframe
        wireframeMat.opacity = 0.3 + scanIntensity * 0.1 * Math.sin(elapsed * 4) * 0.5;

        renderer.render(scene, camera);
    }

    animate();
    } catch (e) { /* WebGL unavailable */ }
})();
