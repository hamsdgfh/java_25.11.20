// DOM 요소 가져오기
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

// --- 게임 변수 설정 ---

const player = {
  x: canvas.width / 2 - 25,
  y: canvas.height - 70,
  width: 50,
  height: 50,
  color: "#4ce0ff",
  speed: 7,
  dx: 0,
};

const obstacles = [];
const obstacleSettings = {
  width: 60,
  height: 20,
  baseSpeed: 4,
  speed: 4,
  spawnInterval: 700,
};

let score = 0;
let highScore = parseInt(localStorage.getItem("dodge_highscore") || "0", 10);
let gameOver = false;
let running = false;
let obstacleSpawner = null;
let lastTimestamp = 0;

// --- 초기 HUD 세팅 ---
highScoreEl.textContent = `최고 점수: ${highScore}`;

// --- 그리기 함수 ---

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawObstacles() {
  ctx.fillStyle = "#ff6ac1";
  obstacles.forEach((obstacle) => {
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });
}

// --- 게임 로직 ---

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
    const obstacle = obstacles[i];
    obstacle.y += distance;

    if (obstacle.y > canvas.height) {
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
  // 시간이 지날수록 점수 증가 (delta 기반)
  score += delta * 0.02; // 속도 조절
  const displayScore = Math.floor(score);
  scoreEl.textContent = `점수: ${displayScore}`;

  // 점수에 비례해서 난이도 약간 상승
  obstacleSettings.speed = obstacleSettings.baseSpeed + displayScore * 0.02;
}

// 캔버스 지우기
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- 게임 상태 제어 ---

function resetGame() {
  score = 0;
  gameOver = false;
  running = true;
  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 70;
  player.dx = 0;
  obstacles.length = 0;
  obstacleSettings.speed = obstacleSettings.baseSpeed;
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
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem("dodge_highscore", String(highScore));
    highScoreEl.textContent = `최고 점수: ${highScore}`;
    overlayTitle.textContent = "신기록 달성!";
    overlayText.textContent = `점수: ${finalScore}점\n스페이스바 또는 버튼을 눌러 다시 도전!`;
  } else {
    overlayTitle.textContent = "게임 오버";
    overlayText.textContent = `점수: ${finalScore}점\n스페이스바 또는 버튼을 눌러 재시작하세요.`;
  }

  overlay.classList.remove("hidden");
}

// --- 메인 루프 ---

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

// --- 이벤트 리스너 ---

function keyDown(e) {
  if (e.key === "ArrowRight" || e.key === "Right") {
    player.dx = player.speed;
  } else if (e.key === "ArrowLeft" || e.key === "Left") {
    player.dx = -player.speed;
  } else if (e.code === "Space") {
    // 스페이스: 시작 또는 재시작
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

// 처음에는 대기 화면(오버레이)만 보여주고 시작 안 함
overlayTitle.textContent = "장애물 피하기";
overlayText.textContent = "게임 시작 버튼을 누르거나 스페이스바를 눌러 시작하세요.";
overlay.classList.remove("hidden");
running = false;
