// ============================================================
// 게임 전역 상수 및 정의
// ============================================================

const CONFIG = {
  // 화면 크기
  GAME_WIDTH: window.innerWidth,
  GAME_HEIGHT: window.innerHeight - 60,
  SERVER_HEIGHT: 80,

  // 게임 기본값
  INITIAL_HP: 100,
  INITIAL_ENERGY: 5,
  MAX_ENERGY: 10,
  ENERGY_REGEN: 0.5,

  // 난이도 기본
  BASE_SPAWN_RATE: 1200,
  MIN_SPAWN_RATE: 350,
  BASE_FALL_SPEED: 1.2,
  MAX_FALL_SPEED: 4.0,
  WAVE_DURATION: 25000,
  BOSS_WAVE_INTERVAL: 5,

  // ✅ [T02-C07] 성공 조건 & 시간 제한
  WIN_SCORE: 100,                // 라운드마다 동일 목표
  MAX_PLAY_TIME: 30000,          // 라운드당 30초 제한

  // ✅ [라운드 모드] 라운드별 난이도 상승 계수
  ROUND_DIFFICULTY: {
    spawnRateDecrease: 100,      // 라운드마다 스폰 주기 -100ms
    fallSpeedIncrease: 0.2,      // 라운드마다 낙하 속도 +0.2
    hpDamageIncrease: 0,         // 4라운드부터 +5씩 (game.js에서 조건 처리)
    bossEveryRounds: 5           // 5라운드마다 보스 등장
  },
  MAX_ROUND: 999,                // 사실상 무한

  // 점수 규칙
  SCORE_PER_ATTACK_BLOCK: 10,
  SCORE_PER_LEGIT_PASS: 5,
  SCORE_PENALTY_FALSE_POSITIVE: -5,
  HP_DAMAGE_PER_ATTACK: 10,
  COMBO_TIMEOUT: 2000,

  // 아이템 확률
  CRYPTO_PACKET_CHANCE: 0.15,
  POWERUP_CHANCE: 0.08,
  POWERUP_DURATION: 10000,

  // ✅ [T02-C14] 프레임 안전
  MAX_FRAME_DELTA: 0.05,
  AUTO_PAUSE_ON_BLUR: false,

  // ✅ [T02-C24/C25] 저장 스키마
  STORAGE_SCHEMA: {
    'pd.highscore': {
      type: 'number', default: 0, label: '최고 점수',
      min: 0, max: 999999999
    },
    'pd.muted': {
      type: 'boolean', default: false, label: '음소거'
    },
    'pd.totalGames': {
      type: 'number', default: 0, label: '총 플레이 횟수',
      min: 0, max: 999999
    },
    'pd.highestRound': {
      type: 'number', default: 1, label: '최고 도달 라운드',
      min: 1, max: 999
    }
  },
  STORAGE_PREFIX: 'pd.'
};

// ============================================================
// 패킷 유형 정의
// ============================================================
const PACKET_TYPES = {
  legit_https:  { type: 'legit',      label: '✅ HTTPS 요청',         isAttack: false, weight: 20, ports: [443],        ipPrefix: '192.168' },
  legit_api:    { type: 'legit',      label: '✅ API 호출',           isAttack: false, weight: 15, ports: [8080],       ipPrefix: '10.0' },
  legit_image:  { type: 'legit',      label: '✅ 이미지 로드',         isAttack: false, weight: 12, ports: [80],         ipPrefix: '203.0' },
  legit_dns:    { type: 'legit',      label: '✅ DNS 쿼리',           isAttack: false, weight: 10, ports: [53],         ipPrefix: '8.8' },
  ddos:         { type: 'ddos',       label: '💥 DDoS 플러드',        isAttack: true,  weight: 18, ports: [80, 443],    ipPrefix: '45.33' },
  phishing:     { type: 'phishing',   label: '🎣 피싱 링크',           isAttack: true,  weight: 15, ports: [80],         ipPrefix: '185.99' },
  sqli:         { type: 'sqli',       label: '🐛 SQL Injection',      isAttack: true,  weight: 15, ports: [3306, 5432], ipPrefix: '77.88' },
  bruteforce:   { type: 'bruteforce', label: '🔑 무차별 대입',         isAttack: true,  weight: 15, ports: [22, 3389],   ipPrefix: '104.21' },
  xss:          { type: 'sqli',       label: '⚠️ XSS 시도',           isAttack: true,  weight: 10, ports: [80, 443],    ipPrefix: '91.20' },
  zero_day:     { type: 'sqli',       label: '☣️ 제로데이 익스플로잇',  isAttack: true,  weight: 8,  ports: [0],          ipPrefix: '0.0' },
  ransomware:   { type: 'bruteforce', label: '🔒 랜섬웨어 배포',       isAttack: true,  weight: 6,  ports: [445],        ipPrefix: '51.15' }
};

// ============================================================
// 파워업 정의
// ============================================================
const POWERUPS = {
  waf:    { name: 'WAF 방화벽',  icon: '🛡️', duration: 10000, effect: '10초간 공격 패킷 자동 차단', color: '#00ccff' },
  slow:   { name: '슬로우 모션', icon: '⏱️', duration: 8000,  effect: '8초간 낙하 속도 50%',        color: '#ff00ff' },
  double: { name: '더블 스코어', icon: '✨', duration: 10000, effect: '10초간 점수 2배',            color: '#ffcc00' }
};

// ============================================================
// 방화벽 규칙 타입
// ============================================================
const RULE_TYPES = {
  ip:   { label: 'IP 대역', match: (packet, value) => packet.ip && packet.ip.startsWith(value) },
  port: { label: '포트',    match: (packet, value) => packet.ports && packet.ports.includes(parseInt(value)) },
  type: { label: '유형',    match: (packet, value) => packet.type === value }
};

// ============================================================
// 보스 정의
// ============================================================
const BOSSES = [
  {
    name: 'DDoS 마스터',
    icon: '💀',
    hp: 100,
    spawnRate: 500,
    description: '초당 다량의 공격 패킷을 쏟아냅니다.'
  },
  {
    name: '피싱 제왕',
    icon: '🎭',
    hp: 150,
    spawnRate: 700,
    description: '위장된 정상 패킷과 피싱을 섞어 보냅니다.'
  },
  {
    name: 'SQL 오버로드',
    icon: '👾',
    hp: 200,
    spawnRate: 450,
    description: 'DB를 노리는 강력한 인젝션을 시도합니다.'
  }
];

// ============================================================
// 교육 팁 (게임 오버 시 표시)
// ============================================================
const EDUCATION_TIPS = {
  ddos: '💡 DDoS는 다수 좀비 PC가 동시에 트래픽을 보내 서버를 마비시킵니다. CDN/로드밸런서로 분산 대응합니다.',
  sqli: '💡 SQL Injection은 입력값에 SQL 코드를 삽입해 DB를 조작합니다. Prepared Statement로 방어합니다.',
  phishing: '💡 피싱은 위장 사이트로 유도해 개인정보를 탈취합니다. 도메인 검증과 2FA가 필수입니다.',
  bruteforce: '💡 무차별 대입은 가능한 모든 조합을 시도합니다. 계정 잠금과 강력한 암호 정책으로 방어합니다.',
  general: '💡 심층 방어(Defense in Depth): 방화벽, IDS/IPS, WAF, 로그 분석을 조합해 다층 방어를 구축하세요.'
};