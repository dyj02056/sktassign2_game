// 암호화 패킷 복호화 미니게임
const CryptoGame = {
  currentPacket: null,
  currentShift: 0,
  onResolve: null,

  // 암호화된 패킷 생성
  encrypt(originalText) {
    const shift = Utils.randInt(3, 10);
    const cipherText = Utils.caesarCipher(originalText, shift);
    return {
      cipher: Utils.toHex(cipherText),
      plain: originalText,
      shift
    };
  },

  // 복호화 미니게임 시작
  start(packet, onResolve) {
    this.currentPacket = packet;
    this.onResolve = onResolve;

    // 원본 텍스트 후보 (4개 중 정답 1개)
    const isAttack = packet.isAttack;
    const correctText = isAttack 
      ? this.getRandomAttackText() 
      : this.getRandomLegitText();
    const wrongTexts = this.getWrongOptions(correctText, isAttack);

    // 정답 + 오답 3개 섞기
    const options = [
      { text: correctText, correct: true },
      ...wrongTexts.map(t => ({ text: t, correct: false }))
    ].sort(() => Math.random() - 0.5);

    const encrypted = this.encrypt(correctText);

    // UI 표시
    const modal = document.getElementById('crypto-modal');
    const display = document.getElementById('cipher-display');
    const choices = document.getElementById('crypto-choices');

    display.innerHTML = `
      <div>
        <div style="font-size:11px;opacity:0.6;margin-bottom:8px;">🔒 암호문 (시저 암호)</div>
        <div>${encrypted.cipher}</div>
      </div>
    `;

    choices.innerHTML = '';
    options.forEach(opt => {
      const btn = Utils.createEl('button', 'crypto-choice', opt.text);
      btn.addEventListener('click', () => {
        this.answer(opt, btn);
      });
      choices.appendChild(btn);
    });

    modal.classList.remove('hidden');
  },

  // 답변 처리
  answer(option, btn) {
    const isCorrect = option.correct;
    
    document.querySelectorAll('.crypto-choice').forEach(b => {
      b.style.pointerEvents = 'none';
    });
    
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (isCorrect) {
      AudioManager.decrypt();
    }

    setTimeout(() => {
      document.getElementById('crypto-modal').classList.add('hidden');
      if (this.onResolve) {
        this.onResolve({
          packet: this.currentPacket,
          correct: isCorrect,
          decidedBlock: this.currentPacket.isAttack  // 실제 판단
        });
      }
    }, 800);
  },

  getRandomAttackText() {
    const attacks = [
      "GET /admin?u=' OR 1=1--",
      "POST /login?user=admin&pass=admin",
      "SELECT * FROM users WHERE id=1--",
      "GET /wp-admin.php?id=<script>",
      "<iframe src='http://evil.com'>",
      "DROP TABLE customers;--",
      "GET /../../etc/passwd",
      "POST /api?cmd=;rm -rf /"
    ];
    return attacks[Utils.randInt(0, attacks.length - 1)];
  },

  getRandomLegitText() {
    const legit = [
      "GET /api/user/profile",
      "POST /api/order/create",
      "GET /images/logo.png",
      "GET /api/products?page=2",
      "POST /api/auth/login",
      "GET /css/style.css",
      "GET /api/notifications",
      "POST /api/cart/add"
    ];
    return legit[Utils.randInt(0, legit.length - 1)];
  },

  getWrongOptions(correctText, isAttack) {
    const pool = isAttack ? this.getRandomLegitTexts() : this.getRandomAttackTexts();
    const options = [];
    while (options.length < 3) {
      const t = pool[Utils.randInt(0, pool.length - 1)];
      if (t !== correctText && !options.includes(t)) options.push(t);
    }
    return options;
  },

  getRandomAttackTexts() {
    return [
      "GET /admin?u=' OR 1=1--",
      "SELECT * FROM users WHERE id=1--",
      "GET /../../etc/passwd",
      "POST /api?cmd=;rm -rf /"
    ];
  },

  getRandomLegitTexts() {
    return [
      "GET /api/user/profile",
      "POST /api/order/create",
      "GET /images/logo.png",
      "POST /api/cart/add"
    ];
  }
};