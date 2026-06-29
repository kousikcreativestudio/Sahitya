const CACHE_VERSION = '102';

const preloadImages = [
  `./assets/game-bg.jpg?v=${CACHE_VERSION}`,
  `./assets/wish-bg.png?v=${CACHE_VERSION}`,
  `./assets/gift-box.png?v=${CACHE_VERSION}`
];

preloadImages.forEach(src => {
  const img = new Image();
  img.src = src;
});

const photos = [
  'photos/photo1.jpg',
  'photos/photo2.jpg',
  'photos/photo3.jpg',
  'photos/photo4.jpg',
  'photos/photo5.jpg',
  'photos/photo6.jpg',
  'photos/photo7.jpg',
  'photos/photo8.jpg',
  'photos/photo9.jpg',
  'photos/photo10.jpg',
  'photos/photo11.jpg',
  'photos/photo12.jpg'
];

const fullPhotoSources = [
  'photos/fullphoto.jpg',
  'photos/fullphoto.jpg.jpg',
  'photos/fullphoto.png',
  'photos/fullphoto.jpeg',
  'photos/fullphoto.webp'
];

const TARGET_STARS = 20;
const TEXT_FORM_MS = 1250;
const BLUR_BEFORE_GIFT_MS = 6400;
const SECOND_GIFT_DELAY_MS = 7300;
const PHOTO_DURATION_MS = 5200;
const FULL_PHOTO_DISPLAY_MS = 9000;

let collected = 0;
let gameRunning = false;
let spawnTimer = null;
let firstGiftClicked = false;
let secondGiftClicked = false;
let audioCtx = null;
let musicStarted = false;
let musicTimer = null;
let musicIndex = 0;
let activeSoundNodes = [];
let textParticles = [];
let textAnimating = false;
let textStartTime = 0;
let photoRunId = 0;
let surpriseFinished = false;
let cachedFullPhoto = null;

const app = document.getElementById('app');
const screens = {
  start: document.getElementById('startScreen'),
  game: document.getElementById('gameScreen'),
  gift: document.getElementById('giftScreen'),
  wish: document.getElementById('wishScreen'),
  photo: document.getElementById('photoScreen'),
  finalPhoto: document.getElementById('fullPhotoScreen'),
  final: document.getElementById('finalScreen')
};

const playBtn = document.getElementById('playBtn');
const gameLayer = document.getElementById('gameLayer');
const score = document.getElementById('score');
const firstGift = document.getElementById('firstGift');
const secondGift = document.getElementById('secondGift');
const secondLabel = document.getElementById('secondLabel');
const flash = document.getElementById('flash');
const photoStage = document.getElementById('photoStage');
const photoCount = document.getElementById('photoCount');
const replayBtn = document.getElementById('replayBtn');
const fullPhotoPopup = document.getElementById('fullPhotoPopup');
const fullPhotoImg = document.getElementById('fullPhotoImg');
const canvas = document.getElementById('starTextCanvas');
const ctx = canvas.getContext('2d');
const photoCache = new Map();

function show(name){
  Object.values(screens).forEach(s => s && s.classList.remove('active'));
  if(screens[name]) screens[name].classList.add('active');

  // Stop every scheduled/running music note when the surprise is complete.
  if(name === 'final'){
    setTimeout(stopMusic, 100);
  }
}

function initAudio(){
  if(surpriseFinished) return;

  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if(audioCtx.state === 'suspended'){
    audioCtx.resume();
  }

  if(!musicStarted){
    musicStarted = true;
    startMusic();
  }
}

function tone(freq, dur = .2, type = 'sine', vol = .09, delay = 0){
  if(!audioCtx || !freq || surpriseFinished) return;

  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  activeSoundNodes.push({ source: o, gain: g });

  o.type = type;
  o.frequency.setValueAtTime(freq, t);

  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + .02);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);

  o.connect(g);
  g.connect(audioCtx.destination);

  o.onended = function(){
    try{ o.disconnect(); }catch(e){}
    try{ g.disconnect(); }catch(e){}
    activeSoundNodes = activeSoundNodes.filter(n => n.source !== o);
  };

  o.start(t);
  o.stop(t + dur + .05);
}

function noiseSweep(dur=.32, vol=.045, delay=0){
  if(!audioCtx || surpriseFinished) return;

  const t = audioCtx.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for(let i=0;i<bufferSize;i++){
    const fade = 1 - (i / bufferSize);
    data[i] = (Math.random() * 2 - 1) * fade;
  }

  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  activeSoundNodes.push({ source, filter, gain });

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(450, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + dur);
  filter.Q.setValueAtTime(0.8, t);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  source.onended = function(){
    try{ source.disconnect(); }catch(e){}
    try{ filter.disconnect(); }catch(e){}
    try{ gain.disconnect(); }catch(e){}
    activeSoundNodes = activeSoundNodes.filter(n => n.source !== source);
  };

  source.start(t);
  source.stop(t + dur + 0.02);
}

function collectSound(){
  tone(900,.1,'sine',.11);
  tone(1280,.17,'triangle',.085,.05);
}

function boxSound(){
  tone(220,.18,'sine',.08);
  tone(440,.25,'triangle',.1,.08);
  tone(880,.42,'sine',.09,.18);
  tone(1320,.5,'triangle',.065,.28);
}

function revealSound(){
  tone(392,.35,'sine',.08);
  tone(523,.42,'triangle',.09,.14);
  tone(784,.52,'sine',.085,.3);
  tone(1046,.66,'triangle',.075,.46);
}

function photoSound(){
  // Different from star-collect ding: camera whoosh + soft shutter sparkle.
  noiseSweep(.34, .052, 0);
  tone(180, .045, 'square', .018, .03);
  tone(120, .055, 'square', .014, .08);
  tone(740, .10, 'triangle', .020, .15);
  tone(1480, .14, 'sine', .018, .23);
}

function finalPhotoSound(){
  tone(164,.35,'sine',.09);
  tone(328,.48,'triangle',.09,.10);
  tone(656,.70,'sine',.08,.28);
  tone(984,.85,'triangle',.06,.48);
  tone(1312,.95,'sine',.04,.62);
}

function photoLightFlash(target, strong=false){
  if(!target) return;
  const fx = document.createElement('div');
  fx.className = strong ? 'photoLightFx strong' : 'photoLightFx';
  target.appendChild(fx);
  setTimeout(() => fx.remove(), strong ? 1500 : 900);
}

function startMusic(){
  // Birthday melody, played one note at a time so stopMusic can stop it fully.
  if(musicTimer){
    clearTimeout(musicTimer);
    musicTimer = null;
  }

  musicIndex = 0;

  const melody = [
    [392.00,.32], [392.00,.32], [440.00,.65], [392.00,.65], [523.25,.65], [493.88,1.15], [0,.35],
    [392.00,.32], [392.00,.32], [440.00,.65], [392.00,.65], [587.33,.65], [523.25,1.15], [0,.35],
    [392.00,.32], [392.00,.32], [783.99,.65], [659.25,.65], [523.25,.65], [493.88,.65], [440.00,1.25], [0,.35],
    [698.46,.32], [698.46,.32], [659.25,.65], [523.25,.65], [587.33,.65], [523.25,1.40], [0,1.20]
  ];

  function playNextNote(){
    if(!musicStarted || surpriseFinished || !audioCtx) return;

    const note = melody[musicIndex % melody.length];
    const freq = note[0];
    const dur = note[1];

    if(freq > 0){
      tone(freq, dur, 'sine', .034, 0);
      tone(freq * 2, dur * .72, 'triangle', .013, .04);
      tone(freq / 2, dur * .9, 'sine', .010, .02);
    }

    musicIndex++;
    musicTimer = setTimeout(playNextNote, dur * 1000);
  }

  playNextNote();
}

function stopMusic(){
  surpriseFinished = true;
  musicStarted = false;

  if(musicTimer){
    clearTimeout(musicTimer);
    clearInterval(musicTimer);
    musicTimer = null;
  }

  activeSoundNodes.forEach(n => {
    try{ n.source.stop(0); }catch(e){}
    try{ n.source.disconnect(); }catch(e){}
    try{ n.filter && n.filter.disconnect(); }catch(e){}
    try{ n.gain && n.gain.disconnect(); }catch(e){}
  });
  activeSoundNodes = [];

  if(audioCtx){
    try{ audioCtx.close(); }catch(e){}
    audioCtx = null;
  }
}

function updateScore(){
  score.textContent = `Stars ${collected} / ${TARGET_STARS}`;
}

function makeAmbientStars(){
  document.querySelectorAll('.ambientDot').forEach(d=>d.remove());
  const w = app.clientWidth;
  const h = app.clientHeight;
  for(let i=0;i<95;i++){
    const d=document.createElement('div');
    d.className = 'ambientDot' + (Math.random()>.75?' gold':'');
    const s = 2 + Math.random()*3;
    d.style.width=s+'px';
    d.style.height=s+'px';
    d.style.left=Math.random()*w+'px';
    d.style.top=Math.random()*h+'px';
    d.style.setProperty('--dur',(2+Math.random()*3)+'s');
    gameLayer.appendChild(d);
  }
}

function spawnStar(initial=false){
  if(!gameRunning) return;
  const w = app.clientWidth;
  const h = app.clientHeight;
  const star = document.createElement('div');
  const size = 34 + Math.random()*18;
  star.className='fallStar';
  star.style.width=size+'px';
  star.style.height=size+'px';
  star.style.fontSize=(size*.88)+'px';
  star.style.left=(8 + Math.random()*(w-size-16))+'px';
  star.style.setProperty('--start', initial ? (-Math.random()*h*.95-30)+'px' : '-70px');
  star.style.setProperty('--end', (h + 120 + Math.random()*100)+'px');
  star.style.setProperty('--drift', (Math.random()*90-45)+'px');
  star.style.animationDuration=(6.5 + Math.random()*2.8)+'s';

  const trail=document.createElement('div');
  trail.className='trail';
  star.appendChild(trail);

  star.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(!gameRunning) return;
    const r=star.getBoundingClientRect();
    star.remove();
    collected++;
    updateScore();
    collectSound();
    sparkBurst(r.left+r.width/2,r.top+r.height/2,16);
    if(collected >= TARGET_STARS) finishGame();
  }, {once:true});

  star.addEventListener('animationend',()=>star.remove());
  gameLayer.appendChild(star);
}

function startGame(){
  surpriseFinished = false;
  initAudio();
  show('game');
  collected=0;
  updateScore();
  gameLayer.innerHTML='';
  makeAmbientStars();
  gameRunning=true;
  clearInterval(spawnTimer);
  for(let i=0;i<15;i++) spawnStar(true);
  spawnTimer=setInterval(()=>spawnStar(false),550);
}

function finishGame(){
  gameRunning=false;
  clearInterval(spawnTimer);
  document.querySelectorAll('.fallStar').forEach(s=>s.remove());
  setTimeout(() => {
    firstGift.classList.remove('open');
    firstGift.style.visibility = 'visible';
    firstGiftClicked = false;
    show('gift');
  }, 550);
}

function sparkBurst(x,y,n=12){
  for(let i=0;i<n;i++){
    const sp=document.createElement('div');
    sp.className='spark';
    sp.style.left=x+'px';
    sp.style.top=y+'px';
    sp.style.setProperty('--x',(Math.random()*150-75)+'px');
    sp.style.setProperty('--y',(Math.random()*150-75)+'px');
    app.appendChild(sp);
    setTimeout(()=>sp.remove(),820);
  }
}

function flashOpen(){
  flash.classList.remove('show');
  void flash.offsetWidth;
  flash.classList.add('show');
}

function resizeCanvas(){
  const r=canvas.getBoundingClientRect();
  canvas.width = Math.floor(r.width * devicePixelRatio);
  canvas.height = Math.floor(r.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
window.addEventListener('resize', resizeCanvas);

function textPoints(w,h){
  const off=document.createElement('canvas');
  off.width=w;
  off.height=h;
  const c=off.getContext('2d');
  c.fillStyle='white';
  c.textAlign='center';
  c.textBaseline='middle';

  c.font = `700 ${Math.min(w*.09,38)}px Georgia`;
  c.fillText('Happy Birthday', w/2, h*.125);

  c.font = `700 ${Math.min(w*.145,60)}px Georgia`;
  c.fillText('SAHITYA', w/2, h*.205);

  const data=c.getImageData(0,0,w,h).data;
  const pts=[];
  const gap=Math.max(3,Math.floor(w/150));
  for(let y=0;y<h;y+=gap){
    for(let x=0;x<w;x+=gap){
      if(data[(y*w+x)*4+3] > 110) pts.push({x,y});
    }
  }
  return pts;
}

function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }

function drawStarParticle(x,y,r,a,cross){
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor='#ffd55d';
  ctx.shadowBlur=14;

  if(cross){
    ctx.strokeStyle='rgba(255,242,188,.96)';
    ctx.lineWidth=Math.max(.65,r*.24);
    ctx.beginPath();
    ctx.moveTo(x-r*1.4,y);
    ctx.lineTo(x+r*1.4,y);
    ctx.moveTo(x,y-r*1.4);
    ctx.lineTo(x,y+r*1.4);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle='rgba(255,238,170,.98)';
  ctx.arc(x,y,r*.55,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function startStarText(){
  resizeCanvas();
  textParticles=[];
  const w=canvas.clientWidth;
  const h=canvas.clientHeight;
  const pts=textPoints(w,h);

  pts.forEach(p=>{
    textParticles.push({
      sx:Math.random()*w,
      sy:Math.random()*h,
      tx:p.x,
      ty:p.y,
      x:0,
      y:0,
      size:1.5+Math.random()*2.6,
      delay:Math.random()*180,
      tw:Math.random()*Math.PI*2,
      cross:Math.random()>.58
    });
  });

  textStartTime = performance.now();
  textAnimating=true;
  animateStarText();
}

function animateStarText(now=performance.now()){
  if(!textAnimating || !screens.wish.classList.contains('active')) return;
  const w=canvas.clientWidth;
  const h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);

  let completeCount=0;
  for(const p of textParticles){
    const local=(now-textStartTime-p.delay)/TEXT_FORM_MS;
    const t=Math.max(0,Math.min(1,local));
    const e=easeOutCubic(t);
    p.x=p.sx+(p.tx-p.sx)*e;
    p.y=p.sy+(p.ty-p.sy)*e;
    p.tw += .08;
    if(t>=1) completeCount++;

    const pulse=.76+(Math.sin(p.tw)+1)*.35;
    const alpha=t<1 ? .92 : .68+(Math.sin(p.tw*1.25)+1)*.16;
    drawStarParticle(p.x,p.y,p.size*pulse,alpha,p.cross && t>.88);
  }

  if(completeCount===textParticles.length){
    for(let i=0;i<14;i++){
      const p=textParticles[Math.floor(Math.random()*textParticles.length)];
      if(p) drawStarParticle(p.tx,p.ty,p.size*1.8,.9,true);
    }
  }

  requestAnimationFrame(animateStarText);
}

function openWish(){
  show('wish');
  screens.wish.classList.remove('blur');
  secondGift.classList.remove('show','open');
  secondLabel.classList.remove('show');
  secondGiftClicked = false;

  textAnimating=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  startStarText();

  setTimeout(()=>revealSound(),900);
  setTimeout(()=>screens.wish.classList.add('blur'),BLUR_BEFORE_GIFT_MS);
  setTimeout(()=>{
    secondGift.classList.add('show');
    secondLabel.classList.add('show');
  },SECOND_GIFT_DELAY_MS);
}

function preloadPhoto(src){
  return new Promise(resolve => {
    if(photoCache.has(src)){
      resolve(photoCache.get(src));
      return;
    }

    const img = new Image();
    img.onload = () => {
      photoCache.set(src,img);
      resolve(img);
    };
    img.onerror = () => {
      if(src.endsWith('.jpg') && !src.endsWith('.jpg.jpg')){
        const fallback = src + '.jpg';
        const img2 = new Image();
        img2.onload = () => {
          photoCache.set(src,img2);
          resolve(img2);
        };
        img2.onerror = () => resolve(null);
        img2.src = fallback + `?v=${CACHE_VERSION}`;
      } else {
        resolve(null);
      }
    };
    img.src = src + `?v=${CACHE_VERSION}`;
  });
}

function preloadAllPhotos(){
  return Promise.all(photos.map(src => preloadPhoto(src)));
}

async function loadFirstAvailablePhoto(sources){
  for(const src of sources){
    const img = await preloadPhoto(src);
    if(img) return img;
  }
  return null;
}

async function startPhotos(){
  show('photo');
  photoRunId++;
  const runId = photoRunId;
  cachedFullPhoto = null;

  photoStage.innerHTML = '<div class="placeholder">Preparing memories ✨</div>';
  photoCount.textContent = '';

  // Preload all 12 photos and fullphoto before the photo sequence starts.
  // This removes the delay after photo 12 finishes.
  const results = await Promise.all([
    preloadAllPhotos(),
    loadFirstAvailablePhoto(fullPhotoSources)
  ]);
  cachedFullPhoto = results[1];

  if(runId !== photoRunId) return;

  showPhoto(0, photos, runId);
}

async function showPhoto(i, list, runId = photoRunId){
  if(runId !== photoRunId) return;

  if(i >= list.length){
    photoStage.innerHTML = '';
    photoCount.textContent = '';
    showFullPhoto(runId);
    return;
  }

  photoStage.innerHTML='';
  const card=document.createElement('div');
  card.className='photoCard';

  const loadedImg = await preloadPhoto(list[i]);
  if(runId !== photoRunId) return;

  if(loadedImg){
    const img=document.createElement('img');
    img.src=loadedImg.src;
    img.alt='Birthday memory photo';
    card.appendChild(img);
  } else {
    const ph=document.createElement('div');
    ph.className='placeholder';
    ph.innerHTML=`Photo ${i+1}<br>Upload ${list[i]}`;
    card.appendChild(ph);
  }

  photoCount.textContent=`${i+1} / ${list.length}`;
  photoSound();
  photoStage.appendChild(card);
  photoLightFlash(card, false);
  sparkBurst(app.clientWidth/2,app.clientHeight/2,34);

  setTimeout(()=>showPhoto(i+1,list,runId),PHOTO_DURATION_MS);
}

async function showFullPhoto(runId = photoRunId){
  if(runId !== photoRunId) return;

  show('finalPhoto');
  fullPhotoPopup.classList.remove('show');
  fullPhotoImg.removeAttribute('src');
  fullPhotoImg.alt = 'Final Photo';

  const loadedImg = cachedFullPhoto || await loadFirstAvailablePhoto(fullPhotoSources);
  if(runId !== photoRunId) return;

  if(loadedImg){
    fullPhotoImg.src = loadedImg.src;
  } else {
    fullPhotoImg.alt = 'Upload photos/fullphoto.jpg';
  }

  finalPhotoSound();
  fullPhotoPopup.classList.add('show');
  photoLightFlash(fullPhotoPopup, true);
  sparkBurst(app.clientWidth / 2, app.clientHeight * 0.55, 60);

  setTimeout(() => {
    if(runId !== photoRunId) return;
    show('final');
  }, FULL_PHOTO_DISPLAY_MS);
}

function handleFirstGift(){
  if(firstGiftClicked) return;
  firstGiftClicked = true;
  initAudio();
  boxSound();
  firstGift.classList.add('open');
  flashOpen();

  setTimeout(() => {
    firstGift.style.visibility = 'hidden';
    openWish();

    setTimeout(() => {
      firstGift.classList.remove('open');
      firstGift.style.visibility = 'visible';
      firstGiftClicked = false;
    }, 1200);
  }, 850);
}

function handleSecondGift(){
  if(secondGiftClicked) return;
  secondGiftClicked = true;
  initAudio();
  boxSound();
  secondGift.classList.add('open');
  flashOpen();

  setTimeout(() => {
    secondGift.classList.remove('open');
    secondGiftClicked = false;
    startPhotos();
  }, 780);
}

function replay(){
  textAnimating=false;
  photoRunId++;
  clearInterval(spawnTimer);
  photoStage.innerHTML='';
  photoCount.textContent='';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  screens.wish.classList.remove('blur');
  secondGift.classList.remove('show','open');
  secondLabel.classList.remove('show');
  firstGift.classList.remove('open');
  firstGift.style.visibility = 'visible';
  fullPhotoPopup.classList.remove('show');
  fullPhotoImg.removeAttribute('src');
  firstGiftClicked=false;
  secondGiftClicked=false;
  cachedFullPhoto = null;
  show('start');
}

function bindTap(el, handler){
  if(!el) return;
  let lastTap = 0;
  const run = e => {
    if(e){
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if(now - lastTap < 450) return;
    lastTap = now;
    handler(e);
  };
  el.addEventListener('pointerup', run);
  el.addEventListener('click', run);
}

bindTap(playBtn, startGame);
bindTap(firstGift, handleFirstGift);
bindTap(secondGift, handleSecondGift);
bindTap(replayBtn, replay);

// Stop sound when the final page is hidden, phone is locked, or the tab is closed.
window.addEventListener('pagehide', stopMusic);
window.addEventListener('beforeunload', stopMusic);

document.addEventListener('visibilitychange', function(){
  if(document.hidden){
    stopMusic();
  }
});
