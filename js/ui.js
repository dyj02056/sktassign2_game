// ============================================================
// UI 렌더링 및 모달 관리 (클래식 / 무한 모드 대응)
// ============================================================
const UI = {
  elements: {},

  init() {
    this.elements = {
      score: document.getElementById('score'),
      wave: document.getElementById('wave'),
      combo: document.getElementById('combo'),
      round: document.getElementById('round'),
      totalScore: document.getElementById('total-score'),
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

    safeAdd('firewall-btn', 'click', () => this.toggleFirewall());
    safeAdd('log-btn', 'click', () => this.startLogAnalysis());

    safeAdd('mute-btn', 'click', (e) => {
      const muted = AudioManager.toggleMute();
      e.currentTarget.textContent = muted ? '🔇' : '🔊';
      Utils.saveToStorage('pd.muted', muted);
    });

    safeAdd('pause-btn', 'click', () => this.togglePause());

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

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.target.dataset.close;
        const target = document.getElementById(targetId);
        if (target) target.classList.add('hidden');
      });
    });

    safeAdd('restart-btn', 'click', () => location.reload());
    safeAdd('resume-btn', 'click', () => this.togglePause());
    safeAdd('quit-btn', 'click', () => location.reload());

    document.addEventListener('visibilitychange', () => {
      if (!window.Game || !window.Game.state.running) return;
      if (document.hidden) {
        window.Game.pause();
      } else {
        if (window.Game.state.autoPaused) {
          UI.showAutoPauseModal();
        }
      }
    });

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

  updateHUD(state) {
    if (!this.elements.score) return;

    const safeScore = Number.isFinite(state.score) ? Math.max(0, Math.floor(state.score)) : 0;
    const safeWave = Number.isFinite(state.wave) ? Math.max(1, Math.floor(state.wave)) : 1;
    const safeCombo = Number.isFinite(state.combo) ? Math.max(0, Math.floor(state.combo)) : 0;
    const safeRound = Number.isFinite(state.round) ? Math.max(1, Math.floor(state.round)) : 1;
    const safeTotal = Number.isFinite(state.totalScore) ? Math.max(0, Math.floor(state.totalScore)) : 0;

    this.elements.score.textContent = safeScore;
    this.elements.wave.textContent = safeWave;
    if (this.elements.combo) this.elements.combo.textContent = `x${safeCombo}`;
    if (this.elements.round) this.elements.round.textContent = safeRound;
    if (this.elements.totalScore) this.elements.totalScore.textContent = safeTotal;

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
      window.Game.state.autoPaused = false;
    } else {
      modal.classList.add('hidden');
      window.Game.resume();
    }
  },

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

  // ✅ 클래식 모드 / 무한 모드 실패 화면
  showGameOver(state) {
    const scoreEl = document.getElementById('final-score');
    const waveEl = document.getElementById('final-wave');
    const blockedEl = document.getElementById('final-blocked');
    const comboEl = document.getElementById('final-combo');

    const modeConfig = CONFIG.GAME_MODES[window.Game.mode] || {};

    if (scoreEl) scoreEl.textContent = state.finalScore || state.score;
    if (waveEl) waveEl.textContent = modeConfig.hasRounds ? (state.round || 1) : (state.wave || 1);
    if (blockedEl) blockedEl.textContent = state.blockedCount;
    if (comboEl) comboEl.textContent = state.maxCombo;

    const title = document.querySelector('.gameover-title');
    if (title) {
      if (modeConfig.hasRounds) {
        title.textContent = `💀 라운드 ${state.round || 1} 실패!`;
      } else {
        title.textContent = '💀 서버 다운!';
      }
      title.style.color = '';
      title.style.textShadow = '';
    }

    const tipEl = document.getElementById('education-tip');
    if (tipEl) {
      const mostFrequent = state.mostFrequentAttack || 'general';
      const tip = EDUCATION_TIPS[mostFrequent] || EDUCATION_TIPS.general;
      let summary = '';
      if (modeConfig.hasRounds) {
        summary = `<div style="margin-bottom:10px;">도달 라운드: <b>${state.round || 1}</b> | 누적 점수: <b>${state.finalScore || state.score}</b></div>`;
      }
      tipEl.innerHTML = summary + tip;
    }

    // 버튼 초기화
    const oldBtn = document.getElementById('restart-btn');
    const nextBtn = document.getElementById('next-round-btn');
    const quitBtn = document.getElementById('quit-to-main-btn');
    if (oldBtn) {
      oldBtn.style.display = '';
      oldBtn.textContent = '🔄 다시 시작';
    }
    if (nextBtn) nextBtn.style.display = 'none';
    if (quitBtn) quitBtn.style.display = 'none';

    const modal = this.elements.gameoverModal;
    if (modal) modal.classList.remove('hidden');
  },

  // ✅ [클래식 모드] 승리 화면 (라운드 개념 없음)
  showWinScreen(state) {
    const scoreEl = document.getElementById('final-score');
    const waveEl = document.getElementById('final-wave');
    const blockedEl = document.getElementById('final-blocked');
    const comboEl = document.getElementById('final-combo');

    if (scoreEl) scoreEl.textContent = state.score;
    if (waveEl) waveEl.textContent = state.wave;
    if (blockedEl) blockedEl.textContent = state.blockedCount;
    if (comboEl) comboEl.textContent = state.maxCombo;

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

    // 버튼 초기화 (라운드 클리어에서 넘어온 경우 대비)
    const oldBtn = document.getElementById('restart-btn');
    const nextBtn = document.getElementById('next-round-btn');
    const quitBtn = document.getElementById('quit-to-main-btn');
    if (oldBtn) {
      oldBtn.style.display = '';
      oldBtn.textContent = '🔄 다시 시작';
    }
    if (nextBtn) nextBtn.style.display = 'none';
    if (quitBtn) quitBtn.style.display = 'none';

    const modal = this.elements.gameoverModal;
    if (modal) modal.classList.remove('hidden');
  },

  // ✅ [무한 모드] 라운드 클리어 화면
  showRoundClearScreen(state, onNextRound) {
    const modal = this.elements.gameoverModal;
    if (!modal) return;

    const title = modal.querySelector('.gameover-title');
    if (title) {
      title.textContent = `🎉 라운드 ${state.round} 클리어!`;
      title.style.color = '#00ff88';
      title.style.textShadow = '0 0 30px #00ff88';
    }

    const scoreEl = document.getElementById('final-score');
    const waveEl = document.getElementById('final-wave');
    const blockedEl = document.getElementById('final-blocked');
    const comboEl = document.getElementById('final-combo');

    if (scoreEl) scoreEl.textContent = state.score;
    if (waveEl) waveEl.textContent = state.round;
    if (blockedEl) blockedEl.textContent = state.blockedCount;
    if (comboEl) comboEl.textContent = state.maxCombo;

    const tipEl = document.getElementById('education-tip');
    if (tipEl) {
      const nextRoundNum = state.round + 1;
      tipEl.innerHTML = `
        <div style="font-size:16px; margin-bottom:10px;">
          누적 점수: <b style="color:#00ff88;">${state.totalScore}</b>
        </div>
        <div>
          ▶ 다음 라운드 <b>${nextRoundNum}</b>는 <b>더 어려워집니다</b>.<br>
          스폰 속도 ↑, 낙하 속도 ↑<br>
          <br>
          계속 도전하시겠어요? 아니면 여기서 마무리하시겠어요?
        </div>
      `;
    }

    const oldBtn = document.getElementById('restart-btn');
    if (oldBtn) oldBtn.style.display = 'none';

    let nextBtn = document.getElementById('next-round-btn');
    if (!nextBtn) {
      nextBtn = Utils.createEl('button', '', '▶ 다음 라운드');
      nextBtn.id = 'next-round-btn';
      nextBtn.style.marginRight = '10px';
      if (oldBtn && oldBtn.parentNode) {
        oldBtn.parentNode.insertBefore(nextBtn, oldBtn);
      }
    }
    nextBtn.style.display = '';
    nextBtn.onclick = () => {
      modal.classList.add('hidden');
      onNextRound();
    };

    let quitBtn = document.getElementById('quit-to-main-btn');
    if (!quitBtn) {
      quitBtn = Utils.createEl('button', '', '🏠 메인으로');
      quitBtn.id = 'quit-to-main-btn';
      if (oldBtn && oldBtn.parentNode) {
        oldBtn.parentNode.insertBefore(quitBtn, oldBtn);
      }
    }
    quitBtn.style.display = '';
    quitBtn.onclick = () => location.reload();

    modal.classList.remove('hidden');
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