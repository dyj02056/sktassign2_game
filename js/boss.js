// ============================================================
// 보스 라운드 시스템 (중복 격파 방지)
// ============================================================
const BossManager = {
  active: false,
  defeated: false,        // ✅ [T02-C17] 중복 격파 방지
  boss: null,
  hp: 0,
  maxHp: 0,
  spawnTimer: 0,
  spawnInterval: 0,
  onDefeat: null,

  start(bossIndex, onDefeat) {
    const config = BOSSES[bossIndex % BOSSES.length];
    this.boss = config;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.spawnInterval = config.spawnRate;
    this.spawnTimer = 0;
    this.active = true;
    this.defeated = false;   // ✅ 리셋
    this.onDefeat = onDefeat;

    this.showWarning();
    this.updateUI();
  },

  showWarning() {
    const warning = Utils.createEl('div', 'boss-warning', `⚠ ${this.boss.name} 등장 ⚠`);
    const area = document.getElementById('game-area');
    if (area) area.appendChild(warning);
    try { AudioManager.bossWarning(); } catch (e) {}
    Utils.removeAfter(warning, 2000);
  },

  updateUI() {
    const container = document.getElementById('boss-hp-container');
    const bar = document.getElementById('boss-hp-bar');
    const text = document.getElementById('boss-hp-text');
    if (!container || !bar || !text) return;

    container.classList.remove('hidden');
    bar.style.width = (this.hp / this.maxHp * 100) + '%';
    text.textContent = `${this.boss.icon} ${this.boss.name} - ${this.hp}/${this.maxHp}`;
  },

  update(dt, spawnCallback) {
    if (!this.active) return;

    this.spawnTimer += dt * 16.67;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const attackTypes = Object.values(PACKET_TYPES).filter(p => p.isAttack);
      const def = Utils.weightedRandom(attackTypes);
      spawnCallback(def, true);
    }
  },

  // ✅ [T02-C17] 중복 hit/defeat 방지
  hit(damage = 10) {
    if (!this.active || this.defeated) return;
    this.hp = Math.max(0, this.hp - damage);
    this.updateUI();
    if (this.hp <= 0) {
      this.defeated = true;
      this.defeat();
    }
  },

  defeat() {
    if (!this.active) return;
    this.active = false;
    const container = document.getElementById('boss-hp-container');
    if (container) container.classList.add('hidden');

    const area = document.getElementById('game-area');
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const x = Utils.randInt(100, window.innerWidth - 200);
        const y = Utils.randInt(100, window.innerHeight - 200);
        new Particle(x, y, '#ffcc00', 20);
      }, i * 150);
    }

    const text = Utils.createEl('div', 'combo-text', '🎉 BOSS 격파! +500');
    if (area) area.appendChild(text);
    Utils.removeAfter(text, 800);

    if (this.onDefeat) this.onDefeat();
  },

  reset() {
    this.active = false;
    this.defeated = false;
    this.boss = null;
    this.hp = 0;
    const container = document.getElementById('boss-hp-container');
    if (container) container.classList.add('hidden');
  }
};