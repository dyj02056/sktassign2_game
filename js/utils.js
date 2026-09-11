// ============================================================
// 유틸리티 함수 모음
// ============================================================
const Utils = {
  // ----------------------------------------------------------
  // 확률 가중치 기반 랜덤 선택
  // ----------------------------------------------------------
  weightedRandom(items, weightKey = 'weight') {
    const total = items.reduce((sum, item) => sum + item[weightKey], 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item[weightKey];
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  },

  // ----------------------------------------------------------
  // 범위 내 랜덤 정수
  // ----------------------------------------------------------
  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // ----------------------------------------------------------
  // 랜덤 IP 생성
  // ----------------------------------------------------------
  randomIP(prefix = null) {
    if (prefix) {
      return `${prefix}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
    }
    return `${this.randInt(1, 255)}.${this.randInt(0, 255)}.${this.randInt(0, 255)}.${this.randInt(1, 254)}`;
  },

  // ----------------------------------------------------------
  // 랜덤 포트
  // ----------------------------------------------------------
  randomPort(ports) {
    if (ports && ports.length) {
      return ports[this.randInt(0, ports.length - 1)];
    }
    return this.randInt(1024, 65535);
  },

  // ----------------------------------------------------------
  // 문자열 암호화 (시저 암호)
  // ----------------------------------------------------------
  caesarCipher(text, shift) {
    return text.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26) + 97);
      return c;
    }).join('');
  },

  // ----------------------------------------------------------
  // 16진수 문자열로 변환
  // ----------------------------------------------------------
  toHex(str) {
    return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  },

  // ----------------------------------------------------------
  // 시간 포맷
  // ----------------------------------------------------------
  formatTime(ms) {
    return (ms / 1000).toFixed(1) + 's';
  },

  // ----------------------------------------------------------
  // DOM 헬퍼
  // ----------------------------------------------------------
  $(sel) { return document.querySelector(sel); },
  $$(sel) { return document.querySelectorAll(sel); },

  createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  },

  removeAfter(el, ms) {
    setTimeout(() => {
      if (el && el.parentNode) el.remove();
    }, ms);
  },

  // ============================================================
  // ✅ [T02-C17] 저장소 안전 래퍼
  // ============================================================
  safeGetStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? defaultValue : value;
    } catch (e) {
      console.warn('[Storage] read failed:', e.message);
      return defaultValue;
    }
  },

  safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[Storage] write failed:', e.message);
      return false;
    }
  },

  // ============================================================
  // ✅ [T02-C25] 엄격한 파서 (손상값 방어)
  // ============================================================
  _parseStrictNumber(raw, defaultValue, options = {}) {
    if (raw === null || raw === undefined) return defaultValue;

    const str = String(raw).trim();

    // 빈 문자열 → 기본값
    if (str === '') return defaultValue;

    // 정규식 필터 (정수만 or 소수 허용)
    const allowDecimal = options.allowDecimal || false;
    const pattern = allowDecimal ? /^-?\d+(\.\d+)?$/ : /^-?\d+$/;
    if (!pattern.test(str)) return defaultValue;

    // Number 변환
    const num = Number(str);
    if (!Number.isFinite(num)) return defaultValue; // Infinity, NaN 차단

    // 범위 검증
    const min = options.min !== undefined ? options.min : -Infinity;
    const max = options.max !== undefined ? options.max : Infinity;
    if (num < min || num > max) return defaultValue;

    return num;
  },

  _parseStrictBoolean(raw, defaultValue) {
    if (raw === null || raw === undefined) return defaultValue;
    const str = String(raw).trim().toLowerCase();
    if (str === 'true') return true;
    if (str === 'false') return false;
    return defaultValue;
  },

  // ============================================================
  // ✅ [T02-C24/C25] 스키마 기반 로드/저장
  // ============================================================
  loadFromStorage() {
    const result = {};
    const schema = (CONFIG && CONFIG.STORAGE_SCHEMA) || {};

    for (const key in schema) {
      const spec = schema[key];

      // 스키마 자체 방어
      if (!spec || typeof spec !== 'object') {
        console.warn('[Storage] Invalid schema for:', key);
        continue;
      }

      const defaultValue = spec.default;
      const raw = this.safeGetStorage(key, null);

      // 빈 값 → 기본값
      if (raw === null || raw === undefined || raw === '') {
        result[key] = defaultValue;
        continue;
      }

      // 타입별 엄격 파싱
      try {
        if (spec.type === 'number') {
          result[key] = this._parseStrictNumber(raw, defaultValue, spec);
        } else if (spec.type === 'boolean') {
          result[key] = this._parseStrictBoolean(raw, defaultValue);
        } else {
          result[key] = String(raw);
        }
      } catch (e) {
        console.warn('[Storage] Parse error for', key, ':', e.message);
        result[key] = defaultValue;
      }
    }

    // 기존 키 마이그레이션 (packetDefender_highscore → pd.highscore)
    try {
      const legacyScore = this.safeGetStorage('packetDefender_highscore', null);
      if (legacyScore !== null && result['pd.highscore'] === 0) {
        const legacyNum = this._parseStrictNumber(
          legacyScore, 0, { min: 0, max: 999999999 }
        );
        if (legacyNum > 0) {
          result['pd.highscore'] = legacyNum;
        }
      }
    } catch (e) {
      console.warn('[Storage] Migration failed:', e.message);
    }

    return result;
  },

  saveToStorage(key, value) {
    const schema = (CONFIG && CONFIG.STORAGE_SCHEMA) || {};
    const spec = schema[key];

    // 스키마 없으면 거부
    if (!spec || typeof spec !== 'object') {
      console.warn('[Storage] Unknown or invalid key:', key);
      return false;
    }

    // 값 검증
    if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        console.warn('[Storage] Invalid number for', key, ':', value);
        return false;
      }
      const min = spec.min !== undefined ? spec.min : -Infinity;
      const max = spec.max !== undefined ? spec.max : Infinity;
      if (value < min || value > max) {
        console.warn('[Storage] Out of range for', key, ':', value);
        return false;
      }
    } else if (spec.type === 'boolean') {
      if (typeof value !== 'boolean') {
        console.warn('[Storage] Invalid boolean for', key, ':', value);
        return false;
      }
    }

    return this.safeSetStorage(key, String(value));
  },

  getDefault(key) {
    const spec = (CONFIG && CONFIG.STORAGE_SCHEMA) || {};
    return spec[key] ? spec[key].default : null;
  },

  // 기존 API 유지 (내부적으로 새 스키마 사용)
  getHighScore() {
    const saved = this.loadFromStorage();
    return saved['pd.highscore'] || 0;
  },

  setHighScore(score) {
    if (typeof score !== 'number' || !Number.isFinite(score)) return false;
    const current = this.getHighScore();
    if (score > current) {
      return this.saveToStorage('pd.highscore', score);
    }
    return false;
  }
};