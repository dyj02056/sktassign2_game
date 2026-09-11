// UI 렌더링 및 모달 관리
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

    this.bindEvents();
  },

  bindEvents() {
    // 방화벽 버튼
    document.getElementById('firewall-btn').addEventListener('click', () => this.toggleFirewall());
    // 로그 분석 버튼
    document.getElementById('log-btn').addEventListener('click', () => this.startLogAnalysis());
    // 음소거
    document.getElementById('mute-btn').addEventListener('click', (e) => {
      const muted = AudioManager.toggleMute();
      e.currentTarget.textContent = muted ? '🔇' : '🔊';
    });
    // 일시정지
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());

    // 방화벽 규칙 추가
    document.getElementById('add-rule-btn').addEventListener('click', () => {
      const type = document.getElementById('rule-type').value;
      const value = document.getElementById('rule-value').value;
      if (!value) return;
      const result = Firewall.addRule(type, value);
      if (result.success) {
        this.renderFirewallRules();
        document.getElementById('rule-value').value = '';
      } else {
        alert(result.msg);
      }
    });

    // 모달 닫기
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.target.dataset.close;
        document.getElementById(targetId).classList.add('hidden');
      });
    });

    // 다시 시작
    document.getElementById('restart-btn').addEventListener('click', () => location.reload());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('quit-btn').addEventListener('click', () => location.reload());

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
    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      this.renderFirewallRules();
    } else {
      modal.classList.add('hidden');
    }
  },

  renderFirewallRules() {
    const list = this.elements.rulesList;
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

    this.elements.energyValue.textContent = Math.floor(Firewall.energy);
    this.renderFirewallBar();
  },

  renderFirewallBar() {
    const bar = this.elements.firewallBar;
    const rules = this.elements.firewallRules;
    
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

  updateHUD(state) {
    this.elements.score.textContent = state.score;
    this.elements.wave.textContent = state.wave;
    this.elements.combo.textContent = `x${state.combo}`;
    
    const hpPercent = (state.hp / CONFIG.INITIAL_HP) * 100;
    this.elements.hpBar.style.width = Math.max(0, hpPercent) + '%';
    this.elements.hpText.textContent = `${Math.max(0, state.hp)} / ${CONFIG.INITIAL_HP}`;
    
    if (hpPercent < 30) {
      this.elements.hpBar.style.background = 'linear-gradient(90deg, #ff3232, #ff6666)';
    } else if (hpPercent < 60) {
      this.elements.hpBar.style.background = 'linear-gradient(90deg, #ffcc00, #ffee66)';
    } else {
      this.elements.hpBar.style.background = 'linear-gradient(90deg, #00ff88, #00ffaa)';
    }

    // 서버 위험 상태
    const server = document.getElementById('server');
    if (hpPercent < 30) server.classList.add('server-critical');
    else server.classList.remove('server-critical');

    // 방화벽 에너지 업데이트
    if (!this.elements.firewallModal.classList.contains('hidden')) {
      this.elements.energyValue.textContent = Math.floor(Firewall.energy);
    }
  },

  showFloatText(x, y, text, color) {
    const ft = Utils.createEl('div', 'float-text', text);
    ft.style.left = x + 'px';
    ft.style.top = y + 'px';
    ft.style.color = color;
    this.elements.effectsLayer.appendChild(ft);
    Utils.removeAfter(ft, 1200);
  },

  showCombo(combo) {
    if (combo < 3) return;
    const text = Utils.createEl('div', 'combo-text', `COMBO x${combo}!`);
    this.elements.gameArea.appendChild(text);
    Utils.removeAfter(text, 800);
  },

  showWaveTransition(wave) {
    const el = Utils.createEl('div', 'wave-transition', `WAVE ${wave}`);
    this.elements.gameArea.appendChild(el);
    Utils.removeAfter(el, 1500);
    AudioManager.waveStart();
  },

  flashDamage() {
    let flash = document.getElementById('damage-flash');
    if (!flash) {
      flash = Utils.createEl('div');
      flash.id = 'damage-flash';
      this.elements.gameArea.appendChild(flash);
    }
    flash.style.opacity = '0.35';
    setTimeout(() => flash.style.opacity = '0', 150);
    
    this.elements.gameArea.classList.add('shake');
    setTimeout(() => this.elements.gameArea.classList.remove('shake'), 300);
  },

  togglePause() {
    if (!window.Game || !window.Game.state.running) return;
    const modal = this.elements.pauseModal;
    if (modal.classList.contains('hidden')) {
      modal.classList.remove('hidden');
      window.Game.pause();
    } else {
      modal.classList.add('hidden');
      window.Game.resume();
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  },

  showGameOver(state) {
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-wave').textContent = state.wave;
    document.getElementById('final-blocked').textContent = state.blockedCount;
    document.getElementById('final-combo').textContent = state.maxCombo;

    // 교육 팁
    const tipEl = document.getElementById('education-tip');
    const mostFrequent = state.mostFrequentAttack || 'general';
    tipEl.textContent = EDUCATION_TIPS[mostFrequent] || EDUCATION_TIPS.general;

    this.elements.gameoverModal.classList.remove('hidden');
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