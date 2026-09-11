// 멀티플레이어 (공격자 vs 방어자)
const Multiplayer = {
  active: false,
  mode: 'defender',  // 'defender' | 'attacker'
  defenderScore: 0,
  attackerScore: 0,
  turnTime: 30,
  timeLeft: 30,
  timer: null,

  start(onEnd) {
    this.active = true;
    this.defenderScore = 0;
    this.attackerScore = 0;
    this.timeLeft = this.turnTime;
    this.mode = 'defender';
    this.onEnd = onEnd;

    this.showRoleSelection(onEnd);
  },

  showRoleSelection(onEnd) {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h1>⚔️ 멀티플레이어</h1>
        <p class="subtitle">공격자 vs 방어자</p>
        <div class="mp-setup">
          <div class="mp-role-info">
            <b>🛡️ 방어자:</b> 서버로 오는 공격을 차단하세요. 정상 트래픽 통과 시 +5, 공격 차단 시 +10.<br>
            <b>⚔️ 공격자:</b> 방어자를 뚫기 위해 다양한 공격을 시도하세요. 성공 시 +10.
          </div>
          <p style="font-size:13px;color:#88ffbb;">먼저 방어자부터 시작합니다. 30초간 진행됩니다.</p>
        </div>
        <button id="mp-start-btn">턴 시작</button>
      </div>
    `;

    document.getElementById('mp-start-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
      this.startTurn();
    });
  },

  startTurn() {
    if (this.mode === 'defender') {
      this.startDefenderTurn();
    } else {
      this.startAttackerTurn();
    }
  },

  startDefenderTurn() {
    // 기존 게임 루프 재사용, 방어자 점수만 별도 추적
    this.timeLeft = this.turnTime;
    this.updateScoreboard();
    this.startTurnTimer(() => {
      this.defenderScore = window.Game ? window.Game.state.score : 0;
      this.mode = 'attacker';
      this.showTurnResult('🛡️ 방어자 턴 종료!', () => this.startAttackerTurn());
    });
  },

  startAttackerTurn() {
    // 공격자 턴: 화면 클릭으로 특정 위치에 공격 패킷 생성
    this.timeLeft = this.turnTime;
    this.updateScoreboard();
    
    const area = document.getElementById('game-area');
    area.style.cursor = 'crosshair';
    
    const clickHandler = (e) => {
      if (e.target.closest('#hud') || e.target.closest('#server')) return;
      // 공격 패킷 강제 스폰
      if (window.Game && window.Game.spawnAttackAt) {
        window.Game.spawnAttackAt(e.clientX, 50);
      }
    };
    
    area.addEventListener('click', clickHandler);
    
    this.startTurnTimer(() => {
      area.removeEventListener('click', clickHandler);
      area.style.cursor = '';
      this.showTurnResult('⚔️ 공격자 턴 종료!', () => this.showFinalResult());
    });
  },

  startTurnTimer(onEnd) {
    document.getElementById('log-timer') && (document.getElementById('log-timer').textContent = '');
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateScoreboard();
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        onEnd();
      }
    }, 1000);
  },

  updateScoreboard() {
    let sb = document.getElementById('mp-scoreboard');
    if (!sb) {
      sb = Utils.createEl('div', 'mp-scoreboard');
      sb.id = 'mp-scoreboard';
      document.getElementById('game-area').appendChild(sb);
    }
    sb.innerHTML = `
      <div class="mp-player defender ${this.mode === 'defender' ? 'active' : ''}">
        🛡️ 방어자: ${this.defenderScore}
      </div>
      <div class="mp-player attacker ${this.mode === 'attacker' ? 'active' : ''}">
        ⚔️ 공격자: ${this.attackerScore}
      </div>
      <div style="color:#ffdc32;">⏱️ ${this.timeLeft}s</div>
    `;
  },

  showTurnResult(title, onNext) {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h1>${title}</h1>
        <div class="gameover-stats">
          <div>🛡️ 방어자 점수: <b>${this.defenderScore}</b></div>
          <div>⚔️ 공격자 점수: <b>${this.attackerScore}</b></div>
        </div>
        <button id="mp-next-btn">계속</button>
      </div>
    `;
    document.getElementById('mp-next-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
      onNext();
    });
  },

  showFinalResult() {
    const winner = this.defenderScore > this.attackerScore 
      ? '🛡️ 방어자 승리!' 
      : this.attackerScore > this.defenderScore 
        ? '⚔️ 공격자 승리!' 
        : '🤝 무승부!';
    
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h1>${winner}</h1>
        <div class="gameover-stats">
          <div>🛡️ 방어자: <b>${this.defenderScore}</b></div>
          <div>⚔️ 공격자: <b>${this.attackerScore}</b></div>
        </div>
        <button id="mp-restart-btn">다시하기</button>
      </div>
    `;
    document.getElementById('mp-restart-btn').addEventListener('click', () => {
      location.reload();
    });
  },

  reset() {
    this.active = false;
    clearInterval(this.timer);
    const sb = document.getElementById('mp-scoreboard');
    if (sb) sb.remove();
  }
};