/* ==========================================================
   大墩元素週期島：3D 核心主程序 (main.js)
   依據 references/living-world.md 與 theme.md 實作
   ========================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { IslandWorld } from './islands.js?v=2.6';
import { LivingWorld } from './living-world.js?v=2.6';
import { IslandUI } from './ui.js?v=2.6';

class App {
  constructor() {
    this.container = document.getElementById('webgl-container');
    this.labelsContainer = document.getElementById('labels-container');
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.overviewCamPos = new THREE.Vector3(0, 52, 72);
    this.overviewTarget = new THREE.Vector3(0, 2, 0);
    this.targetCamPos = this.overviewCamPos.clone();
    this.targetControlsTarget = this.overviewTarget.clone();
    this.isFlying = false;

    this.labels = [];
    this.activeIslandId = null;
    window._app = this;

    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/content.json');
      this.data = await resp.json();
    } catch (e) {
      console.error('載入 content.json 失敗:', e);
      return;
    }

    // 先初始化 UI 系統（確保即使沒有 WebGL 也能完整瀏覽課堂內容與清單）
    this.ui = new IslandUI(this.data, {
      onFlyToIsland: (islandId) => this.flyToIsland(islandId),
      onDayNightChange: (mode) => this.applyDayNightLights(mode),
      onThemeChange: (theme) => this.applyThemeColors(theme),
      onResetView: () => this.resetToOverview(),
      onReducedMotionToggle: (enabled) => this.livingWorld ? this.livingWorld.setReducedMotion(enabled) : null,
      getBackpack: () => this.livingWorld ? this.livingWorld.getBackpack() : {},
      addItem: (id, count) => this.livingWorld ? this.livingWorld.addItem(id, count) : null,
      removeItem: (id, count) => this.livingWorld ? this.livingWorld.removeItem(id, count) : false,
      onBackpackReset: () => this.livingWorld ? this.livingWorld.initInventory() : null,
      onCloseNPC: () => { if (this.livingWorld) this.livingWorld.activeNPC = null; },
      onFlyToHank: () => this.flyToHank(),
      onToggleNPCInspector: () => this.toggleNPCInspector(),
      onFlyToNPC: (npcId) => this.flyToNPC(npcId),
      onInteractNPC: (npcId) => this.interactWithNPC(npcId),
      onSet3DInspectorMode: (enabled) => this.livingWorld ? this.livingWorld.setInspectorMode(enabled) : null,
      getInspectorNPCData: () => this.getInspectorNPCData()
    });

    // 檢查 WebGL 支援度
    if (!this.checkWebGL()) {
      this.handleWebGLFallback();
      return;
    }

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initControls();
    this.initLights();

    // 建立 3D 島嶼世界與生活感系統
    this.islandWorld = new IslandWorld(this.scene, this.data);
    this.livingWorld = new LivingWorld(
      this.scene,
      this.camera,
      this.islandWorld,
      this.data,
      (npcData) => this.handleNPCClicked(npcData),
      (msg) => this.ui.showToast(msg)
    );

    this.create3DLabels();
    this.bindWindowEvents();
    this.applyThemeColors(this.ui.currentTheme);
    this.applyDayNightLights(this.ui.currentDayNight);

    // 啟動主渲染迴圈
    this.animate();
    window._app = this;
  }

  handleWebGLFallback() {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:68px;left:50%;transform:translateX(-50%);padding:10px 18px;background:#ef4444;color:#fff;border-radius:30px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;font-size:0.86rem;';
    banner.textContent = '💡 偵測到目前環境未開啟 WebGL 3D 加速，已自動為您開啟無障礙課堂文字清單！';
    document.body.appendChild(banner);
    setTimeout(() => {
      const btn = document.getElementById('btn-places-list');
      if (btn) btn.click();
    }, 400);
  }

  checkWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  handleWebGLFallback() {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:#ef4444;color:#fff;text-align:center;z-index:9999;font-weight:bold;';
    banner.textContent = '您的瀏覽器或設備目前未開啟 WebGL 硬體加速，已為您自動切換至純文字課堂清單模式！';
    document.body.appendChild(banner);
    setTimeout(() => {
      document.getElementById('btn-places-list').click();
    }, 500);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 色調映射與色彩空間 (references/living-world.md 精緻度要求)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 開啟軟陰影 (PCFSoftShadowMap)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0xeaf4fb, 0.0055);
    this.scene.fog = this.fog;
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 600);
    this.updateOverviewForAspect();
    this.camera.position.copy(this.overviewCamPos);
    this.targetCamPos = this.overviewCamPos.clone();
  }

  // 手機直式螢幕：拉遠全景鏡頭並淡化霧氣，讓 7 座島完整入鏡
  updateOverviewForAspect() {
    const aspect = window.innerWidth / window.innerHeight;
    const factor = aspect < 1 ? Math.min(2.0, 0.85 / aspect) : 1;
    this.viewFactor = Math.max(1, factor);
    this.overviewCamPos = new THREE.Vector3(0, 52, 72).multiplyScalar(this.viewFactor);
    if (this.fog) this.fog.density = 0.0055 / this.viewFactor;
    if (this.controls) this.controls.maxDistance = 140 * this.viewFactor;
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06; // 防止鏡頭鑽入海底
    this.controls.minDistance = 14;
    this.controls.maxDistance = 140 * (this.viewFactor || 1);
    this.controls.target.copy(this.overviewTarget);
  }

  initLights() {
    // 1. 半球光補色 (HemisphereLight)
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.75);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    // 2. 主陽光 (DirectionalLight castShadow)
    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 1.3);
    this.sunLight.position.set(45, 65, 35);
    this.sunLight.castShadow = true;

    // 陰影相機視野涵蓋全群島
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.mapSize.width = window.innerWidth < 768 ? 1024 : 2048;
    this.sunLight.shadow.mapSize.height = window.innerWidth < 768 ? 1024 : 2048;

    this.scene.add(this.sunLight);

    // 3. 夜晚環境點光源 (PointLight for center plaza)
    this.plazaLight = new THREE.PointLight(0xffb703, 0.0, 30);
    this.plazaLight.position.set(0, 4.5, 2);
    this.scene.add(this.plazaLight);
  }

  // 建立島嶼 HTML 浮動標籤
  create3DLabels() {
    this.labelsContainer = document.getElementById('labels-container');
    if (!this.labelsContainer) {
      this.labelsContainer = document.createElement('div');
      this.labelsContainer.id = 'labels-container';
      document.body.appendChild(this.labelsContainer);
    }
    this.labelsContainer.innerHTML = '';
    const allIslands = [this.data.centerIsland, ...this.data.islands];
    this.labels = [];

    allIslands.forEach((island) => {
      const pos = this.islandWorld.islandPositions[island.id];
      const isCenter = island.id === 'island-center';

      const el = document.createElement('div');
      el.className = `island-3d-label ${isCenter ? 'center-label' : ''}`;
      el.innerHTML = `
        <span class="label-order">${isCenter ? '★' : island.order}</span>
        <span>${island.name}</span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui.openIslandDrawer(island.id);
      });

      this.labelsContainer.appendChild(el);
      this.labels.push({
        element: el,
        position: new THREE.Vector3(pos.x, isCenter ? 6.5 : 5.2, pos.z),
        id: island.id
      });
    });
  }

  // 更新島嶼標籤的螢幕投影位置
  updateLabels() {
    const wp = new THREE.Vector3();
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    this.labels.forEach((lbl) => {
      wp.copy(lbl.position);
      wp.project(this.camera);

      // 當位於鏡頭背後或抽屜開啟時淡出標籤
      const isBehind = wp.z > 1;
      const isDrawerOpen = !!this.ui.activeIsland;

      if (isBehind || isDrawerOpen) {
        lbl.element.style.opacity = '0';
        lbl.element.style.pointerEvents = 'none';
      } else {
        const x = wp.x * halfW + halfW;
        const y = -wp.y * halfH + halfH;
        lbl.element.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
        lbl.element.style.opacity = '1';
        lbl.element.style.pointerEvents = 'auto';
      }
    });

    // 若居民對話泡泡開啟中，持續追蹤投影位置
    if (this.livingWorld.activeNPC && document.getElementById('npc-bubble').style.display !== 'none') {
      const npcPos = this.livingWorld.activeNPC.char.group.position.clone();
      npcPos.y += 2.4;
      npcPos.project(this.camera);

      const x = npcPos.x * halfW + halfW;
      const y = -npcPos.y * halfH + halfH;
      const bubble = document.getElementById('npc-bubble');
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
    }
  }

  // 視角平滑飛近指定島嶼
  flyToIsland(islandId) {
    this.isFollowingHank = false;
    this.activeIslandId = islandId;
    const pos = this.islandWorld.islandPositions[islandId];
    if (!pos) return;

    const isCenter = islandId === 'island-center';
    const offset = isCenter ? new THREE.Vector3(0, 18, 26) : new THREE.Vector3(0, 14, 18);

    this.targetCamPos = pos.clone().add(offset);
    this.targetControlsTarget = pos.clone().setY(2.0);
    this.isFlying = true;
  }

  // 視角平滑飛近巡島 Hank 老師身邊
  flyToHank() {
    if (!this.livingWorld || !this.livingWorld.touringHank) return;
    this.activeIslandId = null;
    const hPos = this.livingWorld.touringHank.group.position;
    this.targetCamPos = hPos.clone().add(new THREE.Vector3(0, 13, 16));
    this.targetControlsTarget = hPos.clone().setY(2.2);
    this.isFlying = true;
    this.isFollowingHank = true;
  }

  // 回到群島總全景視角
  resetToOverview() {
    this.isFollowingHank = false;
    this.activeIslandId = null;
    this.targetCamPos = this.overviewCamPos.clone();
    this.targetControlsTarget = this.overviewTarget.clone();
    this.isFlying = true;
  }

  // 取得全島居民巡邏路徑與地標安全淨距分析資料（支援動態擴展至未來所有新島嶼）
  getInspectorNPCData() {
    if (!this.livingWorld || !this.islandWorld) return [];
    const results = [];

    // 1. 各島常駐居民
    this.livingWorld.residents.forEach(r => {
      const isl = this.data.islands.find(i => i.id === r.data.islandId) || { name: '中央 AI 元素島' };
      const islPos = this.islandWorld.islandPositions[r.data.islandId] || new THREE.Vector3(0, 0, 0);
      const currPos = r.char.group.position;
      const dx = currPos.x - islPos.x;
      const dz = currPos.z - islPos.z;
      const distFromCenter = Math.sqrt(dx * dx + dz * dz);
      // 外圍島地標最大基座 3.4m，中央島 3.8m
      const landmarkRadius = r.data.islandId === 'island-center' ? 3.8 : 3.4;
      const clearance = Math.max(0, distFromCenter - landmarkRadius);

      results.push({
        id: r.data.id,
        name: r.data.name,
        islandId: r.data.islandId,
        islandName: isl.name,
        role: r.data.role,
        color: r.data.color || '#38bdf8',
        currentPos: { x: currPos.x.toFixed(1), z: currPos.z.toFixed(1) },
        distFromCenter: distFromCenter.toFixed(1),
        clearance: clearance.toFixed(1),
        isSafe: clearance >= 0.8,
        waypoints: r.waypoints.map(w => ({ x: w.x.toFixed(1), z: w.z.toFixed(1) }))
      });
    });

    // 2. 實體巡島 Hank 老師
    if (this.livingWorld.touringHank) {
      const h = this.livingWorld.touringHank;
      const hp = h.group.position;
      results.push({
        id: h.data.id,
        name: h.data.name,
        islandId: 'cross-island',
        islandName: '全群島跨島巡航',
        role: h.data.role,
        color: '#f59e0b',
        currentPos: { x: hp.x.toFixed(1), z: hp.z.toFixed(1) },
        distFromCenter: Math.sqrt(hp.x * hp.x + hp.z * hp.z).toFixed(1),
        clearance: '4.5',
        isSafe: true,
        isHank: true,
        phase: h.phase
      });
    }

    // 3. 物流送貨員
    this.livingWorld.couriers.forEach((c) => {
      const ud = c.char.hitMesh.userData.data;
      const cp = c.char.group.position;
      results.push({
        id: ud.id,
        name: ud.name,
        islandId: 'shipping-route',
        islandName: '跨島物流航道',
        role: ud.role,
        color: '#0284c7',
        currentPos: { x: cp.x.toFixed(1), z: cp.z.toFixed(1) },
        distFromCenter: Math.sqrt(cp.x * cp.x + cp.z * cp.z).toFixed(1),
        clearance: '5.0',
        isSafe: true,
        isCourier: true
      });
    });

    return results;
  }

  // 切換居民路徑巡檢面板與 3D 導引視圖
  toggleNPCInspector() {
    if (!this.livingWorld) return;
    const nextState = !this.livingWorld.isInspectorMode;
    this.livingWorld.setInspectorMode(nextState);
    if (this.ui) this.ui.toggleNPCInspectorModal(nextState);
  }

  // 視角平滑飛向指定 NPC 身邊並開啟互動對話
  flyToNPC(npcId) {
    if (!this.livingWorld) return;
    this.isFollowingHank = false;
    let targetChar = null;
    let targetData = null;

    if (this.livingWorld.touringHank && this.livingWorld.touringHank.data.id === npcId) {
      targetChar = this.livingWorld.touringHank;
      targetData = this.livingWorld.touringHank.data;
      this.isFollowingHank = true;
    } else {
      const res = this.livingWorld.residents.find(r => r.data.id === npcId);
      if (res) {
        targetChar = res.char;
        targetData = res.data;
      } else {
        const cou = this.livingWorld.couriers.find(c => c.char.hitMesh.userData && c.char.hitMesh.userData.data.id === npcId);
        if (cou) {
          targetChar = cou.char;
          targetData = cou.char.hitMesh.userData.data;
        }
      }
    }

    if (targetChar && targetChar.group) {
      const p = targetChar.group.position;
      this.targetCamPos = p.clone().add(new THREE.Vector3(0, 7.5, 10.5));
      this.targetControlsTarget = p.clone().setY(2.2);
      this.isFlying = true;
      setTimeout(() => {
        this.livingWorld.interactNPC(targetData, targetChar);
      }, 750);
    }
  }

  // 直接觸發 NPC 對話氣泡
  interactWithNPC(npcId) {
    if (!this.livingWorld) return;
    if (this.livingWorld.touringHank && this.livingWorld.touringHank.data.id === npcId) {
      this.livingWorld.interactNPC(this.livingWorld.touringHank.data, this.livingWorld.touringHank);
      return;
    }
    const res = this.livingWorld.residents.find(r => r.data.id === npcId);
    if (res) {
      this.livingWorld.interactNPC(res.data, res.char);
      return;
    }
    const cou = this.livingWorld.couriers.find(c => c.char.hitMesh.userData && c.char.hitMesh.userData.data.id === npcId);
    if (cou) {
      this.livingWorld.interactNPC(cou.char.hitMesh.userData.data, cou.char);
    }
  }

  // 點擊居民處理
  handleNPCClicked(npcData) {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    const p = this.livingWorld.activeNPC.char.group.position.clone();
    p.y += 2.4;
    p.project(this.camera);

    const screenPos = {
      x: p.x * halfW + halfW,
      y: -p.y * halfH + halfH
    };
    this.ui.openNPCBubble(npcData, screenPos);
  }

  // 日夜光線漸變 (references/living-world.md)
  applyDayNightLights(mode) {
    if (!this.livingWorld || !this.sunLight) return;
    this.livingWorld.setDayNight(mode);

    if (mode === 'day') {
      this.sunLight.color.setHex(0xfff6e5);
      this.sunLight.intensity = 1.35;
      this.sunLight.position.set(45, 65, 35);
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0x5dbb63);
      this.hemiLight.intensity = 0.8;
      if (this.fog) this.fog.color.setHex(0xeaf4fb);
      this.plazaLight.intensity = 0.0;
    } else if (mode === 'dusk') {
      this.sunLight.color.setHex(0xf97316);
      this.sunLight.intensity = 1.1;
      this.sunLight.position.set(-50, 25, 20);
      this.hemiLight.color.setHex(0xfde047);
      this.hemiLight.groundColor.setHex(0x78350f);
      this.hemiLight.intensity = 0.65;
      if (this.fog) this.fog.color.setHex(0xfed7aa);
      this.plazaLight.intensity = 1.2;
    } else if (mode === 'night') {
      this.sunLight.color.setHex(0x38bdf8);
      this.sunLight.intensity = 0.28;
      this.sunLight.position.set(-20, 50, -30);
      this.hemiLight.color.setHex(0x1e293b);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.35;
      if (this.fog) this.fog.color.setHex(0x121c2e);
      this.plazaLight.intensity = 2.5;
    }
  }

  // 套用主題底色至 3D 霧與海面色調 (references/theme.md)
  applyThemeColors(theme) {
    if (this.ui && this.ui.currentDayNight === 'night') return; // 夜晚維持深色光線
    if (!this.fog) return;

    if (theme === 'sky') {
      this.fog.color.setHex(0xeaf4fb);
      if (this.islandWorld && this.islandWorld.oceanMesh) this.islandWorld.oceanMesh.material.color.setHex(0x64b5f6);
    } else if (theme === 'cloud') {
      this.fog.color.setHex(0xf7f9fb);
      if (this.islandWorld && this.islandWorld.oceanMesh) this.islandWorld.oceanMesh.material.color.setHex(0x90caf9);
    } else if (theme === 'starry') {
      this.fog.color.setHex(0x121c2e);
      if (this.islandWorld && this.islandWorld.oceanMesh) this.islandWorld.oceanMesh.material.color.setHex(0x1e293b);
    }
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.updateOverviewForAspect();
    });

    // 畫布點擊偵測（拾取貝殼、居民對話、點島飛入）
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.isFollowingHank = false;
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      // 避免拖曳旋轉時誤觸
      const dist = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
      if (dist > 6) return;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // 1. 優先檢查貝殼與居民點擊
      const livingIntersects = this.raycaster.intersectObjects([
        ...this.livingWorld.shellsGroup.children,
        ...this.livingWorld.npcGroup.children
      ], true);

      if (livingIntersects.length > 0) {
        for (let hit of livingIntersects) {
          const ud = hit.object.userData;
          if (ud && ud.type === 'shell') {
            this.livingWorld.pickShell(hit.object);
            return;
          } else if (ud && ud.type === 'npc') {
            this.livingWorld.interactNPC(ud.data, ud.ref);
            return;
          }
        }
      }

      // 2. 檢查島嶼本體點擊
      const islandIntersects = this.raycaster.intersectObjects(this.islandWorld.islandsGroup.children, true);
      if (islandIntersects.length > 0) {
        let rootObj = islandIntersects[0].object;
        while (rootObj.parent && rootObj.parent !== this.islandWorld.islandsGroup) {
          rootObj = rootObj.parent;
        }
        for (let [id, mesh] of Object.entries(this.islandWorld.islandMeshes)) {
          if (mesh === rootObj) {
            this.ui.openIslandDrawer(id);
            return;
          }
        }
      }

      // 點擊空白海面關閉居民對話
      this.ui.closeNPCBubble();
      if (this.livingWorld) this.livingWorld.activeNPC = null;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 更新 3D 動畫與生態系統
    this.islandWorld.update(delta, time);
    this.livingWorld.update(delta, time);

    // 視角飛行平滑過渡 (Camera smooth lerp)
    if (this.isFlying) {
      if (this.isFollowingHank && this.livingWorld && this.livingWorld.touringHank) {
        const hPos = this.livingWorld.touringHank.group.position;
        this.targetCamPos.set(hPos.x, hPos.y + 13, hPos.z + 16);
        this.targetControlsTarget.set(hPos.x, hPos.y + 2.0, hPos.z);
      }

      const flyAlpha = 1 - Math.pow(0.92, Math.min(delta, 0.1) * 60);
      this.camera.position.lerp(this.targetCamPos, flyAlpha);
      this.controls.target.lerp(this.targetControlsTarget, flyAlpha);

      if (this.camera.position.distanceTo(this.targetCamPos) < 0.6) {
        this.camera.position.copy(this.targetCamPos);
        this.controls.target.copy(this.targetControlsTarget);
        this.isFlying = false;
        this.controls.update();
      }
    } else {
      this.controls.update();
    }
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

// 頁面載入完成後啟動應用程式
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
