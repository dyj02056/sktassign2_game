// 메인 게임 로직
const Game = {
  canvas: null,
  ctx: null,
  packets: [],
  powerups: [],
  activePowerups: {},   // { type: endTime }
  state: {
    running: false,
    paused: false,
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
    attackCounts: {}
  },
  mode: 'classic',
  lastSpawnSecond: 0,
  gameLoopId: null,

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  },

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 60;
  },

  start(mode = 'classic') {
    this.mode = mode;
    this.reset();
    this.state.running = true;
    this.state.paused = false;
    this.state.lastTime = performance.now();
    
    UI.updateHUD(this.state);
    this.scheduleSpawn();
    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  },

  reset() {
    // 기존 패킷 제거
    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());
    this.packets = [];
    this.powerups = [];
    this.activePowerups = {};
    
    this.state = {
      running: false,
      paused: false,
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
      lastTime: performance.now(),
      waveTimer: 0,
      attackCounts: {}
    };
    
    Firewall.reset();
    BossManager.reset();
    UI.renderFirewallBar();
  },

  pause() {
    this.state.paused = true;
  },

  resume() {
    this.state.paused = false;
    this.state.lastTime = performance.now();
  },

  scheduleSpawn() {
    this.state.spawnTimer = 0;
  },

  spawnPacket(forcedDef = null, isBossSpawn = false, atX = null) {
    if (!this.state.running || this.state.paused) return;
    
    let def = forcedDef;
    let isEncrypted = false;

    if (!def) {
      const allDefs = Object.values(PACKET_TYPES);
      def = Utils.weightedRandom(allDefs);
      
      // 암호화 패킷 확률
      if (Math.random() < CONFIG.CRYPTO_PACKET_CHANCE) {
        isEncrypted = true;
      }
    }

    const gameArea = document.getElementById('game-area');
    const maxX = gameArea.clientWidth - 180;
    const x = atX !== null ? Math.max(20, Math.min(maxX, atX - 60)) : Utils.randInt(20, maxX);
    const y = -50;

    const packet = new Packet(x, y, def, {
      encrypted: isEncrypted,
      isBoss: isBossSpawn
    });
    
    // 낙하 속도 반영
    packet.speedMultiplier = this.state.fallSpeed / CONFIG.BASE_FALL_SPEED;

    // 느린 모션 파워업 적용
    if (this.activePowerups.slow && Date.now() < this.activePowerups.slow) {
      packet.speedMultiplier *= 0.5;
    }

    // 클릭 이벤트
    packet.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlePacketClick(packet, e);
    });

    document.getElementById('packet-layer').appendChild(packet.el);
    this.packets.push(packet);

    // 공격 카운트
    if (def.isAttack) {
      this.state.attackCounts[def.type] = (this.state.attackCounts[def.type] || 0) + 1;
    }
  },

  spawnAttackAt(x, y) {
    // 멀티플레이어 공격자용
    const attackDefs = Object.values(PACKET_TYPES).filter(p => p.isAttack);
    const def = Utils.weightedRandom(attackDefs);
    this.spawnPacket(def, false, x);
  },

  spawnPowerUp() {
    if (Math.random() > CONFIG.POWERUP_CHANCE) return;
    const types = Object.keys(POWERUPS);
    const type = types[Utils.randInt(0, types.length - 1)];
    const gameArea = document.getElementById('game-area');
    const maxX = gameArea.clientWidth - 80;
    const x = Utils.randInt(20, maxX);
    const y = -50;
    
    const pu = new PowerUp(x, y, type);
    pu.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.activatePowerUp(type);
      pu.destroy();
    });
    document.getElementById('powerup-layer').appendChild(pu.el);
    this.powerups.push(pu);
  },

  activatePowerUp(type) {
    const def = POWERUPS[type];
    this.activePowerups[type] = Date.now() + def.duration;
    AudioManager.powerup();
    
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
    if (!container) {
      container = Utils.createEl('div', 'powerup-indicator');
      container.id = 'powerup-indicators';
      document.getElementById('game-area').appendChild(container);
    }
    
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
    if (packet.resolved || !this.state.running || this.state.paused) return;

    // 암호화 패킷은 복호화 미니게임
    if (packet.encrypted) {
      this.pause();
      CryptoGame.start(packet, (result) => {
        this.resume();
        if (result.correct) {
          this.resolvePacket(packet, packet.isAttack);
        } else {
          // 오답 처리: 반대로
          this.resolvePacket(packet, !packet.isAttack);
        }
      });
      return;
    }

    // 정상 판정
    this.resolvePacket(packet, packet.isAttack);
  },

  resolvePacket(packet, wasCorrectBlock) {
    if (packet.resolved) return;

    if (wasCorrectBlock) {
      // 공격 차단 성공
      packet.markBlocked();
      this.addScore(CONFIG.SCORE_PER_ATTACK_BLOCK);
      this.incrementCombo();
      this.state.blockedCount++;
      
      new Particle(packet.x + 40, packet.y + 20, '#00ff88', 10);
      UI.showFloatText(packet.x, packet.y, `+${CONFIG.SCORE_PER_ATTACK_BLOCK}`, '#00ff88');
      AudioManager.blockSuccess();

      // 보스 피격
      if (BossManager.active) {
        BossManager.hit(10);
      }
    } else {
      // 정상 패킷을 잘못 차단 (오탐)
      packet.markBlocked();
      this.addScore(CONFIG.SCORE_PENALTY_FALSE_POSITIVE);
      this.resetCombo();
      
      new Particle(packet.x + 40, packet.y + 20, '#ff3232', 8);
      UI.showFloatText(packet.x, packet.y, `${CONFIG.SCORE_PENALTY_FALSE_POSITIVE}`, '#ff3232');
      AudioManager.falsePositive();
    }
    
    packet.destroy();
    UI.updateHUD(this.state);
  },

  // 서버 도달 처리
  handleServerReach(packet) {
    if (packet.resolved) return;

    if (packet.isAttack) {
      // 공격 통과 → HP 감소
      packet.markPassed();
      this.state.hp -= CONFIG.HP_DAMAGE_PER_ATTACK;
      this.resetCombo();
      UI.flashDamage();
      UI.showFloatText(packet.x, packet.y - 30, `-${CONFIG.HP_DAMAGE_PER_ATTACK} HP`, '#ff3232');
      AudioManager.damage();
      new Particle(packet.x + 40, packet.y, '#ff3232', 15);
    } else {
      // 정상 통과 → 점수
      packet.markPassed();
      this.addScore(CONFIG.SCORE_PER_LEGIT_PASS);
      UI.showFloatText(packet.x, packet.y - 30, `+${CONFIG.SCORE_PER_LEGIT_PASS}`, '#00ff88');
    }

    packet.destroy();
    UI.updateHUD(this.state);

    if (this.state.hp <= 0) {
      this.gameOver();
    }
  },

  addScore(amount) {
    let finalAmount = amount;
    if (this.activePowerups.double && Date.now() < this.activePowerups.double) {
      finalAmount *= 2;
    }
    this.state.score += finalAmount;
    // 음수 점수 방지
    if (this.state.score < 0) this.state.score = 0;
  },

  incrementCombo() {
    this.state.combo++;
    this.state.comboTimeout = Date.now() + CONFIG.COMBO_TIMEOUT;
    if (this.state.combo > this.state.maxCombo) {
      this.state.maxCombo = this.state.combo;
    }
    
    if (this.state.combo >= 3 && this.state.combo % 3 === 0) {
      UI.showCombo(this.state.combo);
      AudioManager.combo(this.state.combo);
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
    
    // 보스 웨이브 체크
    if (this.state.wave % CONFIG.BOSS_WAVE_INTERVAL === 0) {
      const bossIndex = Math.floor(this.state.wave / CONFIG.BOSS_WAVE_INTERVAL) - 1;
      BossManager.start(bossIndex, () => {
        this.addScore(500);
      });
    }
  },

  loop(timestamp) {
    if (!this.state.running) return;
    
    const dt = Math.min((timestamp - this.state.lastTime) / 16.67, 3); // 60fps 기준, 최대 3배까지만
    const secondsElapsed = (timestamp - this.state.lastTime) / 1000;
    this.state.lastTime = timestamp;

    if (!this.state.paused) {
      this.update(dt, secondsElapsed);
    }
    
    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  },

  update(dt, secondsElapsed) {
    const serverY = document.getElementById('game-area').clientHeight - CONFIG.SERVER_HEIGHT + 20;

    // 방화벽 에너지 재생
    Firewall.update(dt, secondsElapsed);

    // 콤보 타임아웃
    if (this.state.combo > 0 && Date.now() > this.state.comboTimeout) {
      this.resetCombo();
    }

    // 패킷 스폰 타이머
    this.state.spawnTimer += secondsElapsed * 1000;
    if (this.state.spawnTimer >= this.state.spawnRate) {
      this.state.spawnTimer = 0;
      this.spawnPacket();
      if (Math.random() < 0.5) this.spawnPowerUp();
    }

    // 보스 업데이트
    BossManager.update(dt, (def, isBoss) => this.spawnPacket(def, isBoss));

    // 파워업 활성 상태 갱신
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

    // 웨이브 타이머
    this.state.waveTimer += secondsElapsed * 1000;
    if (this.state.waveTimer >= CONFIG.WAVE_DURATION && !BossManager.active) {
      this.state.waveTimer = 0;
      this.updateWave();
    }

    // 패킷 업데이트
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      if (p.dead) {
        this.packets.splice(i, 1);
        continue;
      }

      // WAF 자동 차단
      if (!p.resolved && this.activePowerups.waf && Date.now() < this.activePowerups.waf) {
        if (p.isAttack && Firewall.shouldAutoBlock(p) === false) {
          // WAF는 모든 공격 차단
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

      // 방화벽 규칙 자동 차단
      if (!p.resolved && Firewall.shouldAutoBlock(p)) {
        p.resolved = true;
        if (p.isAttack) {
          p.markBlocked();
          this.addScore(5);
          this.state.blockedCount++;
          UI.showFloatText(p.x, p.y, '+5 🔥', '#ff9632');
        } else {
          // 오탐
          p.markBlocked();
          this.addScore(-3);
          UI.showFloatText(p.x, p.y, '-3 오탐', '#ff3232');
        }
        p.destroy();
        continue;
      }

      p.update(dt);

      // 서버 도달
      if (p.y >= serverY) {
        this.handleServerReach(p);
      }
    }

    // 파워업 업데이트
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

  gameOver() {
    this.state.running = false;
    cancelAnimationFrame(this.gameLoopId);
    
    // 가장 많이 나온 공격 유형
    let mostFrequent = 'general';
    let maxCount = 0;
    Object.entries(this.state.attackCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = type;
      }
    });
    this.state.mostFrequentAttack = mostFrequent;

    // 최고점 갱신
    Utils.setHighScore(this.state.score);

    // 남은 패킷 정리
    this.packets.forEach(p => p.el && p.el.remove());
    this.powerups.forEach(p => p.el && p.el.remove());
    
    AudioManager.gameOver();
    UI.showGameOver(this.state);
  },

  stop() {
    this.state.running = false;
    cancelAnimationFrame(this.gameLoopId);
  }
};

window.Game = Game;