// Web Audio API 기반 사운드 매니저
const AudioManager = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  },

  // 기본 톤 재생
  playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (this.muted || !this.ctx) return;
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
  },

  // 차단 성공
  blockSuccess() {
    this.playTone(880, 0.1, 'square', 0.08);
    setTimeout(() => this.playTone(1320, 0.15, 'square', 0.08), 80);
  },

  // 오탐 (정상 차단)
  falsePositive() {
    this.playTone(220, 0.2, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(165, 0.25, 'sawtooth', 0.1), 100);
  },

  // 피격
  damage() {
    this.playTone(150, 0.3, 'sawtooth', 0.15);
  },

  // 파워업 획득
  powerup() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine', 0.1), i * 60);
    });
  },

  // 콤보
  combo(level) {
    const baseFreq = 660 + level * 55;
    this.playTone(baseFreq, 0.15, 'triangle', 0.12);
  },

  // 웨이브 시작
  waveStart() {
    [392, 523, 659, 784].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.1), i * 100);
    });
  },

  // 보스 등장
  bossWarning() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(110, 0.3, 'sawtooth', 0.15);
        this.playTone(115, 0.3, 'sawtooth', 0.15);
      }, i * 400);
    }
  },

  // 게임 오버
  gameOver() {
    [440, 349, 293, 220].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.5, 'sawtooth', 0.15), i * 200);
    });
  },

  // 복호화 성공
  decrypt() {
    this.playTone(1200, 0.1, 'sine', 0.08);
    setTimeout(() => this.playTone(1600, 0.15, 'sine', 0.08), 60);
  },

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
};