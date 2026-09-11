// ============================================================
// 메인 게임 로직 (클래식 / 무한 모드 분기)
// ============================================================
const Game = {
  canvas: null,
  ctx: null,
  packets: [],
  powerups: [],
  activePowerups: {},
  state: {
    running: false,
    paused: false,
    finished: false,
    autoPaused: false,
    pausedAt: 0,
    round: 1,
    totalScore: 0,
    score: 0,
    hp: CONFIG.INITIAL_HP,
    wave: 1,
    combo: 0,
    maxCombo: 0,
    comboTimeout: 0,
    blockedCount: 0,
    spawnTimer: 0,
    spawnRate: CONFIG.BASE_SPAWN_RATE,
    fallSpeed: CONFIG.BASE_FALL_SPEED,
    lastTime: 0,
    waveTimer: 0,
    playTime: 0,
    attackCounts: {},
    highscore: 0
  },
  mode: 'classic',
  gameLoopId: null,

  init() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  },

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 60;
  },

  // ✅ mode: 'classic' | 'endless' | 'crypto'
  start(mode = 'classic') {
    this.mode = mode;
    this.reset();

    // 저장값 로드
    const saved = Utils.loadFromStorage();
    this.state.highscore = Number.isFinite(saved['pd.highscore']) ? saved['pd.highscore'] : 0;
    AudioManager.muted = (saved['pd.muted'] === true);

    const totalGames = Number.isFinite(saved['pd.totalGames']) ? saved['pd.totalGames'] : 0;
    Utils.saveToStorage('pd.totalGames', totalGames + 1);

    this.state.running = true;
    this.state.paused = false;
    this.state.finished = false;
    this.state.lastTime = 0;

    UI.updateHUD(this.state);
    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  },

  reset() {
    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());
    this.packets = [];
    this.powerups = [];
    this.activePowerups = {};

    this.state = {
      running: false,
      paused: false,
      finished: false,
      autoPaused: false,
      pausedAt: 0,
      round: 1,
      totalScore: 0,
      score: 0,
      hp: CONFIG.INITIAL_HP,
      wave: 1,
      combo: 0,
      maxCombo: 0,
      comboTimeout: 0,
      blockedCount: 0,
      spawnTimer: 0,
      spawnRate: CONFIG.BASE_SPAWN_RATE,
      fallSpeed: CONFIG.BASE_FALL_SPEED,
      lastTime: 0,
      waveTimer: 0,
      playTime: 0,
      attackCounts: {},
      highscore: 0
    };

    Firewall.reset();
    BossManager.reset();
    if (UI.renderFirewallBar) UI.renderFirewallBar();
  },

  resetRoundState() {
    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());
    this.packets = [];
    this.powerups = [];
    this.activePowerups = {};

    this.state.score = 0;
    this.state.hp = CONFIG.INITIAL_HP;
    this.state.wave = 1;
    this.state.combo = 0;
    this.state.comboTimeout = 0;
    this.state.blockedCount = 0;
    this.state.spawnTimer = 0;
    this.state.waveTimer = 0;
    this.state.playTime = 0;
    this.state.attackCounts = {};

    BossManager.reset();
    Firewall.reset();
    if (UI.renderFirewallBar) UI.renderFirewallBar();
  },

  pause() {
    if (this.state.paused) return;
    this.state.paused = true;
    this.state.pausedAt = performance.now();
    this.state.autoPaused = true;
  },

  resume() {
    if (!this.state.paused) return;
    this.state.paused = false;
    this.state.autoPaused = false;
    this.state.lastTime = 0;
  },

  spawnPacket(forcedDef = null, isBossSpawn = false, atX = null) {
    if (!this.state.running || this.state.paused || this.state.finished) return;

    let def = forcedDef;
    let isEncrypted = false;

    if (!def) {
      const allDefs = Object.values(PACKET_TYPES);
      def = Utils.weightedRandom(allDefs);
      if (Math.random() < CONFIG.CRYPTO_PACKET_CHANCE) {
        isEncrypted = true;
      }
    }

    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    const maxX = gameArea.clientWidth - 180;
    const x = atX !== null ? Math.max(20, Math.min(maxX, atX - 60)) : Utils.randInt(20, Math.max(20, maxX));
    const y = -50;

    const packet = new Packet(x, y, def, {
      encrypted: isEncrypted,
      isBoss: isBossSpawn
    });

    packet.speedMultiplier = this.state.fallSpeed / CONFIG.BASE_FALL_SPEED;

    if (this.activePowerups.slow && Date.now() < this.activePowerups.slow) {
      packet.speedMultiplier *= 0.5;
    }

    packet.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlePacketClick(packet, e);
    });

    const layer = document.getElementById('packet-layer');
    if (layer) layer.appendChild(packet.el);
    this.packets.push(packet);

    if (def.isAttack) {
      this.state.attackCounts[def.type] = (this.state.attackCounts[def.type] || 0) + 1;
    }
  },

  spawnAttackAt(x, y) {
    const attackDefs = Object.values(PACKET_TYPES).filter(p => p.isAttack);
    const def = Utils.weightedRandom(attackDefs);
    this.spawnPacket(def, false, x);
  },

  spawnPowerUp() {
    if (Math.random() > CONFIG.POWERUP_CHANCE) return;
    const types = Object.keys(POWERUPS);
    const type = types[Utils.randInt(0, types.length - 1)];
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;

    const maxX = gameArea.clientWidth - 80;
    const x = Utils.randInt(20, Math.max(20, maxX));
    const y = -50;

    const pu = new PowerUp(x, y, type);
    pu.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.activatePowerUp(type);
      pu.destroy();
    });
    const layer = document.getElementById('powerup-layer');
    if (layer) layer.appendChild(pu.el);
    this.powerups.push(pu);
  },

  activatePowerUp(type) {
    const def = POWERUPS[type];
    this.activePowerups[type] = Date.now() + def.duration;
    try { AudioManager.powerup(); } catch (e) {}

    UI.showFloatText(
      window.innerWidth / 2 - 100,
      window.innerHeight / 2,
      `${def.icon} ${def.name}!`,
      def.color
    );

    this.renderPowerupIndicators();
  },

  renderPowerupIndicators() {
    let container = document.getElementById('powerup-indicators');
    const area = document.getElementById('game-area');
    if (!container && area) {
      container = Utils.createEl('div', 'powerup-indicator');
      container.id = 'powerup-indicators';
      area.appendChild(container);
    }
    if (!container) return;

    container.innerHTML = '';
    const now = Date.now();
    Object.keys(this.activePowerups).forEach(type => {
      const endTime = this.activePowerups[type];
      if (endTime > now) {
        const def = POWERUPS[type];
        const el = Utils.createEl('div', 'powerup-status');
        el.style.borderColor = def.color;
        el.style.color = def.color;
        el.innerHTML = `${def.icon} ${def.name} <span class="timer">${((endTime - now) / 1000).toFixed(1)}s</span>`;
        container.appendChild(el);
      }
    });
  },

  handlePacketClick(packet, event) {
    if (packet.resolved || !this.state.running || this.state.paused || this.state.finished) return;

    if (packet.encrypted) {
      this.pause();
      CryptoGame.start(packet, (result) => {
        this.resume();
        if (result.correct) {
          this.resolvePacket(packet, packet.isAttack);
        } else {
          this.resolvePacket(packet, !packet.isAttack);
        }
      });
      return;
    }

    this.resolvePacket(packet, packet.isAttack);
  },

  resolvePacket(packet, wasCorrectBlock) {
    if (packet.resolved) return;

    if (wasCorrectBlock) {
      packet.markBlocked();
      this.addScore(CONFIG.SCORE_PER_ATTACK_BLOCK);
      this.incrementCombo();
      this.state.blockedCount++;

      new Particle(packet.x + 40, packet.y + 20, '#00ff88', 10);
      UI.showFloatText(packet.x, packet.y, `+${CONFIG.SCORE_PER_ATTACK_BLOCK}`, '#00ff88');
      try { AudioManager.blockSuccess(); } catch (e) {}

      if (BossManager.active) {
        BossManager.hit(10);
      }
    } else {
      packet.markBlocked();
      this.addScore(CONFIG.SCORE_PENALTY_FALSE_POSITIVE);
      this.resetCombo();

      new Particle(packet.x + 40, packet.y + 20, '#ff3232', 8);
      UI.showFloatText(packet.x, packet.y, `${CONFIG.SCORE_PENALTY_FALSE_POSITIVE}`, '#ff3232');
      try { AudioManager.falsePositive(); } catch (e) {}
    }

    packet.destroy();
    UI.updateHUD(this.state);
  },

  handleServerReach(packet) {
    if (packet.resolved || this.state.finished) return;

    const hpDamage = CONFIG.HP_DAMAGE_PER_ATTACK;

    if (packet.isAttack) {
      packet.markPassed();
      this.state.hp -= hpDamage;
      this.resetCombo();
      UI.flashDamage();
      UI.showFloatText(packet.x, packet.y - 30, `-${hpDamage} HP`, '#ff3232');
      try { AudioManager.damage(); } catch (e) {}
      new Particle(packet.x + 40, packet.y, '#ff3232', 15);
    } else {
      packet.markPassed();
      this.addScore(CONFIG.SCORE_PER_LEGIT_PASS);
      UI.showFloatText(packet.x, packet.y - 30, `+${CONFIG.SCORE_PER_LEGIT_PASS}`, '#00ff88');
    }

    packet.destroy();
    UI.updateHUD(this.state);

    if (this.state.hp <= 0 && !this.state.finished) {
      this.state.finished = true;
      this.gameOver();
    }
  },

  addScore(amount) {
    let finalAmount = amount;
    if (this.activePowerups.double && Date.now() < this.activePowerups.double) {
      finalAmount *= 2;
    }
    this.state.score += finalAmount;
    if (this.state.score < 0) this.state.score = 0;

    if (this.state.score >= CONFIG.WIN_SCORE && !this.state.finished) {
      this.state.finished = true;
      this.win();
    }
  },

  incrementCombo() {
    this.state.combo++;
    this.state.comboTimeout = Date.now() + CONFIG.COMBO_TIMEOUT;
    if (this.state.combo > this.state.maxCombo) {
      this.state.maxCombo = this.state.combo;
    }
    if (this.state.combo >= 3 && this.state.combo % 3 === 0) {
      UI.showCombo(this.state.combo);
      try { AudioManager.combo(this.state.combo); } catch (e) {}
    }
    UI.updateHUD(this.state);
  },

  resetCombo() {
    this.state.combo = 0;
    UI.updateHUD(this.state);
  },

  updateWave() {
    this.state.wave++;
    this.state.spawnRate = Math.max(CONFIG.MIN_SPAWN_RATE, this.state.spawnRate - 100);
    this.state.fallSpeed = Math.min(CONFIG.MAX_FALL_SPEED, this.state.fallSpeed + 0.2);

    UI.showWaveTransition(this.state.wave);

    if (this.state.wave % CONFIG.BOSS_WAVE_INTERVAL === 0) {
      const bossIndex = Math.floor(this.state.wave / CONFIG.BOSS_WAVE_INTERVAL) - 1;
      BossManager.start(bossIndex, () => {
        this.addScore(500);
      });
    }
  },

  loop(timestamp) {
    if (!this.state.running) return;

    if (this.state.lastTime === 0) {
      this.state.lastTime = timestamp;
      this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    const rawDt = (timestamp - this.state.lastTime) / 16.67;
    const rawSec = (timestamp - this.state.lastTime) / 1000;

    const dt = Math.max(0, Math.min(rawDt, 3));
    const secondsElapsed = Math.max(0, Math.min(rawSec, CONFIG.MAX_FRAME_DELTA));

    this.state.lastTime = timestamp;

    if (!this.state.paused && !this.state.finished) {
      this.update(dt, secondsElapsed);
    }

    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  },

  update(dt, secondsElapsed) {
    const area = document.getElementById('game-area');
    if (!area) return;
    const serverY = area.clientHeight - CONFIG.SERVER_HEIGHT + 20;

    // ✅ [T02-C07] 30초 타이머 (모드 무관)
    this.state.playTime += secondsElapsed * 1000;
    if (this.state.playTime >= CONFIG.MAX_PLAY_TIME && !this.state.finished) {
      this.state.finished = true;
      this.gameOver();
      return;
    }

    Firewall.update(dt, secondsElapsed);

    if (this.state.combo > 0 && Date.now() > this.state.comboTimeout) {
      this.resetCombo();
    }

    this.state.spawnTimer += secondsElapsed * 1000;
    if (this.state.spawnTimer >= this.state.spawnRate) {
      this.state.spawnTimer = 0;
      this.spawnPacket();
      if (Math.random() < 0.5) this.spawnPowerUp();
    }

    BossManager.update(dt, (def, isBoss) => this.spawnPacket(def, isBoss));

    const now = Date.now();
    let powerupChanged = false;
    Object.keys(this.activePowerups).forEach(type => {
      if (this.activePowerups[type] <= now) {
        delete this.activePowerups[type];
        powerupChanged = true;
      }
    });
    if (powerupChanged || Object.keys(this.activePowerups).length > 0) {
      this.renderPowerupIndicators();
    }

    this.state.waveTimer += secondsElapsed * 1000;
    if (this.state.waveTimer >= CONFIG.WAVE_DURATION && !BossManager.active) {
      this.state.waveTimer = 0;
      this.updateWave();
    }

    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      if (p.dead || !p.el) {
        this.packets.splice(i, 1);
        continue;
      }

      if (!p.resolved && this.activePowerups.waf && Date.now() < this.activePowerups.waf) {
        if (p.isAttack) {
          p.resolved = true;
          p.markBlocked();
          this.addScore(5);
          this.state.blockedCount++;
          new Particle(p.x + 40, p.y + 20, '#00ccff', 8);
          UI.showFloatText(p.x, p.y, '+5 WAF', '#00ccff');
          p.destroy();
          continue;
        }
      }

      if (!p.resolved && Firewall.shouldAutoBlock(p)) {
        p.resolved = true;
        if (p.isAttack) {
          p.markBlocked();
          this.addScore(5);
          this.state.blockedCount++;
          UI.showFloatText(p.x, p.y, '+5 🔥', '#ff9632');
        } else {
          p.markBlocked();
          this.addScore(-3);
          UI.showFloatText(p.x, p.y, '-3 오탐', '#ff3232');
        }
        p.destroy();
        continue;
      }

      p.update(dt);

      if (p.y >= serverY) {
        this.handleServerReach(p);
        if (this.state.finished) return;
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (p.dead) {
        this.powerups.splice(i, 1);
        continue;
      }
      p.update(dt);
      if (p.y > serverY) {
        p.destroy();
        this.powerups.splice(i, 1);
      }
    }

    UI.updateHUD(this.state);
  },

  // ✅ 승리 처리 (모드 분기)
  win() {
    this.state.running = false;
    cancelAnimationFrame(this.gameLoopId);

    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());

    const modeConfig = CONFIG.GAME_MODES[this.mode] || {};

    // ✅ 무한 모드: 누적 점수 & 라운드 진행
    if (modeConfig.hasRounds) {
      this.state.totalScore += this.state.score;
      Utils.setHighScore(this.state.totalScore);

      const saved = Utils.loadFromStorage();
      const highestRound = Number.isFinite(saved['pd.highestRound']) ? saved['pd.highestRound'] : 1;
      if (this.state.round > highestRound) {
        Utils.saveToStorage('pd.highestRound', this.state.round);
      }

      try { AudioManager.win(); } catch (e) {}

      UI.showRoundClearScreen(this.state, () => this.nextRound());
    } else {
      // ✅ 클래식 모드: 1판 승리 → 종료
      Utils.setHighScore(this.state.score);
      try { AudioManager.win(); } catch (e) {}
      UI.showWinScreen(this.state);
    }
  },

  // ✅ 무한 모드 전용: 다음 라운드 시작
  nextRound() {
    const modeConfig = CONFIG.GAME_MODES[this.mode];
    if (!modeConfig || !modeConfig.hasRounds) return;

    const nextRoundNum = this.state.round + 1;
    const prevTotalScore = this.state.totalScore;
    const prevMaxCombo = this.state.maxCombo;

    this.resetRoundState();
    this.state.round = nextRoundNum;
    this.state.totalScore = prevTotalScore;
    this.state.maxCombo = prevMaxCombo;

    // 난이도 상승
    const diff = modeConfig.difficulty || {};
    const spawnDecrease = diff.spawnRateDecrease || 100;
    const speedIncrease = diff.fallSpeedIncrease || 0.2;

    this.state.spawnRate = Math.max(
      CONFIG.MIN_SPAWN_RATE,
      CONFIG.BASE_SPAWN_RATE - (nextRoundNum - 1) * spawnDecrease
    );
    this.state.fallSpeed = Math.min(
      CONFIG.MAX_FALL_SPEED,
      CONFIG.BASE_FALL_SPEED + (nextRoundNum - 1) * speedIncrease
    );

    this.state.running = true;
    this.state.paused = false;
    this.state.finished = false;
    this.state.lastTime = 0;

    UI.updateHUD(this.state);
    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  },

  gameOver() {
    if (!this.state.running) return;
    this.state.running = false;
    this.state.finished = true;
    cancelAnimationFrame(this.gameLoopId);

    let mostFrequent = 'general';
    let maxCount = 0;
    Object.entries(this.state.attackCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = type;
      }
    });
    this.state.mostFrequentAttack = mostFrequent;

    // ✅ 무한 모드: 누적 점수까지 합산
    const modeConfig = CONFIG.GAME_MODES[this.mode] || {};
    const finalScore = modeConfig.hasRounds
      ? this.state.totalScore + this.state.score
      : this.state.score;
    this.state.finalScore = finalScore;
    Utils.setHighScore(finalScore);

    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());

    try { AudioManager.gameOver(); } catch (e) {}
    UI.showGameOver(this.state);
  },

  stop() {
    this.state.running = false;
    cancelAnimationFrame(this.gameLoopId);
  }
};

window.Game = Game;