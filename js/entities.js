// 패킷 엔티티
class Packet {
  constructor(x, y, definition, options = {}) {
    this.x = x;
    this.y = y;
    this.definition = definition;
    this.type = definition.type;
    this.label = definition.label;
    this.isAttack = definition.isAttack;
    this.ip = Utils.randomIP(definition.ipPrefix);
    this.ports = [Utils.randomPort(definition.ports)];
    this.encrypted = options.encrypted || false;
    this.isBoss = options.isBoss || false;
    this.hp = options.hp || 1;
    this.blocked = false;
    this.resolved = false;
    this.dead = false;
    this.el = null;
    this.speedMultiplier = 1;

    this.createElement();
  }

  createElement() {
    const el = Utils.createEl('div', `packet ${this.encrypted ? 'encrypted' : this.type}`);
    if (this.isBoss) el.classList.add('boss');
    
    if (this.encrypted) {
      el.textContent = '🔐 [' + Utils.toHex('ENCRYPTED').slice(0, 20) + '...]';
    } else {
      el.textContent = this.label;
    }
    
    el.dataset.ip = this.ip;
    el.dataset.ports = this.ports.join(',');
    el.style.left = this.x + 'px';
    el.style.top = this.y + 'px';
    
    this.el = el;
  }

  update(dt) {
    if (this.dead) return;
    this.y += CONFIG.BASE_FALL_SPEED * this.speedMultiplier * dt;
    this.el.style.top = this.y + 'px';
  }

  markBlocked() {
    this.resolved = true;
    this.blocked = true;
    this.el.classList.add('blocked-anim');
  }

  markPassed() {
    this.resolved = true;
    this.el.classList.add('passed-anim');
  }

  destroy() {
    this.dead = true;
    Utils.removeAfter(this.el, 500);
  }
}

// 파워업 엔티티
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.definition = POWERUPS[type];
    this.collected = false;
    this.dead = false;
    this.createEl();
  }

  createEl() {
    const el = Utils.createEl('div', `powerup ${this.type}`, this.definition.icon);
    el.style.left = this.x + 'px';
    el.style.top = this.y + 'px';
    el.title = this.definition.name;
    this.el = el;
  }

  update(dt) {
    if (this.dead) return;
    this.y += CONFIG.BASE_FALL_SPEED * 0.7 * dt;
    this.el.style.top = this.y + 'px';
  }

  destroy() {
    this.dead = true;
    Utils.removeAfter(this.el, 300);
  }
}

// 파티클 (시각 효과)
class Particle {
  constructor(x, y, color, count = 8) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = Utils.randInt(30, 70);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const el = Utils.createEl('div', 'particle');
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.background = color;
      el.style.boxShadow = `0 0 8px ${color}`;
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      document.getElementById('effects-layer').appendChild(el);
      this.particles.push(el);
      Utils.removeAfter(el, 800);
    }
  }
}