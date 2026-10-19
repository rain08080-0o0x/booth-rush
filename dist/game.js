(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    time: document.getElementById("timeValue"),
    distance: document.getElementById("distanceValue"),
    progress: document.getElementById("progressBar"),
    stamina: document.getElementById("staminaValue"),
    staminaBar: document.getElementById("staminaBar"),
    startOverlay: document.getElementById("startOverlay"),
    resultOverlay: document.getElementById("resultOverlay"),
    resultKicker: document.getElementById("resultKicker"),
    resultTitle: document.getElementById("resultTitle"),
    resultScore: document.getElementById("resultScore"),
    resultMessage: document.getElementById("resultMessage"),
    sound: document.getElementById("soundButton")
  };

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const ROUND_TIME = 45;
  const START_X = 68;
  const GOAL_X = 820;
  const colors = ["#ff6a9f", "#6b8cff", "#f4c45c", "#63d8c6", "#aa74f7", "#f47c5b"];
  const input = { up: false, down: false, left: false, right: false, push: false };
  let state = "ready";
  let timeLeft = ROUND_TIME;
  let lastTime = performance.now();
  let elapsed = 0;
  let crowd = [];
  let particles = [];
  let shake = 0;
  let soundOn = true;
  let audioContext = null;

  const player = {
    x: START_X,
    y: HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: 13,
    stamina: 100,
    facingX: 1,
    facingY: 0,
    pushing: false,
    pushGlow: 0
  };

  function random(min, max) { return min + Math.random() * (max - min); }

  function createCrowd() {
    crowd = [];
    const columns = [175, 255, 340, 430, 520, 610, 700, 765];
    columns.forEach((baseX, columnIndex) => {
      const count = columnIndex === 7 ? 4 : 5;
      const spacing = HEIGHT / count;
      for (let row = 0; row < count; row += 1) {
        crowd.push({
          x: baseX + random(-27, 27),
          y: spacing * (row + 0.5) + random(-28, 28),
          baseY: spacing * (row + 0.5),
          vx: random(-5, 5),
          vy: random(18, 35) * (Math.random() > 0.5 ? 1 : -1),
          radius: random(13, 18),
          phase: random(0, Math.PI * 2),
          color: colors[(row + columnIndex * 2) % colors.length],
          mood: Math.floor(random(0, 3))
        });
      }
    });
  }

  function resetGame() {
    player.x = START_X;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.stamina = 100;
    player.facingX = 1;
    player.facingY = 0;
    player.pushGlow = 0;
    timeLeft = ROUND_TIME;
    elapsed = 0;
    particles = [];
    shake = 0;
    createCrowd();
    updateHud();
  }

  function startGame() {
    ensureAudio();
    resetGame();
    state = "playing";
    ui.startOverlay.classList.remove("is-visible");
    ui.resultOverlay.classList.remove("is-visible");
    beep(260, 0.07, "square", 0.04);
    setTimeout(() => beep(420, 0.11, "square", 0.04), 90);
  }

  function finishGame(won) {
    if (state !== "playing") return;
    state = won ? "won" : "lost";
    if (won) {
      ui.resultKicker.textContent = "MISSION CLEAR";
      ui.resultKicker.style.color = "#51f6e0";
      ui.resultTitle.textContent = "たどり着いた！";
      ui.resultScore.textContent = timeLeft.toFixed(1);
      ui.resultScore.nextElementSibling.textContent = "秒残し";
      ui.resultMessage.textContent = timeLeft > 20
        ? "人波の切れ目を見逃さない、最短ルートの押し進み！"
        : "ぎりぎりでも到着すれば勝ち。最後の一歩が光りました。";
      chord([523, 659, 784]);
    } else {
      ui.resultKicker.textContent = "TIME UP";
      ui.resultKicker.style.color = "#ff5aa5";
      ui.resultTitle.textContent = "人波に阻まれた…";
      ui.resultScore.textContent = Math.max(0, Math.min(100, Math.round((player.x - START_X) / (GOAL_X - START_X) * 100)));
      ui.resultScore.nextElementSibling.textContent = "% 到達";
      ui.resultMessage.textContent = "押し続けず、流れが開いた瞬間に進むのがコツ。もう一度！";
      beep(155, 0.35, "sawtooth", 0.035);
    }
    setTimeout(() => ui.resultOverlay.classList.add("is-visible"), 380);
  }

  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function beep(frequency, duration, type = "sine", volume = 0.025) {
    if (!soundOn || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function chord(notes) {
    notes.forEach((note, index) => setTimeout(() => beep(note, .22, "triangle", .035), index * 95));
  }

  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt;
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft <= 0) finishGame(false);

    let dx = Number(input.right) - Number(input.left);
    let dy = Number(input.down) - Number(input.up);
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    if (dx || dy) {
      player.facingX = dx;
      player.facingY = dy;
    }

    player.pushing = input.push && player.stamina > 1 && (dx || dy);
    const acceleration = player.pushing ? 780 : 520;
    const maxSpeed = player.pushing ? 195 : 120;
    if (player.pushing) {
      player.stamina = Math.max(0, player.stamina - 35 * dt);
      player.pushGlow = Math.min(1, player.pushGlow + dt * 6);
      if (Math.random() < dt * 18) addTrail();
    } else {
      player.stamina = Math.min(100, player.stamina + 19 * dt);
      player.pushGlow = Math.max(0, player.pushGlow - dt * 5);
    }

    player.vx += dx * acceleration * dt;
    player.vy += dy * acceleration * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = player.vx / speed * maxSpeed;
      player.vy = player.vy / speed * maxSpeed;
    }
    const drag = Math.pow(0.0008, dt);
    player.vx *= drag;
    player.vy *= drag;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(28, Math.min(WIDTH - 26, player.x));
    player.y = Math.max(42, Math.min(HEIGHT - 30, player.y));

    crowd.forEach((person) => {
      person.phase += dt;
      person.x += (person.vx + Math.sin(person.phase * .8) * 7) * dt;
      person.y += person.vy * dt;
      if (person.y < 44 || person.y > HEIGHT - 30) {
        person.vy *= -1;
        person.y = Math.max(44, Math.min(HEIGHT - 30, person.y));
      }
      if (person.x < 140 || person.x > 795) person.vx *= -1;

      const cx = person.x - player.x;
      const cy = person.y - player.y;
      const distance = Math.hypot(cx, cy);
      const minimum = person.radius + player.radius + 2;
      if (distance < minimum && distance > 0) {
        const nx = cx / distance;
        const ny = cy / distance;
        const overlap = minimum - distance;
        if (player.pushing) {
          person.x += nx * overlap * 1.45;
          person.y += ny * overlap * 1.45;
          person.vx += nx * 30;
          person.vy += ny * 28;
          player.x -= nx * overlap * .08;
          if (Math.random() < .12) beep(100 + Math.random() * 40, .035, "square", .008);
        } else {
          player.x -= nx * overlap * .68;
          player.y -= ny * overlap * .68;
          player.vx -= nx * 80;
          player.vy -= ny * 80;
          person.x += nx * overlap * .22;
          shake = Math.max(shake, 2.4);
        }
      }
    });

    particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    });
    particles = particles.filter((particle) => particle.life > 0);
    shake = Math.max(0, shake - dt * 9);

    if (player.x > GOAL_X && player.y > 176 && player.y < 384) finishGame(true);
    updateHud();
  }

  function addTrail() {
    particles.push({
      x: player.x - player.facingX * 15 + random(-5, 5),
      y: player.y - player.facingY * 15 + random(-5, 5),
      vx: -player.facingX * random(35, 70),
      vy: -player.facingY * random(35, 70),
      life: random(.12, .28),
      maxLife: .28
    });
  }

  function updateHud() {
    const progress = Math.max(0, Math.min(1, (player.x - START_X) / (GOAL_X - START_X)));
    ui.time.textContent = timeLeft.toFixed(1);
    ui.time.style.color = timeLeft < 10 ? "#ff5aa5" : "";
    ui.distance.textContent = `${Math.ceil((1 - progress) * 85)}m`;
    ui.progress.style.width = `${progress * 100}%`;
    ui.stamina.textContent = `${Math.round(player.stamina)}%`;
    ui.staminaBar.style.width = `${player.stamina}%`;
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawFloor() {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#17142d");
    gradient.addColorStop(1, "#211434");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    for (let y = 30; y < HEIGHT; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,.035)";
    ctx.fillRect(0, 0, WIDTH, 32);
    ctx.fillStyle = "#80789c";
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.fillText("ENTRANCE", 24, 21);
    ctx.fillText("← HALL FLOW →", 392, 21);
  }

  function drawGoal() {
    ctx.save();
    const pulse = .65 + Math.sin(elapsed * 4) * .18;
    ctx.shadowColor = "#ff5aa5";
    ctx.shadowBlur = 28 * pulse;
    ctx.fillStyle = `rgba(255,90,165,${.12 + pulse * .08})`;
    roundedRect(810, 158, 90, 244, 13);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ff5aa5";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#27152d";
    roundedRect(822, 188, 78, 182, 8);
    ctx.fill();
    ctx.fillStyle = "#ff5aa5";
    ctx.fillRect(810, 158, 90, 38);
    ctx.fillStyle = "#160f26";
    ctx.textAlign = "center";
    ctx.font = "900 11px IBM Plex Mono, monospace";
    ctx.fillText("TARGET", 855, 174);
    ctx.fillText("BOOTH", 855, 188);
    ctx.fillStyle = "#f9ea62";
    ctx.font = "900 32px Noto Sans JP, sans-serif";
    ctx.fillText("物", 855, 285);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "700 10px Noto Sans JP, sans-serif";
    ctx.fillText("限定グッズ", 855, 311);
    ctx.restore();
  }

  function drawPerson(person) {
    ctx.save();
    ctx.translate(person.x, person.y);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(2, person.radius + 8, person.radius * .85, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = person.color;
    ctx.beginPath(); ctx.arc(0, 4, person.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8b18f";
    ctx.beginPath(); ctx.arc(0, -person.radius + 3, person.radius * .58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = person.mood === 0 ? "#35243d" : person.mood === 1 ? "#553343" : "#25233d";
    ctx.beginPath(); ctx.arc(0, -person.radius, person.radius * .6, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    const angle = Math.atan2(player.facingY, player.facingX);
    ctx.rotate(angle);
    if (player.pushGlow > 0) {
      ctx.strokeStyle = `rgba(81,246,224,${player.pushGlow * .7})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 22 + player.pushGlow * 6, -2.3, 2.3); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(-2, 18, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#51f6e0";
    ctx.beginPath(); ctx.arc(0, 2, player.radius + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#20163b";
    ctx.beginPath(); ctx.arc(0, -10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f9ea62";
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#f9ea62";
    ctx.font = "900 10px IBM Plex Mono, monospace";
    ctx.fillText("YOU", player.x, player.y - 27);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      ctx.fillStyle = `rgba(81,246,224,${particle.life / particle.maxLife})`;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawFloor();
    drawGoal();
    drawParticles();
    [...crowd].sort((a, b) => a.y - b.y).forEach(drawPerson);
    drawPlayer();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(.032, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  const keyMap = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "push"
  };

  window.addEventListener("keydown", (event) => {
    const action = keyMap[event.code];
    if (!action) return;
    event.preventDefault();
    input[action] = true;
    if (state === "ready" && event.code === "Space") startGame();
  });
  window.addEventListener("keyup", (event) => {
    const action = keyMap[event.code];
    if (action) input[action] = false;
  });
  window.addEventListener("blur", () => Object.keys(input).forEach((key) => { input[key] = false; }));

  document.querySelectorAll("[data-key]").forEach((button) => {
    const action = button.dataset.key;
    const release = (event) => {
      event.preventDefault();
      input[action] = false;
      button.classList.remove("is-held");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      input[action] = true;
      button.classList.add("is-held");
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
  });

  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("retryButton").addEventListener("click", startGame);
  ui.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    ui.sound.textContent = soundOn ? "♪" : "×";
    ui.sound.setAttribute("aria-label", soundOn ? "サウンドをオフにする" : "サウンドをオンにする");
    if (soundOn) { ensureAudio(); beep(440, .08); }
  });

  resetGame();
  requestAnimationFrame(frame);
})();
