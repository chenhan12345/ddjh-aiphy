/* ==========================================================
   大墩元素週期島：3D 群島幾何建造模組 (islands.js)
   依據 references/living-world.md 精緻度底線打造
   ========================================================== */

import * as THREE from 'three';

export class IslandWorld {
  constructor(scene, contentData) {
    this.scene = scene;
    this.data = contentData;
    this.islandsGroup = new THREE.Group();
    this.bridgesGroup = new THREE.Group();
    this.decorationsGroup = new THREE.Group();
    this.landmarksGroup = new THREE.Group();
    this.nightLightsGroup = new THREE.Group();
    this.animatedObjects = [];

    this.scene.add(this.islandsGroup);
    this.scene.add(this.bridgesGroup);
    this.scene.add(this.decorationsGroup);
    this.scene.add(this.landmarksGroup);
    this.scene.add(this.nightLightsGroup);

    this.islandMeshes = {};
    this.islandPositions = {};

    this.nightMaterials = [];
    this.streetLamps = [];

    this.initPalette();
    this.buildArchipelago();
    this.buildOcean();
    this.buildDistantMountains();
  }

  initPalette() {
    this.materials = {
      grass: new THREE.MeshLambertMaterial({ color: 0x5dbb63, flatShading: true }),
      grassDark: new THREE.MeshLambertMaterial({ color: 0x489a4e, flatShading: true }),
      sand: new THREE.MeshLambertMaterial({ color: 0xf5dd90, flatShading: true }),
      rock: new THREE.MeshLambertMaterial({ color: 0x7e8b9b, flatShading: true }),
      wood: new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true }),
      woodDark: new THREE.MeshLambertMaterial({ color: 0x5c3a21, flatShading: true }),
      roofRed: new THREE.MeshLambertMaterial({ color: 0xe05638, flatShading: true }),
      roofBlue: new THREE.MeshLambertMaterial({ color: 0x2c6db5, flatShading: true }),
      roofGold: new THREE.MeshLambertMaterial({ color: 0xf2b33d, flatShading: true }),
      wallWhite: new THREE.MeshLambertMaterial({ color: 0xf4f6f8, flatShading: true }),
      wallBrick: new THREE.MeshLambertMaterial({ color: 0xd97757, flatShading: true }),
      gold: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.2, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3, flatShading: true }),
      crystal: new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, roughness: 0.1, transmission: 0.7, flatShading: true }),
      neonCyan: new THREE.MeshBasicMaterial({ color: 0x00f5ff }),
      neonAmber: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
      windowOff: new THREE.MeshLambertMaterial({ color: 0x334155 }),
      windowOn: new THREE.MeshBasicMaterial({ color: 0xffe680 }),
      foam: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    };
  }

  // 建立低多邊形不規則島嶼主體（沙灘、岩石、草地三層）
  createIslandBase(radius, height, segments, noiseScale, seed = 1) {
    const group = new THREE.Group();

    // 1. 沙灘層 (Beach layer)
    const sandGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.15, height * 0.45, segments, 1);
    this.displaceGeometry(sandGeo, noiseScale * 0.9, seed);
    const sandMesh = new THREE.Mesh(sandGeo, this.materials.sand);
    sandMesh.position.y = -height * 0.3;
    sandMesh.castShadow = true;
    sandMesh.receiveShadow = true;
    group.add(sandMesh);

    // 2. 岩石層 (Rock cliff layer)
    const rockGeo = new THREE.CylinderGeometry(radius * 0.92, radius * 1.04, height * 0.55, segments, 1);
    this.displaceGeometry(rockGeo, noiseScale * 1.1, seed + 10);
    const rockMesh = new THREE.Mesh(rockGeo, this.materials.rock);
    rockMesh.position.y = height * 0.1;
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    group.add(rockMesh);

    // 3. 草地頂層 (Grass top layer)
    const grassGeo = new THREE.CylinderGeometry(radius * 0.88, radius * 0.92, height * 0.35, segments, 1);
    this.displaceGeometry(grassGeo, noiseScale * 0.7, seed + 20);
    const grassMesh = new THREE.Mesh(grassGeo, this.materials.grass);
    grassMesh.position.y = height * 0.45;
    grassMesh.castShadow = true;
    grassMesh.receiveShadow = true;
    group.add(grassMesh);

    // 4. 白色浪花環 (Foam ring)
    const foamGeo = new THREE.RingGeometry(radius * 1.08, radius * 1.25, segments);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMesh = new THREE.Mesh(foamGeo, this.materials.foam);
    foamMesh.position.y = -height * 0.45 + 0.05;
    group.add(foamMesh);

    return { group, topY: height * 0.62, radius };
  }

  // 頂點角度噪聲變形，讓島嶼呈現自然不規則海岸線
  displaceGeometry(geometry, scale, seed) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const angle = Math.atan2(z, x);
      const noise = Math.sin(angle * 4 + seed) * 0.15 + Math.cos(angle * 7 + seed * 2) * 0.1;
      pos.setX(i, x * (1 + noise * scale));
      pos.setZ(i, z * (1 + noise * scale));
    }
    geometry.computeVertexNormals();
  }

  buildArchipelago() {
    // 1. 中央島：AI元素週期島
    const centerPos = new THREE.Vector3(0, 0, 0);
    this.islandPositions['island-center'] = centerPos;
    const centerIsland = this.createIslandBase(14.5, 3.8, 28, 0.22, 42);
    centerIsland.group.position.copy(centerPos);
    this.islandsGroup.add(centerIsland.group);
    this.islandMeshes['island-center'] = centerIsland.group;

    this.buildCenterLandmark(centerPos, centerIsland.topY);
    this.populateIslandFloraAndBuildings(centerIsland.group, centerIsland.radius * 0.85, centerIsland.topY, true);

    // 2. 六座主環形外圍學習島嶼（島嶼 1~6 圍繞中央島配置）
    const radiusDistance = 34;
    const islandsList = this.data.islands;
    const radialIslands = islandsList.filter(i => i.id !== 'island-07');
    const extensionIsland = islandsList.find(i => i.id === 'island-07');
    const totalRadial = 6;

    radialIslands.forEach((island, index) => {
      // 前 6 座島依 60 度均勻環繞配置
      const angle = (index / totalRadial) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radiusDistance;
      const z = Math.sin(angle) * radiusDistance;
      const pos = new THREE.Vector3(x, 0, z);
      this.islandPositions[island.id] = pos;

      const islandBase = this.createIslandBase(9.2, 3.2, 22, 0.26, index * 17 + 5);
      islandBase.group.position.copy(pos);
      this.islandsGroup.add(islandBase.group);
      this.islandMeshes[island.id] = islandBase.group;

      // 建立該島專屬獨特地標
      this.buildUniqueLandmark(island.id, pos, islandBase.topY);

      // 配置樹木、花草、小屋、碼頭
      this.populateIslandFloraAndBuildings(islandBase.group, islandBase.radius * 0.82, islandBase.topY, false);

      // 連接中央島至外圍島的木橋
      this.buildBridge(centerPos, pos, 12.5, 7.8);
    });

    // 3. 第七座島嶼：由第六島（聲波迴響共鳴島）向外海延續接續之研究前哨島（非放射型，單獨連接第六島）
    if (extensionIsland && this.islandPositions['island-06']) {
      const pos6 = this.islandPositions['island-06'];
      // 沿第六島向外延伸之方向 (方位角 -150 度)
      const extDir = new THREE.Vector3(pos6.x, 0, pos6.z).normalize();
      const extDistance = 25.0;
      const pos7 = new THREE.Vector3().copy(pos6).addScaledVector(extDir, extDistance);
      this.islandPositions[extensionIsland.id] = pos7;

      const islandBase7 = this.createIslandBase(9.2, 3.2, 22, 0.26, 7 * 17 + 5);
      islandBase7.group.position.copy(pos7);
      this.islandsGroup.add(islandBase7.group);
      this.islandMeshes[extensionIsland.id] = islandBase7.group;

      // 建立第七島專屬獨特光學地標
      this.buildUniqueLandmark(extensionIsland.id, pos7, islandBase7.topY);

      // 配置島上自然景觀
      this.populateIslandFloraAndBuildings(islandBase7.group, islandBase7.radius * 0.82, islandBase7.topY, false);

      // 核心：由第六島延伸至第七島之外海跨島木橋（起迄端點均為外圍島，offset 設為 7.8）
      this.buildBridge(pos6, pos7, 7.8, 7.8);
    }
  }

  // 中央島專屬地標：發光元素週期巨碑＋Hank 圓頂理化實驗室＋旋轉原子軌道
  buildCenterLandmark(pos, topY) {
    const centerGroup = new THREE.Group();
    centerGroup.position.set(pos.x, topY, pos.z);

    // A. 元素週期發光方碑
    const pillarGeo = new THREE.BoxGeometry(3.6, 6.2, 1.2);
    const pillarMesh = new THREE.Mesh(pillarGeo, this.materials.wallWhite);
    pillarMesh.position.set(-2, 3.1, -1);
    pillarMesh.castShadow = true;
    centerGroup.add(pillarMesh);

    // 元素方格矩陣 (Periodic Grid)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const tileGeo = new THREE.PlaneGeometry(0.85, 0.85);
        const tileMat = new THREE.MeshBasicMaterial({
          color: (r + c) % 2 === 0 ? 0x38bdf8 : 0xf2b33d
        });
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.set(-3.3 + c * 1.1, 1.4 + r * 1.15, -0.38);
        centerGroup.add(tile);
      }
    }

    // B. Hank 圓頂理化實驗室
    const labBaseGeo = new THREE.CylinderGeometry(3.5, 3.8, 3.0, 14);
    const labBase = new THREE.Mesh(labBaseGeo, this.materials.wallWhite);
    labBase.position.set(3.2, 1.5, 0);
    labBase.castShadow = true;
    centerGroup.add(labBase);

    // 圓頂 (Dome)
    const domeGeo = new THREE.SphereGeometry(3.2, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, this.materials.roofBlue);
    domeMesh.position.set(3.2, 3.0, 0);
    domeMesh.castShadow = true;
    centerGroup.add(domeMesh);

    // 實驗室發光窗戶
    const winGeo = new THREE.PlaneGeometry(1.2, 1.4);
    const winMesh = new THREE.Mesh(winGeo, this.materials.windowOff);
    winMesh.position.set(3.2, 1.6, 3.52);
    this.nightMaterials.push(winMesh);
    centerGroup.add(winMesh);

    // C. 旋轉原子核與電子軌道 (Rotating Bohr Atom Model)
    const atomGroup = new THREE.Group();
    atomGroup.position.set(-2, 7.6, -1);

    const nucleusGeo = new THREE.SphereGeometry(0.7, 10, 8);
    const nucleus = new THREE.Mesh(nucleusGeo, this.materials.gold);
    atomGroup.add(nucleus);

    const ringColors = [0x38bdf8, 0xf2b33d, 0x10b981];
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 6, 24);
      const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: ringColors[i] }));
      ringMesh.rotation.x = (i * Math.PI) / 3;
      ringMesh.rotation.y = (i * Math.PI) / 4;
      atomGroup.add(ringMesh);

      // 電子小球
      const electronGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const electron = new THREE.Mesh(electronGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      electron.position.x = 1.6;
      ringMesh.add(electron);
      rings.push(ringMesh);
    }

    centerGroup.add(atomGroup);
    this.animatedObjects.push((delta) => {
      atomGroup.rotation.y += delta * 0.8;
      rings.forEach((r, idx) => {
        r.rotation.z += delta * (1.2 + idx * 0.4);
      });
    });

    // D. 中央市集阿布商人的攤位帳篷
    const tentGroup = new THREE.Group();
    tentGroup.position.set(0, 0, 4.5);

    const tentRoofGeo = new THREE.ConeGeometry(2.4, 1.8, 6);
    const tentRoof = new THREE.Mesh(tentRoofGeo, this.materials.roofGold);
    tentRoof.position.y = 2.2;
    tentRoof.castShadow = true;
    tentGroup.add(tentRoof);

    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 6);
    for (let px = -1.2; px <= 1.2; px += 2.4) {
      for (let pz = -1.2; pz <= 1.2; pz += 2.4) {
        const pole = new THREE.Mesh(poleGeo, this.materials.wood);
        pole.position.set(px, 1.0, pz);
        tentGroup.add(pole);
      }
    }
    // 攤位桌面
    const tableGeo = new THREE.BoxGeometry(2.2, 0.8, 1.2);
    const table = new THREE.Mesh(tableGeo, this.materials.woodDark);
    table.position.set(0, 0.4, 0);
    tentGroup.add(table);

    centerGroup.add(tentGroup);

    // E. 廣場中央路燈
    this.addStreetLamp(centerGroup, new THREE.Vector3(-1.8, 0, 3.2));
    this.addStreetLamp(centerGroup, new THREE.Vector3(1.8, 0, 3.2));

    this.landmarksGroup.add(centerGroup);
  }

  // 外圍五座學習島獨特地標
  buildUniqueLandmark(islandId, pos, topY) {
    const group = new THREE.Group();
    group.position.set(pos.x, topY, pos.z);

    switch (islandId) {
      case 'island-01': {
        // 教職員公務帳號同步島：金鑰鐘樓與同步天線柱
        const towerGeo = new THREE.BoxGeometry(2.6, 7.5, 2.6);
        const tower = new THREE.Mesh(towerGeo, this.materials.wallWhite);
        tower.position.y = 3.75;
        tower.castShadow = true;
        group.add(tower);

        const roofGeo = new THREE.ConeGeometry(2.2, 2.5, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, this.materials.roofRed);
        roof.position.y = 8.5;
        roof.castShadow = true;
        group.add(roof);

        // 金鑰天線 (Pulsing key antenna)
        const keyRingGeo = new THREE.TorusGeometry(0.9, 0.15, 8, 16);
        const keyRing = new THREE.Mesh(keyRingGeo, this.materials.gold);
        keyRing.position.y = 10.2;
        group.add(keyRing);

        this.animatedObjects.push((delta, time) => {
          keyRing.rotation.y += delta * 1.5;
          const s = 1 + Math.sin(time * 3) * 0.08;
          keyRing.scale.set(s, s, s);
        });
        break;
      }

      case 'island-02': {
        // 校園 Wi-Fi 連線島：雙頻高聳雷達天線塔與訊號基站
        const towerGeo = new THREE.CylinderGeometry(0.7, 1.4, 8.5, 8);
        const tower = new THREE.Mesh(towerGeo, this.materials.metal);
        tower.position.y = 4.25;
        tower.castShadow = true;
        group.add(tower);

        // 雷達拋物盤 (Radar dish)
        const dishGeo = new THREE.SphereGeometry(1.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 3);
        const dish = new THREE.Mesh(dishGeo, this.materials.wallWhite);
        dish.rotation.x = -Math.PI / 3;
        dish.position.y = 8.8;
        group.add(dish);

        // 訊號波環 (WiFi wave indicator)
        const waveGeo = new THREE.TorusGeometry(2.4, 0.08, 6, 24, Math.PI);
        waveGeo.rotateX(Math.PI / 2);
        const waveMesh = new THREE.Mesh(waveGeo, this.materials.neonCyan);
        waveMesh.position.y = 9.4;
        group.add(waveMesh);

        this.animatedObjects.push((delta, time) => {
          dish.rotation.y += delta * 1.0;
          waveMesh.scale.setScalar(1 + (Math.sin(time * 4) + 1) * 0.15);
        });
        break;
      }

      case 'island-03': {
        // 學生縣市帳號登入島：五階登入彩虹階梯拱門與南屯大墩 193527 地標碑
        const archGroup = new THREE.Group();
        const stepColors = [0xef4444, 0xf97316, 0xeab308, 0x10b981, 0x3b82f6];
        for (let i = 0; i < 5; i++) {
          const stepGeo = new THREE.BoxGeometry(3.6 - i * 0.4, 0.6, 1.2);
          const stepMat = new THREE.MeshLambertMaterial({ color: stepColors[i], flatShading: true });
          const step = new THREE.Mesh(stepGeo, stepMat);
          step.position.set(0, 0.3 + i * 0.6, -1.8 + i * 0.9);
          step.castShadow = true;
          archGroup.add(step);
        }
        // 拱門柱
        const pillarGeo = new THREE.BoxGeometry(0.7, 5.0, 0.7);
        const pLeft = new THREE.Mesh(pillarGeo, this.materials.wallWhite);
        pLeft.position.set(-1.8, 2.5, 2.2);
        const pRight = new THREE.Mesh(pillarGeo, this.materials.wallWhite);
        pRight.position.set(1.8, 2.5, 2.2);
        const topBarGeo = new THREE.BoxGeometry(4.3, 0.7, 0.8);
        const topBar = new THREE.Mesh(topBarGeo, this.materials.roofBlue);
        topBar.position.set(0, 5.0, 2.2);
        archGroup.add(pLeft, pRight, topBar);

        // 大墩 193527 紀念石碑
        const stoneGeo = new THREE.BoxGeometry(1.6, 2.6, 0.6);
        const stone = new THREE.Mesh(stoneGeo, this.materials.rock);
        stone.position.set(2.4, 1.3, -1.5);
        archGroup.add(stone);

        group.add(archGroup);
        break;
      }

      case 'island-04': {
        // 學生雲端校務帳密中樞島：雲端水晶數據大廈與同步光束
        const bldgGeo = new THREE.BoxGeometry(3.2, 6.0, 3.2);
        const bldg = new THREE.Mesh(bldgGeo, this.materials.wallWhite);
        bldg.position.y = 3.0;
        bldg.castShadow = true;
        group.add(bldg);

        // 浮空旋轉的雲端水晶立方體 (Floating crystal data cube)
        const crystalGeo = new THREE.OctahedronGeometry(1.8, 0);
        const crystalMesh = new THREE.Mesh(crystalGeo, this.materials.crystal);
        crystalMesh.position.y = 8.5;
        group.add(crystalMesh);

        // 光環
        const ringGeo = new THREE.TorusGeometry(2.3, 0.08, 6, 24);
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.materials.neonCyan);
        ringMesh.position.y = 8.5;
        group.add(ringMesh);

        this.animatedObjects.push((delta, time) => {
          crystalMesh.rotation.y += delta * 1.2;
          crystalMesh.rotation.x += delta * 0.6;
          crystalMesh.position.y = 8.5 + Math.sin(time * 2.5) * 0.3;
          ringMesh.rotation.z += delta * 1.8;
        });
        break;
      }

      case 'island-05': {
        // 導師查詢學生帳密島：星盤查詢觀測所（圓頂望遠鏡天文台）
        const obsBaseGeo = new THREE.CylinderGeometry(2.8, 3.2, 4.0, 12);
        const obsBase = new THREE.Mesh(obsBaseGeo, this.materials.wallBrick);
        obsBase.position.y = 2.0;
        obsBase.castShadow = true;
        group.add(obsBase);

        const obsDomeGeo = new THREE.SphereGeometry(2.6, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const obsDome = new THREE.Mesh(obsDomeGeo, this.materials.metal);
        obsDome.position.y = 4.0;
        obsDome.castShadow = true;
        group.add(obsDome);

        // 望遠鏡鏡筒 (Telescope)
        const scopeGeo = new THREE.CylinderGeometry(0.4, 0.5, 3.8, 8);
        const scope = new THREE.Mesh(scopeGeo, this.materials.gold);
        scope.rotation.x = Math.PI / 3;
        scope.position.set(0, 4.8, 1.2);
        group.add(scope);

        this.animatedObjects.push((delta, time) => {
          obsDome.rotation.y = Math.sin(time * 0.5) * 0.4;
          scope.rotation.x = Math.PI / 3 + Math.sin(time * 0.8) * 0.15;
        });
        break;
      }

      case 'island-06': {
        // 聲波迴響共鳴島：巨大黃金共鳴音叉 + 動態同心擴散聲波環 + 聲學頻率水晶
        const acousticGroup = new THREE.Group();

        // A. 聲納共鳴石階基座 (Resonance Base)
        const baseGeo = new THREE.CylinderGeometry(3.0, 3.4, 1.4, 16);
        const baseMesh = new THREE.Mesh(baseGeo, this.materials.wallWhite);
        baseMesh.position.y = 0.7;
        baseMesh.castShadow = true;
        acousticGroup.add(baseMesh);

        // 刻度金屬環 (Acoustic Dial Ring)
        const dialGeo = new THREE.TorusGeometry(2.5, 0.1, 8, 32);
        dialGeo.rotateX(Math.PI / 2);
        const dialMesh = new THREE.Mesh(dialGeo, this.materials.gold);
        dialMesh.position.y = 1.45;
        acousticGroup.add(dialMesh);

        // B. 巨型黃金共鳴音叉 (Giant Golden Tuning Fork)
        const forkGroup = new THREE.Group();
        forkGroup.position.y = 1.4;

        // 1. 音叉底柄 (Stem)
        const stemGeo = new THREE.CylinderGeometry(0.35, 0.4, 2.0, 12);
        const stemMesh = new THREE.Mesh(stemGeo, this.materials.gold);
        stemMesh.position.y = 1.0;
        stemMesh.castShadow = true;
        forkGroup.add(stemMesh);

        // 2. 音叉橫樑 (Crossbar)
        const crossGeo = new THREE.BoxGeometry(2.5, 0.5, 0.6);
        const crossMesh = new THREE.Mesh(crossGeo, this.materials.gold);
        crossMesh.position.y = 2.0;
        crossMesh.castShadow = true;
        forkGroup.add(crossMesh);

        // 3. 雙平行叉齒 (Twin Parallel Prongs)
        const prongGeo = new THREE.BoxGeometry(0.38, 4.4, 0.45);
        const leftProng = new THREE.Mesh(prongGeo, this.materials.gold);
        leftProng.position.set(-0.95, 4.2, 0);
        leftProng.castShadow = true;
        forkGroup.add(leftProng);

        const rightProng = new THREE.Mesh(prongGeo, this.materials.gold);
        rightProng.position.set(0.95, 4.2, 0);
        rightProng.castShadow = true;
        forkGroup.add(rightProng);

        acousticGroup.add(forkGroup);

        // C. 動態同心擴散聲波環 (Concentric Acoustic Sound Wave Rings)
        const waveCount = 3;
        const waveRings = [];
        for (let i = 0; i < waveCount; i++) {
          const waveGeo = new THREE.TorusGeometry(1.6, 0.08, 8, 32);
          waveGeo.rotateX(Math.PI / 2);
          const waveMat = new THREE.MeshBasicMaterial({
            color: i === 0 ? 0x38bdf8 : (i === 1 ? 0x06b6d4 : 0xf59e0b),
            transparent: true,
            opacity: 0.8
          });
          const waveMesh = new THREE.Mesh(waveGeo, waveMat);
          waveMesh.position.y = 5.4;
          acousticGroup.add(waveMesh);
          waveRings.push({
            mesh: waveMesh,
            phase: (i / waveCount) * Math.PI * 2
          });
        }

        // D. 懸浮共鳴頻率水晶 (Floating Resonance Frequency Crystal)
        const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.7,
          metalness: 0.85,
          roughness: 0.15
        });
        const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
        crystalMesh.position.set(0, 5.4, 0);
        acousticGroup.add(crystalMesh);

        // 動畫：聲波向外擴散縮放、水晶共鳴微震與音叉緩慢微轉
        this.animatedObjects.push((delta, time) => {
          forkGroup.rotation.y = Math.sin(time * 0.8) * 0.15;
          crystalMesh.rotation.y += delta * 1.5;
          crystalMesh.rotation.z += delta * 0.8;
          crystalMesh.position.y = 5.4 + Math.sin(time * 4.0) * 0.15;

          waveRings.forEach((w, idx) => {
            const progress = (time * 1.2 + idx * 0.8) % 2.5;
            const scale = 1.0 + progress * 1.8;
            w.mesh.scale.set(scale, scale, scale);
            w.mesh.material.opacity = Math.max(0, 0.85 * (1.0 - progress / 2.5));
          });
        });

        group.add(acousticGroup);
        break;
      }

      case 'island-07': {
        // 光影幻境探索島：七彩三角分光稜鏡、光譜光環與羅馬大理石座
        const prismGroup = new THREE.Group();

        // A. 羅馬圓形大理石基座
        const pedestalGeo = new THREE.CylinderGeometry(2.8, 3.2, 1.6, 12);
        const pedestal = new THREE.Mesh(pedestalGeo, this.materials.wallWhite);
        pedestal.position.y = 0.8;
        pedestal.castShadow = true;
        prismGroup.add(pedestal);

        // 基座雕花金環
        const dialGeo = new THREE.TorusGeometry(2.2, 0.1, 8, 24);
        dialGeo.rotateX(Math.PI / 2);
        const dialMesh = new THREE.Mesh(dialGeo, this.materials.gold);
        dialMesh.position.y = 1.65;
        prismGroup.add(dialMesh);

        // B. 三角分光稜鏡 (Triangular Prism)
        const prismGeo = new THREE.CylinderGeometry(1.6, 1.6, 3.8, 3);
        const prismMat = new THREE.MeshPhysicalMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.85,
          roughness: 0.05,
          transmission: 0.9,
          reflectivity: 0.9,
          flatShading: true
        });
        const prismMesh = new THREE.Mesh(prismGeo, prismMat);
        prismMesh.position.y = 3.8;
        prismMesh.castShadow = true;
        prismGroup.add(prismMesh);

        // C. 環繞三角稜鏡的七彩光譜光環 (Rainbow Spectral Rings)
        const rainbowColors = [0xef4444, 0xf97316, 0xeab308, 0x10b981, 0x06b6d4, 0x3b82f6, 0x8b5cf6];
        const spectralRings = [];
        rainbowColors.forEach((col, i) => {
          const ringGeo = new THREE.TorusGeometry(2.5 + i * 0.28, 0.06, 6, 24);
          ringGeo.rotateX(Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.y = 3.2 + Math.sin(i * 0.8) * 0.4;
          prismGroup.add(ring);
          spectralRings.push({ mesh: ring, speed: (i % 2 === 0 ? 1 : -1) * (0.8 + i * 0.2) });
        });

        // D. 浮動光學焦點晶體 (Floating Focal Crystal)
        const focalGeo = new THREE.OctahedronGeometry(1.0, 0);
        const focalMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.6,
          metalness: 0.8,
          roughness: 0.1
        });
        const focalMesh = new THREE.Mesh(focalGeo, focalMat);
        focalMesh.position.y = 6.6;
        prismGroup.add(focalMesh);

        // 動畫：三稜鏡旋轉、七彩環反向公轉、上下懸浮浮動特效
        this.animatedObjects.push((delta, time) => {
          prismMesh.rotation.y += delta * 0.8;
          focalMesh.rotation.y -= delta * 1.2;
          focalMesh.rotation.z += delta * 0.6;
          focalMesh.position.y = 6.6 + Math.sin(time * 3) * 0.25;
          spectralRings.forEach(sr => {
            sr.mesh.rotation.z += delta * sr.speed;
          });
        });

        group.add(prismGroup);
        break;
      }
    }

    this.landmarksGroup.add(group);
  }

  // 打造連島木橋
  buildBridge(startPos, endPos, startOffset, endOffset) {
    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const fullDist = dir.length();
    dir.normalize();

    const p1 = new THREE.Vector3().copy(startPos).addScaledVector(dir, startOffset);
    const p2 = new THREE.Vector3().copy(endPos).addScaledVector(dir, -endOffset);
    p1.y = 0.6;
    p2.y = 0.5;

    const bridgeLength = p1.distanceTo(p2);
    const bridgeCenter = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    bridgeCenter.y += 0.4; // 拱橋微弧度

    const bridgeGeo = new THREE.BoxGeometry(1.6, 0.25, bridgeLength);
    const bridge = new THREE.Mesh(bridgeGeo, this.materials.wood);
    bridge.position.copy(bridgeCenter);
    bridge.lookAt(p2);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    this.bridgesGroup.add(bridge);

    // 兩側木圍欄
    const railGeo = new THREE.BoxGeometry(0.12, 0.4, bridgeLength);
    const railLeft = new THREE.Mesh(railGeo, this.materials.woodDark);
    railLeft.position.set(-0.75, 0.3, 0);
    const railRight = new THREE.Mesh(railGeo, this.materials.woodDark);
    railRight.position.set(0.75, 0.3, 0);
    bridge.add(railLeft, railRight);
  }

  // 配置島上的植被、小木屋與生活細節（樹木>=3株、2種樹形、花草、碼頭）
  populateIslandFloraAndBuildings(parentGroup, radius, topY, isCenter) {
    const itemCount = isCenter ? 7 : 4;

    // 1. 小木屋 (House with night glowing window)
    const houseCount = isCenter ? 2 : 1;
    for (let h = 0; h < houseCount; h++) {
      const angle = (h * Math.PI) + (isCenter ? 1.2 : 2.5);
      const dist = radius * (0.45 + h * 0.2);
      const hx = Math.cos(angle) * dist;
      const hz = Math.sin(angle) * dist;

      const house = new THREE.Group();
      house.position.set(hx, topY, hz);

      const bodyGeo = new THREE.BoxGeometry(2.0, 1.6, 1.8);
      const body = new THREE.Mesh(bodyGeo, this.materials.wallWhite);
      body.position.y = 0.8;
      body.castShadow = true;
      house.add(body);

      const roofGeo = new THREE.ConeGeometry(1.7, 1.2, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, isCenter ? this.materials.roofRed : this.materials.roofBlue);
      roof.position.y = 2.1;
      roof.castShadow = true;
      house.add(roof);

      // 夜間發光窗戶
      const winGeo = new THREE.PlaneGeometry(0.6, 0.6);
      const win = new THREE.Mesh(winGeo, this.materials.windowOff);
      win.position.set(0, 0.85, 0.92);
      this.nightMaterials.push(win);
      house.add(win);

      house.lookAt(0, topY, 0);
      parentGroup.add(house);
    }

    // 2. 樹木群 (Tree type 1: 松樹錐形; Tree type 2: 圓形落葉樹)
    for (let t = 0; t < itemCount; t++) {
      const angle = (t / itemCount) * Math.PI * 2 + 0.3;
      const dist = radius * (0.6 + (t % 2) * 0.25);
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      const tree = new THREE.Group();
      tree.position.set(tx, topY, tz);

      // 樹幹
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 6);
      const trunk = new THREE.Mesh(trunkGeo, this.materials.woodDark);
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      tree.add(trunk);

      if (t % 2 === 0) {
        // 錐形松樹
        const foliageGeo = new THREE.ConeGeometry(1.1, 2.2, 7);
        const foliage = new THREE.Mesh(foliageGeo, this.materials.grassDark);
        foliage.position.y = 1.9;
        foliage.castShadow = true;
        tree.add(foliage);
      } else {
        // 圓球形果樹
        const foliageGeo = new THREE.DodecahedronGeometry(1.0, 1);
        const foliage = new THREE.Mesh(foliageGeo, this.materials.grass);
        foliage.position.y = 1.8;
        foliage.castShadow = true;
        tree.add(foliage);
      }
      parentGroup.add(tree);
    }

    // 3. 碼頭木棧道與小舢舨 (Wooden dock & dinghy)
    const dockAngle = isCenter ? -Math.PI / 4 : 0.8;
    const dockX = Math.cos(dockAngle) * (radius * 1.15);
    const dockZ = Math.sin(dockAngle) * (radius * 1.15);

    const dock = new THREE.Group();
    dock.position.set(dockX, 0.2, dockZ);
    dock.lookAt(dockX * 2, 0.2, dockZ * 2);

    const deckGeo = new THREE.BoxGeometry(1.6, 0.2, 3.2);
    const deck = new THREE.Mesh(deckGeo, this.materials.wood);
    deck.position.z = 1.6;
    deck.castShadow = true;
    dock.add(deck);

    // 停泊小船
    const boatGeo = new THREE.BoxGeometry(1.0, 0.4, 2.2);
    const boat = new THREE.Mesh(boatGeo, this.materials.roofRed);
    boat.position.set(1.4, 0.1, 2.4);
    dock.add(boat);

    parentGroup.add(dock);

    // 4. 島邊路燈
    this.addStreetLamp(parentGroup, new THREE.Vector3(dockX * 0.7, topY, dockZ * 0.7));
  }

  // 建立路燈（夜間自動發光）
  addStreetLamp(parent, pos) {
    const lampGroup = new THREE.Group();
    lampGroup.position.copy(pos);

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6);
    const pole = new THREE.Mesh(poleGeo, this.materials.metal);
    pole.position.y = 1.1;
    lampGroup.add(pole);

    const bulbGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const bulb = new THREE.Mesh(bulbGeo, this.materials.windowOff);
    bulb.position.y = 2.2;
    lampGroup.add(bulb);

    this.streetLamps.push(bulb);
    parent.add(lampGroup);
  }

  // 建立動態起伏的低多邊形海洋
  buildOcean() {
    const seaGeo = new THREE.PlaneGeometry(360, 360, 48, 48);
    seaGeo.rotateX(-Math.PI / 2);

    const seaMat = new THREE.MeshLambertMaterial({
      color: 0x64b5f6,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });

    this.oceanMesh = new THREE.Mesh(seaGeo, seaMat);
    this.oceanMesh.position.y = -0.3;
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);

    // 儲存原始頂點位置供每幀波動計算
    const pos = seaGeo.attributes.position;
    this.oceanOriginalY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this.oceanOriginalY[i] = pos.getY(i);
    }

    this.animatedObjects.push((delta, time) => {
      const p = seaGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i);
        const v = p.getZ(i);
        const wave = Math.sin(u * 0.08 + time * 1.8) * 0.22 + Math.cos(v * 0.08 + time * 1.5) * 0.18;
        p.setY(i, this.oceanOriginalY[i] + wave);
      }
      p.needsUpdate = true;
    });
  }

  // 外海環繞低多邊形遠山剪影（構建有邊界的精緻視界）
  buildDistantMountains() {
    const mountainsGroup = new THREE.Group();
    const mountainCount = 14;
    const ringRadius = 150;

    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2;
      const x = Math.cos(angle) * (ringRadius + (Math.sin(i) * 15));
      const z = Math.sin(angle) * (ringRadius + (Math.cos(i) * 15));

      const height = 22 + (i % 3) * 12;
      const radius = 18 + (i % 2) * 8;
      const coneGeo = new THREE.ConeGeometry(radius, height, 6);
      const coneMat = new THREE.MeshLambertMaterial({
        color: 0x475569,
        flatShading: true
      });
      const mountain = new THREE.Mesh(coneGeo, coneMat);
      mountain.position.set(x, height * 0.45, z);
      mountainsGroup.add(mountain);
    }
    this.scene.add(mountainsGroup);
  }

  // 夜晚燈光開關（窗戶、路燈發光材質切換）
  setNightMode(isNight) {
    const targetMat = isNight ? this.materials.windowOn : this.materials.windowOff;
    this.nightMaterials.forEach((m) => {
      m.material = targetMat;
    });
    this.streetLamps.forEach((l) => {
      l.material = isNight ? this.materials.neonAmber : this.materials.windowOff;
    });
  }

  // 每幀更新動畫
  update(delta, time) {
    this.animatedObjects.forEach((fn) => fn(delta, time));
  }
}
