// 보스 라운드 시스템
const BossManager = {
  active: false,
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
    this.onDefeat = onDefeat;

    this.showWarning();
    this.updateUI();
  },

  showWarning() {
    const warning = Utils.createEl('div', 'boss-warning', `⚠ ${this.boss.name} 등장 ⚠`);
    document.getElementById('game-area').appendChild(warning);
    AudioManager.bossWarning();
    Utils.removeAfter(warning, 2000);
  },

  updateUI() {
    const container = document.getElementById('boss-hp-container');
    const bar = document.getElementById('boss-hp-bar');
    const text = document.getElementById('boss-hp-text');
    
    container.classList.remove('hidden');
    bar.style.width = (this.hp / this.maxHp * 100) + '%';
    text.textContent = `${this.boss.icon} ${this.boss.name} - ${this.hp}/${this.maxHp}`;
  },

  // 보스가 공격 패킷을 스폰할지 결정
  update(dt, spawnCallback) {
    if (!this.active) return;

    this.spawnTimer += dt * 16.67;  // ms 근사
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // 보스는 공격 패킷 위주로 스폰
      const attackTypes = Object.values(PACKET_TYPES).filter(p => p.isAttack);
      const def = Utils.weightedRandom(attackTypes);
      spawnCallback(def, true);
    }
  },

  // 보스 피격
  hit(damage = 10) {
    if (!this.active) return;
    this.hp = Math.max(0, this.hp - damage);
    this.updateUI();

    if (this.hp <= 0) {
      this.defeat();
    }
  },

  defeat() {
    this.active = false;
    const container = document.getElementById('boss-hp-container');
    container.classList.add('hidden');

    // 축하 효과
    const area = document.getElementById('game-area');
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const x = Utils.randInt(100, window.innerWidth - 200);
        const y = Utils.randInt(100, window.innerHeight - 200);
        new Particle(x, y, '#ffcc00', 20);
      }, i * 150);
    }

    // 플로팅 텍스트
    const text = Utils.createEl('div', 'combo-text', '🎉 BOSS 격파! +500');
    area.appendChild(text);
    Utils.removeAfter(text, 800);

    if (this.onDefeat) this.onDefeat();
  },

  reset() {
    this.active = false;
    this.boss = null;
    this.hp = 0;
    document.getElementById('boss-hp-container').classList.add('hidden');
  }
};