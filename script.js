'use strict';

const IMAGE_PATH = 'img/bubu-very-small.png';
const CURSOR_IMAGE_SIZE = 56; // must match .cursor-follower size in CSS
const SOUND_ENABLED = true;

const COLORS = [
  { id: 'red',      name: 'ROȘII',      css: '#ff3b4e' },
  { id: 'blue',     name: 'ALBASTRE',   css: '#2f80ff' },
  { id: 'green',    name: 'VERZI',      css: '#2ecc71' },
  { id: 'yellow',   name: 'GALBENE',    css: '#ffd400' },
  { id: 'purple',   name: 'MOV',        css: '#9b5de5' },
  { id: 'orange',   name: 'PORTOCALII', css: '#ff8c1a' }
];

const DIFFICULTIES = {
  easy: {
    balloons: 8,
    needsClick: false,
    useTarget: false,
    instruction: 'Mișcă mouse-ul peste baloane ca să le spargi!'
  },
  medium: {
    balloons: 10,
    needsClick: true,
    useTarget: false,
    instruction: 'Apasă pe baloane ca să le spargi!'
  },
  hard: {
    balloons: 14,
    needsClick: true,
    useTarget: true,
    targetCount: 5,
    instruction: 'Apasă doar pe baloanele de culoarea cerută!'
  },
  expert: {
    balloons: 48,
    needsClick: true,
    useTarget: true,
    targetCount: 16,
    sizeFactor: 0.6, // smaller balloons so that more of them fit on screen
    instruction: 'Apasă doar pe baloanele de culoarea cerută!'
  }
};

const $ = (id) => document.getElementById(id);

const menuScreen = $('menu-screen');
const gameScreen = $('game-screen');
const playArea = $('play-area');
const winOverlay = $('win-overlay');
const remainingEl = $('remaining');
const instructionEl = $('instruction');
const targetBox = $('target-box');
const targetSwatch = $('target-swatch');
const targetName = $('target-name');
const messageEl = $('message');
const finalTimeEl = $('final-time');
const cursorToggle = $('cursor-toggle');
const toggleImg = $('toggle-img');
const cursorFollower = $('cursor-follower');

let currentDifficulty = null;
let currentTarget = null;
let remaining = 0;
let startTime = 0;
let messageTimer = null;
let audioCtx = null;

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pickRandom = (list) => list[randInt(0, list.length - 1)];

function showScreen(name) {
  menuScreen.classList.toggle('hidden', name !== 'menu');
  gameScreen.classList.toggle('hidden', name !== 'game');
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => messageEl.classList.remove('show'), 1600);
}

function playPopSound() {
  if (!SOUND_ENABLED || !audioCtx) return;

  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(rand(450, 800), t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  } catch (e) { /* sound is optional */ }
}

function prepareAudio() {
  if (!SOUND_ENABLED) return;

  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();

    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* sound is optional */ }
}

function generatePositions(count, areaW, areaH, size) {
  const balloonW = size;
  const balloonH = size * 1.2 + size * 0.5; // body + string
  const margin = 10;
  const maxX = Math.max(0, areaW - balloonW - margin);
  const maxY = Math.max(0, areaH - balloonH - margin);
  const positions = [];

  for (let i = 0; i < count; i++) {
    let spot = null;

    for (let attempt = 0; attempt < 400 && !spot; attempt++) {
      const x = rand(margin, Math.max(margin, maxX));
      const y = rand(margin, Math.max(margin, maxY));
      const overlaps = positions.some((p) =>
        Math.abs(p.x - x) < balloonW + margin && Math.abs(p.y - y) < balloonH + margin
      );

      if (!overlaps) spot = { x, y };
    }

    // If the screen is too small, allow a little overlap instead of failing
    positions.push(spot || { x: rand(margin, Math.max(margin, maxX)), y: rand(margin, Math.max(margin, maxY)) });
  }

  return positions;
}

function buildColorList(config) {
  const colors = [];

  if (config.useTarget) {
    const others = COLORS.filter((c) => c.id !== currentTarget.id);

    for (let i = 0; i < config.targetCount; i++) colors.push(currentTarget);

    for (let i = colors.length; i < config.balloons; i++) colors.push(pickRandom(others));
  } else {
    for (let i = 0; i < config.balloons; i++) colors.push(pickRandom(COLORS));
  }

  return colors;
}

function startGame(difficulty) {
  const config = DIFFICULTIES[difficulty];
  currentDifficulty = difficulty;
  prepareAudio();

  winOverlay.classList.add('hidden');
  playArea.innerHTML = '';
  showScreen('game');
  instructionEl.textContent = config.instruction;

  if (config.useTarget) {
    currentTarget = pickRandom(COLORS);
    targetSwatch.style.setProperty('--swatch', currentTarget.css);
    targetName.textContent = currentTarget.name;
    targetName.style.color = currentTarget.css;
    targetBox.classList.remove('hidden');
  } else {
    currentTarget = null;
    targetBox.classList.add('hidden');
  }

  const colors = buildColorList(config);
  remaining = config.useTarget ? config.targetCount : config.balloons;
  remainingEl.textContent = remaining;

  const rect = playArea.getBoundingClientRect();
  const baseSize = Math.max(64, Math.min(104, Math.min(rect.width, rect.height) * 0.15));
  const size = Math.round(baseSize * (config.sizeFactor || 1));
  const positions = generatePositions(colors.length, rect.width, rect.height, size);

  colors.forEach((color, i) => {
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.dataset.color = color.id;
    balloon.style.setProperty('--c', color.css);
    balloon.style.setProperty('--size', size + 'px');
    balloon.style.setProperty('--delay', (-rand(0, 3)).toFixed(2) + 's');
    balloon.style.left = positions[i].x + 'px';
    balloon.style.top = positions[i].y + 'px';

    if (config.needsClick) {
      balloon.addEventListener('pointerdown', () => tryPop(balloon, config));
    } else {
      balloon.addEventListener('pointerenter', () => tryPop(balloon, config));
    }
    playArea.appendChild(balloon);
  });

  startTime = performance.now();
}

function tryPop(balloon, config) {
  if (balloon.classList.contains('pop')) return;

  if (config.useTarget && balloon.dataset.color !== currentTarget.id) {
    balloon.classList.remove('shake');
    void balloon.offsetWidth; // restart animation
    balloon.classList.add('shake');
    balloon.addEventListener('animationend', () => balloon.classList.remove('shake'), { once: true });
    showMessage('Ups! Caută baloanele de culoarea ' + currentTarget.name.toLowerCase() + '!');
    return;
  }

  popBalloon(balloon);
  remaining--;
  remainingEl.textContent = remaining;

  if (remaining === 0) setTimeout(showWin, 600);
}

function popBalloon(balloon) {
  balloon.classList.add('pop');
  playPopSound();
  spawnConfetti(balloon);
  setTimeout(() => balloon.remove(), 300);
}

function spawnConfetti(balloon) {
  const cx = balloon.offsetLeft + balloon.offsetWidth / 2;
  const cy = balloon.offsetTop + balloon.offsetHeight / 2;
  const color = balloon.style.getPropertyValue('--c');

  for (let i = 0; i < 12; i++) {
    const piece = document.createElement('span');
    const angle = (Math.PI * 2 * i) / 12 + rand(-0.2, 0.2);
    const distance = rand(50, 100);
    piece.className = 'confetti';
    piece.style.left = cx + 'px';
    piece.style.top = cy + 'px';
    piece.style.setProperty('--c', i % 3 === 0 ? '#fff' : color);
    piece.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
    piece.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
    playArea.appendChild(piece);
    setTimeout(() => piece.remove(), 750);
  }
}

function showWin() {
  const seconds = Math.round((performance.now() - startTime) / 1000);
  finalTimeEl.textContent = seconds;
  winOverlay.classList.remove('hidden');
}

function goToMenu() {
  winOverlay.classList.add('hidden');
  playArea.innerHTML = '';
  showScreen('menu');
}

// Fallback if the PNG is missing: use a ladybug emoji drawn as SVG
const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#fff"/>' +
  '<text x="50" y="76" font-size="72" text-anchor="middle">🐞</text></svg>'
);

[toggleImg, cursorFollower].forEach((img) => {
  img.addEventListener('error', () => {
    if (img.src !== FALLBACK_IMAGE) img.src = FALLBACK_IMAGE;
  });
  img.src = IMAGE_PATH;
});

let mouseX = -100;
let mouseY = -100;

function moveFollower() {
  // The hotspot (the exact click point) is the center of the image
  const half = CURSOR_IMAGE_SIZE / 2;
  cursorFollower.style.transform = `translate(${mouseX - half}px, ${mouseY - half}px)`;
}

function setLadybugCursor(on) {
  document.body.classList.toggle('ladybug-cursor', on);
  cursorFollower.classList.toggle('active', on);
  cursorToggle.dataset.mode = on ? 'arrow' : 'ladybug';
  const label = on ? 'Înapoi la săgeată' : 'Folosește buburuza ca cursor';
  cursorToggle.setAttribute('aria-label', label);
  cursorToggle.title = label;
  moveFollower();
}

cursorToggle.addEventListener('click', (e) => {
  if (e.clientX || e.clientY) { mouseX = e.clientX; mouseY = e.clientY; }
  setLadybugCursor(cursorToggle.dataset.mode === 'ladybug');
  cursorFollower.classList.add('visible');
});

document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorFollower.classList.add('visible');
  moveFollower();
});

document.documentElement.addEventListener('mouseleave', () => cursorFollower.classList.remove('visible'));

document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.difficulty));
});

$('restart-btn').addEventListener('click', () => startGame(currentDifficulty));
$('menu-btn').addEventListener('click', goToMenu);
$('back-btn').addEventListener('click', goToMenu);
