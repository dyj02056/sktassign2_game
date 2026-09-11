// ============================================================
// Web Audio API 기반 사운드 매니저 (안전 초기화)
// ============================================================
const AudioManager = {
  ctx: null,
  muted: false,
  initialized: false,   // ✅ [T02-C17] 중복 초기화 방지

  // ----------------------------------------------------------
  // ✅ [T02-C17] 안전한 초기화
  // ----------------------------------------------------------
  init() {
    if (this.initialized && this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('[AudioManager] Web Audio API unavailable:', e.message);
      this.ctx = null;
    }
  },

  // ✅ 사용자 제스처 시점에 resume
  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  // ----------------------------------------------------------
  // 기본 톤 재생 (try/catch로 감싼 안전 버전)
  // ----------------------------------------------------------
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // 재생 실패해도 게임은 계속
      console.warn('[AudioManager] playTone failed:', e.message);
    }
  },

  // ----------------------------------------------------------
  // 효과음들 (모두 try/catch로 감싼 안전 버전)
  // ----------------------------------------------------------
  blockSuccess() {
    try {
      this.playTone(880, 0.1, 'square', 0.08);
      setTimeout(() => this.playTone(1320, 0.15, 'square', 0.08), 80);
    } catch (e) {}
  },

  falsePositive() {
    try {
      this.playTone(220, 0.2, 'sawtooth', 0.1);
      setTimeout(() => this.playTone(165, 0.25, 'sawtooth', 0.1), 100);
    } catch (e) {}
  },

  damage() {
    try {
      this.playTone(150, 0.3, 'sawtooth', 0.15);
    } catch (e) {}
  },

  powerup() {
    try {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.12, 'sine', 0.1), i * 60);
      });
    } catch (e) {}
  },

  combo(level) {
    try {
      const baseFreq = 660 + level * 55;
      this.playTone(baseFreq, 0.15, 'triangle', 0.12);
    } catch (e) {}
  },

  waveStart() {
    try {
      [392, 523, 659, 784].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.1), i * 100);
      });
    } catch (e) {}
  },

  bossWarning() {
    try {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.playTone(110, 0.3, 'sawtooth', 0.15);
          this.playTone(115, 0.3, 'sawtooth', 0.15);
        }, i * 400);
      }
    } catch (e) {}
  },

  gameOver() {
    try {
      [440, 349, 293, 220].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.5, 'sawtooth', 0.15), i * 200);
      });
    } catch (e) {}
  },

  // ✅ [T02-C07] 성공 효과음
  win() {
    try {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.12), i * 100);
      });
    } catch (e) {}
  },

  decrypt() {
    try {
      this.playTone(1200, 0.1, 'sine', 0.08);
      setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.08), 60);
    } catch (e) {}
  },

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
};