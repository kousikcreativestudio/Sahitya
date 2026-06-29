const preloadImages = [
  './assets/game-bg.jpg?v=21',
  './assets/wish-bg.png?v=21',
  './assets/gift-box.png?v=21'
];

preloadImages.forEach(src => {
  const img = new Image();
  img.src = src;
});

// You said total photos = 12.
// Upload your photos inside the photos folder with these exact names.
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

const photoCache = new Map();

function preloadPhoto(src) {
  return new Promise(resolve => {
    if (photoCache.has(src)) {
      resolve(photoCache.get(src));
      return;
    }

    const img = new Image();
    img.onload = () => {
      photoCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = src + "?v=20";
  });
}

function preloadAllPhotos() {
  return Promise.all(photos.map(src => preloadPhoto(src)));
}

const TARGET_STARS = 20;
const TEXT_FORM_MS = 1250;
const BLUR_BEFORE_GIFT_MS = 6400;
const SECOND_GIFT_DELAY_MS = 7300;

let collected = 0;
let gameRunning = false;
let spawnTimer = null;
let audioCtx = null;
let musicStarted = false;
let musicTimer = null;
let textParticles = [];
let textAnimating = false;
let textStartTime = 0;

const app = document.getElementById('app');
const screens = {
  start: document.getElementById('startScreen'),
  game: document.getElementById('gameScreen'),
  gift: document.getElementById('giftScreen'),
  wish: document.getElementById('wishScreen'),
  photo: document.getElementById('photoScreen'),
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
const canvas = document.getElementById('starTextCanvas');
const ctx = canvas.getContext('2d');

function show(name){
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  if(!musicStarted){
    musicStarted = true;
    startMusic();
  }
}

function tone(freq,dur=.2,type='sine',vol=.09,delay=0){
  if(!audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(vol,t+.02);
  g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(t);
  o.stop(t+dur+.05);
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
  tone(640,.16,'triangle',.08);
  tone(980,.24,'sine',.07,.08);
}

function startMusic(){
  const notes=[261.63,329.63,392,523.25,392,329.63];
  let i=0;
  function loop(){
    tone(notes[i%notes.length],1.05,'sine',.028);
    tone(notes[(i+2)%notes.length]*2,.55,'triangle',.014,.13);
    i++;
  }
  loop();
  musicTimer = setInterval(loop,1250);
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
  star.style.animationDuration=(4.1 + Math.random()*2.1)+'s';
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
  initAudio();
  show('game');
  collected=0;
  updateScore();
  gameLayer.innerHTML='';
  makeAmbientStars();
  gameRunning=true;
  for(let i=0;i<15;i++) spawnStar(true);
  spawnTimer=setInterval(()=>spawnStar(false),250);
}

function finishGame(){
  gameRunning=false;
  clearInterval(spawnTimer);
  document.querySelectorAll('.fallStar').forEach(s=>s.remove());
  setTimeout(()=>show('gift'),550);
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

function easeOutCubic(t){
  return 1 - Math.pow(1-t,3);
}

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

  textAnimating=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  startStarText();

  setTimeout(()=>revealSound(),900);

  setTimeout(()=>{
    screens.wish.classList.add('blur');
  },BLUR_BEFORE_GIFT_MS);

  setTimeout(()=>{
    secondGift.classList.add('show');
    secondLabel.classList.add('show');
  },SECOND_GIFT_DELAY_MS);
}

async function startPhotos(){
  show('photo');
  photoStage.innerHTML = '';
  photoCount.textContent = '';

  // Preload first, then start photo popup
  await preloadAllPhotos();

  const list = photos.length ? photos : ['__placeholder__'];
  showPhoto(0, list);
}

async function showPhoto(i, list) {
  if (i >= list.length) {
    show('final');
    return;
  }

  photoStage.innerHTML = '';
  photoSound();

  const card = document.createElement('div');
  card.className = 'photoCard';

  if (list[i] === '__placeholder__') {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.innerHTML = 'Add your selected photos later ✨';
    card.appendChild(ph);
    photoCount.textContent = '';
  } else {
    const loadedImg = await preloadPhoto(list[i]);

    if (loadedImg) {
      const img = document.createElement('img');
      img.src = loadedImg.src;
      img.alt = 'Birthday memory photo';
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.innerHTML = 'Photo not found<br>' + list[i];
      card.appendChild(ph);
    }

    photoCount.textContent = `${i + 1} / ${list.length}`;
  }

  photoStage.appendChild(card);
  sparkBurst(app.clientWidth / 2, app.clientHeight / 2, 26);

  setTimeout(() => {
    showPhoto(i + 1, list);
  }, 5200);
}

  photoSound();
  photoStage.innerHTML='';
  const card=document.createElement('div');
  card.className='photoCard';

  const img=document.createElement('img');
  img.src=list[i];
  img.alt='Birthday memory photo';
  img.onerror=()=>{
    img.replaceWith(Object.assign(document.createElement('div'),{
      className:'placeholder',
      innerHTML:`Photo ${i+1}<br>Upload ${list[i]}`
    }));
  };
  card.appendChild(img);
  photoCount.textContent=`${i+1} / ${list.length}`;

  photoStage.appendChild(card);
  sparkBurst(app.clientWidth/2,app.clientHeight/2,26);
  setTimeout(()=>showPhoto(i+1,list),5100);
}

playBtn.addEventListener('click', startGame);

firstGift.addEventListener('click', ()=>{
  initAudio();
  boxSound();
  firstGift.classList.add('open');
  flashOpen();
  setTimeout(()=>{
    firstGift.classList.remove('open');
    openWish();
  },850);
});

secondGift.addEventListener('click', ()=>{
  initAudio();
  boxSound();
  secondGift.classList.add('open');
  flashOpen();
  setTimeout(()=>{
    secondGift.classList.remove('open');
    startPhotos();
  },780);
});

replayBtn.addEventListener('click', ()=>{
  textAnimating=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  screens.wish.classList.remove('blur');
  secondGift.classList.remove('show','open');
  secondLabel.classList.remove('show');
  show('start');
});
