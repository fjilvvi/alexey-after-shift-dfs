import Phaser from 'phaser';
import './style.css';
import { RetroAudio } from './audio';
import { makeCustomers } from './customer';

const W = 1280;
const H = 720;
const SHOP_GROUND = 612;
const CUSTOMER_GROUND = 610;
const GYM_GROUND = 555;
const HERO_SCALE = 480 / 740;
const GYM_SCALE = 0.68;
const BASELINE_ORIGIN = 737 / 740;
const METER_X = 240;
const METER_Y = 610;
const METER_W = 620;
const METER_H = 44;
const HIT_MIN = 0.42;
const HIT_MAX = 0.58;
const C = { ink: 0x151728, panel: 0x202136, line: 0x727186, gold: 0xedc575, cream: 0xf6eedb, green: 0xb3ed7a, red: 0xff827c };
const audio = new RetroAudio();

type Phase = 'title' | 'shop' | 'choice' | 'feedback' | 'transition' | 'gymIntro' | 'gym' | 'lifting' | 'win';
type Speaker = 'hero' | 'customer';
type Placement = 'above' | 'left' | 'right';
type Rect = { x: number; y: number; w: number; h: number };
type SpeechInfo = Rect & { speaker: Speaker; name: string; anchorX: number; anchorY: number; placement: Placement };

const requests = [
  { name: 'БЕГУН', short: 'Нужен белок после пробежки!', text: 'Бегаю за автобусом каждый день.\nХочу белок для восстановления.\nЧто посоветуешь, чемпион?', answer: 0, reply: 'Протеин! А автобус пусть сам догоняет.', thanks: 'Спасибо! Побегу… на диван.', x: 970 },
  { name: 'НОВИЧОК', short: 'Хочу стать сильнее. Что взять?', text: 'В зал записалась. Теперь нужна\nдобавка для силы и коротких\nмощных подходов. Без магии!', answer: 1, reply: 'Креатин. Магия — это не пропускать ноги.', thanks: 'Беру! День ног… с понедельника.', x: 270 },
  { name: 'ВЕТЕРАН', short: 'Выручай: после зала сводит ноги.', text: 'После тренировки сводит мышцы.\nНужен минерал для их нормальной\nработы. И без вкуса «бетон»!', answer: 2, reply: 'Магний. Железо поднимать, а не есть!', thanks: 'От души! Пояс у тебя зачётный.', x: 970 },
];
const products = [
  { name: 'ПРОТЕИН', desc: 'Белок · восстановление', color: 0xa6d1ca, tag: 'WHEY' },
  { name: 'КРЕАТИН', desc: 'Сила · мощные подходы', color: 0xe9ba75, tag: 'CREA' },
  { name: 'МАГНИЙ', desc: 'Минерал · работа мышц', color: 0xc3a7df, tag: 'MG' },
];

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return width * height;
}

class AfterShift extends Phaser.Scene {
  phase: Phase = 'title';
  hero!: Phaser.GameObjects.Container;
  body!: Phaser.GameObjects.Sprite;
  shadow!: Phaser.GameObjects.Image;
  bg!: Phaser.GameObjects.Image;
  customer?: Phaser.GameObjects.Image;
  customerShadow?: Phaser.GameObjects.Image;
  hud!: Phaser.GameObjects.Container;
  bottom!: Phaser.GameObjects.Container;
  overlay!: Phaser.GameObjects.Container;
  message!: Phaser.GameObjects.Container;
  completed = 0;
  fatigue = 0;
  reps = 0;
  power = 0;
  misses = 0;
  shopMistakes = 0;
  current = 0;
  ready = false;
  target?: number;
  direction = 0;
  walking = false;
  heroVelocity = 0;
  heroGround = SHOP_GROUND;
  elapsed = 0;
  startAt = 0;
  gymTime = 0;
  cycleMs = 2600;
  needle = 0;
  lastHitNeedle = -1;
  paused = false;
  customerEntering = false;
  statusText!: Phaser.GameObjects.Text;
  counterText!: Phaser.GameObjects.Text;
  meter!: Phaser.GameObjects.Graphics;
  pauseLabel!: Phaser.GameObjects.Text;
  needleG?: Phaser.GameObjects.Graphics;
  timeBar?: Phaser.GameObjects.Graphics;
  meterFlash?: Phaser.GameObjects.Graphics;
  liftButtonText?: Phaser.GameObjects.Text;
  gymRepsText?: Phaser.GameObjects.Text;
  held = new Set<string>();
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  speechTimer?: Phaser.Time.TimerEvent;
  speechToken = 0;
  speechInfo?: SpeechInfo;

  preload() {
    const a = './assets/';
    ['shop', 'gym', 'hero-idle', 'hero-down', 'hero-up', 'hero-win'].forEach(k => this.load.image(k, a + k + '.png'));
    this.load.spritesheet('hero-walk', a + 'hero-walk.png', { frameWidth: 328, frameHeight: 740 });
  }

  create() {
    makeCustomers(this);
    document.getElementById('loading')?.remove();
    this.input.addPointer(3);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('A,D,E,P,ONE,TWO,THREE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'LEFT', 'RIGHT', 'UP', 'DOWN']);
    this.bg = this.add.image(W / 2, H / 2, 'shop').setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x232041, 0.10);
    this.add.text(75, 193, 'DFS', { fontFamily: 'Arial', fontStyle: 'bold italic', fontSize: '48px', color: '#edc575', stroke: '#151728', strokeThickness: 3 }).setRotation(-0.02);
    this.add.text(78, 248, 'СПОРТИВНОЕ ПИТАНИЕ', { fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', color: '#c9bec3' });
    this.makeShadowTexture();
    this.shadow = this.add.image(565, SHOP_GROUND + 3, 'contact-shadow').setDisplaySize(176, 25).setAlpha(0.56).setDepth(2);
    this.hero = this.add.container(565, SHOP_GROUND).setDepth(5);
    if (!this.anims.exists('hero-walk-cycle')) {
      this.anims.create({ key: 'hero-walk-cycle', frames: this.anims.generateFrameNumbers('hero-walk', { start: 0, end: 7 }), frameRate: 13, repeat: -1 });
    }
    this.makeHero();
    this.hud = this.add.container(0, 0).setDepth(20);
    this.bottom = this.add.container(0, 0).setDepth(21);
    this.message = this.add.container(0, 0).setDepth(22);
    this.overlay = this.add.container(0, 0).setDepth(30);
    this.drawHud();
    this.title();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      if (this.phase === 'shop' && !objects.length && p.y > 135 && p.y < 610) {
        this.target = Phaser.Math.Clamp(p.x, 170, 1110);
      }
    });
    this.input.on('pointerup', () => { this.direction = 0; this.held.clear(); });
    this.input.on('gameout', () => { this.direction = 0; this.held.clear(); });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.direction = 0;
      this.held.clear();
      if (this.phase !== 'title' && this.phase !== 'win' && !this.paused) this.setPause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && this.phase !== 'title' && this.phase !== 'win') this.setPause(true);
    });
    const sound = document.getElementById('sound')!;
    const soundUpdate = () => {
      sound.innerHTML = audio.muted ? '♫ <span>ЗВУК ВЫКЛ.</span>' : '♫ <span>ЗВУК ВКЛ.</span>';
      sound.setAttribute('aria-pressed', String(!audio.muted));
    };
    soundUpdate();
    sound.onclick = () => { audio.unlock(); audio.toggle(); soundUpdate(); };
    document.getElementById('fullscreen')!.onclick = async () => {
      audio.unlock();
      const el = document.getElementById('game')!;
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (el.requestFullscreen) await el.requestFullscreen();
        else window.scrollTo(0, document.querySelector('.machine')!.getBoundingClientRect().top + scrollY);
      } catch { /* Fullscreen is optional on iOS. */ }
      try { await (screen.orientation as unknown as { lock?: (s: string) => Promise<void> }).lock?.('landscape'); } catch { /* Safari may not expose orientation lock. */ }
    };

    // Read-only diagnostics for browser QA. No gameplay shortcuts are exposed.
    Object.defineProperty(window, '__alexey', {
      configurable: true,
      get: () => ({
        phase: this.phase,
        completed: this.completed,
        ready: this.ready,
        heroX: this.hero.x,
        heroY: this.hero.y,
        heroVelocity: this.heroVelocity,
        direction: this.direction,
        target: this.target,
        walking: this.walking,
        walkFrame: this.body.anims.currentFrame?.index ?? 0,
        customerX: this.customer?.x,
        customerY: this.customer?.y,
        customerShadowX: this.customerShadow?.x,
        current: this.current,
        reps: this.reps,
        power: this.power,
        misses: this.misses,
        shopMistakes: this.shopMistakes,
        needle: this.needle,
        lastHitNeedle: this.lastHitNeedle,
        needleX: METER_X + this.needle * METER_W,
        cycleMs: this.cycleMs,
        gymRepsText: this.gymRepsText?.text,
        paused: this.paused,
        elapsed: Math.floor(this.elapsed / 1000),
        speech: this.speechInfo ? { ...this.speechInfo } : undefined,
        heroFace: this.faceRect('hero'),
        customerFace: this.customer ? this.faceRect('customer') : undefined,
        heroFootY: this.hero.y,
        customerFootY: this.customer?.y,
      }),
    });
  }

  makeShadowTexture() {
    if (this.textures.exists('contact-shadow')) return;
    const texture = this.textures.createCanvas('contact-shadow', 128, 32);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.save();
    ctx.translate(64, 16);
    ctx.scale(1, 0.25);
    const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
    gradient.addColorStop(0, 'rgba(12,10,25,0.85)');
    gradient.addColorStop(0.55, 'rgba(12,10,25,0.42)');
    gradient.addColorStop(1, 'rgba(12,10,25,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-64, -64, 128, 128);
    ctx.restore();
    texture.refresh();
  }

  text(x: number, y: number, s: string, size = 18, color = '#f6eedb', parent?: Phaser.GameObjects.Container) {
    const t = this.add.text(x, y, s, { fontFamily: 'Pixel, monospace', fontSize: size + 'px', color, lineSpacing: 12, padding: { top: 3, bottom: 3 } });
    parent?.add(t);
    return t;
  }

  label(x: number, y: number, s: string, size = 18, color = '#f6eedb', parent?: Phaser.GameObjects.Container) {
    const t = this.add.text(x, y, s, { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: size + 'px', color, lineSpacing: 8 });
    parent?.add(t);
    return t;
  }

  panel(x: number, y: number, w: number, h: number, parent: Phaser.GameObjects.Container, fill = C.panel, line = C.line) {
    const g = this.add.graphics();
    g.fillStyle(C.ink).fillRect(x + 5, y + 6, w, h);
    g.fillStyle(line).fillRect(x, y, w, h);
    g.fillStyle(fill).fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle(0xffffff, 0.12).fillRect(x + 4, y + 4, w - 8, 2);
    parent.add(g);
    return g;
  }

  button(x: number, y: number, w: number, h: number, s: string, fn: () => void, parent = this.bottom, gold = false) {
    const c = this.add.container(x, y);
    parent.add(c);
    this.panel(0, 0, w, h, c, gold ? C.gold : 0x25273d, gold ? 0xffe4a5 : 0x8b879c);
    const t = this.label(w / 2, h / 2, s, 23, gold ? '#1a1b2b' : '#f6eedb', c).setOrigin(0.5);
    const hit = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      if (this.paused && s !== 'ПРОДОЛЖИТЬ') return;
      audio.unlock();
      audio.sfx('tap');
      c.y = y + 3;
      fn();
    });
    hit.on('pointerup', () => { if (c.active) c.y = y; });
    hit.on('pointerout', () => { if (c.active) c.y = y; });
    return { c, hit, t };
  }

  makeHero() {
    this.hero.removeAll(true);
    this.body = this.add.sprite(0, 0, 'hero-idle').setOrigin(0.5, BASELINE_ORIGIN).setScale(HERO_SCALE);
    this.hero.add(this.body);
    this.heroGround = SHOP_GROUND;
    this.hero.setPosition(this.hero.x || 565, SHOP_GROUND);
  }

  setHeroTexture(key: string, scale: number) {
    this.body.anims.stop();
    this.body.setTexture(key).setOrigin(0.5, BASELINE_ORIGIN).setScale(scale).setAngle(0);
  }

  setWalking(active: boolean) {
    if (this.walking === active) return;
    this.walking = active;
    if (active) {
      this.body.setTexture('hero-walk', 0).setOrigin(0.5, BASELINE_ORIGIN).setScale(HERO_SCALE).setAngle(0);
      this.body.play('hero-walk-cycle');
    } else {
      this.setHeroTexture('hero-idle', HERO_SCALE);
    }
  }

  stopHeroMovement() {
    this.target = undefined;
    this.direction = 0;
    this.heroVelocity = 0;
    this.held.clear();
    this.setWalking(false);
  }

  drawHud() {
    this.hud.removeAll(true);
    this.panel(22, 20, 322, 68, this.hud);
    this.text(42, 34, this.phase === 'title' ? 'DFS / AFTER HOURS' : this.phase.startsWith('gym') || this.phase === 'lifting' || this.phase === 'win' ? 'АЛЕКСЕЙ / ЗАЛ' : 'АЛЕКСЕЙ / DFS', 14, '#edc575', this.hud);
    this.counterText = this.label(43, 58, 'СМЕНА 01  ·  ПОКУПАТЕЛИ 0/3', 15, '#c7c2d2', this.hud);
    this.panel(907, 20, 279, 68, this.hud);
    this.statusText = this.text(925, 31, 'УСТАЛОСТЬ', 11, '#dcd4de', this.hud);
    this.meter = this.add.graphics();
    this.hud.add(this.meter);
    const p = this.button(1200, 20, 58, 68, 'II', () => this.setPause(!this.paused), this.hud);
    this.pauseLabel = p.t;
    const sound = this.button(803, 20, 82, 68, audio.muted ? 'SFX ×' : 'SFX', () => {
      audio.unlock();
      audio.toggle();
      sound.t.setText(audio.muted ? 'SFX ×' : 'SFX');
      document.getElementById('sound')!.innerHTML = audio.muted ? '♫ <span>ЗВУК ВЫКЛ.</span>' : '♫ <span>ЗВУК ВКЛ.</span>';
    }, this.hud);
    sound.t.setFontSize(17);
    this.updateHud();
  }

  updateHud() {
    const gym = ['gymIntro', 'gym', 'lifting', 'win'].includes(this.phase);
    this.counterText?.setText(gym ? `ПОВТОРЫ ${String(this.reps).padStart(2, '0')}/10  ·  СИЛА ${this.power}` : `СМЕНА 01  ·  ПОКУПАТЕЛИ ${this.completed}/3`);
    this.statusText?.setText(gym ? 'СИЛА' : 'УСТАЛОСТЬ');
    this.meter?.clear();
    for (let i = 0; i < 10; i++) {
      const value = gym ? this.reps : this.fatigue / 10;
      this.meter.fillStyle(i < value ? (gym ? C.green : C.gold) : 0x414054).fillRect(925 + i * 24, 61, 20, 12);
    }
  }

  title() {
    this.phase = 'title';
    this.bottom.removeAll(true);
    this.overlay.removeAll(true);
    this.panel(70, 303, 397, 278, this.overlay, 0x191b2c, 0x8e7d70);
    this.text(95, 326, '16-BIT · STORY ARCADE', 12, '#edc575', this.overlay);
    this.label(95, 359, 'Смена закончится.\nЛегенда — начнётся.', 32, '#fff3dc', this.overlay);
    this.label(95, 451, 'Три покупателя. Десять повторений.\nПокажи, кто здесь чемпион.', 17, '#b8b5c6', this.overlay);
    this.button(95, 511, 344, 48, 'НАЧАТЬ СМЕНУ   →', () => this.startShop(), this.overlay, true);
    this.label(896, 524, 'ТВОЙ ПОЯС.\nТВОИ ПРАВИЛА.', 23, '#f6eedb', this.overlay);
    this.text(897, 587, '~ 2–3 МИН · STORY ARCADE', 9, '#d9c7a7', this.overlay);
    this.text(466, 666, 'НАЖМИ «НАЧАТЬ» ИЛИ ENTER', 12, '#f6eedb', this.overlay);
  }

  startShop() {
    if (this.phase !== 'title') return;
    audio.unlock();
    audio.setScene('shop');
    this.overlay.removeAll(true);
    this.phase = 'shop';
    this.startAt = this.time.now;
    this.setHeroTexture('hero-idle', HERO_SCALE);
    this.drawHud();
    this.shopControls();
    this.speech('АЛЕКСЕЙ', 'Ещё три покупателя — и на тренировку!', 'hero', 1500);
    this.time.delayedCall(1000, () => { if (this.phase === 'shop' && !this.customer) this.arrive(); });
  }

  shopControls() {
    this.bottom.removeAll(true);
    const g = this.add.graphics().fillStyle(0x101321, 0.91).fillRect(0, 610, W, 110);
    this.bottom.add(g);
    const left = this.button(24, 623, 94, 82, '<', () => { this.direction = -1; this.target = undefined; });
    const right = this.button(130, 623, 94, 82, '>', () => { this.direction = 1; this.target = undefined; });
    [left, right].forEach(b => {
      b.hit.on('pointerup', () => { this.direction = 0; });
      b.hit.on('pointerout', () => { this.direction = 0; });
    });
    this.label(254, 640, 'ПОДОЙДИ К ПОКУПАТЕЛЮ', 19, '#f2e8d6', this.bottom);
    this.label(254, 672, 'Стрелки / A D или нажми на пол', 14, '#85869b', this.bottom);
    this.button(928, 623, 326, 82, 'E  ·  ОБСЛУЖИТЬ', () => this.interact(), this.bottom, true);
  }

  arrive() {
    if (this.completed >= 3 || this.phase !== 'shop') return;
    this.current = this.completed;
    this.ready = false;
    this.customerEntering = true;
    const r = requests[this.current];
    this.customer?.destroy();
    this.customerShadow?.destroy();
    const startX = r.x > 640 ? 1400 : -100;
    this.customerShadow = this.add.image(startX, CUSTOMER_GROUND + 2, 'contact-shadow').setDisplaySize(116, 20).setAlpha(0.48).setDepth(3);
    this.customer = this.add.image(startX, CUSTOMER_GROUND, 'customer' + this.current)
      .setOrigin(0.5, (this.current === 0 ? 208 : 210) / 220)
      .setDisplaySize(165, 336)
      .setDepth(4);
    this.customer.setFlipX(r.x < 640);
    const step = this.tweens.add({ targets: this.customer, angle: 1.25, duration: 135, yoyo: true, repeat: 6 });
    this.tweens.add({
      targets: this.customer,
      x: r.x,
      duration: 850,
      ease: 'Sine.easeOut',
      onComplete: () => {
        step.stop();
        this.customer?.setAngle(0);
        this.customerEntering = false;
        this.ready = true;
        this.speech(r.name, r.short, 'customer');
      },
    });
  }

  speakerRect(speaker: Speaker): Rect {
    const object = speaker === 'hero' ? this.body : this.customer;
    if (!object) return { x: this.hero.x - 80, y: 150, w: 160, h: 400 };
    const b = object.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  faceRect(speaker: Speaker): Rect {
    const r = this.speakerRect(speaker);
    const width = speaker === 'hero' ? Math.min(110, r.w * 0.42) : Math.min(74, r.w * 0.55);
    const height = speaker === 'hero' ? Math.min(130, r.h * 0.29) : Math.min(95, r.h * 0.30);
    return { x: r.x + (r.w - width) / 2, y: r.y, w: width, h: height };
  }

  clearSpeech() {
    this.speechToken++;
    this.speechTimer?.remove(false);
    this.speechTimer = undefined;
    this.tweens.killTweensOf(this.message);
    this.message.removeAll(true);
    this.message.setAlpha(1).setPosition(0, 0);
    this.speechInfo = undefined;
  }

  speech(name: string, s: string, speaker: Speaker, duration?: number) {
    if (speaker === 'customer' && !this.customer) speaker = 'hero';
    this.clearSpeech();
    const token = this.speechToken;
    const w = s.length > 55 ? 490 : 450;
    const content = this.label(0, 0, s, 22, '#272738').setWordWrapWidth(w - 38);
    const h = Phaser.Math.Clamp(Math.ceil(content.height + 65), 94, 176);
    content.destroy();
    const anchorRect = this.speakerRect(speaker);
    const anchorX = anchorRect.x + anchorRect.w / 2;
    const anchorY = anchorRect.y;
    const other: Speaker = speaker === 'hero' ? 'customer' : 'hero';
    const otherFace = other === 'customer' && !this.customer ? undefined : this.faceRect(other);
    const speakerFace = this.faceRect(speaker);
    const candidates: (SpeechInfo & { score: number })[] = [];
    const add = (x: number, y: number, placement: Placement, preference: number) => {
      const rect: SpeechInfo & { score: number } = { x, y, w, h, speaker, name, anchorX, anchorY, placement, score: preference };
      if (x < 20 || x + w > W - 20 || y < 102 || y + h > 596) rect.score += 100000;
      const speakerFaceOverlap = overlapArea(rect, speakerFace);
      const otherFaceOverlap = otherFace ? overlapArea(rect, otherFace) : 0;
      if (speakerFaceOverlap > 0 || otherFaceOverlap > 0) rect.score += 100000;
      rect.score += speakerFaceOverlap / 4 + otherFaceOverlap / 5;
      candidates.push(rect);
    };
    const centeredX = Phaser.Math.Clamp(anchorX - w / 2, 22, W - w - 22);
    add(centeredX, anchorY - h - 16, 'above', 0);
    add(Phaser.Math.Clamp(centeredX - 100, 22, W - w - 22), anchorY - h - 16, 'above', 18);
    add(Phaser.Math.Clamp(centeredX + 100, 22, W - w - 22), anchorY - h - 16, 'above', 18);
    const sideY = Phaser.Math.Clamp(anchorY + 28, 110, 590 - h);
    add(anchorRect.x + anchorRect.w + 20, sideY, 'right', 180);
    add(anchorRect.x - w - 20, sideY, 'left', 190);
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    this.speechInfo = { speaker, name, anchorX, anchorY, placement: best.placement, x: best.x, y: best.y, w, h };
    this.panel(best.x, best.y, w, h, this.message, 0xf7eedb, 0x302a40);
    const tail = this.add.graphics();
    this.message.add(tail);
    tail.fillStyle(0x302a40);
    if (best.placement === 'above') {
      const tx = Phaser.Math.Clamp(anchorX, best.x + 24, best.x + w - 24);
      const tipX = Phaser.Math.Clamp(anchorX, best.x + 12, best.x + w - 12);
      tail.fillTriangle(tx - 11, best.y + h - 3, tx + 11, best.y + h - 3, tipX, best.y + h + 15);
      tail.fillStyle(0xf7eedb).fillTriangle(tx - 6, best.y + h - 3, tx + 6, best.y + h - 3, tipX, best.y + h + 9);
    } else {
      const ty = best.y + 42;
      if (best.placement === 'left') {
        tail.fillTriangle(best.x + w - 3, ty - 11, best.x + w - 3, ty + 11, best.x + w + 14, ty);
        tail.fillStyle(0xf7eedb).fillTriangle(best.x + w - 3, ty - 6, best.x + w - 3, ty + 6, best.x + w + 8, ty);
      } else {
        tail.fillTriangle(best.x + 3, ty - 11, best.x + 3, ty + 11, best.x - 14, ty);
        tail.fillStyle(0xf7eedb).fillTriangle(best.x + 3, ty - 6, best.x + 3, ty + 6, best.x - 8, ty);
      }
    }
    this.label(best.x + 19, best.y + 12, name, 15, '#9a633b', this.message);
    this.label(best.x + 19, best.y + 40, s, 22, '#272738', this.message).setWordWrapWidth(w - 38);
    const hit = this.add.zone(best.x, best.y, w, h).setOrigin(0).setInteractive();
    hit.on('pointerdown', () => this.clearSpeech());
    this.message.add(hit);
    this.message.setAlpha(0).setPosition(0, 7);
    this.tweens.add({ targets: this.message, alpha: 1, y: 0, duration: 120, ease: 'Quad.easeOut' });
    const visibleFor = duration ?? Phaser.Math.Clamp(1250 + s.length * 24, 1700, 2700);
    this.speechTimer = this.time.delayedCall(visibleFor, () => {
      if (token !== this.speechToken) return;
      this.tweens.add({
        targets: this.message,
        alpha: 0,
        y: 5,
        duration: 140,
        onComplete: () => { if (token === this.speechToken) this.clearSpeech(); },
      });
    });
  }

  interact() {
    if (this.phase !== 'shop') return;
    if (!this.ready || !this.customer) {
      this.speech('АЛЕКСЕЙ', 'Покупатель уже подходит — встречу у прилавка.', 'hero', 1300);
      return;
    }
    const r = requests[this.current];
    if (Math.abs(this.hero.x - r.x) > 235) {
      this.speech('АЛЕКСЕЙ', 'Подойду поближе. Через зал не кричим!', 'hero');
      this.target = r.x + (r.x > 640 ? -200 : 200);
      return;
    }
    this.phase = 'choice';
    this.ready = false;
    this.stopHeroMovement();
    this.clearSpeech();
    this.bottom.removeAll(true);
    this.overlay.removeAll(true);
    this.overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0d1020, 0.63));
    this.panel(260, 118, 760, 465, this.overlay, 0x202236, 0xd8bb80);
    this.text(288, 142, `ПОКУПАТЕЛЬ ${this.current + 1} / 3`, 12, '#edc575', this.overlay);
    this.label(289, 176, r.text, 25, '#f5eedf', this.overlay);
    this.label(289, 296, 'ВЫБЕРИ ТОВАР', 14, '#9695aa', this.overlay);
    products.forEach((p, i) => {
      const x = 287 + i * 239;
      const b = this.button(x, 332, 227, 209, '', () => this.choose(i), this.overlay);
      const g = this.add.graphics();
      b.c.add(g);
      g.fillStyle(0x0e1221).fillRect(73, 22, 80, 73);
      g.fillStyle(p.color).fillRect(78, 28, 70, 60);
      g.fillStyle(0x292b3d).fillRect(75, 15, 76, 15);
      g.fillStyle(0xf8efdd).fillRect(82, 40, 62, 32);
      this.label(113, 55, p.tag, 19, '#24273b', b.c).setOrigin(0.5);
      this.label(113, 122, `${i + 1}. ${p.name}`, 19, '#f6eedb', b.c).setOrigin(0.5);
      this.label(113, 155, p.desc, 12, '#aaaabd', b.c).setOrigin(0.5);
      this.label(113, 184, 'ВЫБРАТЬ  →', 12, '#edc575', b.c).setOrigin(0.5);
    });
  }


  choose(i: number) {
    if (this.phase !== 'choice') return;
    const r = requests[this.current];
    if (i !== r.answer) {
      audio.sfx('bad');
      this.shopMistakes++;
      this.fatigue = Math.min(98, this.fatigue + 5);
      this.updateHud();
      this.cameras.main.shake(100, 0.002);
      this.overlay.getByName('choice-error')?.destroy();
      this.label(640, 555, 'Почти! Перечитай запрос — нужна другая добавка.', 17, '#ff9a8b', this.overlay).setOrigin(0.5).setName('choice-error');
      return;
    }

    this.phase = 'feedback';
    this.ready = false;
    audio.sfx('good');
    this.overlay.removeAll(true);
    this.bottom.removeAll(true);
    const feedbackBar = this.add.graphics().fillStyle(0x101321, 0.94).fillRect(0, 625, W, 95);
    this.bottom.add(feedbackBar);
    this.label(640, 660, 'ЗАКАЗ ВЫДАН  ·  ОТЛИЧНАЯ РАБОТА', 19, '#edc575', this.bottom).setOrigin(0.5);
    this.completed++;
    this.fatigue = Math.min(95, this.fatigue + 23);
    this.updateHud();
    this.speech('АЛЕКСЕЙ', r.reply, 'hero', 900);
    this.particles(this.customer!.x, 335, 12, C.gold);
    this.tweens.add({ targets: this.hero, angle: -1.4, duration: 130, yoyo: true, repeat: 1, onComplete: () => this.hero.setAngle(0) });

    this.time.delayedCall(650, () => {
      if (this.phase !== 'feedback' || !this.customer) return;
      this.speech(r.name, r.thanks, 'customer', 1100);
      this.customerEntering = true;
      this.tweens.add({
        targets: this.customer,
        x: r.x > 640 ? 1400 : -100,
        alpha: 0,
        duration: 750,
        delay: 500,
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (this.phase !== 'feedback') return;
          this.customer?.destroy();
          this.customerShadow?.destroy();
          this.customer = undefined;
          this.customerShadow = undefined;
          this.clearSpeech();
          if (this.completed === 3) {
            this.shiftOver();
          } else {
            this.phase = 'shop';
            this.shopControls();
            this.arrive();
          }
        },
      });
    });
  }

  shiftOver() {
    if (this.phase !== 'feedback') return;
    this.phase = 'transition';
    this.stopHeroMovement();
    this.body.setAngle(-1.2);
    this.bottom.removeAll(true);
    this.clearSpeech();
    this.overlay.removeAll(true);
    this.overlay.add(this.add.rectangle(W / 2, H / 2, W, H, 0x111423, 0.76));
    this.text(640, 285, 'СМЕНА ОКОНЧЕНА', 35, '#edc575', this.overlay).setOrigin(0.5);
    this.label(640, 360, '«Фух, поработали… Пора подкачаться!»', 27, '#f8f0df', this.overlay).setOrigin(0.5);
    audio.sfx('transition');
    this.time.delayedCall(2100, () => this.toGym());
  }

  toGym() {
    if (this.phase !== 'transition') return;
    this.overlay.removeAll(true);
    const tiles: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 9; j++) {
        const tile = this.add.rectangle(i * 80, j * 80, 82, 82, C.ink).setOrigin(0).setDepth(50).setAlpha(0);
        tiles.push(tile);
        this.tweens.add({ targets: tile, alpha: 1, duration: 80, delay: (i + j) * 25 });
      }
    }
    this.time.delayedCall(800, () => {
      if (this.phase !== 'transition') return;
      this.bg.setTexture('gym');
      this.children.list.filter(o => o instanceof Phaser.GameObjects.Text && o.depth === 0).forEach(o => o.destroy());
      this.hero.setPosition(640, GYM_GROUND).setScale(1).setAngle(0);
      this.heroGround = GYM_GROUND;
      this.setHeroTexture('hero-down', GYM_SCALE);
      this.shadow.setDisplaySize(245, 28);
      this.phase = 'gymIntro';
      audio.setScene('gym');
      this.drawHud();
      this.gymIntro();
      tiles.forEach((tile, k) => this.tweens.add({ targets: tile, alpha: 0, delay: (k % 9) * 40, duration: 220, onComplete: () => tile.destroy() }));
    });
  }

  gymIntro() {
    this.overlay.removeAll(true);
    this.panel(60, 206, 400, 298, this.overlay, 0x1c2033, 0xbba17b);
    this.text(85, 232, '02 / КАЧАЛКА', 16, '#edc575', this.overlay);
    this.label(85, 281, 'Поймай момент.', 32, '#f7eedc', this.overlay);
    this.label(85, 333, 'Жми, когда бегунок в зелёной зоне.\n10 точных повторений — и ты легенда.\nПромах? Выдохни и попробуй ещё.', 19, '#beb9cb', this.overlay);
    this.button(85, 427, 347, 54, 'К ШТАНГЕ   →', () => this.beginGym(), this.overlay, true);
    this.label(853, 298, 'СМЕНА ЗАКРЫТА.\nПОДХОД ОТКРЫТ.', 27, '#f4e9d6', this.overlay);
    this.label(854, 390, 'DFS • AFTER HOURS', 14, '#dfb773', this.overlay);
  }

  beginGym() {
    if (this.phase !== 'gymIntro') return;
    this.overlay.removeAll(true);
    this.phase = 'gym';
    this.gymTime = 0;
    this.needle = 0;
    this.cycleMs = this.currentCycleMs();
    this.gymControls();
  }

  currentCycleMs() {
    if (this.reps < 3) return 2600;
    if (this.reps < 6) return 2300;
    if (this.reps < 9) return 2000;
    return 1800;
  }

  gymControls() {
    this.bottom.removeAll(true);
    const g = this.add.graphics().fillStyle(0x101321, 0.96).fillRect(0, 560, W, 160);
    this.bottom.add(g);
    this.text(METER_X, 572, 'ПОЙМАЙ ЗЕЛЁНУЮ ЗОНУ', 12, '#c6c0ce', this.bottom);
    this.label(45, 590, 'ПОВТОРЫ', 13, '#8f91a7', this.bottom);
    this.gymRepsText = this.label(45, 620, `${this.reps} / 10`, 29, '#f6eedb', this.bottom);
    this.panel(METER_X - 8, METER_Y - 6, METER_W + 16, METER_H + 12, this.bottom, 0x313145);
    const zones = this.add.graphics();
    this.bottom.add(zones);
    const toleranceLeft = METER_X + METER_W * (HIT_MIN - 0.04);
    const toleranceRight = METER_X + METER_W * (HIT_MAX + 0.04);
    const greenLeft = METER_X + METER_W * HIT_MIN;
    const greenRight = METER_X + METER_W * HIT_MAX;
    zones.fillStyle(0xe1bd64, 0.52).fillRect(toleranceLeft, METER_Y + 5, toleranceRight - toleranceLeft, METER_H - 10);
    zones.fillStyle(0x9ae459).fillRect(greenLeft, METER_Y + 5, greenRight - greenLeft, METER_H - 10);
    zones.lineStyle(2, 0xe9ffd0, 0.9).strokeRect(greenLeft, METER_Y + 5, greenRight - greenLeft, METER_H - 10);
    for (let i = 0; i <= 10; i++) zones.fillStyle(0x111522, 0.18).fillRect(METER_X + i * METER_W / 10, METER_Y + 5, 2, METER_H - 10);
    this.meterFlash = this.add.graphics();
    this.bottom.add(this.meterFlash);
    this.meterFlash.fillStyle(0xf4ffd8, 0.9).fillRect(greenLeft - 5, METER_Y, greenRight - greenLeft + 10, METER_H).setAlpha(0);
    this.needleG = this.add.graphics();
    this.bottom.add(this.needleG);
    this.timeBar = this.add.graphics();
    this.bottom.add(this.timeBar);
    const b = this.button(910, 596, 310, 94, 'ПРОБЕЛ  /  ЖМИ!', () => this.lift(), this.bottom, true);
    this.liftButtonText = b.t;
    this.label(METER_X, 672, 'ЗЕЛЁНАЯ ЗОНА = ПОВТОРЕНИЕ', 12, '#a8cfa0', this.bottom);
    this.label(METER_X, 694, 'Мимо не засчитывается · сразу новая попытка', 12, '#8f91a7', this.bottom);
    this.updateNeedle();
  }

  updateNeedle() {
    const x = METER_X + this.needle * METER_W;
    this.needleG?.clear()
      .fillStyle(0x151728).fillRect(x - 6, METER_Y - 12, 12, METER_H + 24)
      .fillStyle(0xfff7da).fillRect(x - 3, METER_Y - 9, 6, METER_H + 18)
      .fillStyle(C.gold).fillTriangle(x - 10, METER_Y - 23, x + 10, METER_Y - 23, x, METER_Y - 11)
      .fillTriangle(x - 10, METER_Y + METER_H + 23, x + 10, METER_Y + METER_H + 23, x, METER_Y + METER_H + 11);
    this.timeBar?.clear().fillStyle(C.gold, 0.65).fillRect(METER_X, METER_Y + METER_H + 12, this.needle * METER_W, 2);
  }

  gymFeedback(text: string, good: boolean) {
    const t = this.label(875, 190, text, 29, good ? '#f8d78e' : '#ff9a8b', this.overlay).setOrigin(0.5);
    this.tweens.add({ targets: t, y: 166, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  lift() {
    if (this.phase !== 'gym') return;
    // The rendered needle and the hit test use the exact same normalized value.
    this.lastHitNeedle = this.needle;
    const good = this.needle >= HIT_MIN && this.needle <= HIT_MAX;
    this.phase = 'lifting';
    this.gymTime = 0;
    this.liftButtonText?.setText(good ? 'ЕСТЬ!' : 'МИМО!');
    this.meterFlash?.setAlpha(good ? 0.85 : 0);
    if (this.meterFlash) this.tweens.add({ targets: this.meterFlash, alpha: 0, duration: 220 });

    if (good) {
      this.reps++;
      this.power += 100;
      audio.sfx('good');
      this.setHeroTexture('hero-up', GYM_SCALE);
      this.tweens.add({ targets: this.hero, y: GYM_GROUND - 6, duration: 150, yoyo: true, hold: 210, ease: 'Quad.easeOut' });
      this.particles(640, 250, 14, C.gold);
      this.gymFeedback(this.reps % 2 === 0 ? 'МОЩНО!' : 'ОТЛИЧНО!', true);
      if (this.needleG) this.tweens.add({ targets: this.needleG, alpha: 0.35, duration: 70, yoyo: true, repeat: 1 });
    } else {
      this.misses++;
      audio.sfx('bad');
      this.hero.setAngle(-2.2);
      this.tweens.add({ targets: this.hero, angle: 0, duration: 240, ease: 'Bounce.easeOut' });
      this.gymFeedback('МИМО!', false);
    }
    this.updateHud();
    this.gymRepsText?.setText(`${this.reps} / 10`);

    this.time.delayedCall(good ? 800 : 600, () => {
      if (this.phase !== 'lifting') return;
      if (this.reps === 10) {
        this.win();
        return;
      }
      this.setHeroTexture('hero-down', GYM_SCALE);
      this.hero.setPosition(640, GYM_GROUND).setAngle(0);
      this.phase = 'gym';
      this.gymTime = 0;
      this.needle = 0;
      this.cycleMs = this.currentCycleMs();
      this.liftButtonText?.setText('ПРОБЕЛ  /  ЖМИ!');
      this.gymControls();
    });
  }


  win() {
    if (this.phase !== 'lifting') return;
    this.phase = 'win';
    this.tweens.killTweensOf(this.hero);
    this.tweens.killTweensOf(this.body);
    this.hero.setAngle(0);
    this.heroGround = 650;
    audio.setScene('win');
    audio.sfx('win');
    this.bottom.removeAll(true);
    this.clearSpeech();
    this.cameras.main.flash(260, 255, 240, 188);
    this.cameras.main.shake(180, 0.006);
    this.setHeroTexture('hero-win', 0.60);
    this.hero.setPosition(640, 650).setScale(0.85);
    this.tweens.add({ targets: this.hero, scaleX: 1, scaleY: 1, duration: 850, ease: 'Back.easeOut' });
    this.shadow.setDisplaySize(310, 34);
    this.particles(640, 350, 80, C.gold);
    this.time.addEvent({ delay: 650, repeat: 5, callback: () => this.particles(Phaser.Math.Between(100, 1180), Phaser.Math.Between(100, 440), 14, Phaser.Math.RND.pick([C.gold, C.green, 0xd4a3df])) });
    const rays = this.add.graphics().setDepth(2);
    rays.fillStyle(C.gold, 0.10);
    for (let i = 0; i < 14; i++) {
      const a = i * Math.PI / 7;
      rays.fillTriangle(640, 400, 640 + 900 * Math.cos(a), 400 + 900 * Math.sin(a), 640 + 900 * Math.cos(a + 0.12), 400 + 900 * Math.sin(a + 0.12));
    }
    this.tweens.add({ targets: rays, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    this.overlay.removeAll(true);
    this.panel(190, 100, 900, 60, this.overlay, 0x1c2033, C.gold);
    this.label(640, 130, 'АЛЕКСЕЙ — ЛЕГЕНДА КАЧАЛКИ!', 35, '#f8d78e', this.overlay).setOrigin(0.5);
    this.panel(55, 270, 325, 226, this.overlay, 0x1c2033, 0x8a7c75);
    this.text(80, 295, 'СМЕНА НА ПЯТЬ.', 17, '#edc575', this.overlay);
    this.label(80, 340, `Покупатели          3 / 3\nПовторения        10 / 10\nСила                  ${this.power}\nПромахи                ${this.misses}`, 21, '#d9d1df', this.overlay);
    this.label(918, 323, 'ЧЕМПИОН\nПОСЛЕ\nЛЮБОЙ СМЕНЫ.', 29, '#f8ecd5', this.overlay);
    let best = 0;
    try {
      best = Number(localStorage.getItem('dfs-best') || 0);
      if (!best || this.misses < best) localStorage.setItem('dfs-best', String(this.misses));
    } catch { /* Private browsing may deny local storage. */ }
    this.button(420, 646, 440, 58, 'ИГРАТЬ СНОВА   ↻', () => { audio.sfx('tap'); window.location.reload(); }, this.overlay, true);
  }

  particles(x: number, y: number, n: number, color: number) {
    for (let i = 0; i < n; i++) {
      const p = this.add.rectangle(x, y, Phaser.Math.Between(3, 9), Phaser.Math.Between(3, 9), color).setDepth(25);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-260, 260),
        y: y + Phaser.Math.Between(-220, 210),
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0,
        duration: Phaser.Math.Between(500, 1250),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  setPause(v: boolean) {
    if (this.phase === 'title' || this.phase === 'win' || this.paused === v) return;
    this.paused = v;
    this.direction = 0;
    this.held.clear();
    this.target = undefined;
    this.time.paused = v;
    this.tweens.timeScale = v ? 0 : 1;
    this.pauseLabel.setText(v ? '▶' : 'II');
    if (v) {
      const c = this.add.container(0, 0).setDepth(100).setName('pause');
      c.add(this.add.rectangle(640, 360, W, H, 0x0e1220, 0.85));
      this.text(640, 290, 'ПАУЗА', 38, '#edc575', c).setOrigin(0.5);
      this.label(640, 360, 'Чемпион тоже отдыхает.', 24, '#f7eddb', c).setOrigin(0.5);
      this.button(465, 422, 350, 64, 'ПРОДОЛЖИТЬ', () => this.setPause(false), c, true);
    } else {
      this.children.getByName('pause')?.destroy();
    }
  }

  update(_time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.P)) this.setPause(!this.paused);
    if (this.paused) return;
    // Movement is clamped against tunnelling, but the gym needle must keep real time
    // even when a slow device renders fewer frames.
    const movementDelta = Math.min(delta, 60);
    const dt = movementDelta / 1000;
    this.elapsed += this.phase === 'title' || this.phase === 'win' ? 0 : delta;
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER);
    if (this.phase === 'title' && enter) this.startShop();
    else if (this.phase === 'gymIntro' && enter) this.beginGym();

    if (this.phase === 'shop') {
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
      const keyboard = (this.cursors.left.isDown || this.keys.A.isDown ? -1 : 0) + (this.cursors.right.isDown || this.keys.D.isDown ? 1 : 0);
      const manual = keyboard || this.direction;
      const maxSpeed = 340;
      const acceleration = 2800;
      const deceleration = 3600;
      let desiredVelocity = manual * maxSpeed;
      if (manual) this.target = undefined;
      if (!manual && this.target !== undefined) {
        const diff = this.target - this.hero.x;
        if (Math.abs(diff) < 4 && Math.abs(this.heroVelocity) < 45) {
          this.hero.x = this.target;
          this.target = undefined;
          this.heroVelocity = 0;
          desiredVelocity = 0;
        } else {
          const brakingSpeed = Math.sqrt(2 * deceleration * Math.max(0, Math.abs(diff) - 3));
          desiredVelocity = Math.sign(diff) * Math.min(maxSpeed, brakingSpeed);
        }
      }
      const rate = Math.abs(desiredVelocity) < Math.abs(this.heroVelocity) ? deceleration : acceleration;
      this.heroVelocity = approach(this.heroVelocity, desiredVelocity, rate * dt);
      const oldX = this.hero.x;
      this.hero.x = Phaser.Math.Clamp(this.hero.x + this.heroVelocity * dt, 165, 1115);
      if (this.hero.x === 165 || this.hero.x === 1115) this.heroVelocity = 0;
      if (this.target !== undefined && (oldX - this.target) * (this.hero.x - this.target) <= 0) {
        this.hero.x = this.target;
        this.target = undefined;
        this.heroVelocity = 0;
      }
      this.setWalking(Math.abs(this.heroVelocity) > 8 || Math.abs(desiredVelocity) > 0);
      if (this.walking) {
        this.body.setScale(HERO_SCALE);
        this.body.x = Phaser.Math.Linear(this.body.x, Math.sign(this.heroVelocity) * 1.5, 0.16);
      } else {
        this.body.x = Phaser.Math.Linear(this.body.x, 0, 0.2);
        this.body.scaleX = HERO_SCALE;
        this.body.scaleY = HERO_SCALE * (1 + Math.sin(this.time.now * 0.002) * 0.0014);
      }
    } else if (this.phase === 'choice') {
      [this.keys.ONE, this.keys.TWO, this.keys.THREE].forEach((k, i) => {
        if (Phaser.Input.Keyboard.JustDown(k)) this.choose(i);
      });
    } else if (this.phase === 'gym') {
      this.cycleMs = this.currentCycleMs();
      this.gymTime += delta;
      this.needle = (this.gymTime % this.cycleMs) / this.cycleMs;
      this.updateNeedle();
      this.body.scaleX = GYM_SCALE;
      this.body.scaleY = GYM_SCALE * (1 + Math.sin(this.time.now * 0.002) * 0.0012);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.lift();
    }

    this.shadow.setPosition(this.hero.x, this.heroGround + 3);
    if (this.customer && this.customerShadow) {
      this.customerShadow.setPosition(this.customer.x, CUSTOMER_GROUND + 2);
      this.customerShadow.setAlpha(this.customer.alpha * 0.48);
      if (!this.customerEntering) {
        const baseY = 336 / 220;
        this.customer.scaleY = baseY * (1 + Math.sin(this.time.now * 0.0018 + this.current) * 0.0015);
      }
    }
  }
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return target;
}

async function boot() {
  try { await document.fonts.load('12px Pixel'); } catch { /* The fallback font remains usable. */ }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#171826',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    scene: AfterShift,
    input: { activePointers: 4 },
    render: { powerPreference: 'high-performance' },
    audio: { noAudio: true },
  });
}

boot();
