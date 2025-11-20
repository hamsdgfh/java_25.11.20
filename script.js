// 캔버스 & DOM 요소
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

const diffButtons = document.querySelectorAll(".diff-btn");

// 난이도 설정
const difficultySettings = {
  easy: {
    spawnInterval: 900,
    baseSpeed: 3,
    playerSpeed: 7,
    label: "쉬움",
  },
  normal: {
    spawnInterval: 700,
    baseSpeed: 4,
    playerSpeed: 7.5,
    label: "보통",
  },
  hard: {
    spawnInterval: 520,
    baseSpeed: 5.5,
    playerSpeed: 8.5,
    label: "어려움",
  },
};

let currentDifficultyKey = "easy";

// 플레이어
const player = {
  x: canvas.width / 2 - 20,
  y: canvas.height - 80,
  width: 40,
  height: 60, // 캡슐 모양용
  color: "#4ce0ff",
  speed: difficultySettings[currentDifficultyKey].playerSpeed,
  dx: 0,
};

// 장애물
const obstacles = [];
const obstacleSettings = {
  width: 70,
  height: 26,
  baseSpeed: difficultySettings[currentDifficultyKey].baseSpeed,
  speed: difficultySettings[currentDifficultyKey].baseSpeed,
  spawnInterval: difficultySettings[currentDifficultyKey].spawnInterval,
};

// 게임 상태
let score = 0;
let highScore = parseInt(localStorage.getItem("dodge_highscore") || "0", 10);
let gameOver = false;
let running = false;
let obstacleSpawner = null;
let lastTimestamp = 0;

// 초기 HUD
highScoreEl.textContent = `최고 점수: ${highScore}`;

/* ---------------------------------------------------
   도형 그리기 (예쁜 버전)
--------------------------------------------------- */

// 둥근 사각형 그리기 헬퍼
function drawRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 플레이어 (네온 캡슐 + 코어)
function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const w = player.width;
  const h = player.height;

  // 바깥 네온 캡슐
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, "#4ce0ff");
  gradient.addColorStop(0.5, "#ffe66a");
  gradient.addColorStop(1, "#ff6ac1");

  ctx.save();
  ctx.shadowColor = "#4ce0ff";
  ctx.shadowBlur = 18;

  drawRoundedRect(x, y, w, h, 20);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  // 안쪽 코어
  ctx.save();
  ctx.globalAlpha = 0.9;
  const coreGradient = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    4,
    x + w / 2,
    y + h / 2,
    h / 2
  );
  coreGradient.addColorStop(0, "#ffffff");
  coreGradient.addColorStop(1, "#4ce0ff");
  ctx.fillStyle = coreGradient;
  drawRoundedRect(x + 8, y + 10, w - 16, h - 20, 14);
  ctx.fill();
  ctx.restore();
}

// 장애물 (둥근 네온 블록)
function drawObstacles() {
  obstacles.forEach((o) => {
    const gradient = ctx.createLinearGradient(o.x, o.y, o.x + o.width, o.y + o.height);
    gradient.addColorStop(0, "#ff6ac1");
    gradient.addColorStop(1, "#ffe66a");

    ctx.save();
    ctx.shadowColor = "#ff6ac1";
    ctx.shadowBlur = 16;
    drawRoundedRect(o.x, o.y, o.width, o.height, 12);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  });
}

/* ---------------------------------------------------
   게임 로직
--------------------------------------------------- */

function movePlayer() {
  player.x += player.dx;

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
}

function spawnObstacle() {
  const x = Math.random() * (canvas.width - obstacleSettings.width);
  obstacles.push({
    x,
    y: -obstacleSettings.height,
    width: obstacleSettings.width,
    height: obstacleSettings.height,
  });
}

function updateObstacles(delta) {
  const distance = obstacleSettings.speed * (delta / 16.67); // 프레임 보정
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += distance;

    if (o.y > canvas.height) {
      obstacles.splice(i, 1);
    }
  }
}

function checkCollision() {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (
      player.x < o.x + o.width &&
      player.x + player.width > o.x &&
      player.y < o.y + o.height &&
      player.y + player.height > o.y
    ) {
      endGame();
      break;
    }
  }
}

function updateScore(delta) {
  // delta 기반 점수 증가
  score += delta * 0.02;
  const displayScore = Math.floor(score);
  scoreEl.textContent = `점수: ${displayScore}`;

  // 난이도 기반 기본 속도 + 점수에 따라 추가로 조금씩 상승
  obstacleSettings.speed =
    obstacleSettings.baseSpeed + displayScore * 0.02;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ---------------------------------------------------
   난이도 변경
--------------------------------------------------- */

function setDifficulty(diffKey) {
  currentDifficultyKey = diffKey;
  const settings = difficultySettings[diffKey];

  // 플레이어 속도 & 장애물 설정 갱신
  player.speed = settings.playerSpeed;
  obstacleSettings.baseSpeed = settings.baseSpeed;
  obstacleSettings.speed = settings.baseSpeed;
  obstacleSettings.spawnInterval = settings.spawnInterval;

  // 버튼 UI 업데이트
  diffButtons.forEach((btn) => {
    if (btn.dataset.diff === diffKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 게임이 진행 중이면 장애물 생성 간격도 바로 반영
  if (running && !gameOver) {
    if (obstacleSpawner) clearInterval(obstacleSpawner);
    obstacleSpawner = setInterval(spawnObstacle, obstacleSettings.spawnInterval);
  }
}

/* ---------------------------------------------------
   게임 상태 제어
--------------------------------------------------- */

function resetGame() {
  score = 0;
  gameOver = false;
  running = true;

  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 80;
  player.dx = 0;
  obstacles.length = 0;

  // 현재 난이도 기반으로 다시 세팅
  const settings = difficultySettings[currentDifficultyKey];
  player.speed = settings.playerSpeed;
  obstacleSettings.baseSpeed = settings.baseSpeed;
  obstacleSettings.speed = settings.baseSpeed;
  obstacleSettings.spawnInterval = settings.spawnInterval;

  scoreEl.textContent = "점수: 0";

  overlay.classList.add("hidden");
  lastTimestamp = 0;

  if (obstacleSpawner) clearInterval(obstacleSpawner);
  obstacleSpawner = setInterval(spawnObstacle, obstacleSettings.spawnInterval);

  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameOver = true;
  running = false;

  if (obstacleSpawner) clearInterval(obstacleSpawner);

  const finalScore = Math.floor(score);
  const currentLabel = difficultySettings[currentDifficultyKey].label;

  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem("dodge_highscore", String(highScore));
    highScoreEl.textContent = `최고 점수: ${highScore}`;
    overlayTitle.textContent = "신기록 달성!";
    overlayText.textContent = `난이도: ${currentLabel}\n점수: ${finalScore}점\n\n스페이스바 또는 버튼을 눌러 다시 도전해보세요.`;
  } else {
    overlayTitle.textContent = "게임 오버";
    overlayText.textContent = `난이도: ${currentLabel}\n점수: ${finalScore}점\n\n스페이스바 또는 버튼을 눌러 재시작하세요.`;
  }

  overlay.classList.remove("hidden");
}

/* ---------------------------------------------------
   메인 루프
--------------------------------------------------- */

function gameLoop(timestamp) {
  if (!running) return;

  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  clearCanvas();
  movePlayer();
  updateObstacles(delta);
  checkCollision();
  updateScore(delta);
  drawPlayer();
  drawObstacles();

  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}

/* ---------------------------------------------------
   이벤트
--------------------------------------------------- */

function keyDown(e) {
  if (e.key === "ArrowRight" || e.key === "Right") {
    player.dx = player.speed;
  } else if (e.key === "ArrowLeft" || e.key === "Left") {
    player.dx = -player.speed;
  } else if (e.code === "Space") {
    if (!running) {
      resetGame();
    }
  }
}

function keyUp(e) {
  if (
    e.key === "ArrowRight" ||
    e.key === "Right" ||
    e.key === "ArrowLeft" ||
    e.key === "Left"
  ) {
    player.dx = 0;
  }
}

document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);

startBtn.addEventListener("click", () => {
  if (!running) {
    resetGame();
  }
});

// 난이도 버튼 클릭
diffButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const diffKey = btn.dataset.diff;
    setDifficulty(diffKey);
  });
});

// 초기 상태
setDifficulty("easy");
overlayTitle.textContent = "장애물 피하기";
overlayText.textContent =
  "난이도를 선택한 후\n게임 시작 버튼 또는 스페이스바를 눌러 시작하세요.";
overlay.classList.remove("hidden");
running = false;
