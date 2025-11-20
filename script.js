// 캔버스 & DOM 요소
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const livesEl = document.getElementById("lives");

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

// 플레이어 관련 설정
const playerConfig = {
  width: 40,
  height: 60,
  invincibilityDuration: 1500, // 피격 후 무적 시간(ms)
  shieldDuration: 5000,        // 쉴드 아이템 지속(ms)
  maxLives: 5,
};

let currentDifficultyKey = "easy";

// 플레이어 상태
const player = {
  x: canvas.width / 2 - playerConfig.width / 2,
  y: canvas.height - 80,
  width: playerConfig.width,
  height: playerConfig.height,
  speed: difficultySettings[currentDifficultyKey].playerSpeed,
  dx: 0,
  isInvincible: false,
  isShielded: false,
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

// 아이템 (하트/쉴드)
const items = [];
const itemSettings = {
  size: 30,
  speed: 3,
  spawnInterval: 8000, // 8초마다 한 번 정도
};

// 게임 상태
let score = 0;
let highScore = parseInt(localStorage.getItem("dodge_highscore") || "0", 10);
let lives = 3;
let gameOver = false;
let running = false;
let obstacleSpawner = null;
let itemSpawner = null;
let lastTimestamp = 0;

// 초기 HUD
highScoreEl.textContent = `최고 점수: ${highScore}`;
livesEl.innerHTML = `생명: ${"❤️".repeat(lives)}`;

/* ---------------------------------------------------
   도형 그리기 (네온 + 아이템)
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

// 플레이어 (네온 캡슐 + 코어 + 무적/쉴드 표현)
function drawPlayer() {
  const x = player.x;
  const y = player.y;
  const w = player.width;
  const h = player.height;

  // 무적 상태일 때 깜빡이기
  if (player.isInvincible) {
    ctx.globalAlpha = Date.now() % 300 < 150 ? 0.4 : 1;
  }

  // 바깥 네온 캡슐 색 (쉴드 상태면 녹색 계열)
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  if (player.isShielded) {
    gradient.addColorStop(0, "#9cff57");
    gradient.addColorStop(0.5, "#57ffb3");
    gradient.addColorStop(1, "#4ce0ff");
  } else {
    gradient.addColorStop(0, "#4ce0ff");
    gradient.addColorStop(0.5, "#ffe66a");
    gradient.addColorStop(1, "#ff6ac1");
  }

  ctx.save();
  ctx.shadowColor = player.isShielded ? "#9cff57" : "#4ce0ff";
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
  coreGradient.addColorStop(1, player.isShielded ? "#9cff57" : "#4ce0ff");
  ctx.fillStyle = coreGradient;
  drawRoundedRect(x + 8, y + 10, w - 16, h - 20, 14);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
}

// 장애물 (둥근 네온 블록)
function drawObstacles() {
  obstacles.forEach((o) => {
    const gradient = ctx.createLinearGradient(
      o.x,
      o.y,
      o.x + o.width,
      o.y + o.height
    );
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

// 하트 아이템
function drawHeart(x, y, size) {
  ctx.fillStyle = "deeppink";
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(
    x - size / 2,
    y + (size + topCurveHeight) / 2,
    x,
    y + (size + topCurveHeight) / 2,
    x,
    y + size
  );
  ctx.bezierCurveTo(
    x,
    y + (size + topCurveHeight) / 2,
    x + size / 2,
    y + (size + topCurveHeight) / 2,
    x + size / 2,
    y + topCurveHeight
  );
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
  ctx.closePath();
  ctx.fill();
}

// 쉴드 아이템 (원 + S)
function drawShield(x, y, size) {
  ctx.fillStyle = "limegreen";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("S", x + size / 2, y + size / 2 + 1);
}

// 아이템 그리기
function drawItems() {
  items.forEach((item) => {
    if (item.type === "life") {
      drawHeart(item.x, item.y, item.width);
    } else if (item.type === "shield") {
      drawShield(item.x, item.y, item.width);
    }
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

function spawnItem() {
  const size = itemSettings.size;
  const rand = Math.random();
  const type = rand < 0.6 ? "life" : "shield"; // 60% 하트, 40% 쉴드

  items.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    width: size,
    height: size,
    speed: itemSettings.speed,
    type,
  });
}

function updateEntities(list, speedKey) {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    e.y += (speedKey ? obstacleSettings.speed : e.speed) * (1 / 60);
    if (e.y > canvas.height) {
      list.splice(i, 1);
    }
  }
}

function updateObstacles(delta) {
  const distance = obstacleSettings.speed * (delta / 16.67);
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += distance;
    if (o.y > canvas.height) {
      obstacles.splice(i, 1);
    }
  }
}

function updateItems(delta) {
  const distance = itemSettings.speed * (delta / 16.67);
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += distance;
    if (item.y > canvas.height) {
      items.splice(i, 1);
    }
  }
}

// 충돌
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function checkCollisions() {
  // 장애물 충돌
  if (!player.isInvincible && !player.isShielded) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (isColliding(player, o)) {
        lives--;
        if (lives <= 0) {
          endGame();
        } else {
          setTemporaryInvincibility(playerConfig.invincibilityDuration);
        }
        break;
      }
    }
  }

  // 아이템 충돌
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (isColliding(player, item)) {
      activateItem(item.type);
      items.splice(i, 1);
    }
  }
}

function activateItem(type) {
  if (type === "life") {
    if (lives < playerConfig.maxLives) {
      lives++;
    }
  } else if (type === "shield") {
    player.isShielded = true;
    setTimeout(() => {
      player.isShielded = false;
    }, playerConfig.shieldDuration);
  }
}

function setTemporaryInvincibility(duration) {
  player.isInvincible = true;
  setTimeout(() => {
    player.isInvincible = false;
  }, duration);
}

function updateScore(delta) {
  score += delta * 0.02;
  const displayScore = Math.floor(score);
  scoreEl.textContent = `점수: ${displayScore}`;
  obstacleSettings.speed =
    obstacleSettings.baseSpeed + displayScore * 0.02;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateHUD() {
  const displayScore = Math.floor(score);
  scoreEl.textContent = `점수: ${displayScore}`;
  highScoreEl.textContent = `최고 점수: ${highScore}`;
  livesEl.innerHTML = `생명: ${"❤️".repeat(lives)}`;
}

/* ---------------------------------------------------
   난이도 변경
--------------------------------------------------- */

function setDifficulty(diffKey) {
  currentDifficultyKey = diffKey;
  const s = difficultySettings[diffKey];

  player.speed = s.playerSpeed;
  obstacleSettings.baseSpeed = s.baseSpeed;
  obstacleSettings.speed = s.baseSpeed;
  obstacleSettings.spawnInterval = s.spawnInterval;

  diffButtons.forEach((btn) => {
    if (btn.dataset.diff === diffKey) btn.classList.add("active");
    else btn.classList.remove("active");
  });

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
  lives = 3;
  gameOver = false;
  running = true;

  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 80;
  player.dx = 0;
  player.isInvincible = false;
  player.isShielded = false;
  obstacles.length = 0;
  items.length = 0;

  const s = difficultySettings[currentDifficultyKey];
  player.speed = s.playerSpeed;
  obstacleSettings.baseSpeed = s.baseSpeed;
  obstacleSettings.speed = s.baseSpeed;
  obstacleSettings.spawnInterval = s.spawnInterval;

  scoreEl.textContent = "점수: 0";
  livesEl.innerHTML = `생명: ${"❤️".repeat(lives)}`;

  overlay.classList.add("hidden");
  lastTimestamp = 0;

  if (obstacleSpawner) clearInterval(obstacleSpawner);
  if (itemSpawner) clearInterval(itemSpawner);

  obstacleSpawner = setInterval(spawnObstacle, obstacleSettings.spawnInterval);
  itemSpawner = setInterval(spawnItem, itemSettings.spawnInterval);

  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameOver = true;
  running = false;

  if (obstacleSpawner) clearInterval(obstacleSpawner);
  if (itemSpawner) clearInterval(itemSpawner);

  const finalScore = Math.floor(score);
  const label = difficultySettings[currentDifficultyKey].label;

  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem("dodge_highscore", String(highScore));
    highScoreEl.textContent = `최고 점수: ${highScore}`;
    overlayTitle.textContent = "신기록 달성!";
    overlayText.textContent = `난이도: ${label}\n점수: ${finalScore}점\n\n스페이스바 또는 버튼을 눌러 다시 도전해보세요.`;
  } else {
    overlayTitle.textContent = "게임 오버";
    overlayText.textContent = `난이도: ${label}\n점수: ${finalScore}점\n\n스페이스바 또는 버튼을 눌러 재시작하세요.`;
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
  updateItems(delta);
  checkCollisions();
  updateScore(delta);
  drawPlayer();
  drawObstacles();
  drawItems();
  updateHUD();

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
