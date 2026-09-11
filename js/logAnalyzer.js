// 로그 분석 모드
const LogAnalyzer = {
  active: false,
  logs: [],
  score: 0,
  timeLeft: 30,
  timer: null,
  onComplete: null,

  // 로그 라인 생성
  generateLog(isThreat) {
    const ips = ['192.168.1.10', '10.0.0.5', '203.0.113.7', '45.33.12.99', '8.8.8.8', '185.99.4.12'];
    const paths = isThreat
      ? ["/admin?u=' OR 1=1--", "/../../etc/passwd", "/wp-login.php?user=admin&pass=admin", "/cgi-bin/.%2e/.%2e/bin/sh"]
      : ["/api/user", "/images/logo.png", "/index.html", "/api/products?page=2", "/css/style.css"];
    const methods = isThreat ? ['POST', 'GET', 'PUT'] : ['GET', 'POST'];
    const codes = isThreat ? [200, 500, 403, 401] : [200, 200, 200, 304];

    const ip = ips[Utils.randInt(0, ips.length - 1)];
    const method = methods[Utils.randInt(0, methods.length - 1)];
    const path = paths[Utils.randInt(0, paths.length - 1)];
    const code = codes[Utils.randInt(0, codes.length - 1)];
    const time = new Date().toISOString().slice(11, 19);

    return {
      isThreat,
      text: `[${time}] ${ip} - "${method} ${path}" ${code}`
    };
  },

  start(onComplete) {
    this.active = true;
    this.score = 0;
    this.timeLeft = 30;
    this.onComplete = onComplete;
    this.logs = [];

    const modal = document.getElementById('log-modal');
    const stream = document.getElementById('log-stream');
    stream.innerHTML = '';
    modal.classList.remove('hidden');

    // 초기 로그 채우기
    for (let i = 0; i < 15; i++) {
      this.addLog();
    }

    // 타이머
    this.timer = setInterval(() => {
      this.timeLeft--;
      document.getElementById('log-timer').textContent = `남은 시간: ${this.timeLeft}s`;
      
      // 스크롤 자동
      stream.scrollTop = stream.scrollHeight;

      if (this.timeLeft <= 0) {
        this.end();
      }
    }, 1000);

    // 로그 스트림 생성
    this.streamTimer = setInterval(() => {
      if (this.active) {
        this.addLog();
        // 오래된 로그 제거
        if (stream.children.length > 40) {
          stream.removeChild(stream.firstChild);
        }
      }
    }, 600);
  },

  addLog() {
    const isThreat = Math.random() < 0.35;
    const log = this.generateLog(isThreat);
    const stream = document.getElementById('log-stream');
    const line = Utils.createEl('div', `log-line${isThreat ? ' threat' : ''}`, log.text);
    
    line.dataset.isThreat = isThreat;
    line.addEventListener('click', () => this.isolate(line, isThreat));
    
    stream.appendChild(line);
  },

  isolate(line, isThreat) {
    if (line.classList.contains('isolated') || line.classList.contains('missed')) return;

    if (isThreat) {
      line.classList.add('isolated');
      this.score += 10;
      line.textContent = '🔒 격리됨: ' + line.textContent;
      AudioManager.blockSuccess();
    } else {
      line.classList.add('missed');
      this.score -= 5;
      line.textContent = '❌ 오탐: ' + line.textContent;
      AudioManager.falsePositive();
    }
  },

  end() {
    this.active = false;
    clearInterval(this.timer);
    clearInterval(this.streamTimer);

    // 놓친 위협 표시
    document.querySelectorAll('.log-line.threat:not(.isolated)').forEach(line => {
      line.classList.add('missed');
      line.textContent = '⚠️ 놓침: ' + line.textContent;
    });

    setTimeout(() => {
      document.getElementById('log-modal').classList.add('hidden');
      if (this.onComplete) this.onComplete(this.score);
    }, 1500);
  }
};