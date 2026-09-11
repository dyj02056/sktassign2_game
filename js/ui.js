// ============================================================
// UI 렌더링 및 모달 관리
// ============================================================
const UI = {
  elements: {},

  init() {
    this.elements = {
      score: document.getElementById('score'),
      wave: document.getElementById('wave'),
      combo: document.getElementById('combo'),
      hpBar: document.getElementById('hp-bar'),
      hpText: document.getElementById('hp-text'),
      overlay: document.getElementById('overlay'),
      packetLayer: document.getElementById('packet-layer'),
      powerupLayer: document.getElementById('powerup-layer'),
      effectsLayer: document.getElementById('effects-layer'),
      firewallModal: document.getElementById('firewall-modal'),
      logModal: document.getElementById('log-modal'),
      cryptoModal: document.getElementById('crypto-modal'),
      gameoverModal: document.getElementById('gameover-modal'),
      pauseModal: document.getElementById('pause-modal'),
      bossHpContainer: document.getElementById('boss-hp-container'),
      firewallBar: document.getElementById('firewall-bar'),
      firewallRules: document.getElementById('firewall-rules'),
      energyValue: document.getElementById('energy-value'),
      rulesList: document.getElementById('rules-list'),
      gameArea: document.getElementById('game-area')
    };

    // ✅ [T02-C24] 저장된 음소거 상태 반영
    const saved = Utils.loadFromStorage();
    if (saved['pd.muted']) {
      AudioManager.muted = true;
      const muteBtn = document.getElementById('mute-btn');
      if (muteBtn) muteBtn.textContent = '🔇';
    }

    this.bindEvents();
  },

  bindEvents() {
    const safeAdd = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    // 방화벽 버튼
    safeAdd('firewall-btn', 'click', () => this.toggleFirewall());
    // 로그 분석
    safeAdd('log-btn', 'click', () => this.startLogAnalysis());

    // ✅ [T02-C24] 음소거 토글 시 즉시 저장
    safeAdd('mute-btn', 'click', (e) => {
      const muted = AudioManager.toggleMute();
      e.currentTarget.textContent = muted ? '🔇' : '🔊';
      Utils.saveToStorage('pd.muted', muted);
    });

    // 일시정지
    safeAdd('pause-btn', 'click', () => this.togglePause());

    // 방화벽 규칙 추가
    safeAdd('add-rule-btn', 'click', () => {
      const typeEl = document.getElementById('rule-type');
      const valueEl = document.getElementById('rule-value');
      if (!typeEl || !valueEl) return;
      const type = typeEl.value;
      const value = valueEl.value;
      if (!value) return;
      const result = Firewall.addRule(type, value);
      if (result.success) {
        this.renderFirewallRules();
        valueEl.value = '';
      } else {
        alert(result.msg);
      }
    });

    // 모달 닫기
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.target.dataset.close;
        const target = document.getElementById(targetId);
        if (target) target.classList.add('hidden');
      });
    });

    // 다시 시작
    safeAdd('restart-btn', 'click', () => location.reload());
    safeAdd('resume-btn', 'click', () => this.togglePause());
    safeAdd('quit-btn', 'click', () => location.reload());

    // ✅ [T02-C14] 탭 전환 감지 (탭 전환만, 창 blur는 무시)
    document.addEventListener('visibilitychange', () => {
      if (!window.Game || !window.Game.state.running) return;

      if (document.hidden) {
        // 탭이 숨겨짐 → 자동 일시정지
        window.Game.pause();
      } else {
        // 탭이 다시 보임 → 일시정지 모달 표시 (사용자가 재개)
        if (window.Game.state.autoPaused) {
          UI.showAutoPauseModal();
        }
      }
    });

    // 단축키
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') this.toggleFirewall();
      if (e.key === 'l' || e.key === 'L') this.startLogAnalysis();
      if (e.key === 'p' || e.key === 'P') this.togglePause();
      if (e.key === 'Escape') this.closeAllModals();
    });
  },

  toggleFirewall() {
    const modal = this.elements.firewallModal;
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      this.renderFirewallRules();
    } else {
      modal.classList.add('hidden');
    }
  },

  renderFirewallRules() {
    const list = this.elements.rulesList;
    if (!list) return;
    list.innerHTML = '';

    if (Firewall.rules.length === 0) {
      list.innerHTML = '<div style="color:#ff963288;font-size:12px;text-align:center;padding:15px;">아직 규칙이 없습니다.</div>';
    }

    Firewall.rules.forEach(rule => {
      const item = Utils.createEl('div', 'rule-item');
      item.innerHTML = `
        <span>${RULE_TYPES[rule.type].label}: <b>${rule.value}</b></span>
        <button data-id="${rule.id}">삭제</button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        Firewall.removeRule(rule.id);
        this.renderFirewallRules();
        this.renderFirewallBar();
      });
      list.appendChild(item);
    });

    if (this.elements.energyValue) {
      this.elements.energyValue.textContent = Math.floor(Firewall.energy);
    }
    this.renderFirewallBar();
  },

  renderFirewallBar() {
    const bar = this.elements.firewallBar;
    const rules = this.elements.firewallRules;
    if (!bar || !rules) return;

    if (Firewall.rules.length === 0) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    rules.innerHTML = '';
    Firewall.rules.forEach(rule => {
      const chip = Utils.createEl('span', 'firewall-rule-chip',
        `${RULE_TYPES[rule.type].label}:${rule.value}`);
      rules.appendChild(chip);
    });
  },

  // ✅ [T02-C25] HUD 표시 시 NaN/Infinity 방어
  updateHUD(state) {
    if (!this.elements.score) return;

    const safeScore = Number.isFinite(state.score) ? Math.max(0, Math.floor(state.score)) : 0;
    const safeWave = Number.isFinite(state.wave) ? Math.max(1, Math.floor(state.wave)) : 1;
    const safeCombo = Number.isFinite(state.combo) ? Math.max(0, Math.floor(state.combo)) : 0;

    this.elements.score.textContent = safeScore;
    this.elements.wave.textContent = safeWave;
    if (this.elements.combo) this.elements.combo.textContent = `x${safeCombo}`;

    const safeHp = Number.isFinite(state.hp) ? Math.max(0, state.hp) : 0;
    const hpPercent = (safeHp / CONFIG.INITIAL_HP) * 100;

    if (this.elements.hpBar) {
      this.elements.hpBar.style.width = Math.max(0, hpPercent) + '%';
      if (hpPercent < 30) {
        this.elements.hpBar.style.background = 'linear-gradient(90deg, #ff3232, #ff6666)';
      } else if (hpPercent < 60) {
        this.elements.hpBar.style.background = 'linear-gradient(90deg, #ffcc00, #ffee66)';
      } else {
        this.elements.hpBar.style.background = 'linear-gradient(90deg, #00ff88, #00ffaa)';
      }
    }

    if (this.elements.hpText) {
      this.elements.hpText.textContent = `${Math.max(0, safeHp)} / ${CONFIG.INITIAL_HP}`;
    }

    const server = document.getElementById('server');
    if (server) {
      if (hpPercent < 30) server.classList.add('server-critical');
      else server.classList.remove('server-critical');
    }

    if (this.elements.firewallModal && !this.elements.firewallModal.classList.contains('hidden')) {
      if (this.elements.energyValue) {
        this.elements.energyValue.textContent = Math.floor(Firewall.energy);
      }
    }
  },

  showFloatText(x, y, text, color) {
    const ft = Utils.createEl('div', 'float-text', text);
    ft.style.left = x + 'px';
    ft.style.top = y + 'px';
    ft.style.color = color;
    if (this.elements.effectsLayer) {
      this.elements.effectsLayer.appendChild(ft);
    } else {
      document.body.appendChild(ft);
    }
    Utils.removeAfter(ft, 1200);
  },

  showCombo(combo) {
    if (combo < 3) return;
    const text = Utils.createEl('div', 'combo-text', `COMBO x${combo}!`);
    const area = this.elements.gameArea || document.body;
    area.appendChild(text);
    Utils.removeAfter(text, 800);
  },

  showWaveTransition(wave) {
    const el = Utils.createEl('div', 'wave-transition', `WAVE ${wave}`);
    const area = this.elements.gameArea || document.body;
    area.appendChild(el);
    Utils.removeAfter(el, 1500);
    try { AudioManager.waveStart(); } catch (e) {}
  },

  flashDamage() {
    let flash = document.getElementById('damage-flash');
    if (!flash) {
      flash = Utils.createEl('div');
      flash.id = 'damage-flash';
      (this.elements.gameArea || document.body).appendChild(flash);
    }
    flash.style.opacity = '0.35';
    setTimeout(() => flash.style.opacity = '0', 150);

    const area = this.elements.gameArea;
    if (area) {
      area.classList.add('shake');
      setTimeout(() => area.classList.remove('shake'), 300);
    }
  },

  togglePause() {
    if (!window.Game || !window.Game.state.running) return;
    const modal = this.elements.pauseModal;
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      const h2 = modal.querySelector('h2');
      if (h2) h2.textContent = '⏸️ 일시정지';
      window.Game.pause();
      window.Game.state.autoPaused = false;   // 수동 일시정지
    } else {
      modal.classList.add('hidden');
      window.Game.resume();
    }
  },

  // ✅ [T02-C14] 자동 일시정지 안내 모달
  showAutoPauseModal() {
    const modal = this.elements.pauseModal;
    if (!modal) return;
    modal.classList.remove('hidden');
    const h2 = modal.querySelector('h2');
    if (h2) h2.textContent = '⏸️ 자동 일시정지 (탭 이탈)';
  },

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  },

  // ✅ [T02-C07] 게임 오버 화면
  showGameOver(state) {
    const scoreEl = document.getElementById('final-score');
    const waveEl = document.getElementById('final-wave');
    const blockedEl = document.getElementById('final-blocked');
    const comboEl = document.getElementById('final-combo');

    if (scoreEl) scoreEl.textContent = state.score;
    if (waveEl) waveEl.textContent = state.wave;
    if (blockedEl) blockedEl.textContent = state.blockedCount;
    if (comboEl) comboEl.textContent = state.maxCombo;

    // 타이틀 원복 (승리 후 재시작 대비)
    const title = document.querySelector('.gameover-title');
    if (title) {
      title.textContent = '💀 서버 다운!';
      title.style.color = '';
      title.style.textShadow = '';
    }

    const tipEl = document.getElementById('education-tip');
    if (tipEl) {
      const mostFrequent = state.mostFrequentAttack || 'general';
      tipEl.textContent = EDUCATION_TIPS[mostFrequent] || EDUCATION_TIPS.general;
    }

    const modal = this.elements.gameoverModal;
    if (modal) modal.classList.remove('hidden');
  },

  // ✅ [T02-C07] 승리 화면 (신규)
  showWinScreen(state) {
    const scoreEl = document.getElementById('final-score');
    const waveEl = document.getElementById('final-wave');
    const blockedEl = document.getElementById('final-blocked');
    const comboEl = document.getElementById('final-combo');

    if (scoreEl) scoreEl.textContent = state.score;
    if (waveEl) waveEl.textContent = state.wave;
    if (blockedEl) blockedEl.textContent = state.blockedCount;
    if (comboEl) comboEl.textContent = state.maxCombo;

    // 타이틀 변경
    const title = document.querySelector('.gameover-title');
    if (title) {
      title.textContent = '🎉 미션 클리어!';
      title.style.color = '#00ff88';
      title.style.textShadow = '0 0 30px #00ff88';
    }

    const tipEl = document.getElementById('education-tip');
    if (tipEl) {
      tipEl.textContent = '💡 훌륭합니다! 실제 보안에서도 목표 시간 안에 위협을 차단하는 것이 핵심입니다.';
    }

    const modal = this.elements.gameoverModal;
    if (modal) modal.classList.remove('hidden');
  },

  startLogAnalysis() {
    if (!window.Game || !window.Game.state.running) return;
    window.Game.pause();
    LogAnalyzer.start((score) => {
      if (window.Game) {
        window.Game.state.score += score;
        window.Game.resume();
        UI.updateHUD(window.Game.state);
      }
    });
  }
};