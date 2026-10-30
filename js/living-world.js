/* ==========================================================
   大墩元素週期島：生活感世界與居民生態系統 (living-world.js)
   依據 references/living-world.md 打造生動生活感世界
   ========================================================== */

import * as THREE from 'three';

export class LivingWorld {
  constructor(scene, camera, islandWorld, contentData, onNPCClick, onToast) {
    this.scene = scene;
    this.camera = camera;
    this.islandWorld = islandWorld;
    this.data = contentData;
    this.onNPCClick = onNPCClick;
    this.onToast = onToast;

    this.npcGroup = new THREE.Group();
    this.skyGroup = new THREE.Group();
    this.seaLifeGroup = new THREE.Group();
    this.shellsGroup = new THREE.Group();
    this.firefliesGroup = new THREE.Group();
    this.inspectorVisualsGroup = new THREE.Group();
    this.inspectorVisualsGroup.visible = false;

    this.scene.add(this.npcGroup);
    this.scene.add(this.inspectorVisualsGroup);
    this.isInspectorMode = false;
    this.scene.add(this.skyGroup);
    this.scene.add(this.seaLifeGroup);
    this.scene.add(this.shellsGroup);
    this.scene.add(this.firefliesGroup);

    this.residents = [];
    this.touringHank = null;
    this.couriers = [];
    this.shells = [];
    this.clouds = [];
    this.birdFlocks = [];
    this.sailboats = [];

    this.activeNPC = null;
    this.isNight = false;
    this.reducedMotion = false;

    this.initInventory();
    this.buildNPCs();
    this.buildCouriers();
    this.buildClouds();
    this.buildBirds();
    this.buildSailboats();
    this.buildBeachShells();
    this.buildFireflies();
  }

  // 初始化訪客背包
  initInventory() {
    const saved = localStorage.getItem('ddjh_backpack');
    if (saved) {
      try {
        this.backpack = JSON.parse(saved);
      } catch (e) {
        this.backpack = { 'item-shell': 3 };
      }
    } else {
      this.backpack = { 'item-shell': 3 }; // 起始 3 顆貝殼
      this.saveBackpack();
    }
  }

  saveBackpack() {
    localStorage.setItem('ddjh_backpack', JSON.stringify(this.backpack));
  }

  getBackpack() {
    return this.backpack;
  }

  addItem(itemId, count = 1) {
    this.backpack[itemId] = (this.backpack[itemId] || 0) + count;
    this.saveBackpack();
  }

  removeItem(itemId, count = 1) {
    if ((this.backpack[itemId] || 0) >= count) {
      this.backpack[itemId] -= count;
      if (this.backpack[itemId] === 0) delete this.backpack[itemId];
      this.saveBackpack();
      return true;
    }
    return false;
  }

  // 打造原創 Q 版低多邊形小人角色
  createCharacterMesh(clothingColor = 0x3b82f6, hatColor = 0x1e293b, hasCrate = false) {
    const char = new THREE.Group();

    // 身體
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.35, 0.8, 6);
    const bodyMat = new THREE.MeshLambertMaterial({ color: clothingColor, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    char.add(body);

    // 頭部
    const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdfba, flatShading: true });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.45;
    head.castShadow = true;
    char.add(head);

    // 帽子或頭髮
    const hatGeo = new THREE.ConeGeometry(0.36, 0.3, 6);
    const hatMat = new THREE.MeshLambertMaterial({ color: hatColor, flatShading: true });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.7;
    char.add(hat);

    // 左手、右手
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 5);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.38, 0.85, 0);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.38, 0.85, 0);
    char.add(leftArm, rightArm);

    // 左腳、右腳
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.55, 5);
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.16, 0.28, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.16, 0.28, 0);
    char.add(leftLeg, rightLeg);

    // 貨箱 (送貨員專用)
    let crate = null;
    if (hasCrate) {
      const crateGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
      const crateMat = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: true });
      crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(0, 1.0, 0.4);
      char.add(crate);
    }

    // 擴大點擊碰撞判定球 (Mobile-friendly hitbox: 半徑加大至 2.4，transparent: true 確保 Three.js Raycaster 100% 偵測)
    const hitSphereGeo = new THREE.SphereGeometry(2.4, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const hitMesh = new THREE.Mesh(hitSphereGeo, hitMat);
    hitMesh.position.y = 1.0;
    char.add(hitMesh);

    return {
      group: char,
      body,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      crate,
      hitMesh
    };
  }

  // 核心安全散步路徑演算法 (保證不被地標或木屋遮擋，且完全面向相機視野)
  generateSafeResidentWaypoints(islandId, islandPos, npcIndex) {
    if (islandId === 'island-center') {
      // 中央島商人阿布：圍繞特色攤位巡視，靠近正面開闊廣場 (x: 0, z: 4.5)
      return [
        new THREE.Vector3(islandPos.x + 1.8, 2.5, islandPos.z + 4.8),
        new THREE.Vector3(islandPos.x + 0.0, 2.5, islandPos.z + 6.2),
        new THREE.Vector3(islandPos.x - 1.8, 2.5, islandPos.z + 4.8),
        new THREE.Vector3(islandPos.x + 0.0, 2.5, islandPos.z + 3.8)
      ];
    }

    // 外圍島嶼（包含島 1~7 及未來所有新島嶼）：
    // 地標基座最大 3.4m，外圍懸崖約 7.5m~9.2m
    // 安全半徑設定為 4.8m ~ 5.5m，完全避開中央地標 (淨距 >= 1.4m)，且遠離後方木屋
    // 兩位居民分別在東南區與西南區巡視，迎向主相機視野
    const isFirst = npcIndex % 2 === 0;
    const baseR = isFirst ? 5.1 : 4.8;

    // NPC 0 (老師/領航): 巡邏東南正面弧線
    // NPC 1 (同學/夥伴): 巡邏西南正面弧線
    const angles = isFirst
      ? [-0.25 * Math.PI, -0.05 * Math.PI, 0.15 * Math.PI, 0.35 * Math.PI]
      : [-0.45 * Math.PI, -0.65 * Math.PI, -0.85 * Math.PI, -0.60 * Math.PI];

    const radii = isFirst
      ? [baseR, baseR + 0.4, baseR + 0.2, baseR - 0.3]
      : [baseR, baseR + 0.3, baseR - 0.2, baseR + 0.4];

    const waypoints = [];
    for (let i = 0; i < 4; i++) {
      const ang = angles[i];
      const r = radii[i];
      waypoints.push(new THREE.Vector3(
        islandPos.x + Math.cos(ang) * r,
        2.5,
        islandPos.z + Math.sin(ang) * r
      ));
    }
    return waypoints;
  }

  // 建造群島常駐居民與商人
  buildNPCs() {
    const npcsData = this.data.residents;
    const islandNPCIndexMap = {};

    npcsData.forEach((npc) => {
      const isHank = npc.id === 'npc-center-01';
      if (isHank) {
        this.touringHank = this.buildTouringHank(npc);
        return;
      }

      const isMerchant = npc.id === 'npc-center-02';
      const islandPos = this.islandWorld.islandPositions[npc.islandId] || new THREE.Vector3(0, 0, 0);

      const char = this.createCharacterMesh(
        npc.color ? parseInt(npc.color.replace('#', '0x')) : 0x2563eb,
        isMerchant ? 0xf59e0b : 0x475569
      );

      // 產生該島的安全散步路徑點 (Waypoints)
      islandNPCIndexMap[npc.islandId] = (islandNPCIndexMap[npc.islandId] || 0);
      const npcIndexOnIsland = islandNPCIndexMap[npc.islandId]++;

      const waypoints = this.generateSafeResidentWaypoints(npc.islandId, islandPos, npcIndexOnIsland);
      char.group.position.copy(waypoints[0]);

      // 核心升級：賦予角色全身上下所有 Mesh 與判定球 NPC 互動資料，點擊 100% 觸發
      const npcUserData = { type: 'npc', data: npc, ref: char };
      char.hitMesh.userData = npcUserData;
      char.group.traverse((obj) => {
        if (obj.isMesh) {
          obj.userData = npcUserData;
        }
      });
      this.npcGroup.add(char.group);

      this.residents.push({
        data: npc,
        char,
        waypoints,
        currentWP: 0,
        state: 'walk', // walk, wait, wave
        stateTimer: 0,
        speed: 1.1 + Math.random() * 0.3,
        animTimer: Math.random() * 10
      });
    });
  }

  // 打造實體巡島導師 Hank 老師 (2.5D 手繪冒險家立繪實體化，於各島木橋巡迴巡島)
  buildTouringHank(hankData) {
    const group = new THREE.Group();

    // 載入使用者手繪 Hank 老師插畫材質
    const textureLoader = new THREE.TextureLoader();
    const hankTexture = textureLoader.load('hank_mascot.png');
    hankTexture.colorSpace = THREE.SRGBColorSpace;

    // 2.5D 精緻立繪裁切面板 (高解析度手繪等比立體化，雙面顯現)
    const billboardNode = new THREE.Group();
    group.add(billboardNode);

    const planeGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const planeMat = new THREE.MeshBasicMaterial({
      map: hankTexture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.y = 1.84;
    planeMesh.scale.set(3.3, 3.67, 1.0);
    billboardNode.add(planeMesh);

    // 腳底動態柔和接觸陰影
    const shadowGeo = new THREE.RingGeometry(0.01, 1.05, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.05;
    group.add(shadowMesh);

    // 頭頂浮動榮譽徽章 (Canvas Sprite): ★ 巡島導師 Hank 老師
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(8, 8, 304, 56, 28);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
    } else {
      ctx.fillRect(8, 8, 304, 56);
    }
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 24px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ 巡島導師 Hank 老師', 160, 36);

    const tagTexture = new THREE.CanvasTexture(canvas);
    tagTexture.needsUpdate = true;
    const tagMat = new THREE.SpriteMaterial({ map: tagTexture, transparent: true });
    const tagSprite = new THREE.Sprite(tagMat);
    tagSprite.position.y = 4.2;
    tagSprite.scale.set(3.6, 0.82, 1.0);
    billboardNode.add(tagSprite);

    // 導師金星 (Golden Touring Star)
    const starGeo = new THREE.OctahedronGeometry(0.38, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.y = 4.9;
    billboardNode.add(starMesh);

    // 點擊碰撞盒 (加大 Hitbox 至 3.2m，使用 transparent: true 確保 Raycaster 100% 偵測)
    const hitGeo = new THREE.SphereGeometry(3.2, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.y = 1.84;
    const charRef = {
      group,
      hitMesh,
      billboardNode,
      planeMesh,
      shadowMesh,
      tagSprite,
      starMesh,
      isTouringHank: true
    };
    const hankUserData = {
      type: 'npc',
      data: hankData,
      ref: charRef
    };
    hitMesh.userData = hankUserData;
    planeMesh.userData = hankUserData;
    tagSprite.userData = hankUserData;
    starMesh.userData = hankUserData;
    group.add(hitMesh);

    this.npcGroup.add(group);

    const centerPos = new THREE.Vector3(0, 2.5, 1.5);
    group.position.copy(centerPos);

    // 規劃跨島巡島航線清單 (環島 6 座外圍島嶼巡視)
    const islandKeys = this.data.islands.map(i => i.id);

    return {
      data: hankData,
      group,
      billboardNode,
      planeMesh,
      shadowMesh,
      tagSprite,
      starMesh,
      hitMesh,
      charRef,
      centerPos,
      islandKeys,
      targetIndex: 0,
      phase: 'center_rest', // 'center_rest' -> 'walk_to_island' -> 'island_inspect' -> 'walk_to_center'
      timer: 2.0,
      currentPos: centerPos.clone(),
      walkTime: 0,
      speed: 3.5, // 移動速度 (單位/秒)
      waypoints: [],
      currentWPIndex: 0
    };
  }

  // 產生自中央島沿木橋走向目標島的平滑巡邏路徑點 (Waypoints)
  generateHankExcursionWaypoints(targetIslandId) {
    const targetPos = this.islandWorld.islandPositions[targetIslandId];
    if (!targetPos) return [];

    // 若目標為第七島 (光影幻境探索島)：先從中央島過橋至第六島 (聲波迴響共鳴島)，再沿延伸木橋抵達第七島
    if (targetIslandId === 'island-07' && this.islandWorld.islandPositions['island-06']) {
      const pos6 = this.islandWorld.islandPositions['island-06'];
      const dir6 = new THREE.Vector3(pos6.x, 0, pos6.z).normalize();
      const dir6to7 = new THREE.Vector3().subVectors(targetPos, pos6).normalize();

      return [
        new THREE.Vector3(0, 2.5, 1.5),
        new THREE.Vector3(dir6.x * 6.0, 2.0, dir6.z * 6.0),
        new THREE.Vector3(dir6.x * 12.5, 0.95, dir6.z * 12.5), // 中央島木橋起點
        new THREE.Vector3(dir6.x * 20.0, 1.05, dir6.z * 20.0), // 木橋中央
        new THREE.Vector3(pos6.x - dir6.x * 7.8, 0.95, pos6.z - dir6.z * 7.8), // 第六島碼頭
        new THREE.Vector3(pos6.x, 2.2, pos6.z), // 巡視第六島中心
        new THREE.Vector3(pos6.x + dir6to7.x * 7.8, 0.95, pos6.z + dir6to7.z * 7.8), // 延伸木橋起點碼頭
        new THREE.Vector3((pos6.x + targetPos.x) * 0.5, 1.05, (pos6.z + targetPos.z) * 0.5), // 延伸木橋中央
        new THREE.Vector3(targetPos.x - dir6to7.x * 7.8, 0.95, targetPos.z - dir6to7.z * 7.8), // 第七島碼頭
        new THREE.Vector3(targetPos.x - dir6to7.x * 3.5, 2.2, targetPos.z - dir6to7.z * 3.5), // 第七島緩坡
        new THREE.Vector3(targetPos.x - dir6to7.z * 2.8, 2.2, targetPos.z + dir6to7.x * 2.8)  // 第七島地標旁巡視點
      ];
    }

    const dir = new THREE.Vector3().subVectors(targetPos, new THREE.Vector3(0, 0, 0)).normalize();

    return [
      new THREE.Vector3(0, 2.5, 1.5),
      new THREE.Vector3(dir.x * 6.0, 2.0, dir.z * 6.0),
      new THREE.Vector3(dir.x * 12.5, 0.95, dir.z * 12.5), // 木橋起點
      new THREE.Vector3(dir.x * 20.0, 1.05, dir.z * 20.0), // 木橋中央 (微拱起)
      new THREE.Vector3(targetPos.x - dir.x * 7.8, 0.95, targetPos.z - dir.z * 7.8), // 木橋終點碼頭
      new THREE.Vector3(targetPos.x - dir.x * 4.0, 2.2, targetPos.z - dir.z * 4.0), // 外圍島斜坡
      new THREE.Vector3(targetPos.x - dir.z * 2.8, 2.2, targetPos.z + dir.x * 2.8)  // 外圍島地標旁巡視點
    ];
  }

  // 建造 3 位跨島往返的送貨員
  buildCouriers() {
    const targetIslands = ['island-01', 'island-03', 'island-05'];
    targetIslands.forEach((islandId, idx) => {
      const char = this.createCharacterMesh(0x0284c7, 0x0369a1, true);
      const centerPos = new THREE.Vector3(0, 2.5, 0);
      const targetPos = this.islandWorld.islandPositions[islandId];

      char.group.position.copy(centerPos);
      char.hitMesh.userData = {
        type: 'npc',
        data: {
          id: `courier-${idx}`,
          name: `送貨員小飛 ${idx + 1} 號`,
          role: '群島物資快遞員',
          islandName: '跨島物流航道',
          quotes: [
            '呼～正在運送大墩國中的數位行政光碟到各島！',
            '過橋時看著海面的波浪，心情特別好～',
            '等等交完貨物，我還要趕回中央市集向阿布商人報到呢！'
          ],
          trade: {
            needs: 'item-shell',
            needsCount: 2,
            gives: 'item-keycard',
            givesCount: 1,
            hint: '用 2 個貝殼可以跟我換備用金鑰喔！'
          }
        },
        ref: char
      };

      char.group.traverse((obj) => {
        if (obj.isMesh) obj.userData = char.hitMesh.userData;
      });

      this.npcGroup.add(char.group);

      this.couriers.push({
        char,
        startPos: centerPos.clone(),
        endPos: targetPos.clone().setY(2.5),
        progress: idx * 0.33,
        forward: true,
        waitTimer: 0,
        speed: 0.12
      });
    });
  }

  // 建造 8~12 朵圍繞外圈緩緩飄移的低多邊形浮雲
  buildClouds() {
    const cloudCount = 10;
    const cloudRadius = 75;

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffCount = 4 + Math.floor(Math.random() * 3);

      for (let p = 0; p < puffCount; p++) {
        const puffGeo = new THREE.DodecahedronGeometry(2.0 + Math.random() * 1.5, 1);
        const puffMat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          flatShading: true,
          transparent: true,
          opacity: 0.92
        });
        const puff = new THREE.Mesh(puffGeo, puffMat);
        puff.position.set(
          (p - puffCount / 2) * 2.2,
          Math.sin(p) * 0.8,
          Math.cos(p) * 1.0
        );
        cloud.add(puff);
      }

      const angle = (i / cloudCount) * Math.PI * 2;
      const height = 18 + (i % 3) * 5;
      cloud.position.set(Math.cos(angle) * cloudRadius, height, Math.sin(angle) * cloudRadius);

      this.skyGroup.add(cloud);
      this.clouds.push({
        group: cloud,
        angle,
        radius: cloudRadius + (i % 2) * 12,
        height,
        speed: 0.03 + (i % 3) * 0.015
      });
    }
  }

  // 建造 2 群在天空以 V 字隊形盤旋的海鷗
  buildBirds() {
    for (let f = 0; f < 2; f++) {
      const flock = new THREE.Group();
      const birdMeshes = [];
      const birdCount = 6;

      for (let b = 0; b < birdCount; b++) {
        const bird = new THREE.Group();

        // 簡約海鷗：身體與兩片拍動的翅膀
        const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

        const leftWingGeo = new THREE.PlaneGeometry(0.8, 0.3);
        const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
        leftWing.position.x = -0.4;
        bird.add(leftWing);

        const rightWingGeo = new THREE.PlaneGeometry(0.8, 0.3);
        const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
        rightWing.position.x = 0.4;
        bird.add(rightWing);

        // V 字形排隊
        const col = Math.floor(b / 2);
        const side = b % 2 === 0 ? 1 : -1;
        bird.position.set(side * col * 1.4, 0, -col * 1.6);

        flock.add(bird);
        birdMeshes.push({ bird, leftWing, rightWing });
      }

      flock.position.y = 26 + f * 6;
      this.skyGroup.add(flock);

      this.birdFlocks.push({
        group: flock,
        birds: birdMeshes,
        angle: f * Math.PI,
        radius: 48 + f * 15,
        speed: 0.25 + f * 0.08
      });
    }
  }

  // 建造 2 艘繞外海隨波逐浪航行的雙桅帆船
  buildSailboats() {
    for (let s = 0; s < 2; s++) {
      const boat = new THREE.Group();

      // 船體
      const hullGeo = new THREE.BoxGeometry(2.4, 1.0, 5.5);
      const hullMat = new THREE.MeshLambertMaterial({ color: 0x78350f, flatShading: true });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      hull.position.y = 0.4;
      boat.add(hull);

      // 主桅杆與白色風帆
      const mastGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 5);
      const mastMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 2.4;
      boat.add(mast);

      const sailGeo = new THREE.ConeGeometry(1.6, 3.2, 3);
      const sailMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.rotation.y = Math.PI / 2;
      sail.position.set(0, 2.5, 0.2);
      boat.add(sail);

      this.seaLifeGroup.add(boat);

      this.sailboats.push({
        group: boat,
        angle: s * Math.PI + 0.5,
        radius: 65 + s * 14,
        speed: 0.08 + s * 0.03
      });
    }
  }

  // 建造每座島海灘上的可拾取貝殼 (Clickable Beach Shells)
  buildBeachShells() {
    const islandKeys = ['island-center', ...this.data.islands.map(i => i.id)];

    islandKeys.forEach((key, idx) => {
      const pos = this.islandWorld.islandPositions[key];
      const shellGeo = new THREE.SphereGeometry(0.35, 6, 6);
      shellGeo.scale(1.2, 0.4, 1.0);
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xffedd5,
        roughness: 0.3,
        metalness: 0.2
      });
      const shellMesh = new THREE.Mesh(shellGeo, shellMat);

      // 放置在海灘潮間帶
      const angle = (idx * 1.3) % (Math.PI * 2);
      const r = key === 'island-center' ? 14.8 : 9.5;
      shellMesh.position.set(
        pos.x + Math.cos(angle) * r,
        0.3,
        pos.z + Math.sin(angle) * r
      );

      // 擴大點擊碰撞盒
      const hitSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 6, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      shellMesh.add(hitSphere);
      hitSphere.userData = { type: 'shell', ref: shellMesh };

      this.shellsGroup.add(shellMesh);
      this.shells.push({
        mesh: shellMesh,
        hit: hitSphere,
        available: true,
        respawnTimer: 0
      });
    });
  }

  // 夜晚螢火蟲微粒系統
  buildFireflies() {
    const pCount = 36;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = 1.0 + Math.random() * 4.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xccff00,
      size: 0.8,
      transparent: true,
      opacity: 0.0 // 白天隱藏
    });

    this.fireflies = new THREE.Points(geom, pMat);
    this.firefliesGroup.add(this.fireflies);
  }

  // 拾取貝殼互動
  pickShell(shellHit) {
    const item = this.shells.find((s) => s.hit === shellHit);
    if (item && item.available) {
      item.available = false;
      item.mesh.visible = false;
      item.respawnTimer = 20.0; // 20 秒後重生

      this.addItem('item-shell', 1);
      this.onToast('🐚 拾取到了 1 個【數位貝殼】！已存入背包');
      return true;
    }
    return false;
  }

  // 點擊居民對話
  interactNPC(npcData, npcChar) {
    this.activeNPC = { data: npcData, char: npcChar };
    // 讓一般 3D 小人轉向鏡頭；實體 Hank 則由巡島控制器處理面向鏡頭與跳躍
    if (npcChar && npcChar.group) {
      if (!npcChar.isTouringHank) {
        npcChar.group.lookAt(this.camera.position.x, npcChar.group.position.y, this.camera.position.z);
      }
    }
    this.onNPCClick(npcData);
  }

  // 設定晝夜光影狀態
  setDayNight(mode) {
    this.isNight = (mode === 'night');
    this.islandWorld.setNightMode(this.isNight);

    // 夜晚隱藏海鷗、顯現螢火蟲
    this.birdFlocks.forEach((f) => {
      f.group.visible = !this.isNight;
    });
    if (this.fireflies) {
      this.fireflies.material.opacity = this.isNight ? 0.85 : 0.0;
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  // 每幀更新循環
  update(delta, time) {
    if (this.reducedMotion) return;

    // 1. 常駐居民走路與揮手狀態機
    this.residents.forEach((r) => {
      r.animTimer += delta;

      if (this.activeNPC && this.activeNPC.data.id === r.data.id) {
        // 與訪客對話中：停下並揮手
        r.char.rightArm.rotation.x = Math.sin(time * 8) * 0.6 + 0.8;
        return;
      }

      if (r.state === 'walk') {
        const target = r.waypoints[r.currentWP];
        const dir = new THREE.Vector3().subVectors(target, r.char.group.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist < 0.4) {
          r.state = 'wait';
          r.stateTimer = 1.5 + Math.random() * 2.5;
          r.char.leftArm.rotation.x = 0;
          r.char.rightArm.rotation.x = 0;
          r.char.leftLeg.rotation.x = 0;
          r.char.rightLeg.rotation.x = 0;
        } else {
          dir.normalize();
          r.char.group.position.addScaledVector(dir, r.speed * delta);
          r.char.group.lookAt(target.x, r.char.group.position.y, target.z);

          // 手腳擺動
          const swing = Math.sin(r.animTimer * 6) * 0.5;
          r.char.leftArm.rotation.x = -swing;
          r.char.rightArm.rotation.x = swing;
          r.char.leftLeg.rotation.x = swing;
          r.char.rightLeg.rotation.x = -swing;
        }
      } else if (r.state === 'wait') {
        r.stateTimer -= delta;
        if (r.stateTimer <= 0) {
          r.currentWP = (r.currentWP + 1) % r.waypoints.length;
          r.state = 'walk';
        }
      }
    });

    // 1.5 實體巡島導師 Hank 老師跨島巡邏與立繪動畫
    if (this.touringHank) {
      const h = this.touringHank;

      // 保持立繪永遠面向相機 (Billboard)
      h.billboardNode.quaternion.copy(this.camera.quaternion);

      if (h.starMesh) {
        h.starMesh.rotation.y += delta * 2.2;
        h.starMesh.rotation.x += delta * 1.1;
        h.starMesh.position.y = 4.9 + Math.sin(time * 3) * 0.1;
      }

      // 若正在與訪客對話中：停下腳步、開心微跳躍揮手
      if (this.activeNPC && this.activeNPC.data.id === h.data.id) {
        const hop = Math.sin(time * 8) * 0.2;
        h.planeMesh.position.y = 1.84 + Math.max(0, hop);
        h.tagSprite.scale.set(3.8, 0.86, 1.0);
      } else {
        h.tagSprite.scale.set(3.6, 0.82, 1.0);

        if (h.phase === 'center_rest') {
          // 在中央島巡視休整
          h.timer -= delta;
          h.planeMesh.position.y = 1.84 + Math.sin(time * 2.5) * 0.05;
          if (h.timer <= 0) {
            const nextTargetId = h.islandKeys[h.targetIndex];
            h.waypoints = this.generateHankExcursionWaypoints(nextTargetId);
            h.currentWPIndex = 0;
            h.phase = 'walk_to_island';
          }
        } else if (h.phase === 'walk_to_island') {
          // 沿木橋邁步前往目標島
          const targetWP = h.waypoints[h.currentWPIndex];
          if (!targetWP) {
            h.phase = 'island_inspect';
            h.timer = 4.0;
          } else {
            const toWP = new THREE.Vector3().subVectors(targetWP, h.group.position);
            const dist = toWP.length();
            h.walkTime += delta;
            const stepDist = h.speed * delta;

            if (dist <= stepDist || dist < 0.25) {
              h.group.position.copy(targetWP);
              h.currentWPIndex++;
              if (h.currentWPIndex >= h.waypoints.length) {
                h.phase = 'island_inspect';
                h.timer = 4.0; // 到達目標島！駐足巡視 4 秒
              }
            } else {
              toWP.normalize();
              h.group.position.addScaledVector(toWP, stepDist);

              // 根據運動方向在螢幕水平方向做鏡像翻轉
              const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
              const dot = toWP.dot(camRight);
              if (dot > 0.08) h.planeMesh.scale.set(3.3, 3.67, 1.0);
              else if (dot < -0.08) h.planeMesh.scale.set(-3.3, 3.67, 1.0);

              // 步伐節奏彈跳與輕微擺動
              const bounce = Math.abs(Math.sin(h.walkTime * 8)) * 0.2;
              h.planeMesh.position.y = 1.84 + bounce;
              h.planeMesh.rotation.z = Math.sin(h.walkTime * 8) * 0.06;
              h.shadowMesh.scale.setScalar(1.0 - bounce * 0.35);
            }
          }
        } else if (h.phase === 'island_inspect') {
          // 在目標島巡視
          h.timer -= delta;
          h.planeMesh.position.y = 1.84 + Math.abs(Math.sin(time * 3)) * 0.08;
          if (h.timer <= 0) {
            // 巡視完畢，沿木橋回程
            h.waypoints = this.generateHankExcursionWaypoints(h.islandKeys[h.targetIndex]).reverse();
            h.currentWPIndex = 0;
            h.phase = 'walk_to_center';
          }
        } else if (h.phase === 'walk_to_center') {
          // 沿木橋邁步返回中央島
          const targetWP = h.waypoints[h.currentWPIndex];
          if (!targetWP) {
            h.phase = 'center_rest';
            h.timer = 3.0;
            h.targetIndex = (h.targetIndex + 1) % h.islandKeys.length;
          } else {
            const toWP = new THREE.Vector3().subVectors(targetWP, h.group.position);
            const dist = toWP.length();
            h.walkTime += delta;
            const stepDist = h.speed * delta;

            if (dist <= stepDist || dist < 0.25) {
              h.group.position.copy(targetWP);
              h.currentWPIndex++;
              if (h.currentWPIndex >= h.waypoints.length) {
                h.phase = 'center_rest';
                h.timer = 3.0; // 回到中央島休整 3 秒
                h.targetIndex = (h.targetIndex + 1) % h.islandKeys.length; // 準備前往下一座島
              }
            } else {
              toWP.normalize();
              h.group.position.addScaledVector(toWP, stepDist);

              const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
              const dot = toWP.dot(camRight);
              if (dot > 0.08) h.planeMesh.scale.set(3.3, 3.67, 1.0);
              else if (dot < -0.08) h.planeMesh.scale.set(-3.3, 3.67, 1.0);

              const bounce = Math.abs(Math.sin(h.walkTime * 8)) * 0.2;
              h.planeMesh.position.y = 1.84 + bounce;
              h.planeMesh.rotation.z = Math.sin(h.walkTime * 8) * 0.06;
              h.shadowMesh.scale.setScalar(1.0 - bounce * 0.35);
            }
          }
        }
      }
    }

    // 2. 送貨員往返木橋
    this.couriers.forEach((c) => {
      if (c.waitTimer > 0) {
        c.waitTimer -= delta;
        return;
      }

      if (c.forward) {
        c.progress += c.speed * delta;
        if (c.progress >= 1.0) {
          c.progress = 1.0;
          c.forward = false;
          c.waitTimer = 2.0; // 到達目標島交貨停留揮手
          if (c.char.crate) c.char.crate.visible = false; // 交出貨箱
        }
      } else {
        c.progress -= c.speed * delta;
        if (c.progress <= 0.0) {
          c.progress = 0.0;
          c.forward = true;
          c.waitTimer = 2.5; // 回到中央市集取貨
          if (c.char.crate) c.char.crate.visible = true; // 重新背起貨物
        }
      }

      const curPos = new THREE.Vector3().lerpVectors(c.startPos, c.endPos, c.progress);
      c.char.group.position.copy(curPos);
      c.char.group.lookAt(
        c.forward ? c.endPos.x : c.startPos.x,
        curPos.y,
        c.forward ? c.endPos.z : c.startPos.z
      );

      // 送貨員步伐
      const sw = Math.sin(time * 7) * 0.45;
      c.char.leftLeg.rotation.x = sw;
      c.char.rightLeg.rotation.x = -sw;
    });

    // 3. 雲朵環形飄移
    this.clouds.forEach((c) => {
      c.angle += c.speed * delta * 0.2;
      c.group.position.x = Math.cos(c.angle) * c.radius;
      c.group.position.z = Math.sin(c.angle) * c.radius;
    });

    // 4. 海鷗拍翅盤旋
    if (!this.isNight) {
      this.birdFlocks.forEach((f) => {
        f.angle += f.speed * delta * 0.4;
        f.group.position.x = Math.cos(f.angle) * f.radius;
        f.group.position.z = Math.sin(f.angle) * f.radius;
        f.group.lookAt(
          Math.cos(f.angle + 0.1) * f.radius,
          f.group.position.y,
          Math.sin(f.angle + 0.1) * f.radius
        );

        const wingFlap = Math.sin(time * 9) * 0.6;
        f.birds.forEach((b) => {
          b.leftWing.rotation.z = wingFlap;
          b.rightWing.rotation.z = -wingFlap;
        });
      });
    }

    // 5. 帆船繞島航行與隨波搖擺
    this.sailboats.forEach((b) => {
      b.angle += b.speed * delta * 0.15;
      b.group.position.x = Math.cos(b.angle) * b.radius;
      b.group.position.z = Math.sin(b.angle) * b.radius;
      b.group.lookAt(
        Math.cos(b.angle + 0.1) * b.radius,
        b.group.position.y,
        Math.sin(b.angle + 0.1) * b.radius
      );

      // 船身微搖晃 (Rocking with waves)
      b.group.rotation.z = Math.sin(time * 2.5 + b.angle) * 0.08;
      b.group.position.y = Math.sin(time * 1.8 + b.angle) * 0.15;
    });

    // 6. 貝殼重生計時
    this.shells.forEach((s) => {
      if (!s.available) {
        s.respawnTimer -= delta;
        if (s.respawnTimer <= 0) {
          s.available = true;
          s.mesh.visible = true;
        }
      }
    });

    // 7. 夜晚螢火蟲飄動
    if (this.isNight && this.fireflies) {
      const pos = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + Math.sin(time * 3 + i) * 0.02;
        if (y < 0.5) y = 4.0;
        if (y > 5.0) y = 0.5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // 8. 巡邏路徑檢視模式：讓地面路徑環與頭頂標記自然懸浮
    if (this.isInspectorMode && this.inspectorVisualsGroup.visible) {
      this.inspectorVisualsGroup.children.forEach((child) => {
        if (child.userData && child.userData.isInspectorPin) {
          child.quaternion.copy(this.camera.quaternion);
        }
      });
    }
  }

  // 打造全局 3D 居民散步路徑與路徑點視覺化系統
  buildInspectorVisuals() {
    this.inspectorVisualsGroup.clear();

    // 1. 各島常駐居民路徑 (Glowing Loop Ribbon + Waypoint Ring Markers)
    this.residents.forEach((r, idx) => {
      const color = r.data.color ? parseInt(r.data.color.replace('#', '0x')) : 0x38bdf8;
      const pts = [...r.waypoints, r.waypoints[0]];

      // A. 3D 連接曲線路徑
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const curvePoints = curve.getPoints(36);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.95
      });
      const pathLine = new THREE.Line(lineGeo, lineMat);
      this.inspectorVisualsGroup.add(pathLine);

      // B. 地面路徑點圓環 (Waypoint Discs on Grass)
      r.waypoints.forEach((wp, wIdx) => {
        const ringGeo = new THREE.RingGeometry(0.18, 0.48, 16);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(wp.x, 2.22, wp.z);
        this.inspectorVisualsGroup.add(ringMesh);

        // 中央實心光點
        const dotGeo = new THREE.CircleGeometry(0.12, 12);
        dotGeo.rotateX(-Math.PI / 2);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dotMesh = new THREE.Mesh(dotGeo, dotMat);
        dotMesh.position.set(wp.x, 2.23, wp.z);
        this.inspectorVisualsGroup.add(dotMesh);
      });

      // C. 角色頭頂 3D 檢視標記看板 (Inspector Pin Billboard)
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(4, 4, 248, 56, 28);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = r.data.color || '#38bdf8';
        ctx.stroke();
      } else {
        ctx.fillRect(4, 4, 248, 56);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`📍 ${r.data.name}`, 128, 32);

      const pinTexture = new THREE.CanvasTexture(canvas);
      pinTexture.needsUpdate = true;
      const pinMat = new THREE.SpriteMaterial({ map: pinTexture, transparent: true, depthTest: false });
      const pinSprite = new THREE.Sprite(pinMat);
      pinSprite.position.set(0, 2.8, 0);
      pinSprite.scale.set(2.8, 0.7, 1.0);
      pinSprite.userData = { isInspectorPin: true };
      r.char.group.add(pinSprite);
      this.inspectorVisualsGroup.add(pinSprite);
    });

    // 2. 實體 Hank 跨島大巡邏路徑 (全島金色木橋航道)
    if (this.touringHank && this.touringHank.islandKeys) {
      this.touringHank.islandKeys.forEach((tId) => {
        const wps = this.generateHankExcursionWaypoints(tId);
        if (wps && wps.length > 1) {
          const hankCurve = new THREE.CatmullRomCurve3(wps, false);
          const hankPoints = hankCurve.getPoints(40);
          const hankLineGeo = new THREE.BufferGeometry().setFromPoints(hankPoints);
          const hankLineMat = new THREE.LineBasicMaterial({
            color: 0xf59e0b,
            linewidth: 3,
            transparent: true,
            opacity: 0.85
          });
          const hankLine = new THREE.Line(hankLineGeo, hankLineMat);
          this.inspectorVisualsGroup.add(hankLine);
        }
      });
    }

    // 3. 物流送貨員航道
    this.couriers.forEach((c) => {
      const pts = [c.startPos, c.endPos];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 1.0,
        gapSize: 0.5,
        transparent: true,
        opacity: 0.6
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.inspectorVisualsGroup.add(line);
    });
  }

  // 切換 3D 路徑檢視模式
  setInspectorMode(enabled) {
    this.isInspectorMode = enabled;
    if (enabled && this.inspectorVisualsGroup.children.length === 0) {
      this.buildInspectorVisuals();
    }
    this.inspectorVisualsGroup.visible = enabled;
  }
}
