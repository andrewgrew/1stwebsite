document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('solar-canvas-container');
    if (!container) return;

    let width  = container.clientWidth;
    let height = container.clientHeight;

    const BASE_MULT = 1000;
    let speedMultiplier = BASE_MULT * 2;

    // ─── Рендерер ───────────────────────────────────────────────────────────
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(60, width / height, 0.1, 200000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    camera.position.set(0, 900, 1400);
    camera.lookAt(0, 0, 0);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = 5;
    controls.maxDistance   = 8000;
    controls.target.set(0, 0, 0);

    // ─── Освітлення ─────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xfff5e0, 4, 200000);
    scene.add(sunLight);

    // ─── Кнопки швидкості ───────────────────────────────────────────────────
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            speedMultiplier = BASE_MULT * parseFloat(btn.dataset.mult);
            resetIdleTimer();
        });
    });

    const lightToggle = document.getElementById('light-toggle');
    if (lightToggle) {
        lightToggle.addEventListener('change', (e) => {
            const on = e.target.checked;
            sunLight.intensity     = on ? 4   : 0;
            ambientLight.intensity = on ? 1.8 : 0.4;
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') detachCamera();
        if (e.key.toLowerCase() === 'l' && lightToggle) {
            lightToggle.checked = !lightToggle.checked;
            lightToggle.dispatchEvent(new Event('change'));
        }
        resetIdleTimer();
    });

    // ─── Автоприховання UI після 10 секунд бездіяльності ────────────────────
    // Елементи що ховаються: панель управління, підказка, всі лейбли, орбіти
    let uiVisible  = true;
    let idleTimer  = null;
    const UI_TIMEOUT = 10000;

    // Збираємо всі UI-елементи (крім інфо-панелі та canvas)
    const uiElements = [
        document.getElementById('controls-panel'),
        document.getElementById('camera-controls-hint'),
    ];

    // Орбіти зберігаємо в масиві щоб ховати/показувати
    const orbitLines = [];

    function setUIVisible(v) {
        uiVisible = v;
        const opacity = v ? '1' : '0';
        const events  = v ? 'auto' : 'none';
        uiElements.forEach(el => {
            if (!el) return;
            el.style.transition = 'opacity 0.6s';
            el.style.opacity    = opacity;
            el.style.pointerEvents = events;
        });
        // Лейбли
        allLabels.forEach(lbl => {
            lbl.el.style.transition = 'opacity 0.6s';
            lbl.el.style.opacity    = v ? '1' : '0';
            lbl.el.style.pointerEvents = v ? 'auto' : 'none';
        });
        // Орбіти
        orbitLines.forEach(line => {
            line.material.transparent = true;
            line.material.opacity = v ? line._baseOpacity : 0;
        });
    }

    function resetIdleTimer() {
        if (!uiVisible) setUIVisible(true);
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => setUIVisible(false), UI_TIMEOUT);
    }

    // Слухаємо будь-яку активність
    ['mousemove', 'mousedown', 'wheel', 'touchstart', 'touchmove'].forEach(ev => {
        container.addEventListener(ev, resetIdleTimer, { passive: true });
    });

    resetIdleTimer(); // запускаємо таймер одразу

    // ─── Зірки ──────────────────────────────────────────────────────────────
    (function () {
        const geo = new THREE.BufferGeometry();
        const v = [];
        const r = 80000;
        for (let i = 0; i < 18000; i++) {
            const th = 2 * Math.PI * Math.random();
            const ph = Math.acos(2 * Math.random() - 1);
            v.push(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xffffff, size: 1.5, transparent: true, opacity: 0.75, depthWrite: false
        })));
    })();

    // ─── Текстури ────────────────────────────────────────────────────────────
    const tl    = new THREE.TextureLoader();
    const TPATH = 'image/textures/';
    const TEX   = {
        Sun: 'sunmap.jpg', Mercury: 'mercurymap.jpg', Venus: 'venusmap.jpg',
        Earth: 'earthmap1k.jpg', Mars: 'mars_1k_color.jpg', Jupiter: 'jupitermap.jpg',
        Saturn: 'saturnmap.jpg', Uranus: 'uranusmap.jpg', Neptune: 'neptunemap.jpg',
        Pluto: 'plutomap1k.jpg', Moon: 'moon.jpg',
    };
    const PLANET_COLORS = {
        Mercury: 0xb0b0b0, Venus: 0xf0dfa0, Earth: 0x4a90d9, Mars: 0xd4623a,
        Jupiter: 0xd4a855, Saturn: 0xe8d9a0, Uranus: 0x9ef0f0, Neptune: 0x4a6fd4,
        Pluto: 0xc4a882,
    };

    function loadTex(name) {
        const f = TEX[name]; if (!f) return null;
        return tl.load(TPATH + f, undefined, undefined,
            () => console.warn('Текстура не знайдена:', TPATH + f));
    }

    // ─── Орбіти ─────────────────────────────────────────────────────────────
    // baseOpacity — запам'ятовуємо для fade-in/out
    function createOrbit(r, parent, color, opacity) {
        color   = color   || 0x00f2ff;
        opacity = opacity || 0.12;
        const pts = new THREE.EllipseCurve(0, 0, r, r).getPoints(160);
        const line = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        );
        line.rotation.x = Math.PI / 2;
        line._baseOpacity = opacity;
        if (parent) parent.add(line); else scene.add(line);
        orbitLines.push(line);
        return line;
    }

    // ─── Сонце ──────────────────────────────────────────────────────────────
    const sunTex  = loadTex('Sun');
    const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(28, 64, 64),
        new THREE.MeshBasicMaterial({ map: sunTex || null, color: sunTex ? 0xffffff : 0xffcc33 })
    );
    scene.add(sunMesh);

    // ─── Пояси астероїдів ────────────────────────────────────────────────────
    const AU = 149600000;
    const DS = 0.000003;

    function asteroidBelt(innerAU, outerAU, count, spread, color) {
        const geo = new THREE.BufferGeometry();
        const p = [];
        for (let i = 0; i < count; i++) {
            const r = (innerAU + Math.random()*(outerAU-innerAU)) * AU * DS;
            const a = Math.random() * 2 * Math.PI;
            p.push(Math.cos(a)*r, (Math.random()-0.5)*spread, Math.sin(a)*r);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        // Астероїди теж ховаються — зберігаємо як Points з _baseOpacity
        const mat  = new THREE.PointsMaterial({ color, size: 1.2, transparent: true, opacity: 0.5, depthWrite: false });
        const pts  = new THREE.Points(geo, mat);
        pts._baseOpacity = 0.5;
        pts._isBelt = true;
        orbitLines.push(pts); // додаємо до загального списку для fade
        scene.add(pts);
    }
    asteroidBelt(2.2, 3.2, 6000, 30, 0x888888);
    asteroidBelt(30,  50,  8000, 60, 0x707880);

    // ─── Лейбл-фабрика ──────────────────────────────────────────────────────
    const allLabels = [];

    function makeLabel(infoKey, displayText, ref, isMoon) {
        const div = document.createElement('div');
        div.className = 'planet-label' + (isMoon ? ' moon-label' : '');
        div.textContent = displayText;
        if (ref !== null) {
            div.classList.add('clickable');
            div.title = 'Натисніть для фокусу';
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                resetIdleTimer();
                focusOnPlanet(ref);
                showInfoPanel(infoKey);
            });
        }
        container.appendChild(div);
        const lbl = { el: div };
        allLabels.push(lbl);
        return lbl;
    }

    // ─── Інфо-панель ────────────────────────────────────────────────────────
    const INFO = {
        Sun:     { ua:'Сонце',    desc:'Зірка G-класу в центрі системи. Містить 99,86% маси. Температура поверхні ~5 500 °C.', diameter:'1 392 700 км', day:'~25 земних днів', moons:8 },
        Mercury: { ua:'Меркурій', desc:'Найменша планета. Немає атмосфери, температура від −180 до +430 °C.', diameter:'4 879 км', day:'59 земних днів', moons:0 },
        Venus:   { ua:'Венера',   desc:'Найгарячіша планета (462 °C). CO₂-атмосфера, тиск у 92 рази вищий за земний.', diameter:'12 104 км', day:'243 земних дні', moons:0 },
        Earth:   { ua:'Земля',    desc:'Єдина відома планета з рідкою водою і складним життям.', diameter:'12 742 км', day:'24 год', moons:1 },
        Moon:    { ua:'Місяць',   desc:'Єдиний природний супутник Землі. Стабілізує нахил осі й спричиняє припливи.', diameter:'3 474 км', day:'27,3 земних дні', moons:0 },
        Mars:    { ua:'Марс',     desc:'Олімп — найвищий вулкан (21 км). Є сезони та полярні крижані шапки.', diameter:'6 779 км', day:'24,6 год', moons:2 },
        Jupiter: { ua:'Юпітер',   desc:'Найбільша планета — 11 разів ширша за Землю. Велика Червона Пляма — шторм 350+ років.', diameter:'139 820 км', day:'9,9 год', moons:95 },
        Saturn:  { ua:'Сатурн',   desc:'Кільця шириною 282 000 км і завтовшки ~1 км. Найменша щільність серед планет.', diameter:'116 460 км', day:'10,7 год', moons:146 },
        Uranus:  { ua:'Уран',     desc:'Нахил осі 98° — обертається «на боці». Найхолодніша атмосфера (−224 °C).', diameter:'50 724 км', day:'17,2 год', moons:27 },
        Neptune: { ua:'Нептун',   desc:'Вітри до 2 100 км/год — найшвидші в Сонячній системі.', diameter:'49 244 км', day:'16,1 год', moons:16 },
        Pluto:   { ua:'Плутон',   desc:'Карликова планета в поясі Койпера. Харон — майже половина розміру Плутона.', diameter:'2 377 км', day:'6,4 земних дні', moons:5 },
        Phobos:  { ua:'Фобос',    desc:'Найближчий супутник Марса. Наближається до планети на ~1,8 м/рік.', diameter:'22 км', day:'7,6 год', moons:0 },
        Deimos:  { ua:'Деймос',   desc:'Менший і дальший супутник Марса. Повільно віддаляється від планети.', diameter:'12 км', day:'30,3 год', moons:0 },
        Io:      { ua:'Іо',       desc:'Найвулканічніше тіло у Сонячній системі. Поверхня постійно оновлюється лавою.', diameter:'3 642 км', day:'1,77 земних дні', moons:0 },
        Europa:  { ua:'Європа',   desc:'Під льодом — океан рідкої води. Кандидат для пошуку позаземного життя.', diameter:'3 122 км', day:'3,55 земних дні', moons:0 },
        Ganymede:{ ua:'Ганімед',  desc:'Найбільший супутник у системі — більший за Меркурій. Є магнітне поле.', diameter:'5 268 км', day:'7,15 земних дні', moons:0 },
        Callisto:{ ua:'Калісто',  desc:'Найстаріша поверхня в системі — вкрита кратерами.', diameter:'4 821 км', day:'16,7 земних дні', moons:0 },
        Titan:   { ua:'Титан',    desc:'Єдиний супутник з густою атмосферою та озерами з метану на поверхні.', diameter:'5 150 км', day:'15,9 земних дні', moons:0 },
        Triton:  { ua:'Тритон',   desc:'Рухається у зворотному напрямку — ймовірно захоплений об\'єкт поясу Койпера.', diameter:'2 707 км', day:'5,88 земних дні', moons:0 },
        Charon:  { ua:'Харон',    desc:'Такий великий, що систему вважають подвійною карликовою планетою.', diameter:'1 212 км', day:'6,4 земних дні', moons:0 },
    };

    const infoPanel = document.createElement('div');
    infoPanel.id = 'planet-info-panel';
    Object.assign(infoPanel.style, {
        position:'absolute', top:'20px', left:'20px',
        background:'rgba(0,0,0,0.88)', border:'1px solid rgba(0,242,255,0.4)',
        borderRadius:'12px', padding:'20px 24px', color:'#fff',
        fontFamily:"'Jura',sans-serif", zIndex:'1000',
        minWidth:'240px', maxWidth:'300px', display:'none',
        backdropFilter:'blur(10px)',
    });
    container.appendChild(infoPanel);

    function showInfoPanel(key) {
        const i = INFO[key]; if (!i) return;
        infoPanel.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:1.15rem;font-weight:700;letter-spacing:2px;color:#00f2ff;text-transform:uppercase">${i.ua}</div>
              <div style="font-size:0.68rem;color:#8899aa;letter-spacing:1px;text-transform:uppercase">${key}</div>
            </div>
            <button id="ip-close" style="background:none;border:none;color:#8899aa;font-size:1.2rem;cursor:pointer;padding:0 0 0 12px;line-height:1">✕</button>
          </div>
          <div style="font-size:0.82rem;color:#ccd6e0;line-height:1.6;margin-bottom:14px">${i.desc}</div>
          <div style="border-top:1px solid rgba(0,242,255,0.2);padding-top:12px;display:flex;flex-direction:column;gap:7px">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem">
              <span style="color:#8899aa">Діаметр</span><span style="color:#e0eaf2">${i.diameter}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.78rem">
              <span style="color:#8899aa">Доба</span><span style="color:#e0eaf2">${i.day}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.78rem">
              <span style="color:#8899aa">Супутники</span><span style="color:#e0eaf2">${i.moons}</span>
            </div>
          </div>
          <button id="ip-detach" style="margin-top:14px;width:100%;padding:7px;
            background:rgba(0,242,255,0.1);border:1px solid rgba(0,242,255,0.4);
            border-radius:6px;color:#00f2ff;font-family:'Jura',sans-serif;
            font-size:0.75rem;letter-spacing:1px;text-transform:uppercase;cursor:pointer">
            Відкріпити камеру
          </button>`;
        infoPanel.style.display = 'block';
        document.getElementById('ip-close').onclick  = () => { infoPanel.style.display='none'; detachCamera(); };
        document.getElementById('ip-detach').onclick = detachCamera;
    }

    // ─── Фокус камери ───────────────────────────────────────────────────────
    let focusTarget      = null;
    let isCameraAttached = false;
    let isFlying         = false;
    const _wp = new THREE.Vector3();

    function focusOnPlanet(ref) {
        focusTarget      = ref;
        isCameraAttached = true;
        isFlying         = true;
        controls.enabled = false;

        const r      = ref.group.children[0].geometry.parameters.radius || 10;
        const offset = Math.max(r * 7, 30);
        const cs = camera.position.clone();
        const ts = controls.target.clone();
        let t = 0;

        function fly() {
            if (!isCameraAttached) return;
            t = Math.min(t + 0.02, 1);
            const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
            ref.group.getWorldPosition(_wp);
            camera.position.lerpVectors(cs, _wp.clone().add(new THREE.Vector3(offset, offset*0.35, offset)), e);
            controls.target.lerpVectors(ts, _wp, e);
            controls.update();
            if (t < 1) requestAnimationFrame(fly);
            else { isFlying = false; controls.enabled = true; }
        }
        fly();
    }

    function detachCamera() {
        isCameraAttached = false;
        isFlying         = false;
        focusTarget      = null;
        controls.enabled = true;
        infoPanel.style.display = 'none';
    }

    // ─── Дані планет ────────────────────────────────────────────────────────
    const SIZE_SCALE = 0.0008;
    const MIN_RADIUS = 4;
    const DS_ORBIT   = DS; // для планетних орбіт

    const PLANET_DATA = [
        { name:'Mercury', radius:2439,  semiAxis:  57910000, period:   87.97 },
        { name:'Venus',   radius:6051,  semiAxis: 108200000, period:  224.70 },
        { name:'Earth',   radius:6371,  semiAxis: 149600000, period:  365.25 },
        { name:'Mars',    radius:3389,  semiAxis: 227900000, period:  686.97 },
        { name:'Jupiter', radius:69911, semiAxis: 778500000, period: 4332.59 },
        { name:'Saturn',  radius:58232, semiAxis:1432000000, period:10759.22 },
        { name:'Uranus',  radius:25362, semiAxis:2867000000, period:30688.50 },
        { name:'Neptune', radius:24622, semiAxis:4515000000, period:60182.00 },
        { name:'Pluto',   radius:1188,  semiAxis:5906380000, period:90560.00 },
    ];

    // Орбіти супутників задаємо як множник від ВІЗУАЛЬНОГО радіуса планети.
    // Це гарантує що супутник завжди поза планетою незалежно від масштабу.
    // orbitMult — скільки візуальних радіусів планети від центру
    // moonRadiusMult — розмір супутника як частка візуального радіуса планети
    const MOON_DATA = {
        Earth:   [
            { name:'Moon',     orbitMult:4.5,  moonRadiusMult:0.27, color:0xcccccc, texKey:'Moon',   showLabel:true,  period:27.32  },
        ],
        Mars:    [
            { name:'Phobos',   orbitMult:3.2,  moonRadiusMult:0.18, color:0x998877, texKey:null,     showLabel:false, period:0.319  },
            { name:'Deimos',   orbitMult:5.5,  moonRadiusMult:0.14, color:0xaa9988, texKey:null,     showLabel:false, period:1.263  },
        ],
        Jupiter: [
            { name:'Io',       orbitMult:2.8,  moonRadiusMult:0.25, color:0xd4b84a, texKey:null,     showLabel:false, period:1.769  },
            { name:'Europa',   orbitMult:4.0,  moonRadiusMult:0.22, color:0xc8b89a, texKey:null,     showLabel:false, period:3.551  },
            { name:'Ganymede', orbitMult:5.8,  moonRadiusMult:0.38, color:0xa09080, texKey:null,     showLabel:false, period:7.155  },
            { name:'Callisto', orbitMult:8.5,  moonRadiusMult:0.35, color:0x706050, texKey:null,     showLabel:false, period:16.690 },
        ],
        Saturn:  [
            { name:'Titan',    orbitMult:4.5,  moonRadiusMult:0.32, color:0xd4a040, texKey:null,     showLabel:false, period:15.945 },
        ],
        Neptune: [
            { name:'Triton',   orbitMult:4.0,  moonRadiusMult:0.30, color:0xaabbcc, texKey:null,     showLabel:false, period:5.877  },
        ],
        Pluto:   [
            { name:'Charon',   orbitMult:5.0,  moonRadiusMult:0.50, color:0xb0a898, texKey:null,     showLabel:false, period:6.387  },
        ],
    };

    // ─── Лейбл Сонця ────────────────────────────────────────────────────────
    const sunLabelObj = makeLabel('Sun', 'Сонце', { group: sunMesh }, false);

    // ─── Побудова планет ────────────────────────────────────────────────────
    const planets = [];

    PLANET_DATA.forEach(pd => {
        const planetDist   = pd.semiAxis * DS_ORBIT;
        const planetRadius = Math.max(pd.radius * SIZE_SCALE, MIN_RADIUS);
        createOrbit(planetDist, null, 0x00f2ff, 0.12);

        const texture = loadTex(pd.name);
        const fbColor = PLANET_COLORS[pd.name] || 0x888888;

        const planetMesh = new THREE.Mesh(
            new THREE.SphereGeometry(planetRadius, 48, 48),
            new THREE.MeshStandardMaterial({
                map: texture || null,
                color: texture ? 0xffffff : fbColor,
                emissive: new THREE.Color(fbColor),
                emissiveIntensity: texture ? 0.08 : 0.18,
                roughness: 0.75, metalness: 0.0,
            })
        );

        const group = new THREE.Group();
        group.add(planetMesh);
        scene.add(group);

        const planetObj = {
            group,
            dist: planetDist,
            angularSpeedPerMs: (2 * Math.PI) / (pd.period * 86400 * 1000),
            angle: Math.random() * 2 * Math.PI,
            name: pd.name,
            visualRadius: planetRadius,
            label: makeLabel(pd.name, pd.name, null, false), // планети — лейбл без кліку
            moons: [],
        };

        // Перевизначаємо клік окремо щоб мати посилання на planetObj
        planetObj.label.el.classList.add('clickable');
        planetObj.label.el.title = 'Натисніть для фокусу';
        planetObj.label.el.addEventListener('click', (e) => {
            e.stopPropagation();
            resetIdleTimer();
            focusOnPlanet(planetObj);
            showInfoPanel(pd.name);
        });

        planets.push(planetObj);

        // ── Супутники ──────────────────────────────────────────────────────
        (MOON_DATA[pd.name] || []).forEach(md => {
            // Орбіта = orbitMult × візуальний радіус планети
            const moonOrbitR  = planetRadius * md.orbitMult;
            // Розмір супутника = moonRadiusMult × візуальний радіус планети
            const moonRadius  = Math.max(planetRadius * md.moonRadiusMult, 0.8);

            // Орбіта супутника як дочірній об'єкт групи планети
            createOrbit(moonOrbitR, group, 0x334455, 0.35);

            const moonTex  = md.texKey ? loadTex(md.texKey) : null;
            const moonMesh = new THREE.Mesh(
                new THREE.SphereGeometry(moonRadius, 24, 24),
                new THREE.MeshStandardMaterial({
                    map: moonTex || null,
                    color: moonTex ? 0xffffff : md.color,
                    roughness: 0.9, metalness: 0.0,
                })
            );

            const moonGroup = new THREE.Group();
            moonGroup.add(moonMesh);
            group.add(moonGroup); // дочірній об'єкт планети → позиція відносна

            const moonObj = {
                group: moonGroup,
                orbitR: moonOrbitR,
                angularSpeedPerMs: (2 * Math.PI) / (md.period * 86400 * 1000),
                angle: Math.random() * 2 * Math.PI,
                name: md.name,
                label: null,
            };
            planetObj.moons.push(moonObj);

            if (md.showLabel) {
                // Лейбл лише для Місяця — з кліком
                moonObj.label = makeLabel(md.name, md.name, null, true);
                moonObj.label.el.classList.add('clickable');
                moonObj.label.el.title = 'Натисніть для фокусу';
                moonObj.label.el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetIdleTimer();
                    focusOnPlanet(moonObj);
                    showInfoPanel(md.name);
                });
            }
        });
    });

    // ─── Анімація ───────────────────────────────────────────────────────────
    const proj   = new THREE.Vector3();
    const wpos   = new THREE.Vector3();
    let lastTime = performance.now();

    function updateLabel(lbl, obj3d) {
        if (!lbl) return;
        obj3d.getWorldPosition(proj);
        proj.project(camera);
        if (proj.z >= 1) { lbl.el.style.display = 'none'; return; }
        const sx = (proj.x * 0.5 + 0.5) * width;
        const sy = (-(proj.y * 0.5) + 0.5) * height;
        lbl.el.style.display = 'block';
        lbl.el.style.left = `${Math.round(sx)}px`;
        lbl.el.style.top  = `${Math.round(sy)}px`;
    }

    function animate() {
        requestAnimationFrame(animate);

        const now  = performance.now();
        const dtMs = Math.min(now - lastTime, 100);
        lastTime   = now;

        controls.update();
        sunMesh.rotation.y += 0.0004 * speedMultiplier * dtMs / 1000;

        // Лейбл Сонця
        updateLabel(sunLabelObj, sunMesh);

        planets.forEach(p => {
            p.angle += p.angularSpeedPerMs * dtMs * speedMultiplier;
            p.group.position.set(
                Math.cos(p.angle) * p.dist, 0,
                Math.sin(p.angle) * p.dist
            );
            p.group.children[0].rotation.y += 0.0005 * speedMultiplier * dtMs / 1000;

            if (isCameraAttached && !isFlying && focusTarget === p) {
                p.group.getWorldPosition(wpos);
                controls.target.lerp(wpos, 0.1);
            }

            updateLabel(p.label, p.group);

            p.moons.forEach(m => {
                m.angle += m.angularSpeedPerMs * dtMs * speedMultiplier;
                m.group.position.set(
                    Math.cos(m.angle) * m.orbitR, 0,
                    Math.sin(m.angle) * m.orbitR
                );

                if (isCameraAttached && !isFlying && focusTarget === m) {
                    m.group.getWorldPosition(wpos);
                    controls.target.lerp(wpos, 0.1);
                }

                if (m.label) updateLabel(m.label, m.group);
            });
        });

        renderer.render(scene, camera);
    }

    // ─── Resize ─────────────────────────────────────────────────────────────
    let rTimer;
    window.addEventListener('resize', () => {
        clearTimeout(rTimer);
        rTimer = setTimeout(() => {
            width  = container.clientWidth;
            height = container.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }, 100);
    });

    animate();
});