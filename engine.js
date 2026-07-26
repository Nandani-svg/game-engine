















const CFG = {

INFLUENCE_RADIUS:  72,  
KILL_RADIUS: 9,
AVOID_RADIUS: 9,
STEP_LEN: 2.6,
AVOID_BLEND: 0.26,


BRANCH_ANGLE_DEG: 80,
MIN_BRANCH_PTS: 4,


MAX_TIPS: 580,
MAX_GEN: 13,
INIT_ENERGY: 220,
ENERGY_DECAY: 0.30,
BRANCH_ENERGY: 0.83,
NO_FOOD_DEATH: 44,


AP_COUNT: 320,
AP_RADIUS: 440,
AP_BLOBS: 3,


SPAWN_TICKS: 260,
MAX_COLONIES: 20,


DRIFT_SPEED: 0.0019,


FADE_ALPHA: 0.0055,
GLOW_RADIUS: 15,
BG_COLOR: '#05050B',
};




const rnd  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


function gaussian () {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
     return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}


function norm2 (dx, dy) {
 const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) {
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  }
  return [dx / len, dy / len];
}





function angularSpread (angles) {
if (angles.length < 2) return 0;
  const sorted = [...angles].sort((a, b) => a - b);
  const n = sorted.length;
  let maxGap = 0;
  for (let i = 1; i < n; i++) maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
  
maxGap = Math.max(maxGap, sorted[0] + Math.PI * 2 - sorted[n - 1]);
  return Math.PI * 2 - maxGap;
}






function splitAtGap (pts, tx, ty) {
const items = pts.map(p => ({ p, a: Math.atan2(p.y - ty, p.x - tx) }));
  items.sort((a, b) => a.a - b.a);
  const n = items.length;
  let maxGap = 0, splitAfter = 0;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    let gap = items[next].a - items[i].a;
    if (next === 0) gap += Math.PI * 2;
    if (gap > maxGap) { maxGap = gap; splitAfter = i; }
  }
  const groupA = items.slice(0, splitAfter + 1).map(x => x.p);
  const groupB = items.slice(splitAfter + 1).map(x => x.p);
  return [groupA, groupB];
}


function avgDir (tx, ty, pts) {
    let dx = 0; dy = 0;
    for (const p of pts) {
 const [ux, uy] = norm2(p.x - tx, p.y - ty);
 dx += ux; dy += uy;
    }
return norm2(dx, dy);
}




class SpatialHash {
    constructor (cellsize) {
        this.cs = cellsize;
        this.cells = new Map();
    }


_k (x, y) {
 return `${Math.floor(x / this.cs)},${Math.floor(y / this.cs)}`;
}


insert (item) {
    const k = this._k(item.x, item.y);
    item._shk = k;
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(item);
}


remove (item) {
    const c = this.cells.get(item._shk);
    if (!c) return;
    const i = c.indexOf(item);
    if (i >= 0) c.splice(i, 1);
}


query (x, y, r) {
    const r2 = r * r, cs = this.cs;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    const res = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const c = this.cells.get(`${cx},${cy}`);
        if (!c) continue;
        for (const item of c) {
          const ddx = item.x - x, ddy = item.y - y;
          if (ddx * ddx + ddy * ddy <= r2) res.push(item);
        }
      }
    }
    return res;
  }


queryBox (x0, y0, x1, y1) {
    const cs = this.cs;
 const cx0 = Math.floor(x0 / cs), cx1 = Math.floor(x1 / cs);
    const cy0 = Math.floor(y0 / cs), cy1 = Math.floor(y1 / cs);
    const res = [];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const c = this.cells.get(`${cx},${cy}`);
        if (c) for (const item of c) res.push(item);
      }
    }
    return res;
  }

clear () { this.cells.clear(); }
}






function hsl2rgb (h, s, l) {
 s /= 100; l /= 100;
 const k = n => (n + h / 30) % 12;
 const a = s * Math.min(l, 1 - l);
const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255);
return  [f(0), f(8), f(4)];
}





function makePalette (hue) {
    return [
  hsl2rgb(hue % 360,            75, 62),   // primary
    hsl2rgb((hue + 48) % 360,     62, 52),   // secondary
    hsl2rgb((hue + 22) % 360,     88, 72),   // highlight
    hsl2rgb((hue + 205) % 360,    52, 58),   // accent complement
  ];
}




const PFXS = ['Xylo','Vena','Myco','Rhiz','Ferro','Cryo','Lumen','Osmo','Petra','Nema','Arbo','Spiro','Aero','Hydro'];
const SFXS = ['phyte','morph','derm','plasm','zoan','spore','form','lith','cyte','thrix','cyst','vore','clast','blast'];
let _nc = 0;
function makeName () {
  const name = `${PFXS[_nc % PFXS.length]}${SFXS[Math.floor(_nc / PFXS.length) % SFXS.length]}`;
  _nc++;
  return name;
}




class Colony {
    constructor (id, x, y, tick) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.spawnTick = tick;
        this.phase = Math.random() * Math.PI * 2;
        this.hue = (180 + id * 137.508) % 360;
        this.palette = makePalette(this.hue);
        this.name = makeName();
        this.segCount = 0;
        this.maxDepth = 0;
        this.attractionPointsRemaining = 0;
        this.active = true;
    }   


ir (tick) {
    return CFG.INFLUENCE_RADIUS * (0.68 + 0.52 * Math.sin(tick * CFG.DRIFT_SPEED + this.phase));
  }

 kr (tick) {
    return CFG.KILL_RADIUS * (0.52 + 0.78 * Math.sin(tick * CFG.DRIFT_SPEED * 1.7 + this.phase * 1.45));
  }

 bat (tick) {
    return CFG.BRANCH_ANGLE_DEG * (0.60 + 0.70 * Math.sin(tick * CFG.DRIFT_SPEED * 0.68 + this.phase * 0.88)) * Math.PI / 180;
  }

sw (gen) { return Math.max(0.35, 2.5 - gen * 0.16); }

col (gen) { return this.palette[gen % 4]; }

 css (gen) { const [r,g,b] = this.col(gen); return `rgb(${r},${g},${b})`; }
}




class Tip {
   constructor (x, y, dx, dy, energy, gen, colId) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.energy = energy;
    this.gen = gen;
    this.colId = colId;
    this.noFood = 0;
    this.alive = true;
    this.lastSegIdx = -1;
   }
}  




class AP {
  constructor (x, y, colId) {
    this.x = x;
    this.y = y;
    this.colId = colId;
    this.alive = true;
    this._shk = null;
  }
}




class SegNode {
    constructor (x, y, idx) {
        this.x = x;
        this.y = y;
        this.idx = idx;
        this._shk = null;
    }
}




class SegStore {
    constructor () {
        this.n = 0;
        this.cap = 0;
        this.x1 = null; this.y1 = null;
        this.x2 = null; this.y2 = null;
        this.lw = null;
        this.cr = null; this.cg = null; this.cb = null; 
        this._grow(65536);
    }

_grow (cap) {
    const prev = this.n;
    this.cap = cap;
    const cpF = old => { const a = new Float32Array(cap); if (old) a.set(old.subarray(0, prev)); return a; };
        const cpU = old => { const a = new Uint8Array(cap);   if (old) a.set(old.subarray(0, prev)); return a; };
        this.x1 = cpF(this.x1); this.y1 = cpF(this.y1);
        this.x2 = cpF(this.x2); this.y2 = cpF(this.y2);
        this.lw = cpF(this.lw);
        this.cr = cpU(this.cr); this.cg = cpU(this.cg); this.cb = cpU(this.cb);
      }

add (x1, y1, x2, y2, lw, r, g, b) {
    if (this.n >= this.cap) this._grow(this.cap * 2);
    const i = this.n++;
    this.x1[i] = x1; this.y1[i] = y1;
    this.x2[i] = x2; this.y2[i] = y2;
    this.lw[i] = lw;
    this.cr[i] = r; this.cg[i] = g; this.cb[i] = b;
    return i;
  }
}




class AudioEngine {
  constructor () {
    this.ctx = null;
    this.master = null;
    this.drone = null;
    this.active = false;
  }

 _init () {
    if (this.ctx) return;
    this.ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    
    
const freq = [55, 82.4, 110];
 this.oscs = freqs.map(f => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f + rnd(-0.5, 0.5);
      gain.gain.value = 0.25 / freqs.length;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      return osc;
    });
    

 const lpf = this.ctx.createBiquadFilter();
 lpf.type = 'lowpass';
 lpf.frequency.value = 400;
 this.master.connect(lpf);
 lpf.connect(this.ctx.destination);
}

enable () {
    this._init();
     if (this.ctx.state === 'suspended') this.ctx.resume();
     this.active = true;
}

disable () {
 if (this.master) this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
this.active = false;
}


chime (f = 400) {
 if (!this.active || !this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const env  = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    env.gain.setValueAtTime(0, this.ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.6);
    osc.connect(env);
    env.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.7);
  }    


setActivity (tipCount) {
    if (!this.active || !this.oscs) return;
    const t = this.ctx.currentTime;
    const mod = 1 + tipCount / 3000;
     this.oscs.forEach((o, i) => {
          const base = [55, 82.4, 110][i];
          o.frequency.linearRampToValueAtTime(base * mod, t + 0.5);
        });
      }
    }




    class GrowthEngine {
       constructor () {
        
 this.canvas   = document.getElementById('world');
 this.ctx      = this.canvas.getContext('2d', { alpha: false });
 this.dpr = 1;
 this.W = 0;
 this.W = 0;


 this.cam = { x: 0, y: 0, scale: 1 };


 this.tick = 0;
 this.tips = [];
 this.colonies = [];
 this.segments = new SegStore();
 this.apHash =  new SpatialHash(CFG.INFLUENCE_RADIUS); 
 this.segHash = new SpatialHash(20);
this.allAP = [];
this._nextSpawn = CFG.SPAWN_TICKS;


this.lastRenderedSeg = 0;
this.needsFullRedraw = true;
this.showGlow = true;
this.showAP = false;
this.speedMult = 1;
this._pendingNewTips = [];


this.hoveredColony = null;
this.lockedColony = null;
this._isPanning = false;


this._fpsLast = performance.now();
this._fpsFrames = 0
this._fps = 60;


this.audio = new AudioEngine();


this._setupCanvas();
this._setupUI();
this._spawnColony(0, 0);

requestAnimationFrame(ts => this._loop(ts));
}





_setupCanvas () {
    const resize = () => {
  this.dpr = window.devicePixelRatio || 1;
  this.W = window.innerWidth;
  this.H = window.innerHeight;
  this.canvas.width = this.W * this.dpr;
  this.canvas.height = this.H * this.dpr;
  this.canvas.style.width  = this.W + 'px';
  this.canvas.style.height = this.H + 'px';

  if (this.cam.x === 0 && this.cam.y === 0) {
    this.cam.x = this.W / 2;
    this.cam.y = this.H / 2;
  }
 this.needsFullRedraw = true;
    };
    resize();
    new ResizeObserver(resize).observe(document.documentElement);
  }

  _setupUI () {
    const canvas = this.canvas;


let drag = null;
canvas.addEventListener('mousedown', e => {
      drag = { sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y };
  this._isPanning = false;
});
window.addEventListener('mousemove', e => {
  if (drag) {
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
  this._isPanning = true;
  this.cam.x = drag.cx + dx;
  this.cam.y = drag.cy + dy;
  this.needsFullRedraw = true;
}
  } else {
 this._hoverUpdate(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', e => {
      if (!this._isPanning && drag) this._clickAt(e.clientX, e.clientY);
      drag = null;
    });    
canvas.addEventListener('wheel', e => {
  e.preventDefault();
    const mx = e.clientX, my = e.clientY;
        this.cam.x = mx - (mx - this.cam.x) * factor;
        this.cam.y = my - (my - this.cam.y) * factor;
        this.cam.scale = clamp(this.cam.scale * factor, 0.04, 12);
        this.needsFullRedraw = true;
}, { passive: false });



let pinch0 = null, pinchScale0 = 1;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
     drag = { sx: t.clientX, sy: t.clientY, cx: this.cam.x, cy: this.cam.y };
     this._isPanning = false;
     pinch0 = null;
  } else if (e.touches.length === 2) {
   const dx = e.touches[1].clientX - e.touches[0].clientX;
   const dy = e.touches[1].clientY - e.touches[0].clientY;
   pinch0 = Math.sqrt(dx * dx + dy * dy);
   pinchScale0 = this.cam.scale;
   drag = null;
  }
}, { passive: false });
 canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && drag) {
        const t = e.touches[0];
        const dx = t.clientX - drag.sx, dy = t.clientY - drag.sy;
if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
  this._isPanning = true;
  this.cam.x = drag.cx + dx;
  this.cam.y = drag.cy + dy;
  this.needsFullRedraw = true;
}
} else if (e.touches.length === 2 && pinch0 !== null) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const d  = Math.sqrt(dx * dx + dy * dy);
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const newScale = clamp(pinchScale0 * (d / pinch0), 0.04, 12);
        this.cam.x = mx - (mx - this.cam.x) / this.cam.scale * newScale;
        this.cam.y = my - (my - this.cam.y) / this.cam.scale * newScale;
        this.cam.scale = newScale;
        this.needsFullRedraw = true;
}
}, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!this._isPanning && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        this._clickAt(t.clientX, t.clientY);
      }
      drag = null; pinch0 = null;
    }, { passive: false });


const speedSlider = document.getElementById('ctrl-speed');
const speedVal = document.getElementById('speed-val');
speedSlider.addEventListener('input', () => {
  this.speedMult = +speedSlider.value;
speedVal.textContent = this.speedMult + '×';
    });

const glowBtn = document.getElementById('ctrl-glow');
glowBtn.addEventListener('click', () => {
  this.showGlow = !this.showGlow;
 glowBtn.classList.toggle('active', this.showGlow);
      glowBtn.setAttribute('aria-pressed', this.showGlow);
    });

const apBtn = document.getElementById('ctrl-ap');
apBtn.addEventListener('click', () => {
this.showAP = !this.showAP;
  apBtn.classList.toggle('active', this.showAP);
      apBtn.setAttribute('aria-pressed', this.showAP);
      this.needsFullRedraw = true;
    });

const audioBtn = document..getElementById('ctrl-audio');
audioBtn.addEventListener('click', () => {
  if (!this.audio.active) {
    this.audio.enable();
    audioBtn.classList.add('active');
    audioBtn.textContent = '♪ ON';
     audioBtn.setAttribute('aria-pressed', 'true');
          } else {
    this.audio.disable();
    audioBtn.classList.remove('active');
    audioBtn.textContent = '♪ OFF';
    audioBtn.setAttribute('aria-pressed', 'false');
          }
        });

document.getElementById('ctrl-home').addEventListener('click', () => {
  this.cam.x = this.W / 2;
  this.cam.y = this.H / 2;
  this.cam.scale = 1;
  this.needsFullRedraw = true;
});

document.getElementById('insp-close').addEventListener('click', () => {
  this.lockedColony = null;
  this._hideInspector();
});
  }





_spawnColony (wx, wy) {
 const col = new Colony(this.colonies.length, wx, wy, this.tick);
 this.colonies.push(col);
 this._seedAP(col);
 
 
 const nTips = 4 + Math.floor(Math.random() * 3);
 for (let i = 0; i < nTips; i++) {
const angle = (i / nTips) * Math.PI * 2 + rnd(-0.2, 0.2);
 this.tips.push(new Tip(wx, wy, Math.cos(angle), Math.sin(angle), CFG.INIT_ENERGY, 0, col.id));
 }


   const chimeFreq = 110 * Math.pow(2, (col.hue / 360) * 2);
    this.audio.chime(chimeFreq);
    
  return col;
}


_seedAP (colony) {

  const centres = [];
  for (let b = 0; b <  CFG.AP_BLOBS; b++) {
    centres.push({
        x: colony.x + gaussian() * CFG.AP_RADIUS * 0.45,
              y: colony.y + gaussian() * CFG.AP_RADIUS * 0.45,
            });
          }

const perBlob = Math.ceil(CFG.AP_COUNT / CFG.AP_BLOBS);
let added = 0;

for (const centre of centres) {
 for (let i = 0; i < perBlob && added < CFG.AP_COUNT; i++) {
  const spread = CFG.AP_RADIUS * 0.38;
  const px = centre.x + gaussian() * spread;
  const py = centre.y + gaussian() * spread;
  const ap = new AP(px, py, colony.id);
  this.apHash.insert(ap);
  this.allAP.push(ap);
  added++;
 }
}
 colony.attractionPointsRemaining = added;
}


_growthCentroid () {
if (this.tips.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const t of this.tips) { sx += t.x; sy += t.y; }
    return { x: sx / this.tips.length, y: sy / this.tips.length };
}  





_simTick () {
  this.tick++;


if (this.tick >= this._nextSpawn) {
this._nextSpawn = this.tick + CFG.SPAWN_TICKS + Math.floor(rnd(-20, 40));
if (this.colonies.length < CFG.MAX_COLONIES) {
  const c = this._growthCenttroid();
  const angle = Math.random() * Math.PI * 2;
  const dist = rnd(250, 600);
  this._spawnColony(
     c.x + Math.cos(angle) * dist,
              c.y + Math.sin(angle) * dist,
            );
          }
        }


this._pendingNewTips.length = 0;
const len = this.tips.length;
for (let ti = 0; ti < len; ti++) {
  const tip = this.tips[ti];
  if (!tip.alive) continue;
  this._tickTip(tip);
      }
      

  for (let i = this.tips.length - 1; i >= 0; i--) {
    for(!this.tips[i].alive) this.tips.splice(i, 1);
  }


for (const t of this._pendingNewTips) {
  if (this.tips.length < CFG.MAX_TIPS) this.tips.push(t);
    }


for (const col of this.colonies) {
  if (!col.active) continue;
  const hasTips = this.tips.some(t => t.colId === col.id);
      if (!hasTips && col.attractionPointsRemaining <= 0) col.active = false;
    }
  }
  
  

_tickTip (tip) {
const col = this.colonies[tip.colId];
if (!col) { tip.alive = false; return; }

const ir = col.ir(this.tick);
const kr = col.kr(this.tick);
const bat = col.bat(this.tick);


const nearby = this.apHash.query(tip.x, tip.y, ir).filter(p => p.alive);

let ndx, ndy;
let doBranch = false;
let groupA = null;
let groupB = null;

if (nearby.length === 0) {

tip.noFood++;
    if (tip.noFood > CFG.NO_FOOD_DEATH) { tip.alive = false; return; }
    const perturb = rnd(-0.28, 0.28);
     const cos = Math.cos(perturb), sin = Math.sin(perturb);
     ndx = tip.dx * cos - tip.dy * sin;
     ndy = tip.dx * sin + tip.dy * cos;
      [ndx, ndy] = norm2(ndx, ndy);
} else {
  tip.noFood = 0;

if (nearby.length >= CFG.MIN_BRANCH_PTS) {

 const angles = nearby.map(p => Math.atan2(p.y - tip.y, p.x - tip.x));
 const spread = angularSpread(angles);

 if (spread > bat) {

  [groupA, groupB] = splitAtGap(nearby, tip.x, tip.y);
          if (groupA.length > 0 && groupB.length > 0) {
            doBranch = true;
            [ndx, ndy] = avgDir(tip.x, tip.y, groupA);
          } else {
            [ndx, ndy] = avgDir(tip.x, tip.y, nearby);
          }
        } else {
             [ndx, ndy] = avgDir(tip.x, tip.y, nearby);
                  }
                } else {
                  [ndx, ndy] = avgDir(tip.x, tip,y, nearby);
                }
              }


const tentX = tip.x + ndx * CFG.STEP_LEN;
const tentY = tip.y + ndy * CFG.STEP_LEN;
    const segsNear = this.segHash.query(tentX, tentY, CFG.AVOID_RADIUS);

if (segsNear.length > 0) {
let nearestNode = null, nearestD2 = Infinity;
 for (const node of segsNear) {
        if (node.idx === tip.lastSegIdx) continue;
        const dx2 = node.x - tentX, dy2 = node.y - tentY;
        const d2 = dx2 * dx2 + dy2 * dy2;
           if (d2 < nearestD2) { nearestD2 = d2; nearestNode = node; }
 }
 if (nearestNode) {

 const [rx, ry] = norm2(tentX - nearestNode.x, tentY - nearestNode.y);
 const b = CFG.AVOID_BLEND;
 ndx = ndx * (1 - b) + rx * b;
 ndy = ndy * (1 - b) + ry * b;
   [ndx, ndy] = norm2(ndx, ndy);
      }
    }
    
    
const nx = tip.x + ndx * CFG.STEP_LEN;
const ny = tip.y + ndy * CFG.STEP_LEN;


  const consumable = this.apHash.query(nx, ny, kr).filter(p => p.alive);
  for (const ap of consumable) {
    ap.alive = false;
    this.apHash.remove(ap);
    const owner = this.colonies[ap.colId];
 if (owner) owner.attractionPointsRemaining = Math.max(0, owner.attractionPointsRemaining - 1);
  }


  const [r, g, b] = col.col(tip.gen);
  const lw = col.sw(tip.gen);
  const segIdx = this.segments.add(tip.x, tip.y, nx, ny, lw, r, g, b);
  tip.lastSegIdx = segIdx;


 const node = new SegNode((tip.x + nx) * 0.5, (tip.y + ny) * 0.5, segIdx);
 this.segHash.insert(node);
 
 
 col.segCount++;
  if (tip.gen > col.maxDepth) col.maxDepth = tip.gen;


  tip.x = nx; tip.y = ny;
  tip.dx = ndx; tip.dy = ndy;
  tip.energy -= CFG.ENERGY_DECAY;

if (tip.energy <= 0 || tip.gen >= CFG.MAX_GEN) {
  tip.alive = false;
  return;
}


if (doBranch && groupB && groupB.length > 0 && tip.gen < CFG.MAX_GEN - 1) {
      const [d2x, d2y] = avgDir(nx, ny, groupB);
      const childEnergy = tip.energy * CFG.BRANCH_ENERGY;
      tip.energy = childEnergy;

   const child = new Tip(nx, ny, d2x, d2y, childEnergy, tip.gen + 1, tip.colId);
      child.lastSegIdx = segIdx;
      this._pendingNewTips.push(child);
    }
  }






_applyCam () {
  const { cam, dpr } = this;
  this.ctx.setTransform(
    cam.scale * dpr, 0, 0,
    cam.scale * dpr,
    cam.x * dpr, cam.y * dpr,
  );
}


_applyScreen () {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

_render () {
  const ctx = this.ctx;
  const { W, H, cam } = this;

  if (this.needsFullRedraw) {

    this._applyScreen();
    ctx.fillStyle = CFG.BG_COLOR;
    ctx.fillRect(0, 0, W, H);


    this._applyCam();
    this._drawGrid();


  const margin = CFG.INFLUENCE_RADIUS * 2;
      const invS   = 1 / cam.scale;
      const vx0 = (-cam.x) * invS - margin, vy0 = (-cam.y) * invS - margin;
      const vx1 = vx0 + W * invS + margin * 2, vy1 = vy0 + H * invS + margin * 2;

      this._applyCam();
      this._drawSegs(0, this.segments.n, vx0, vy0, vx1, vy1);
      if (this.showAP) this._drawAP();

      this.lastRenderedSeg = this.segments.n;
      this.needsFullRedraw = false;

  } else {

  this._applyScreen();
     ctx.fillStyle = `rgba(5,5,11,${CFG.FADE_ALPHA})`;
     ctx.fillRect(0, 0, W, H);


this._applyCam();
this._drawGrid();

this._applyCam();
  this._drawSegs(this.lastRenderedSeg, this.segments.n);
      if (this.showAP) this._drawAP();

this.lastRenderedSeg = this.segments.n;
  }


  if (this.showGlow) {
    this._applyCam();
    this._drawGlows();
  }
}






_drawSeg (from, to, vx0, vy0, vx1, vy1) {
  if (from >= to) return;
  const ctx = this.ctx;
   const { x1, y1, x2, y2, lw, cr, cg, cb } = this.segments;
   const cull = vx0 !== undefined;

   ctx.lineCap = 'round';
   ctx.lineJoin = 'round';

  let pR = -1, pG = -1, pB = -1, pW = -1;
  let open = false;

for (let i = from; i < to; i++) {
  if (cull) {

      const mx = (x1[i] + x2[i]) * 0.5, my = (y1[i] + y2[i]) * 0.5;
        if (mx < vx0 || mx > vx1 || my < vy0 || my > vy1) continue;
      }

const r = cr[i], g = cg[i], b = cb[i], w = lw[i];

 if (r !== pR || g !== pG || b !== pB || Math.abs(w - pW) > 0.01) {
        if (open) ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth   = w;
        pR = r; pG = g; pB = b; pW = w;
        open = true;
 }
 ctx.moveTo(x1[i], y1[i]);
 ctx.lineTo(x2[i], y2[i]);
     }
if (open) ctx.stroke();
    }


_drawGlows () {
  const ctx = this.ctx;
  const gr =  CFG.GLOW_RADIUS;
  for (const tip of this.tips) {
  const col = this.colonies[tip.colId];
  if (!col) continue;
    const [r, g, b] = col.col(tip.gen);
        const grad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, gr);
        grad.addColorStop(0,   `rgba(${r},${g},${b},0.72)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.3)`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, gr, 0, Math.PI * 2);
        ctx.fil();
  }
}


_drawAP () {
  const ctx = this.ctx;
  for (const ap of this.allAP) {
    if (!ap.alive) continue;
    const col = this.colonies[ap.colId];
    if (col) {
      const [r,g,b] = col.col(0);
              ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
            } else {
   ctx.fillStyle = 'rgba(180,200,255,0.25)';
        }
        ctx.beginPath();
        ctx.arc(ap.x, ap.y, 2.2, 0, Math.PI * 2);  
    ctx.fill();
      }
    }


_drawGrid () {
  const ctx = this.ctx;
  const { cam, W, H, dpr } = this;
  const step = 80;
  const alpha = clamp(0.025 * cam.scale, 0.005, 0.06);
  
   ctx.fillStyle = `rgba(100,130,230,${alpha})`;
    ctx.setTransform(cam.scale * dpr, 0, 0, cam.scale * dpr, cam.x * dpr, cam.y * dpr);

    const invS = 1 / cam.scale;
    const wx0  = (-cam.x) * invS, wy0 = (-cam.y) * invS;
    const wx1  = wx0 + W * invS,  wy1 = wy0 + H * invS;

    const gx0 = Math.floor(wx0 / step) * step;
    const gy0 = Math.floor(wy0 / step) * step;

     for (let gx = gx0; gx <= wx1 + step; gx += step) {
          for (let gy = gy0; gy <= wy1 + step; gy += step) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1.2 / cam.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }






_toWorld (sx, sy) {
  return [
    (sx - this.cam.x) / this.cam.scale,
    (sy - this.cam.y) / this.cam.scale,
  ];
}


 _nearestColony (wx, wy, thresh) {
  let best = null, bestD2 = thresh * thresh;
  for (const col of this.colonies) {
     const dx = col.x - wx, dy = col.y - wy;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; best = col; }
        }
        return best;
      }

_hoverUpdate (sx, sy) {
    if (this.lockedColony) return;
    const [wx, wy] = this._toWorld(sx, sy);
    const col = this._nearestColony(wx, wy, 130 / this.cam.scale);
    if (col !== this.hoveredColony) {
      this.hoveredColony = col;
      if (col) this._showInspector(col);
      else     this._hideInspector();
    }
  }

 _clickAt (sx, sy) {
    const [wx, wy] = this._toWorld(sx, sy);
    const col = this._nearestColony(wx, wy, 100 / this.cam.scale);
    if (col) {
      this.lockedColony = this.lockedColony === col ? null : col;
      if (this.lockedColony) this._showInspector(this.lockedColony);
      else this._hideInspector();
    } else {
      this.lockedColony = null;
      this._hideInspector();
    }
  }
  
_showInspector (col) {
document.getElementById('insp-name').textContent = col.name;

