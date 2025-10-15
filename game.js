const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let vw = 0; let vh = 0;
function resizeCanvas(){
  vw = Math.floor(window.innerWidth);
  vh = Math.floor(window.innerHeight);
  canvas.width = Math.floor(vw * DPR);
  canvas.height = Math.floor(vh * DPR);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const hudScore = document.getElementById('score');
const hudHigh = document.getElementById('highscore');
const hudOvertakes = document.getElementById('overtakes');
const hudSpeed = document.getElementById('speed');
const hudLevel = document.getElementById('level');
const hudPowerup = document.getElementById('powerup');

// Game state
const State = {
  isRunning: false,
  isGameOver: false,
  time: 0,
  score: 0,
  highScore: 0,
  overtakes: 0,
  level: 1,
  baseSpeed: 380, // px/s
  speed: 0,
  laneCount: 5,
  lanePadding: 18,
  player: null,
  obstacles: [],
  rivals: [],
  particles: [],
  powerups: [],
  activePowerup: null,
  trackOffset: 0
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return Math.random() * (max - min) + min; }
function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function createPlayer(){
  const w = 36; const h = 56;
  return {
    x: vw * 0.5 - w * 0.5,
    y: vh * 0.78,
    w, h,
    vx: 0,
    steering: 0,
    color: '#00fff0',
    ghostUntil: 0,
    turboUntil: 0
  };
}

function spawnObstacle(){
  const laneWidth = (vw - State.lanePadding * 2) / State.laneCount;
  const lane = Math.floor(rand(0, State.laneCount));
  const w = laneWidth * 0.7;
  return {
    type: 'obstacle',
    x: State.lanePadding + lane * laneWidth + (laneWidth - w) * 0.5,
    y: -60,
    w,
    h: 24,
    color: '#ff00e6'
  };
}

function spawnRival(){
  const laneWidth = (vw - State.lanePadding * 2) / State.laneCount;
  const lane = Math.floor(rand(0, State.laneCount));
  const w = 34; const h = 54;
  return {
    type: 'rival',
    x: State.lanePadding + lane * laneWidth + (laneWidth - w) * 0.5,
    y: vh + rand(120, 240),
    w, h,
    vy: -rand(180, 260),
    color: '#7cff00',
    passed: false
  };
}

function spawnPowerup(){
  const laneWidth = (vw - State.lanePadding * 2) / State.laneCount;
  const lane = Math.floor(rand(0, State.laneCount));
  const kinds = ['turbo','ghost'];
  const kind = choice(kinds);
  const size = 20;
  return {
    type: 'powerup', kind,
    x: State.lanePadding + lane * laneWidth + laneWidth * 0.5 - size,
    y: -60,
    w: size * 2, h: size * 2
  };
}

function resetGame(){
  State.isRunning = false;
  State.isGameOver = false;
  State.time = 0;
  State.score = 0;
  State.highScore = Number(localStorage.getItem('neon-velocity:highScore')||0);
  State.overtakes = 0;
  State.level = 1;
  State.speed = 0;
  State.player = createPlayer();
  State.obstacles.length = 0;
  State.rivals.length = 0;
  State.powerups.length = 0;
  State.particles.length = 0;
  State.activePowerup = null;
  State.trackOffset = 0;
}

resetGame();

// Input
const Input = {
  left: false, right: false,
  using: false
};

window.addEventListener('keydown', (e)=>{
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') Input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') Input.right = true;
  if (e.code === 'Space') Input.using = true;
  if (e.code === 'Enter' && !State.isRunning) startGame();
});
window.addEventListener('keyup', (e)=>{
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') Input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') Input.right = false;
  if (e.code === 'Space') Input.using = false;
});

// Touch input
let touchId = null;
let lastTouchX = 0;
window.addEventListener('touchstart', (e)=>{
  if (!State.isRunning) startGame();
  if (touchId === null && e.changedTouches.length > 0){
    const t = e.changedTouches[0];
    touchId = t.identifier; lastTouchX = t.clientX;
  } else if (e.changedTouches.length >= 2){
    Input.using = true;
  }
},{passive:true});
window.addEventListener('touchmove', (e)=>{
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    if (t.identifier === touchId){
      const dx = t.clientX - lastTouchX;
      State.player.x += dx;
      lastTouchX = t.clientX;
    }
  }
},{passive:true});
window.addEventListener('touchend', (e)=>{
  for (let i=0;i<e.changedTouches.length;i++){
    const t = e.changedTouches[i];
    if (t.identifier === touchId){
      touchId = null;
    }
  }
  Input.using = false;
});

function startGame(){
  resetGame();
  State.isRunning = true;
}

// Utility
function aabb(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Update loop
let lastTs = 0;
function frame(ts){
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function update(dt){
  const p = State.player;
  if (!State.isRunning){
    State.trackOffset += 120 * dt;
    return;
  }

  State.time += dt;
  // Speed scaling with level
  const targetSpeed = State.baseSpeed + (State.level - 1) * 60 + (p.turboUntil > State.time ? 180 : 0);
  State.speed += (targetSpeed - State.speed) * Math.min(1, 4 * dt);
  State.trackOffset += State.speed * dt * 0.06;

  // Level increases every 20 seconds; clamp to keep sessions short
  if (Math.floor(State.time / 20) + 1 !== State.level){
    State.level = Math.floor(State.time / 20) + 1;
  }

  // Input steering
  const steer = (Input.left? -1:0) + (Input.right? 1:0);
  p.vx += steer * 1800 * dt;
  p.vx *= 0.86; // friction
  p.x += p.vx * dt;
  const minX = State.lanePadding;
  const maxX = vw - State.lanePadding - p.w;
  p.x = clamp(p.x, minX, maxX);

  // Spawn logic
  if (Math.random() < 0.9 * dt){ State.obstacles.push(spawnObstacle()); }
  if (Math.random() < 0.8 * dt){ State.rivals.push(spawnRival()); }
  if (Math.random() < 0.15 * dt){ State.powerups.push(spawnPowerup()); }

  // Move entities
  const roadVy = State.speed; // world moves downward
  for (const o of State.obstacles){ o.y += roadVy * dt; }
  for (const r of State.rivals){ r.y += (roadVy + r.vy) * dt; }
  for (const u of State.powerups){ u.y += roadVy * dt; }
  // Particles
  for (const part of State.particles){
    part.y += part.vy * dt;
    part.life -= dt;
  }
  State.particles = State.particles.filter(p => p.life > 0 && p.y < vh + 40);

  // Cleanup out-of-bounds
  State.obstacles = State.obstacles.filter(o => o.y < vh + 60);
  State.rivals = State.rivals.filter(r => r.y > -120);
  State.powerups = State.powerups.filter(u => u.y < vh + 60);

  // Overtakes scoring
  for (const r of State.rivals){
    if (!r.passed && r.y < p.y){
      r.passed = true;
      State.overtakes += 1;
      State.score += 100 + Math.floor(State.speed * 0.2);
    }
  }

  // Collisions
  const isGhost = p.ghostUntil > State.time;
  if (!isGhost){
    for (const o of State.obstacles){
      if (aabb(p, o)) return gameOver();
    }
    for (const r of State.rivals){
      if (aabb(p, r)) return gameOver();
    }
  }

  // Power-up pickup
  for (let i=State.powerups.length-1;i>=0;i--){
    const u = State.powerups[i];
    if (aabb(p, u)){
      State.powerups.splice(i,1);
      if (u.kind === 'turbo') p.turboUntil = State.time + 3;
      if (u.kind === 'ghost') p.ghostUntil = State.time + 3;
      State.score += 50; // reward pickups
    }
  }

  // Manual use (space / two-finger tap) converts to turbo if none active
  if (Input.using){
    if (p.turboUntil < State.time && p.ghostUntil < State.time){
      p.turboUntil = State.time + 1.2;
    }
    Input.using = false;
  }

  // Emit speed-line particles for motion feel
  const speedFactor = clamp((State.speed - 280) / 240, 0, 1);
  const emitCount = Math.floor(10 * speedFactor * dt * 60);
  for (let i=0;i<emitCount;i++){
    const px = p.x + p.w * 0.5 + rand(-p.w*0.6, p.w*0.6);
    const py = p.y + p.h * 0.7 + rand(-6, 6);
    State.particles.push({
      x: px,
      y: py,
      vx: 0,
      vy: State.speed * rand(1.2, 1.8),
      len: rand(8, 18),
      life: rand(0.18, 0.32),
      hue: Math.random() < 0.5 ? '#00fff0' : '#ff00e6'
    });
  }

  // HUD
  // passive score: distance and speed factor
  State.score += Math.floor(State.speed * 0.04);
  if (State.score > State.highScore){
    State.highScore = State.score;
    localStorage.setItem('neon-velocity:highScore', String(State.highScore));
  }
  hudScore.textContent = `Score: ${State.score}`;
  hudHigh.textContent = `Best: ${State.highScore}`;
  hudOvertakes.textContent = `Overtakes: ${State.overtakes}`;
  hudSpeed.textContent = `Speed: ${Math.round(State.speed)}`;
  hudLevel.textContent = `Level: ${State.level}`;
  const pu = p.turboUntil > State.time ? 'Turbo' : (p.ghostUntil > State.time ? 'Ghost' : '—');
  hudPowerup.textContent = `Power-up: ${pu}`;
}

function gameOver(){
  State.isGameOver = true;
  State.isRunning = false;
}

function render(){
  // Background track grid and lane markers
  ctx.clearRect(0,0,vw,vh);
  drawTrack();
  if (State.player) drawPlayer(State.player);
  for (const o of State.obstacles) drawObstacle(o);
  for (const r of State.rivals) drawRival(r);
  for (const u of State.powerups) drawPowerup(u);
  drawParticles();

  drawCenterVignette();
  drawStartOrGameOverText();
}

function drawTrack(){
  const laneWidth = (vw - State.lanePadding * 2) / State.laneCount;
  const meter = 28;
  const offset = State.trackOffset % meter;
  ctx.save();
  // Lane boundaries
  ctx.strokeStyle = 'rgba(0,255,240,0.35)';
  ctx.lineWidth = 2;
  for (let i=0;i<=State.laneCount;i++){
    const x = Math.floor(State.lanePadding + i * laneWidth) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vh);
    ctx.stroke();
  }
  // Dashes
  ctx.strokeStyle = 'rgba(255,0,230,0.4)';
  ctx.lineWidth = 3;
  for (let x = State.lanePadding + laneWidth/2; x < vw - State.lanePadding; x += laneWidth){
    for (let y = -meter; y < vh + meter; y += meter*2){
      ctx.beginPath();
      ctx.moveTo(x, y + offset);
      ctx.lineTo(x, y + meter + offset);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPlayer(p){
  const isGhost = p.ghostUntil > State.time;
  ctx.save();
  ctx.translate(p.x + p.w/2, p.y + p.h/2);
  const tilt = clamp((p.vx/600), -0.25, 0.25);
  ctx.rotate(tilt);
  const w = p.w, h = p.h;
  // body
  ctx.fillStyle = isGhost ? 'rgba(0,255,240,0.35)' : p.color;
  roundRect(-w/2, -h/2, w, h, 10);
  ctx.fill();
  // neon outline
  ctx.strokeStyle = 'rgba(0,255,240,0.7)';
  ctx.lineWidth = 2;
  roundRect(-w/2, -h/2, w, h, 10);
  ctx.stroke();
  // jet trails when turbo
  if (p.turboUntil > State.time){
    ctx.strokeStyle = 'rgba(255,0,230,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w*0.3, h*0.6);
    ctx.lineTo(-w*0.45, h*0.95);
    ctx.moveTo(w*0.3, h*0.6);
    ctx.lineTo(w*0.45, h*0.95);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacle(o){
  ctx.save();
  ctx.fillStyle = 'rgba(255,0,230,0.75)';
  roundRect(o.x, o.y, o.w, o.h, 6);
  ctx.fill();
  ctx.restore();
}

function drawRival(r){
  ctx.save();
  ctx.fillStyle = 'rgba(124,255,0,0.8)';
  roundRect(r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(u){
  ctx.save();
  ctx.translate(u.x + u.w/2, u.y + u.h/2);
  const size = Math.min(u.w, u.h) * 0.6;
  if (u.kind === 'turbo'){
    ctx.strokeStyle = '#ff00e6';
    ctx.lineWidth = 3;
    drawLightning(-size/2,0, size/2,0, 4);
  } else {
    ctx.strokeStyle = '#00fff0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0,0,size/2,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(){
  ctx.save();
  for (const p of State.particles){
    const alpha = clamp(p.life / 0.32, 0, 1);
    ctx.strokeStyle = p.hue.replace(')', ', ' + alpha + ')').replace('#00fff0', 'rgba(0,255,240').replace('#ff00e6','rgba(255,0,230');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + p.len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCenterVignette(){
  const grad = ctx.createRadialGradient(vw/2, vh*0.7, 40, vw/2, vh*0.7, Math.max(vw,vh));
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,vw,vh);
}

function drawStartOrGameOverText(){
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  if (!State.isRunning && !State.isGameOver){
    ctx.font = '700 28px Orbitron, sans-serif';
    ctx.fillText('Neon Velocity', vw/2, vh*0.36);
    ctx.font = '400 16px Orbitron, sans-serif';
    ctx.fillText('Press Enter or Tap to Start', vw/2, vh*0.42);
  }
  if (State.isGameOver){
    ctx.font = '700 26px Orbitron, sans-serif';
    ctx.fillText('Crash! Game Over', vw/2, vh*0.4);
    ctx.font = '400 16px Orbitron, sans-serif';
    ctx.fillText(`Score ${State.score}  •  Best ${State.highScore}`, vw/2, vh*0.46);
    ctx.fillText('Press Enter or Tap to Retry', vw/2, vh*0.52);
  }
  ctx.restore();
}

// Drawing helpers
function roundRect(x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
}

function drawLightning(x1, y1, x2, y2, segments){
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i=1;i<segments;i++){
    const t = i/segments;
    const x = x1 + (x2 - x1) * t + rand(-6,6);
    const y = y1 + (y2 - y1) * t + rand(-4,4);
    ctx.lineTo(x,y);
  }
  ctx.lineTo(x2,y2);
  ctx.stroke();
}


