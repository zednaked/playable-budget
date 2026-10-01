// Bunny Hop: um playable de uma mecânica só. O coelho quica sozinho; o
// jogador só guia para os lados. Cinco moedas abrem o end card.
import { Application, Assets, Sprite, AnimatedSprite, Container, Text, Graphics, TilingSprite } from 'pixi.js';
import ASSETS from './assets.gen.js';

const W = 480, H = 800;          // espaço lógico; o canvas escala para caber
const GRAVITY = 2200, BOUNCE = -1150, STEER = 9;
const GOAL = 5;
const STORE_URL = 'https://github.com/zednaked/playable-budget';
// ?autoplay: o coelho se guia sozinho, para testar o caminho até o end card e gravar a vitrine.
const AUTO = new URLSearchParams(location.search).has('autoplay');

const app = new Application();
await app.init({ preference: 'webgl', width: W, height: H, background: '#cfe8f7', antialias: false, resolution: 1 });
document.body.appendChild(app.canvas);

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  app.canvas.style.width = `${W * s}px`;
  app.canvas.style.height = `${H * s}px`;
}
addEventListener('resize', fit);
fit();

const tex = {};
for (const [name, url] of Object.entries(ASSETS)) tex[name] = await Assets.load({ src: url, parser: 'texture' });

const sky = new TilingSprite({ texture: tex.bg_layer1, width: W, height: H });
sky.tileScale.set(0.5);
const hills = new TilingSprite({ texture: tex.bg_layer2, width: W, height: H });
hills.tileScale.set(0.5);
app.stage.addChild(sky, hills);

const world = new Container();
app.stage.addChild(world);

const bunny = new Sprite(tex.bunny1_jump);
bunny.anchor.set(0.5, 1);
bunny.scale.set(0.5);
world.addChild(bunny);

const coinFrames = ['gold_1', 'gold_2', 'gold_3', 'gold_4', 'gold_3', 'gold_2'].map(n => tex[n]);
const platforms = [], coins = [];
let vx = 0, vy = BOUNCE, targetX = W / 2, score = 0, topY = H, lastX = W / 2, over = false, landed = null;

function addPlatform(x, y, small) {
  const p = new Sprite(small ? tex.ground_grass_small : tex.ground_grass);
  p.anchor.set(0.5, 0);
  p.scale.set(0.6);
  p.position.set(x, y);
  world.addChild(p);
  platforms.push(p);
  if (Math.random() < 0.55) {
    const c = new AnimatedSprite(coinFrames);
    c.anchor.set(0.5);
    c.scale.set(0.45);
    c.animationSpeed = 0.15;
    c.play();
    c.position.set(x, y - 45);
    world.addChild(c);
    coins.push(c);
  }
}

function reset() {
  for (const o of [...platforms, ...coins]) o.destroy();
  platforms.length = coins.length = 0;
  addPlatform(W / 2, H - 120, false);
  topY = H - 120;
  lastX = W / 2;
  landed = platforms[0];
  while (topY > -H) spawnNext();
  bunny.position.set(W / 2, H - 120);
  vx = 0; vy = BOUNCE; targetX = W / 2; score = 0;
  world.y = 0;
  hud.text = `0 / ${GOAL}`;
}

function spawnNext() {
  // Vão e deslocamento que um quique sempre alcança: o playable tem que ser vencível em segundos.
  topY -= 100 + Math.random() * 50;
  lastX = Math.max(80, Math.min(W - 80, lastX + (Math.random() * 2 - 1) * 170));
  addPlatform(lastX, topY, Math.random() < 0.5);
}

const hud = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 34, fontWeight: '800', fill: '#ffffff', stroke: { color: '#2b4a6b', width: 6 } } });
hud.position.set(20, 16);
const hint = new Text({ text: 'Hold left or right to steer', style: { fontFamily: 'sans-serif', fontSize: 26, fontWeight: '700', fill: '#2b4a6b' } });
hint.anchor.set(0.5);
hint.position.set(W / 2, H * 0.3);
app.stage.addChild(hud, hint);

app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;
const steer = e => { targetX = e.global.x; };
app.stage.on('pointerdown', e => { steer(e); hint.visible = false; });
app.stage.on('pointermove', e => { if (e.buttons) steer(e); });

function endCard() {
  over = true;
  window.__bunnyHopOver = true; // sinal para o smoke test
  hint.visible = false;
  const card = new Container();
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x0d1b2a, alpha: 0.72 });
  const title = new Text({ text: `${GOAL} coins!`, style: { fontFamily: 'sans-serif', fontSize: 64, fontWeight: '900', fill: '#ffd34d', stroke: { color: '#5a3d00', width: 8 } } });
  title.anchor.set(0.5);
  title.position.set(W / 2, H * 0.36);
  const btn = new Container();
  btn.addChild(new Graphics().roundRect(-150, -42, 300, 84, 42).fill(0x37c45a));
  const label = new Text({ text: 'PLAY NOW', style: { fontFamily: 'sans-serif', fontSize: 38, fontWeight: '900', fill: '#ffffff' } });
  label.anchor.set(0.5);
  btn.addChild(label);
  btn.position.set(W / 2, H * 0.56);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  // Nas redes, o clique de instalação passa pelo MRAID; fora delas, link comum.
  btn.on('pointertap', () => (window.mraid ? window.mraid.open(STORE_URL) : window.open(STORE_URL, '_blank')));
  card.addChild(dim, title, btn);
  app.stage.addChild(card);
}

reset();

app.ticker.add(t => {
  if (over) return;
  const dt = Math.min(t.deltaMS / 1000, 1 / 30);

  if (AUTO) {
    // Mira a próxima plataforma acima da última em que quicou.
    let next = null;
    for (const p of platforms) if (p.y < landed.y - 10 && (!next || p.y > next.y)) next = p;
    if (next) targetX = next.x;
  }

  vx += ((targetX - bunny.x) * STEER - vx) * Math.min(1, dt * 8);
  bunny.x = Math.max(30, Math.min(W - 30, bunny.x + vx * dt));
  const prevY = bunny.y;
  vy += GRAVITY * dt;
  bunny.y += vy * dt;
  bunny.texture = vy < 0 ? tex.bunny1_jump : tex.bunny1_stand;

  // Quica só caindo, e só se os pés cruzaram o topo da plataforma neste passo.
  if (vy > 0) {
    for (const p of platforms) {
      const half = p.width / 2;
      if (prevY <= p.y && bunny.y >= p.y && Math.abs(bunny.x - p.x) < half) {
        bunny.y = p.y;
        vy = BOUNCE;
        landed = p;
        break;
      }
    }
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.abs(c.x - bunny.x) < 40 && Math.abs(c.y - (bunny.y - 50)) < 60) {
      c.destroy();
      coins.splice(i, 1);
      hud.text = `${++score} / ${GOAL}`;
      if (score >= GOAL) return endCard();
    }
  }

  // A câmera só sobe; o que sai por baixo é reciclado.
  const camTarget = H * 0.45 - bunny.y;
  if (camTarget > world.y) world.y = camTarget;
  sky.tilePosition.y = world.y * 0.1;
  hills.tilePosition.y = world.y * 0.3;
  while (topY > -world.y - H) spawnNext();
  for (let i = platforms.length - 1; i >= 0; i--) {
    if (platforms[i].y + world.y > H + 100) { platforms[i].destroy(); platforms.splice(i, 1); }
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    if (coins[i].y + world.y > H + 100) { coins[i].destroy(); coins.splice(i, 1); }
  }

  if (bunny.y + world.y > H + 200) reset();
});
