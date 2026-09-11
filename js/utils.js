// 유틸리티 함수 모음
const Utils = {
  // 확률 가중치 기반 랜덤 선택
  weightedRandom(items, weightKey = 'weight') {
    const total = items.reduce((sum, item) => sum + item[weightKey], 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item[weightKey];
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  },

  // 범위 내 랜덤 정수
  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // 랜덤 IP 생성
  randomIP(prefix = null) {
    if (prefix) {
      return `${prefix}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
    }
    return `${this.randInt(1, 255)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
  },

  // 랜덤 포트
  randomPort(ports) {
    if (ports && ports.length) {
      return ports[this.randInt(0, ports.length - 1)];
    }
    return this.randInt(1024, 65535);
  },

  // 문자열 암호화 (시저 암호)
  caesarCipher(text, shift) {
    return text.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26) + 97);
      return c;
    }).join('');
  },

  // 16진수 문자열로 변환
  toHex(str) {
    return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  },

  // 시간 포맷
  formatTime(ms) {
    return (ms / 1000).toFixed(1) + 's';
  },

  // DOM 헬퍼
  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },

  // 요소 생성
  createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  },

  // 애니메이션 종료 후 제거
  removeAfter(el, ms) {
    setTimeout(() => el.remove(), ms);
  },

  // 로컬 스토리지 최고점
  getHighScore() {
    return parseInt(localStorage.getItem('packetDefender_highscore') || '0');
  },
  setHighScore(score) {
    const current = this.getHighScore();
    if (score > current) {
      localStorage.setItem('packetDefender_highscore', score);
      return true;
    }
    return false;
  }
};