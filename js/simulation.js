document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('solar-canvas-container');
    if (!container) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    let currentSpeedMultiplier = 1;

    // ─── Рендерер ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 200000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    camera.position.set(0, 800, 1200);
    camera.lookAt(0, 0, 0);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 150000;
    controls.target.set(0, 0, 0);

    // ─── Освітлення ─────────────────────────────────────────────────────────────
    // Підвищено ambient щоб темна сторона планет не була чорною
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xfff5e0, 3, 200000);
    scene.add(sunLight);

    // ─── UI ─────────────────────────────────────────────────────────────────────
    const speedSlider = document.getElementById('speed-slider');
    const lightToggle = document.getElementById('light-toggle');

    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            currentSpeedMultiplier = parseFloat(e.target.value);
        });
    }
    if (lightToggle) {
        lightToggle.addEventListener('change', (e) => {
            const isOn = e.target.checked;
            sunLight.intensity     = isOn ? 3   : 0;
            ambientLight.intensity = isOn ? 1.2 : 0.3;
        });
    }

    // ─── Зірки ──────────────────────────────────────────────────────────────────
    function createStars() {
        const geo = new THREE.BufferGeometry();
        const verts = [];
        const r = 60000;
        for (let i = 0; i < 15000; i++) {
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            verts.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xffffff, size: 1.5, transparent: true, opacity: 0.7, depthWrite: false
        })));
    }
    createStars();

    // ─── Текстури ────────────────────────────────────────────────────────────────
    const textureLoader = new THREE.TextureLoader();
    const TEXTURE_PATH = 'image/textures/';
    const PLANET_TEXTURES = {
        'Sun':     'sunmap.jpg',
        'Mercury': 'mercurymap.jpg',
        'Venus':   'venusmap.jpg',
        'Earth':   'earthmap1k.jpg',
        'Mars':    'mars_1k_color.jpg',
        'Jupiter': 'jupitermap.jpg',
        'Saturn':  'saturnmap.jpg',
        'Uranus':  'uranusmap.jpg',
        'Neptune': 'neptunemap.jpg',
    };
    const FALLBACK_COLORS = {
        'Mercury': 0x909090, 'Venus':   0xe8cda0,
        'Earth':   0x2e6fa3, 'Mars':    0xc1440e,
        'Jupiter': 0xc88b3a, 'Saturn':  0xe4d191,
        'Uranus':  0x7de8e8, 'Neptune': 0x3f54ba,
    };

    function loadTexture(name) {
        const file = PLANET_TEXTURES[name];
        if (!file) return null;
        return textureLoader.load(TEXTURE_PATH + file, undefined, undefined,
            () => console.warn(`Текстура не знайдена: ${TEXTURE_PATH + file}`)
        );
    }

    // ─── Сонце ──────────────────────────────────────────────────────────────────
    const sunTexture = loadTexture('Sun');
    const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(25, 64, 64),
        new THREE.MeshBasicMaterial({ map: sunTexture || null, color: sunTexture ? 0xffffff : 0xffcc33 })
    );
    scene.add(sunMesh);

    // ─── Дані про планети ────────────────────────────────────────────────────────
    const PLANET_INFO = {
        'Mercury': { ua: 'Меркурій',  desc: 'Найменша планета Сонячної системи та найближча до Сонця. Не має атмосфери.', diameter: '4 879 км', dayLength: '59 земних днів', moons: 0 },
        'Venus':   { ua: 'Венера',    desc: 'Найгарячіша планета. Щільна атмосфера з CO₂ створює парниковий ефект.', diameter: '12 104 км', dayLength: '243 земних дні', moons: 0 },
        'Earth':   { ua: 'Земля',     desc: 'Єдина відома планета з життям. 71% поверхні вкрито водою.', diameter: '12 742 км', dayLength: '24 години', moons: 1 },
        'Mars':    { ua: 'Марс',      desc: 'Червона планета з найвищим вулканом у системі — Олімп (21 км).', diameter: '6 779 км', dayLength: '24,6 години', moons: 2 },
        'Jupiter': { ua: 'Юпітер',    desc: 'Найбільша планета. Велика Червона Пляма — шторм, що триває сотні років.', diameter: '139 820 км', dayLength: '9,9 години', moons: 95 },
        'Saturn':  { ua: 'Сатурн',    desc: 'Відомий своїми кільцями з льоду та каменю. Найменша щільність серед планет.', diameter: '116 460 км', dayLength: '10,7 години', moons: 146 },
        'Uranus':  { ua: 'Уран',      desc: 'Обертається на боці — вісь нахилена на 98°. Найхолодніша атмосфера.', diameter: '50 724 км', dayLength: '17,2 години', moons: 27 },
        'Neptune': { ua: 'Нептун',    desc: 'Найвіддаленіша планета. Вітри до 2 100 км/год — найшвидші в системі.', diameter: '49 244 км', dayLength: '16,1 години', moons: 16 },
    };

    // ─── Інфо-панель ─────────────────────────────────────────────────────────────
    const infoPanel = document.createElement('div');
    infoPanel.id = 'planet-info-panel';
    infoPanel.style.cssText = `
        position: absolute; top: 20px; left: 20px;
        background: rgba(0,0,0,0.85);
        border: 1px solid rgba(0,242,255,0.4);
        border-radius: 12px;
        padding: 20px 24px;
        color: #fff;
        font-family: 'Jura', sans-serif;
        z-index: 1000;
        min-width: 240px;
        max-width: 300px;
        display: none;
        backdrop-filter: blur(8px);
    `;
    container.appendChild(infoPanel);

    function showInfoPanel(name) {
        const info = PLANET_INFO[name];
        if (!info) return;
        infoPanel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                    <div style="font-size:1.2rem; font-weight:700; letter-spacing:2px; color:#00f2ff; text-transform:uppercase;">${info.ua}</div>
                    <div style="font-size:0.7rem; color:#8899aa; letter-spacing:1px; text-transform:uppercase;">${name}</div>
                </div>
                <button id="info-close" style="background:none; border:none; color:#8899aa; font-size:1.2rem; cursor:pointer; padding:0 0 0 12px; line-height:1;">✕</button>
            </div>
            <div style="font-size:0.82rem; color:#ccd6e0; line-height:1.6; margin-bottom:14px;">${info.desc}</div>
            <div style="border-top:1px solid rgba(0,242,255,0.2); padding-top:12px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span style="color:#8899aa;">Діаметр</span>
                    <span style="color:#e0eaf2;">${info.diameter}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span style="color:#8899aa;">Доба</span>
                    <span style="color:#e0eaf2;">${info.dayLength}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
                    <span style="color:#8899aa;">Супутники</span>
                    <span style="color:#e0eaf2;">${info.moons}</span>
                </div>
            </div>
            <button id="info-detach" style="
                margin-top:14px; width:100%; padding:7px;
                background:rgba(0,242,255,0.1);
                border:1px solid rgba(0,242,255,0.4);
                border-radius:6px; color:#00f2ff;
                font-family:'Jura',sans-serif;
                font-size:0.75rem; letter-spacing:1px;
                text-transform:uppercase; cursor:pointer;
            ">Відкріпити камеру</button>
        `;
        infoPanel.style.display = 'block';
        document.getElementById('info-close').onclick = () => {
            infoPanel.style.display = 'none';
            detachCamera();
        };
        document.getElementById('info-detach').onclick = detachCamera;
    }

    // ─── Фокус камери ────────────────────────────────────────────────────────────
    let focusedPlanet = null;
    let isCameraAttached = false;
    let isFlying = false;
    const planetWorldPos = new THREE.Vector3();

    function focusOnPlanet(planet) {
        focusedPlanet = planet;
        isCameraAttached = true;
        isFlying = true;
        controls.enabled = false;

        const mesh = planet.group.children[0];
        const radius = mesh.geometry.parameters.radius || 10;
        const offset = radius * 6 + 80;

        const startCamPos = camera.position.clone();
        const startTarget = controls.target.clone();
        let t = 0;

        function flyTo() {
            if (!isCameraAttached) return;
            t += 0.022;
            const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
            const clamped = Math.min(t, 1);
            const easedC = clamped < 0.5 ? 2*clamped*clamped : -1+(4-2*clamped)*clamped;

            planet.group.getWorldPosition(planetWorldPos);
            const endCamPos = planetWorldPos.clone().add(new THREE.Vector3(offset, offset * 0.4, offset));

            camera.position.lerpVectors(startCamPos, endCamPos, easedC);
            controls.target.lerpVectors(startTarget, planetWorldPos, easedC);
            controls.update();

            if (t < 1) {
                requestAnimationFrame(flyTo);
            } else {
                isFlying = false;
                controls.enabled = true;
            }
        }
        flyTo();
    }

    function detachCamera() {
        isCameraAttached = false;
        isFlying = false;
        focusedPlanet = null;
        controls.enabled = true;
        infoPanel.style.display = 'none';
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') detachCamera();
        if (e.key.toLowerCase() === 'l' && lightToggle) {
            lightToggle.checked = !lightToggle.checked;
            lightToggle.dispatchEvent(new Event('change'));
        }
    });

    // ─── Орбіти ──────────────────────────────────────────────────────────────────
    function createOrbit(distance) {
        const points = new THREE.EllipseCurve(0, 0, distance, distance).getPoints(128);
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const orbit = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
            color: 0x00f2ff, transparent: true, opacity: 0.15
        }));
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);
    }

    function createLabel(name, planet) {
        const div = document.createElement('div');
        div.className = 'planet-label';
        div.textContent = name;
        div.style.cursor = 'pointer';
        div.title = 'Натисніть, щоб наблизитись';
        div.addEventListener('click', () => {
            focusOnPlanet(planet);
            showInfoPanel(name);
        });
        container.appendChild(div);
        return div;
    }

    // ─── Планети ─────────────────────────────────────────────────────────────────
    const planets = [];
    const distanceScale = 0.000003;
    const sizeScale = 0.0006;
    const timeScale = 0.02;

    function processPlanetData(p) {
        const radius = p.meanRadius * sizeScale || 5;
        const distance = p.semimajorAxis * distanceScale;
        createOrbit(distance);

        const texture = loadTexture(p.englishName);
        const fallbackColor = FALLBACK_COLORS[p.englishName] || 0x888888;
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 32),
            new THREE.MeshStandardMaterial({
                map: texture || null,
                color: texture ? 0xffffff : fallbackColor,
                roughness: 0.8,
                metalness: 0.0,
            })
        );

        const group = new THREE.Group();
        group.add(mesh);
        scene.add(group);

        const planetObj = {
            group, distance,
            speed: (1 / (p.sideralOrbit || 365)) * timeScale * 100,
            angle: Math.random() * Math.PI * 2,
            label: null,
            name: p.englishName,
        };
        planets.push(planetObj);
        planetObj.label = createLabel(p.englishName, planetObj);
    }

    function clearPlanets() {
        planets.forEach(p => {
            if (p.label && p.label.parentNode) p.label.parentNode.removeChild(p.label);
            scene.remove(p.group);
        });
        planets.length = 0;
    }

    // ─── Init ────────────────────────────────────────────────────────────────────
    async function init() {
        clearPlanets();
        try {
            const res = await fetch('https://api.le-systeme-solaire.net/rest/bodies/');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            data.bodies
                .filter(b => b.isPlanet)
                .sort((a, b) => a.semimajorAxis - b.semimajorAxis)
                .forEach(processPlanetData);
        } catch (err) {
            console.warn("API Error, using local fallback:", err);
            [
                { englishName: "Mercury", meanRadius: 2439,  semimajorAxis: 57910000,   sideralOrbit: 88    },
                { englishName: "Venus",   meanRadius: 6051,  semimajorAxis: 108200000,  sideralOrbit: 224   },
                { englishName: "Earth",   meanRadius: 6371,  semimajorAxis: 149600000,  sideralOrbit: 365   },
                { englishName: "Mars",    meanRadius: 3389,  semimajorAxis: 227900000,  sideralOrbit: 687   },
                { englishName: "Jupiter", meanRadius: 69911, semimajorAxis: 778500000,  sideralOrbit: 4333  },
                { englishName: "Saturn",  meanRadius: 58232, semimajorAxis: 1432000000, sideralOrbit: 10759 },
                { englishName: "Uranus",  meanRadius: 25362, semimajorAxis: 2867000000, sideralOrbit: 30687 },
                { englishName: "Neptune", meanRadius: 24622, semimajorAxis: 4515000000, sideralOrbit: 60190 },
            ].forEach(processPlanetData);
        }
    }

    // ─── Анімація ────────────────────────────────────────────────────────────────
    const vector = new THREE.Vector3();

    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        sunMesh.rotation.y += 0.001 * currentSpeedMultiplier;

        planets.forEach(p => {
            p.angle += p.speed * currentSpeedMultiplier;
            p.group.position.set(
                Math.cos(p.angle) * p.distance,
                0,
                Math.sin(p.angle) * p.distance
            );
            p.group.children[0].rotation.y += 0.01 * currentSpeedMultiplier;

            // Якщо прикріплені до планети і політ завершено — слідкуємо за нею
            if (isCameraAttached && !isFlying && focusedPlanet === p) {
                p.group.getWorldPosition(planetWorldPos);
                controls.target.lerp(planetWorldPos, 0.08);
            }

            // Лейбл
            p.group.getWorldPosition(vector);
            vector.project(camera);
            const x = (vector.x * 0.5 + 0.5) * width;
            const y = (-(vector.y * 0.5) + 0.5) * height;
            p.label.style.display = vector.z < 1 ? 'block' : 'none';
            p.label.style.left = `${Math.round(x)}px`;
            p.label.style.top  = `${Math.round(y)}px`;
        });

        renderer.render(scene, camera);
    }

    // ─── Resize ──────────────────────────────────────────────────────────────────
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            width = container.clientWidth;
            height = container.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }, 100);
    });

    init().then(animate).catch(err => console.error("Помилка ініціалізації:", err));
});
