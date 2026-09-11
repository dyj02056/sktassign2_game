// 방화벽 규칙 시스템
const Firewall = {
  rules: [],
  energy: CONFIG.INITIAL_ENERGY,
  energyAccumulator: 0,

  addRule(type, value) {
    if (this.energy < 1) {
      return { success: false, msg: '에너지가 부족합니다!' };
    }
    const rule = {
      id: Date.now(),
      type,
      value: value.trim(),
      createdAt: Date.now()
    };
    this.rules.push(rule);
    this.energy -= 1;
    return { success: true, rule };
  },

  removeRule(id) {
    const idx = this.rules.findIndex(r => r.id === id);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      this.energy = Math.min(CONFIG.MAX_ENERGY, this.energy + 1);
    }
  },

  // 패킷이 규칙에 매칭되는지 확인
  shouldAutoBlock(packet) {
    for (const rule of this.rules) {
      const ruleType = RULE_TYPES[rule.type];
      if (ruleType && ruleType.match(packet, rule.value)) {
        return true;
      }
    }
    return false;
  },

  // 매 프레임 에너지 재생
  update(dt, secondsElapsed) {
    this.energyAccumulator += CONFIG.ENERGY_REGEN * secondsElapsed;
    if (this.energyAccumulator >= 1) {
      const gain = Math.floor(this.energyAccumulator);
      this.energy = Math.min(CONFIG.MAX_ENERGY, this.energy + gain);
      this.energyAccumulator -= gain;
    }
  },

  reset() {
    this.rules = [];
    this.energy = CONFIG.INITIAL_ENERGY;
    this.energyAccumulator = 0;
  }
};