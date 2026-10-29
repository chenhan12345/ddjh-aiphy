/* ==========================================================
   大墩元素週期島：使用者介面與互動系統 (ui.js)
   依據 references/island-type.md 與 theme.md 實作
   ========================================================== */

export class IslandUI {
  constructor(contentData, callbacks) {
    this.data = contentData;
    this.callbacks = callbacks; // onFlyToIsland, onDayNightChange, onThemeChange, onResetView, onAudioToggle, onReducedMotionToggle
    this.options = callbacks;

    this.currentTheme = localStorage.getItem('ddjh_theme') || 'sky';
    this.currentDayNight = 'day';
    this.autoDayNight = true;
    this.timeOfDay = 12.0; // 0~24 hours
    this.activeIsland = null;
    this.activeTab = 'material';
    this.audioPlaying = false;
    this.reducedMotion = false;

    this.visitedIslands = new Set(JSON.parse(localStorage.getItem('ddjh_visited') || '[]'));
    this.quizScores = JSON.parse(localStorage.getItem('ddjh_quiz_scores') || '{}');
    this.worksheetDrafts = JSON.parse(localStorage.getItem('ddjh_worksheet_drafts') || '{}');

    this.initDOM();
    this.initAudioSynth();
    this.applyTheme(this.currentTheme);
    this.startClockLoop();
  }

  initDOM() {
    this.container = document.getElementById('ui-root');
    this.renderAppHTML();
    this.bindEvents();
    this.updateProgressHUD();
  }

  renderAppHTML() {
    this.container.innerHTML = `
      <!-- 頂部導航列 -->
      <header class="top-navbar">
        <div class="brand-section" id="btn-mascot-intro" title="點擊聆聽 Hank 老師導覽">
          <div class="mascot-avatar-small" style="overflow: hidden; padding: 0; background: #ffffff; border: 2px solid var(--accent);">
            <img src="hank_mascot.png?v=2.1" alt="Hank 老師" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
          </div>
          <div class="brand-text">
            <h1>大墩元素週期島 <span class="brand-badge">3D 課程群島</span></h1>
            <p class="brand-tagline">${this.data.site.tagline}</p>
          </div>
        </div>

        <div class="nav-actions">
          <!-- 三組底色主題切換器 (references/theme.md) -->
          <div class="theme-selector-group" role="group" aria-label="底色主題切換">
            <button class="theme-pill-btn ${this.currentTheme === 'sky' ? 'active' : ''}" data-theme="sky" title="晴空底色">
              <span class="color-dot" style="background: #eaf4fb;"></span>
              <span>晴空</span>
            </button>
            <button class="theme-pill-btn ${this.currentTheme === 'cloud' ? 'active' : ''}" data-theme="cloud" title="雲朵底色">
              <span class="color-dot" style="background: #f7f9fb;"></span>
              <span>雲朵</span>
            </button>
            <button class="theme-pill-btn ${this.currentTheme === 'starry' ? 'active' : ''}" data-theme="starry" title="星夜底色">
              <span class="color-dot" style="background: #121c2e;"></span>
              <span>星夜</span>
            </button>
          </div>

          <div class="nav-icon-buttons">
          <button class="btn-icon" id="btn-search" title="搜尋島嶼與知識 (Ctrl+F)" aria-label="搜尋">🔍</button>
          <button class="btn-icon" id="btn-places-list" title="地點清單（無 3D 亦可全覽）" aria-label="地點清單">📋</button>
          <button class="btn-icon" id="btn-backpack" title="訪客背包與道具" aria-label="背包">
            🎒
            <span class="badge-dot" id="backpack-dot" style="display: none;"></span>
          </button>
          <button class="btn-icon" id="btn-bgm" title="播放微風背景音樂" aria-label="音樂開關">🎵</button>
          <button class="btn-icon" id="btn-reduced-motion" title="減少動態 / 暫停動畫" aria-label="減少動態">⏸️</button>
          <button class="btn-icon" id="btn-quick-fly-hank" title="🚀 飛往巡島 Hank 老師身邊" aria-label="追蹤 Hank" style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid var(--accent); color: var(--accent);">🚀</button>
          <button class="btn-icon" id="btn-reset-view" title="回到群島全景" aria-label="回到全景">🏠</button>
          </div>
        </div>
      </header>

      <!-- 3D 島嶼標籤容器 -->
      <div id="labels-container"></div>

      <!-- 居民對話泡泡 (NPC Speech Bubble) -->
      <div id="npc-bubble" class="npc-dialog-bubble" style="display: none;">
        <div class="npc-header">
          <div class="npc-meta">
            <div class="npc-avatar-badge" id="bubble-avatar">🧑‍🏫</div>
            <div>
              <div class="npc-name" id="bubble-name">佩甄組長</div>
              <div class="npc-role" id="bubble-role">教務資訊組長 ‧ 公務帳號島</div>
            </div>
          </div>
          <button class="drawer-close-btn" id="bubble-close-btn" style="width: 26px; height: 26px; font-size: 14px;">✕</button>
        </div>
        <div class="npc-quote-text" id="bubble-quote">「老師好！記得公務帳號修改密碼後，校內 Wi-Fi (tc-ddjh) 會自動同步喔！」</div>
        <div class="npc-actions">
          <button class="btn-npc" id="bubble-next-quote">💬 再聊聊</button>
          <button class="btn-npc btn-trade" id="bubble-trade-btn">🔁 交易交換</button>
        </div>
      </div>

      <!-- 左下角：時間與日夜切換面板 -->
      <div class="hud-clock-widget">
        <div class="clock-card">
          <div class="clock-icon" id="clock-symbol">☀️</div>
          <div class="clock-info">
            <div class="time-text" id="clock-time">12:00</div>
            <div class="mode-label" id="clock-status">晴朗正午 ‧ 自動循環</div>
          </div>
        </div>
        <div class="daynight-buttons">
          <button class="daynight-btn active" data-mode="day">☀️ 白天</button>
          <button class="daynight-btn" data-mode="dusk">🌇 黃昏</button>
          <button class="daynight-btn" data-mode="night">🌙 夜晚</button>
          <button class="daynight-btn" data-mode="auto">⏱ 自動</button>
          <button class="daynight-btn" data-mode="realtime">⌚ 即時</button>
        </div>
      </div>

      <!-- 右下角：探索進度膠囊與證書按鈕 -->
      <div class="hud-bottom-right">
        <div class="progress-capsule" id="btn-open-progress" title="查看探索紀錄與接關碼">
          <div>
            <div style="font-size: 0.72rem; color: var(--muted); font-weight: 700;">群島修業進度</div>
            <div style="font-size: 0.88rem; font-weight: 800;" id="hud-progress-text">0 / 7 島完成</div>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" id="hud-progress-fill"></div>
          </div>
        </div>
        <button class="btn-primary-action" id="btn-cert-quick">🏆 修業證書與接關碼</button>
      </div>

      <!-- 內容面板抽屜 (Desktop Side Drawer / Mobile Bottom Sheet) -->
      <div class="content-drawer-backdrop" id="drawer-backdrop"></div>
      <aside class="content-drawer" id="content-drawer" aria-hidden="true">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <div class="drawer-badge-group">
              <span class="drawer-badge" id="drawer-group-badge">教職行政</span>
              <span class="drawer-badge" style="background: var(--badge-bg); color: var(--accent-text);" id="drawer-order-badge">第 1 課</span>
            </div>
            <h2 id="drawer-title">教職員公務帳號同步島</h2>
            <p class="drawer-intro" id="drawer-intro">搞懂教育局公務帳號，一次同步縣市單一簽入與校內 Wi-Fi</p>
          </div>
          <button class="drawer-close-btn" id="drawer-close-btn" aria-label="關閉面板">✕</button>
        </div>

        <!-- 課程群島專屬三分頁 (references/island-type.md) -->
        <nav class="drawer-tabs">
          <button class="tab-btn active" data-tab="material">📖 學習教材</button>
          <button class="tab-btn" data-tab="quiz">📝 隨堂測驗</button>
          <button class="tab-btn" data-tab="worksheet">✏️ 實務學習單</button>
        </nav>

        <div class="drawer-body" id="drawer-body">
          <!-- 動態注入分頁內容 -->
        </div>

        <div class="drawer-footer">
          <button class="btn-primary-action" style="flex: 1; justify-content: center;" id="drawer-action-next">
            下一個學習島 ➔
          </button>
        </div>
      </aside>

      <!-- 彈出視窗：地點清單 (Places List Modal) -->
      <div class="modal-overlay" id="modal-places">
        <div class="modal-card">
          <div class="modal-header">
            <h3>📋 大墩元素週期島 ‧ 課程總覽清單</h3>
            <button class="drawer-close-btn modal-close-btn">✕</button>
          </div>
          <div class="modal-body" id="places-list-container">
            <!-- 動態注入島嶼卡片 -->
          </div>
        </div>
      </div>

      <!-- 彈出視窗：搜尋 (Search Modal) -->
      <div class="modal-overlay" id="modal-search">
        <div class="modal-card">
          <div class="modal-header">
            <h3>🔍 搜尋島嶼與知識內容</h3>
            <button class="drawer-close-btn modal-close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" id="search-input" class="search-input" placeholder="輸入關鍵字（例如：Wi-Fi、單一簽入、密碼、導師）..." autofocus>
            </div>
            <div id="search-results-list"></div>
          </div>
        </div>
      </div>

      <!-- 彈出視窗：訪客背包 (Backpack Inventory Modal) -->
      <div class="modal-overlay" id="modal-backpack">
        <div class="modal-card">
          <div class="modal-header">
            <h3>🎒 訪客冒險背包</h3>
            <button class="drawer-close-btn modal-close-btn">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.86rem; color: var(--muted); margin-bottom: 14px;">
              在各島海灘撿拾貝殼，並與居民交換各類科技信物，最後可在中央市集換取傳說中的【元素週期黃金燒瓶】！
            </p>
            <div class="inventory-grid" id="inventory-grid"></div>
            <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
              <button class="btn-npc" id="btn-reset-backpack" style="color: #ef4444;">清空背包</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 彈出視窗：修業證書與接關碼 (Certificate & Save Code Modal) -->
      <div class="modal-overlay" id="modal-certificate">
        <div class="modal-card">
          <div class="modal-header">
            <h3>🏆 修業完成證書與進度存檔</h3>
            <button class="drawer-close-btn modal-close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 16px;">
              <label style="font-size: 0.88rem; font-weight: 700;">學員姓名 / 稱謂：</label>
              <input type="text" id="cert-student-name" class="search-input" style="padding: 8px 12px; margin-top: 6px;" value="大墩探索學員">
            </div>
            <!-- 證書預覽畫布 -->
            <canvas id="cert-canvas" width="600" height="380" style="width: 100%; border-radius: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--line);"></canvas>
            <div style="margin-top: 14px; display: flex; gap: 8px;">
              <button class="btn-primary-action" id="btn-download-cert" style="flex: 1; justify-content: center;">💾 下載高畫質證書圖檔</button>
              <button class="btn-npc" id="btn-print-cert">🖨️ 列印證書</button>
            </div>

            <!-- 接關碼區域 (references/island-type.md) -->
            <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--line);">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 6px;">🔑 換機接關碼（Save Code）</h4>
            <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 8px;">更換電腦或手機時，可用這串安全代碼同步您的學習進度與背包道具：</p>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="save-code-input" class="search-input" style="padding: 8px 12px; font-family: monospace; font-size: 0.82rem;" readonly>
              <button class="btn-npc" id="btn-copy-code">複製代碼</button>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <input type="text" id="load-code-input" class="search-input" style="padding: 8px 12px; font-family: monospace; font-size: 0.82rem;" placeholder="在此貼上代碼還原進度...">
              <button class="btn-npc" id="btn-import-code">還原存檔</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 彈出視窗：Hank 老師引導對話 (Mascot Guide Modal) -->
      <div class="modal-overlay" id="modal-mascot">
        <div class="modal-card">
          <div class="modal-header">
            <h3>🧪 歡迎來到大墩元素週期島！</h3>
            <button class="drawer-close-btn modal-close-btn">✕</button>
          </div>
          <div class="modal-body" style="text-align: center; padding: 24px;">
            <div style="width: 120px; height: 120px; border-radius: 50%; background: #ffffff; border: 3.5px solid var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; box-shadow: var(--shadow-md); overflow: hidden; padding: 4px;">
              <img src="hank_mascot.png?v=2.1" alt="Hank 老師" style="width: 100%; height: 100%; object-fit: contain;">
            </div>
            <h4 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 6px;">我是領航導師 Hank 老師</h4>
            <p style="font-size: 0.9rem; line-height: 1.6; color: var(--ink-secondary); margin-bottom: 16px;">
              這座 3D 群島將「大墩國中校園數位行政與帳號連線」與「自然科學元素探究」完美結合！<br>
              你可以拖曳旋轉、縮放視野，點擊島嶼學習教材與隨堂測驗；也能漫步海灘撿拾貝殼，與居民交易稀有道具！
            </p>
            <div style="background: var(--bg); padding: 12px; border-radius: 10px; font-size: 0.84rem; text-align: left; line-height: 1.5; margin-bottom: 18px;">
              💡 <b>島嶼操作小秘訣：</b><br>
              • 點擊島嶼標籤：直接飛近並開啟學習面板<br>
              • 點擊島上走動的居民：停下轉向並開始聊天<br>
              • 點擊海灘貝殼：撿拾並存入訪客背包<br>
              • 按鍵盤 Esc：隨時關閉目前面板並回到全景
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="btn-primary-action" id="btn-mascot-start" style="flex: 1; justify-content: center;">
                開始探索群島 ✨
              </button>
              <button class="btn-primary-action" id="btn-mascot-fly" style="flex: 1; justify-content: center; background: linear-gradient(135deg, var(--accent), #f59e0b); color: #1e293b; font-weight: 800;">
                🚀 飛往巡島 Hank
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 吐司通知容器 -->
      <div class="toast-container" id="toast-container"></div>
    `;
  }

  bindEvents() {
    // 1. 主題切換按鈕
    this.container.querySelectorAll('.theme-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this.applyTheme(theme);
      });
    });

    // 2. 日夜切換按鈕
    this.container.querySelectorAll('.daynight-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.daynight-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        this.setDayNightMode(mode);
      });
    });

    // 3. 抽屜關閉與分頁切換
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    drawerBackdrop.addEventListener('click', () => this.closeDrawer());
    drawerCloseBtn.addEventListener('click', () => this.closeDrawer());

    this.container.querySelectorAll('.drawer-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.drawer-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderDrawerBody();
      });
    });

    // 4. 下一個島按鈕
    document.getElementById('drawer-action-next').addEventListener('click', () => {
      if (!this.activeIsland) return;
      const allIslands = [...this.data.islands, this.data.centerIsland];
      const curIdx = allIslands.findIndex((i) => i.id === this.activeIsland.id);
      const nextIdx = (curIdx + 1) % allIslands.length;
      this.openIslandDrawer(allIslands[nextIdx].id);
    });

    // 5. 居民對話泡泡關閉與互動
    document.getElementById('bubble-close-btn').addEventListener('click', () => {
      this.closeNPCBubble();
    });
    document.getElementById('bubble-next-quote').addEventListener('click', () => {
      if (this.currentNPC) this.cycleNPCQuote();
    });
    document.getElementById('bubble-trade-btn').addEventListener('click', () => {
      if (this.currentNPC) this.executeNPCTrade();
    });

    // 6. 工具列快捷按鈕
    document.getElementById('btn-reset-view').addEventListener('click', () => {
      this.closeDrawer();
      this.closeNPCBubble();
      this.callbacks.onResetView();
    });

    document.getElementById('btn-places-list').addEventListener('click', () => {
      this.openModal('modal-places');
      this.renderPlacesList();
    });

    document.getElementById('btn-search').addEventListener('click', () => {
      this.openModal('modal-search');
      document.getElementById('search-input').focus();
    });

    document.getElementById('btn-backpack').addEventListener('click', () => {
      this.openModal('modal-backpack');
      this.renderBackpack();
    });

    document.getElementById('btn-cert-quick').addEventListener('click', () => {
      this.openModal('modal-certificate');
      this.renderCertificate();
      this.generateSaveCode();
    });

    document.getElementById('btn-open-progress').addEventListener('click', () => {
      this.openModal('modal-certificate');
      this.renderCertificate();
      this.generateSaveCode();
    });

    document.getElementById('btn-mascot-intro').addEventListener('click', () => {
      this.openModal('modal-mascot');
    });

    document.getElementById('btn-mascot-start').addEventListener('click', () => {
      this.closeModal('modal-mascot');
    });

    const triggerFlyToHank = () => {
      this.closeModal('modal-mascot');
      if (this.callbacks && this.callbacks.onFlyToHank) {
        this.callbacks.onFlyToHank();
        this.showToast('✈️ 視角正在飛往巡島 Hank 老師身邊！');
      } else if (this.options && this.options.onFlyToHank) {
        this.options.onFlyToHank();
        this.showToast('✈️ 視角正在飛往巡島 Hank 老師身邊！');
      }
    };

    const btnMascotFly = document.getElementById('btn-mascot-fly');
    if (btnMascotFly) {
      btnMascotFly.addEventListener('click', triggerFlyToHank);
    }

    const btnQuickFlyHank = document.getElementById('btn-quick-fly-hank');
    if (btnQuickFlyHank) {
      btnQuickFlyHank.addEventListener('click', triggerFlyToHank);
    }

    // 7. 音樂開關
    document.getElementById('btn-bgm').addEventListener('click', () => {
      this.toggleAudio();
    });

    // 8. 減少動態開關
    document.getElementById('btn-reduced-motion').addEventListener('click', () => {
      this.toggleReducedMotion();
    });

    // 9. 搜尋輸入監聽
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    // 10. 接關碼複製與還原
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('save-code-input').value;
      navigator.clipboard.writeText(code).then(() => {
        this.showToast('📋 接關碼已複製至剪貼簿！');
      });
    });

    document.getElementById('btn-import-code').addEventListener('click', () => {
      const code = document.getElementById('load-code-input').value.trim();
      this.importSaveCode(code);
    });

    // 11. 證書下載與列印
    document.getElementById('btn-download-cert').addEventListener('click', () => {
      this.downloadCertificateImage();
    });
    document.getElementById('btn-print-cert').addEventListener('click', () => {
      window.print();
    });
    document.getElementById('cert-student-name').addEventListener('input', () => {
      this.renderCertificate();
    });

    // 12. 背包清空
    document.getElementById('btn-reset-backpack').addEventListener('click', () => {
      if (confirm('確定要清空背包道具嗎？')) {
        localStorage.removeItem('ddjh_backpack');
        if (this.callbacks.onBackpackReset) this.callbacks.onBackpackReset();
        this.renderBackpack();
        this.showToast('🗑️ 背包已重置');
      }
    });

    // 13. 通用彈出視窗關閉按鈕
    this.container.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('open');
      });
    });

    // 點擊彈窗遮罩關閉
    this.container.querySelectorAll('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    // 鍵盤快捷鍵 (Esc 關閉所有面板, Ctrl+F 搜尋)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDrawer();
        this.closeNPCBubble();
        this.container.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('open'));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.openModal('modal-search');
        document.getElementById('search-input').focus();
      }
    });
  }

  // 套用主題
  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ddjh_theme', theme);

    this.container.querySelectorAll('.theme-pill-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });

    if (this.callbacks.onThemeChange) {
      this.callbacks.onThemeChange(theme);
    }
  }

  // 設定日夜模式
  setDayNightMode(mode) {
    if (mode === 'auto') {
      this.autoDayNight = true;
    } else if (mode === 'realtime') {
      this.autoDayNight = false;
      const now = new Date();
      this.timeOfDay = now.getHours() + now.getMinutes() / 60;
      this.applyDayNightFromHour(this.timeOfDay);
    } else {
      this.autoDayNight = false;
      this.currentDayNight = mode;
      this.callbacks.onDayNightChange(mode);
      this.updateClockDisplay();
    }
  }

  // 時鐘循環
  startClockLoop() {
    setInterval(() => {
      if (this.autoDayNight) {
        // 每 2.5 分鐘循環 24 小時
        this.timeOfDay = (this.timeOfDay + 0.16) % 24;
        this.applyDayNightFromHour(this.timeOfDay);
      }
      this.updateClockDisplay();
    }, 1000);
  }

  applyDayNightFromHour(hour) {
    let mode = 'day';
    if (hour >= 5 && hour < 17) {
      mode = 'day';
    } else if (hour >= 17 && hour < 19.5) {
      mode = 'dusk';
    } else {
      mode = 'night';
    }
    if (mode !== this.currentDayNight) {
      this.currentDayNight = mode;
      this.callbacks.onDayNightChange(mode);
    }
  }

  updateClockDisplay() {
    const clockTime = document.getElementById('clock-time');
    const clockSymbol = document.getElementById('clock-symbol');
    const clockStatus = document.getElementById('clock-status');
    if (!clockTime) return;

    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay % 1) * 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    clockTime.textContent = timeStr;

    if (this.currentDayNight === 'day') {
      clockSymbol.textContent = '☀️';
      clockStatus.textContent = '晴空萬里 ‧ 白晝';
    } else if (this.currentDayNight === 'dusk') {
      clockSymbol.textContent = '🌇';
      clockStatus.textContent = '金黃夕陽 ‧ 黃昏';
    } else {
      clockSymbol.textContent = '🌙';
      clockStatus.textContent = '星光閃爍 ‧ 夜晚';
    }
  }

  // 吐司通知
  showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // 開啟島嶼內容抽屜
  openIslandDrawer(islandId) {
    const isCenter = islandId === 'island-center';
    const island = isCenter
      ? this.data.centerIsland
      : this.data.islands.find((i) => i.id === islandId);

    if (!island) return;
    this.activeIsland = island;
    this.closeNPCBubble();

    // 標記探索進度
    this.visitedIslands.add(island.id);
    localStorage.setItem('ddjh_visited', JSON.stringify([...this.visitedIslands]));
    this.updateProgressHUD();

    // 更新標題與徽章
    document.getElementById('drawer-group-badge').textContent = island.group;
    document.getElementById('drawer-order-badge').textContent = isCenter ? '總複習核心' : `第 ${island.order} 課`;
    document.getElementById('drawer-title').textContent = island.name;
    document.getElementById('drawer-intro').textContent = island.intro;

    this.renderDrawerBody();

    // 展開抽屜
    document.getElementById('drawer-backdrop').classList.add('active');
    document.getElementById('content-drawer').classList.add('open');
    document.getElementById('content-drawer').setAttribute('aria-hidden', 'false');

    // 視角平滑移至該島
    this.callbacks.onFlyToIsland(island.id);
  }

  closeDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('active');
    document.getElementById('content-drawer').classList.remove('open');
    document.getElementById('content-drawer').setAttribute('aria-hidden', 'true');
    this.activeIsland = null;
  }

  // 渲染抽屜三核心分頁 (references/island-type.md)
  renderDrawerBody() {
    const body = document.getElementById('drawer-body');
    if (!this.activeIsland) return;
    const isCenter = this.activeIsland.id === 'island-center';

    if (isCenter) {
      this.renderCenterReviewBody(body);
      return;
    }

    if (this.activeTab === 'material') {
      // 1. 學習教材分頁
      let contentHtml = `
        <div class="info-section-card">
          <h3>🎯 學習目標</h3>
          <p>${this.activeIsland.extra}</p>
        </div>

        <div class="info-section-card">
          <h3>📌 課程核心重點</h3>
          <ul class="info-points-list">
            ${this.activeIsland.points.map((p) => `<li>${p}</li>`).join('')}
          </ul>
        </div>
      `;

      if (this.activeIsland.detailedContent) {
        this.activeIsland.detailedContent.forEach((sec) => {
          contentHtml += `
            <div class="info-section-card">
              <h3>${sec.title}</h3>
              <p style="white-space: pre-line;">${sec.text}</p>
            </div>
          `;
        });
      }

      if (this.activeIsland.material) {
        contentHtml += `
          <div class="info-section-card">
            <h3>🖼️ 官方操作海報指引</h3>
            <div class="material-preview-box">
              <img src="${this.activeIsland.material}" alt="${this.activeIsland.name}" class="material-img" onclick="window.open('${this.activeIsland.material}', '_blank')">
              <div style="font-size: 0.78rem; color: var(--muted); margin-top: 6px;">點擊圖片可放大檢視或儲存原圖</div>
            </div>
          </div>
        `;
      }

      if (this.activeIsland.link) {
        contentHtml += `
          <div>
            <a href="${this.activeIsland.link}" target="_blank" rel="noopener noreferrer" class="external-link-btn">
              🔗 前往系統官方登入入口 ➔
            </a>
          </div>
        `;
      }

      body.innerHTML = contentHtml;
    } else if (this.activeTab === 'quiz') {
      // 2. 隨堂測驗分頁
      const questions = this.activeIsland.quiz || [];
      const savedScore = this.quizScores[this.activeIsland.id];

      let quizHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.88rem; font-weight: 700;">共 ${questions.length} 題隨堂測驗</span>
          <span style="font-size: 0.82rem; color: var(--primary); font-weight: 700;">
            ${savedScore !== undefined ? `上次測驗得分：${savedScore} 分` : '尚未作答'}
          </span>
        </div>
      `;

      questions.forEach((q, idx) => {
        quizHtml += `
          <div class="quiz-card" data-qid="${q.id}">
            <div class="quiz-question-title">Q${idx + 1}. ${q.question}</div>
            <div class="quiz-options-group">
              ${q.options.map((opt) => `
                <div class="quiz-option-label" data-opt="${opt.id}">
                  <b>${opt.id}.</b> ${opt.text}
                </div>
              `).join('')}
            </div>
            <div class="quiz-explanation-box" id="explain-${q.id}">
              💡 <b>解析：</b>${q.explanation}
            </div>
          </div>
        `;
      });

      quizHtml += `
        <button class="btn-primary-action" id="btn-submit-quiz" style="width: 100%; justify-content: center;">
          送出測驗並計算成績 📝
        </button>
      `;

      body.innerHTML = quizHtml;
      this.bindQuizEvents(questions);
    } else if (this.activeTab === 'worksheet') {
      // 3. 實務學習單分頁 (支援草稿暫存與 Markdown 匯出)
      const worksheets = this.activeIsland.worksheet || [];
      const drafts = this.worksheetDrafts[this.activeIsland.id] || {};

      let wsHtml = `
        <div style="font-size: 0.86rem; color: var(--muted); margin-bottom: 10px;">
          ✍️ 填寫實務學習單，輸入內容自動存檔於本機瀏覽器。完成後可點擊下方按鈕匯出 Markdown 筆記。
        </div>
      `;

      worksheets.forEach((w, idx) => {
        const val = drafts[w.id] || '';
        wsHtml += `
          <div class="worksheet-card">
            <div class="worksheet-prompt">第 ${idx + 1} 題：${w.question}</div>
            <textarea class="worksheet-textarea" data-wid="${w.id}" placeholder="${w.placeholder}">${val}</textarea>
            <div class="worksheet-tools">
              <span class="draft-status-tip" id="draft-tip-${w.id}">已自動暫存</span>
            </div>
          </div>
        `;
      });

      wsHtml += `
        <button class="btn-primary-action" id="btn-export-markdown" style="width: 100%; justify-content: center;">
          📥 匯出個人學習單 Markdown 筆記
        </button>
      `;

      body.innerHTML = wsHtml;
      this.bindWorksheetEvents();
    }
  }

  // 中央總複習島專屬面板 (抽驗 6 題跨課測驗)
  renderCenterReviewBody(body) {
    const reviewQuestions = this.data.reviewQuiz || [];
    const savedScore = this.quizScores['island-center'];

    let html = `
      <div class="info-section-card" style="background: linear-gradient(135deg, rgba(44,109,181,0.08), rgba(242,179,61,0.12));">
        <h3>🧪 Hank 老師的總複習大挑戰</h3>
        <p>
          結合全校數位行政五大島嶼的核心密碼，並融入自然科學實驗探究精神！
          本題庫隨機抽取跨課難題，檢驗你的全方位數位與科學素養！
        </p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0;">
        <span style="font-size: 0.88rem; font-weight: 700;">總複習測驗（共 ${reviewQuestions.length} 題）</span>
        <span style="font-size: 0.85rem; color: var(--accent-text); font-weight: 800;">
          ${savedScore !== undefined ? `目前最高分：${savedScore} 分` : '尚未挑戰'}
        </span>
      </div>
    `;

    reviewQuestions.forEach((q, idx) => {
      html += `
        <div class="quiz-card" data-qid="${q.id}">
          <div style="font-size: 0.72rem; color: var(--primary); font-weight: 700; margin-bottom: 4px;">[出自：${q.sourceName}]</div>
          <div class="quiz-question-title">Q${idx + 1}. ${q.question}</div>
          <div class="quiz-options-group">
            ${q.options.map((opt) => `
              <div class="quiz-option-label" data-opt="${opt.id}">
                <b>${opt.id}.</b> ${opt.text}
              </div>
            `).join('')}
          </div>
          <div class="quiz-explanation-box" id="explain-${q.id}">
            💡 <b>解析：</b>${q.explanation}
          </div>
        </div>
      `;
    });

    html += `
      <button class="btn-primary-action" id="btn-submit-review" style="width: 100%; justify-content: center; margin-top: 10px;">
        送出總複習考卷並解鎖證書 🏆
      </button>
    `;

    body.innerHTML = html;
    this.bindReviewQuizEvents(reviewQuestions);
  }

  // 隨堂測驗互動事件綁定
  bindQuizEvents(questions) {
    const selectedAnswers = {};
    const body = document.getElementById('drawer-body');

    body.querySelectorAll('.quiz-option-label').forEach((label) => {
      label.addEventListener('click', () => {
        const card = label.closest('.quiz-card');
        const qid = card.dataset.qid;
        card.querySelectorAll('.quiz-option-label').forEach((l) => l.classList.remove('selected'));
        label.classList.add('selected');
        selectedAnswers[qid] = label.dataset.opt;
      });
    });

    const submitBtn = document.getElementById('btn-submit-quiz');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        let correctCount = 0;
        questions.forEach((q) => {
          const card = body.querySelector(`.quiz-card[data-qid="${q.id}"]`);
          const chosen = selectedAnswers[q.id];
          const explainBox = card.querySelector(`#explain-${q.id}`);
          explainBox.style.display = 'block';

          card.querySelectorAll('.quiz-option-label').forEach((l) => {
            if (l.dataset.opt === q.answer) {
              l.classList.add('correct');
            } else if (l.dataset.opt === chosen && chosen !== q.answer) {
              l.classList.add('wrong');
            }
          });

          if (chosen === q.answer) correctCount++;
        });

        const score = Math.round((correctCount / questions.length) * 100);
        this.quizScores[this.activeIsland.id] = score;
        localStorage.setItem('ddjh_quiz_scores', JSON.stringify(this.quizScores));
        this.updateProgressHUD();
        this.showToast(`🎉 測驗完成！本次得分：${score} 分（答對 ${correctCount}/${questions.length} 題）`);
      });
    }
  }

  // 總複習測驗事件綁定
  bindReviewQuizEvents(questions) {
    const selectedAnswers = {};
    const body = document.getElementById('drawer-body');

    body.querySelectorAll('.quiz-option-label').forEach((label) => {
      label.addEventListener('click', () => {
        const card = label.closest('.quiz-card');
        const qid = card.dataset.qid;
        card.querySelectorAll('.quiz-option-label').forEach((l) => l.classList.remove('selected'));
        label.classList.add('selected');
        selectedAnswers[qid] = label.dataset.opt;
      });
    });

    const submitBtn = document.getElementById('btn-submit-review');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        let correctCount = 0;
        questions.forEach((q) => {
          const card = body.querySelector(`.quiz-card[data-qid="${q.id}"]`);
          const chosen = selectedAnswers[q.id];
          const explainBox = card.querySelector(`#explain-${q.id}`);
          explainBox.style.display = 'block';

          card.querySelectorAll('.quiz-option-label').forEach((l) => {
            if (l.dataset.opt === q.answer) {
              l.classList.add('correct');
            } else if (l.dataset.opt === chosen && chosen !== q.answer) {
              l.classList.add('wrong');
            }
          });

          if (chosen === q.answer) correctCount++;
        });

        const score = Math.round((correctCount / questions.length) * 100);
        this.quizScores['island-center'] = score;
        localStorage.setItem('ddjh_quiz_scores', JSON.stringify(this.quizScores));
        this.updateProgressHUD();

        if (score >= 60) {
          this.showToast(`🌟 恭喜合格！總複習測驗得分：${score} 分！已解鎖榮譽修業證書！`);
          setTimeout(() => {
            this.openModal('modal-certificate');
            this.renderCertificate();
          }, 1000);
        } else {
          this.showToast(`總複習得分：${score} 分。建議再複習各島教材後重新挑戰喔！`);
        }
      });
    }
  }

  // 學習單輸入自動暫存與匯出
  bindWorksheetEvents() {
    const body = document.getElementById('drawer-body');
    body.querySelectorAll('.worksheet-textarea').forEach((ta) => {
      ta.addEventListener('input', (e) => {
        const wid = ta.dataset.wid;
        const islandId = this.activeIsland.id;
        if (!this.worksheetDrafts[islandId]) this.worksheetDrafts[islandId] = {};
        this.worksheetDrafts[islandId][wid] = e.target.value;
        localStorage.setItem('ddjh_worksheet_drafts', JSON.stringify(this.worksheetDrafts));

        const tip = document.getElementById(`draft-tip-${wid}`);
        if (tip) tip.textContent = '已儲存草稿 ✓';
      });
    });

    const exportBtn = document.getElementById('btn-export-markdown');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportWorksheetMarkdown();
      });
    }
  }

  // 匯出 Markdown 筆記 (references/island-type.md)
  exportWorksheetMarkdown() {
    const island = this.activeIsland;
    const drafts = this.worksheetDrafts[island.id] || {};
    let md = `# 大墩元素週期島 ‧ 學習單筆記\n\n`;
    md += `**課程**：${island.name}（${island.group}）\n`;
    md += `**導師**：${this.data.site.author}\n`;
    md += `**匯出日期**：${new Date().toLocaleDateString('zh-TW')}\n\n`;
    md += `## 課程重點回顧\n\n`;
    island.points.forEach((p) => {
      md += `- ${p}\n`;
    });
    md += `\n## 實務學習單回答\n\n`;
    (island.worksheet || []).forEach((w, idx) => {
      const ans = drafts[w.id] || '（尚未作答）';
      md += `### 第 ${idx + 1} 題：${w.question}\n\n${ans}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${island.name}_學習單筆記.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('📥 學習單 Markdown 筆記已成功匯出！');
  }

  // 居民對話泡泡管理
  openNPCBubble(npcData, screenPos) {
    this.currentNPC = npcData;
    this.quoteIndex = 0;

    const bubble = document.getElementById('npc-bubble');
    document.getElementById('bubble-name').textContent = npcData.name;
    document.getElementById('bubble-role').textContent = `${npcData.role} ‧ ${npcData.islandName}`;
    document.getElementById('bubble-quote').textContent = npcData.quotes[0];

    const avatarBadge = document.getElementById('bubble-avatar');
    if (avatarBadge) {
      if (npcData.id === 'npc-center-01' || npcData.name.includes('Hank')) {
        avatarBadge.style.padding = '0';
        avatarBadge.style.overflow = 'hidden';
        avatarBadge.innerHTML = '<img src="hank_mascot.png?v=2.1" alt="Hank 老師" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; border-radius: 50%;">';
      } else {
        avatarBadge.textContent = '🧑‍🏫';
      }
    }

    // 更新交易按鈕文字
    const tradeBtn = document.getElementById('bubble-trade-btn');
    if (npcData.trade) {
      tradeBtn.style.display = 'inline-flex';
      tradeBtn.title = npcData.trade.hint;
    } else {
      tradeBtn.style.display = 'none';
    }

    bubble.style.left = `${screenPos.x}px`;
    bubble.style.top = `${screenPos.y}px`;
    bubble.style.display = 'block';
  }

  closeNPCBubble() {
    const bubble = document.getElementById('npc-bubble');
    if (bubble) bubble.style.display = 'none';
    this.currentNPC = null;
    if (this.options && this.options.onCloseNPC) {
      this.options.onCloseNPC();
    }
  }

  cycleNPCQuote() {
    if (!this.currentNPC || !this.currentNPC.quotes) return;
    this.quoteIndex = (this.quoteIndex + 1) % this.currentNPC.quotes.length;
    document.getElementById('bubble-quote').textContent = this.currentNPC.quotes[this.quoteIndex];
  }

  // 居民交易交換
  executeNPCTrade() {
    if (!this.currentNPC || !this.currentNPC.trade) return;
    const trade = this.currentNPC.trade;
    const backpack = this.callbacks.getBackpack();

    const curCount = backpack[trade.needs] || 0;
    if (curCount < trade.needsCount) {
      const needItem = this.data.items.find((i) => i.id === trade.needs);
      this.showToast(`❌ 道具不足！需要 ${trade.needsCount} 個【${needItem ? needItem.name : trade.needs}】才能交換喔！`);
      return;
    }

    // 扣除並給予
    this.callbacks.removeItem(trade.needs, trade.needsCount);
    this.callbacks.addItem(trade.gives, trade.givesCount || 1);

    const giveItem = this.data.items.find((i) => i.id === trade.gives);
    this.showToast(`🎉 交易成功！獲得了【${giveItem ? giveItem.name : trade.gives}】！已存入背包`);
    this.closeNPCBubble();
  }

  // 渲染背包道具視窗
  renderBackpack() {
    const grid = document.getElementById('inventory-grid');
    const backpack = this.callbacks.getBackpack();
    const items = this.data.items;

    let html = '';
    items.forEach((item) => {
      const count = backpack[item.id] || 0;
      html += `
        <div class="inventory-slot" style="${count === 0 ? 'opacity: 0.45;' : ''}" title="${item.desc}">
          <div class="item-icon">${item.icon}</div>
          <div class="item-name">${item.name}</div>
          <div style="font-size: 0.7rem; color: var(--muted); margin-top: 4px;">${count > 0 ? '已收集' : '未獲得'}</div>
          ${count > 0 ? `<div class="item-count">${count}</div>` : ''}
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  // 地點清單渲染 (references/island-type.md 無 3D 亦可全覽)
  renderPlacesList() {
    const container = document.getElementById('places-list-container');
    const allIslands = [this.data.centerIsland, ...this.data.islands];

    let html = '';
    allIslands.forEach((island) => {
      const isVisited = this.visitedIslands.has(island.id);
      const score = this.quizScores[island.id];
      html += `
        <div class="island-list-item" data-id="${island.id}">
          <div>
            <div style="font-size: 0.74rem; font-weight: 700; color: var(--primary); margin-bottom: 2px;">
              ${island.group} ‧ ${island.id === 'island-center' ? '總複習核心' : `第 ${island.order} 課`}
            </div>
            <div style="font-size: 1.0rem; font-weight: 800;">${island.name}</div>
            <div style="font-size: 0.8rem; color: var(--muted); margin-top: 4px;">${island.intro}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0; margin-left: 14px;">
            <span class="drawer-badge" style="${isVisited ? 'background: #ecfdf5; color: #065f46;' : 'background: #f1f5f9; color: #64748b;'}">
              ${isVisited ? '已探索 ✓' : '未解鎖'}
            </span>
            ${score !== undefined ? `<div style="font-size: 0.74rem; color: var(--accent-text); font-weight: 700; margin-top: 4px;">測驗：${score}分</div>` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.querySelectorAll('.island-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.closeModal('modal-places');
        this.openIslandDrawer(item.dataset.id);
      });
    });
  }

  // 搜尋功能
  handleSearch(query) {
    const list = document.getElementById('search-results-list');
    const q = query.trim().toLowerCase();
    if (!q) {
      list.innerHTML = '';
      return;
    }

    const allIslands = [this.data.centerIsland, ...this.data.islands];
    const results = [];

    allIslands.forEach((island) => {
      let matched = false;
      let matchedSnippet = '';

      if (island.name.toLowerCase().includes(q)) {
        matched = true;
        matchedSnippet = `島嶼名稱：${island.name}`;
      } else if (island.intro.toLowerCase().includes(q)) {
        matched = true;
        matchedSnippet = island.intro;
      } else if (island.points && island.points.some((p) => p.toLowerCase().includes(q))) {
        matched = true;
        matchedSnippet = island.points.find((p) => p.toLowerCase().includes(q));
      }

      if (matched) results.push({ island, snippet: matchedSnippet });
    });

    if (results.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 20px;">找不到符合「${query}」的內容</div>`;
      return;
    }

    list.innerHTML = results.map((r) => `
      <div class="island-list-item" data-id="${r.island.id}">
        <div>
          <div style="font-size: 0.95rem; font-weight: 800;">${r.island.name}</div>
          <div style="font-size: 0.8rem; color: var(--primary); margin-top: 2px;">🔍 匹配重點：${r.snippet}</div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.island-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.closeModal('modal-search');
        this.openIslandDrawer(item.dataset.id);
      });
    });
  }

  // 產生並繪製修業證書 (HTML5 Canvas)
  renderCertificate() {
    const canvas = document.getElementById('cert-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const studentName = document.getElementById('cert-student-name').value || '大墩探索學員';

    // 背景金黃與學院藍雙色漸層邊框
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 380);

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2c6db5';
    ctx.strokeRect(8, 8, 584, 364);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f2b33d';
    ctx.strokeRect(16, 16, 568, 348);

    // 頂部標題
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 22px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('臺中市立大墩國民中學', 300, 52);

    ctx.fillStyle = '#2c6db5';
    ctx.font = 'bold 26px "Microsoft JhengHei", sans-serif';
    ctx.fillText('大墩元素週期島 ‧ 數位與自然科探索修業證書', 300, 90);

    // 內文
    ctx.fillStyle = '#475569';
    ctx.font = '16px "Microsoft JhengHei", sans-serif';
    ctx.fillText(`茲證明學員`, 300, 130);

    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 28px "Microsoft JhengHei", sans-serif';
    ctx.fillText(studentName, 300, 172);

    ctx.fillStyle = '#334155';
    ctx.font = '15px "Microsoft JhengHei", sans-serif';
    ctx.fillText('已全數修畢群島之數位行政連線、校園 Wi-Fi 排障、單一簽入驗證、', 300, 212);
    ctx.fillText('光影折射成像與理化實驗室跨領域探究課程，表現優異，特頒此證。', 300, 238);

    // 底部資訊
    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`發證日期：${new Date().toLocaleDateString('zh-TW')}`, 40, 320);
    ctx.fillText(`驗證代碼：DDJH-${Math.abs(studentName.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase()}`, 40, 342);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px "Microsoft JhengHei", sans-serif';
    ctx.fillText('指導老師：Teacher Hank 簽署 ✍️', 560, 335);

    // 金色印章
    ctx.beginPath();
    ctx.arc(420, 280, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(242, 179, 61, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#f2b33d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 12px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('大墩核可', 420, 284);

    // 繪製 Hank 老師手繪吉祥物
    if (!this.hankMascotImg) {
      this.hankMascotImg = new Image();
      this.hankMascotImg.src = 'hank_mascot.png?v=2.1';
      this.hankMascotImg.onload = () => this.renderCertificate();
    } else if (this.hankMascotImg.complete && this.hankMascotImg.naturalWidth > 0) {
      ctx.drawImage(this.hankMascotImg, 485, 235, 78, 86);
    }
  }

  downloadCertificateImage() {
    const canvas = document.getElementById('cert-canvas');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `大墩元素週期島_修業證書.png`;
    a.click();
    this.showToast('💾 證書圖片已成功下載！');
  }

  // 接關碼生成與還原 (references/island-type.md Base64)
  generateSaveCode() {
    const payload = {
      v: [...this.visitedIslands],
      q: this.quizScores,
      b: this.callbacks.getBackpack(),
      t: Date.now()
    };
    const code = btoa(encodeURIComponent(JSON.stringify(payload)));
    const input = document.getElementById('save-code-input');
    if (input) input.value = code;
  }

  importSaveCode(code) {
    try {
      const decoded = decodeURIComponent(atob(code));
      const payload = JSON.parse(decoded);
      if (payload.v && payload.q) {
        this.visitedIslands = new Set(payload.v);
        this.quizScores = payload.q;
        localStorage.setItem('ddjh_visited', JSON.stringify(payload.v));
        localStorage.setItem('ddjh_quiz_scores', JSON.stringify(payload.q));
        if (payload.b) {
          localStorage.setItem('ddjh_backpack', JSON.stringify(payload.b));
        }
        this.updateProgressHUD();
        this.showToast('🎉 進度還原成功！已同步學習紀錄與背包');
        this.closeModal('modal-certificate');
      } else {
        throw new Error();
      }
    } catch (e) {
      alert('接關碼格式不正確，請重新檢查！');
    }
  }

  // 更新 HUD 進度條
  updateProgressHUD() {
    const total = this.data.islands.length + 1;
    const completed = this.visitedIslands.size;
    const percent = Math.min(100, Math.round((completed / total) * 100));

    const text = document.getElementById('hud-progress-text');
    const fill = document.getElementById('hud-progress-fill');
    if (text) text.textContent = `${completed} / ${total} 島完成 (${percent}%)`;
    if (fill) fill.style.width = `${percent}%`;
  }

  // Web Audio 程序化 Lo-Fi 輕晶片微風音樂
  initAudioSynth() {
    this.audioCtx = null;
    this.melodyInterval = null;
  }

  toggleAudio() {
    const btn = document.getElementById('btn-bgm');
    if (this.audioPlaying) {
      this.stopAudio();
      btn.style.color = 'var(--ink)';
      this.showToast('🔇 已關閉微風音樂');
    } else {
      this.startAudio();
      btn.style.color = 'var(--primary)';
      this.showToast('🎵 已開啟微風 Lo-Fi 音樂（純程式合成）');
    }
  }

  startAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.audioPlaying = true;

      // 輕快琶音音符頻率 (C Major Pentatonic: C4, D4, E4, G4, A4, C5)
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      let noteIdx = 0;

      this.melodyInterval = setInterval(() => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        const freq = notes[noteIdx % notes.length];
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.8);

        noteIdx = (noteIdx + Math.floor(Math.random() * 2) + 1);
      }, 420);
    } catch (e) {
      console.warn('Web Audio 初始化受瀏覽器政策限制');
    }
  }

  stopAudio() {
    if (this.melodyInterval) clearInterval(this.melodyInterval);
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.audioPlaying = false;
  }

  // 減少動態開關
  toggleReducedMotion() {
    this.reducedMotion = !this.reducedMotion;
    document.body.classList.toggle('reduced-motion', this.reducedMotion);
    const btn = document.getElementById('btn-reduced-motion');
    btn.style.color = this.reducedMotion ? 'var(--accent)' : 'var(--ink)';
    this.callbacks.onReducedMotionToggle(this.reducedMotion);
    this.showToast(this.reducedMotion ? '⏸️ 已開啟「減少動態模式」' : '▶️ 已恢復正常動態效果');
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  }
}
