// ============================================================
// 진입점 - 초기화 및 모드 선택 처리
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // 게임 초기화
  UI.init();
  Game.init();

  // ✅ [T02-C17] 오디오 초기화는 여기서 하지 않음 (사용자 제스처 필요)

  // 모드 선택 버튼
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;

      // ✅ [T02-C17] 첫 클릭 시 오디오 초기화 + unlock
      AudioManager.init();
      AudioManager.unlock();

      UI.elements.overlay.style.display = 'none';

      if (mode === 'multiplayer') {
        Multiplayer.start();
      } else if (mode === 'log') {
        startLogOnlyMode();
      } else {
        Game.start(mode);
      }
    });
  });

  // ✅ [T02-C17] 첫 페이지 클릭에도 오디오 초기화 시도 (백업)
  document.addEventListener('click', () => {
    if (!AudioManager.initialized) {
      AudioManager.init();
    }
    AudioManager.unlock();
  }, { passive: true });
});

function startLogOnlyMode() {
  let totalScore = 0;
  let rounds = 0;
  const maxRounds = 3;

  function runRound() {
    LogAnalyzer.start((score) => {
      totalScore += score;
      rounds++;

      if (rounds < maxRounds) {
        setTimeout(() => {
          const overlay = document.getElementById('overlay');
          overlay.style.display = 'flex';
          overlay.innerHTML = `
            <div class="overlay-content">
              <h1>라운드 ${rounds} 완료!</h1>
              <p>현재 총점: <b>${totalScore}</b></p>
              <button id="next-round-btn">다음 라운드</button>
            </div>
          `;
          document.getElementById('next-round-btn').addEventListener('click', () => {
            overlay.style.display = 'none';
            runRound();
          });
        }, 500);
      } else {
        showFinalLogResult(totalScore);
      }
    });
  }

  function showFinalLogResult(score) {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    const grade = score >= 250 ? 'S' : score >= 180 ? 'A' : score >= 120 ? 'B' : score >= 60 ? 'C' : 'D';
    overlay.innerHTML = `
      <div class="overlay-content">
        <h1>📋 로그 분석 완료</h1>
        <p style="font-size:24px;">최종 점수: <b style="color:#00ff88;">${score}</b></p>
        <p style="font-size:48px;color:#ffdc32;margin:20px 0;">등급: ${grade}</p>
        <div class="education-tip">
          💡 로그 분석은 SIEM(보안 정보 이벤트 관리)의 핵심입니다.
          정상 트래픽 패턴을 학습해 이상 징후를 빠르게 탐지하는 것이 중요합니다.
        </div>
        <button id="restart-log-btn">다시 시작</button>
      </div>
    `;
    document.getElementById('restart-log-btn').addEventListener('click', () => location.reload());
  }

  runRound();
}

// 전역 에러 핸들링
window.addEventListener('error', (e) => {
  console.error('Game error:', e.error);
});