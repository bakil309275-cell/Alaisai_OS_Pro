
"use strict";

/* ==========================================
   سيد المجرة | العيسائي
   main.js — محرك اللعبة والتقدم والمكافآت
   ========================================== */

const CONFIG = Object.freeze({
  saveKey: "galaxy_alisai_v2",
  dailyCooldown: 24 * 60 * 60 * 1000,
  maxDelta: 0.033,
  baseXP: 1000,
  bossEvery: 5,
  waveDuration: 25,
  adUrl: "", // ضع رابط منصتك الإعلانية هنا لاحقًا
  rewardAdEnabled: false
});

const SHIPS = [
  { name: "فالكون", emoji: "🚀", hp: 100, damage: 10, speed: 300, price: 0 },
  { name: "تيتان", emoji: "🛸", hp: 190, damage: 16, speed: 245, price: 500 },
  { name: "دبور", emoji: "🚁", hp: 75, damage: 9, speed: 390, price: 800 }
];

const ENEMY_TYPES = [
  { name: "دجاجة فضائية", emoji: "🐓", hp: 24, speed: 95, damage: 12, reward: 20, color: "#ffb347" },
  { name: "طائر فضائي", emoji: "🐦", hp: 18, speed: 140, damage: 10, reward: 25, color: "#63e6ff" },
  { name: "مهاجم مدرع", emoji: "👾", hp: 55, speed: 65, damage: 18, reward: 45, color: "#ff4d8d" },
  { name: "قنبلة طائرة", emoji: "🚁", hp: 35, speed: 110, damage: 20, reward: 35, color: "#b69aff" }
];

const UPGRADES = {
  hp: { name: "درع إضافي", base: 100, max: 5 },
  dmg: { name: "قوة السلاح", base: 150, max: 5 },
  speed: { name: "محرك فائق", base: 200, max: 5 }
};

const DEFAULT_SAVE = {
  level: 1,
  xp: 0,
  credits: 0,
  crystals: 100,
  ship: 0,
  owned: [0],
  upgrades: { hp: 0, dmg: 0, speed: 0 },
  lastDaily: 0,
  best: 0,
  kills: 0,
  bosses: 0,
  games: 0,
  settings: { sfx: 50, shake: true, vibrate: true }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const Store = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.saveKey));
      if (!saved || typeof saved !== "object") return clone(DEFAULT_SAVE);

      const result = { ...clone(DEFAULT_SAVE), ...saved };
      result.upgrades = {
        ...DEFAULT_SAVE.upgrades,
        ...(saved.upgrades || {})
      };
      result.settings = {
        ...DEFAULT_SAVE.settings,
        ...(saved.settings || {})
      };

      result.owned = Array.isArray(saved.owned)
        ? [...new Set(saved.owned.filter(n =>
            Number.isInteger(n) && n >= 0 && n < SHIPS.length
          ))]
        : [0];

      if (!result.owned.includes(0)) result.owned.unshift(0);

      for (const key of [
        "level", "xp", "credits", "crystals",
        "ship", "lastDaily", "best", "kills", "bosses", "games"
      ]) {
        const value = Number(result[key]);
        result[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
      }

      result.level = Math.max(1, Math.floor(result.level));
      result.ship = Math.min(SHIPS.length - 1, Math.floor(result.ship));

      if (!result.owned.includes(result.ship)) result.ship = 0;

      for (const key of Object.keys(UPGRADES)) {
        result.upgrades[key] = Math.max(
          0,
          Math.min(
            UPGRADES[key].max,
            Math.floor(Number(result.upgrades[key]) || 0)
          )
        );
      }

      result.settings.sfx = Math.max(
        0, Math.min(100, Number(result.settings.sfx) || 0)
      );

      result.settings.shake = result.settings.shake !== false;
      result.settings.vibrate = result.settings.vibrate !== false;

      return result;
    } catch {
      return clone(DEFAULT_SAVE);
    }
  },

  save(data) {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
};

const Data = {
  state: Store.load(),

  save() {
    return Store.save(this.state);
  },

  addXP(amount) {
    this.state.xp += Math.max(0, Math.floor(amount));

    while (this.state.xp >= this.state.level * CONFIG.baseXP) {
      this.state.xp -= this.state.level * CONFIG.baseXP;
      this.state.level++;
      UI.toast(`🎖️ ارتقيت إلى المستوى ${this.state.level}`);
      AudioFX.play("level");
    }

    this.save();
    UI.refresh();
  },

  shipStats() {
    const ship = SHIPS[this.state.ship];
    const u = this.state.upgrades;

    return {
      hp: ship.hp + u.hp * 25,
      damage: ship.damage + u.dmg * 4,
      speed: ship.speed + u.speed * 20,
      fireRate: Math.max(0.09, 0.24 - u.speed * 0.025),
      weapon: 1 + Math.floor(u.dmg / 2)
    };
  },

  toggle(key) {
    if (!(key in this.state.settings)) return;

    if (typeof this.state.settings[key] === "boolean") {
      this.state.settings[key] = !this.state.settings[key];
    }

    this.save();
    UI.refreshSettings();
  }
};

const AudioFX = {
  ctx: null,

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  },

  play(type) {
    if (!Data.state.settings.sfx) return;

    this.init();
    if (!this.ctx) return;

    const notes = {
      click: [650, 320, 0.07, "sine"],
      shoot: [800, 180, 0.06, "square"],
      hit: [150, 55, 0.12, "sawtooth"],
      collect: [650, 1100, 0.15, "sine"],
      level: [400, 1000, 0.28, "triangle"],
      explosion: [120, 35, 0.18, "sawtooth"]
    };

    const n = notes[type] || notes.click;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const volume = Data.state.settings.sfx / 100;

    osc.type = n[3];
    osc.frequency.setValueAtTime(n[0], now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(25, n[1]), now + n[2]
    );

    gain.gain.setValueAtTime(0.12 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n[2]);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + n[2] + 0.01);
  }
};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

const UI = {
  toast(message) {
    let box = document.getElementById("toastBox");

    if (!box) {
      box = document.createElement("div");
      box.id = "toastBox";
      document.body.appendChild(box);
    }

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    box.appendChild(el);

    window.setTimeout(() => el.remove(), 2600);
  },

  show(id) {
    if (Game.state === "PLAYING") return;

    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.remove("active");
    });

    const screen = document.getElementById("screen-" + id);
    if (screen) screen.classList.add("active");

    const playing = Game.state === "PLAYING";
    const hud = document.getElementById("hud");
    const topBar = document.getElementById("topBar");

    if (hud) hud.style.display = playing ? "flex" : "none";
    if (topBar) topBar.style.display = playing ? "none" : "block";

    if (id === "hangar") this.buildHangar();
    if (id === "upgrades") this.buildUpgrades();
    if (id === "missions") this.buildMissions();

    this.refresh();
    this.refreshSettings();
  },

  refresh() {
    const d = Data.state;

    setText("levelLabel", `المستوى ${d.level}`);
    setText("xpLabel", `الخبرة ${Math.floor(d.xp)} / ${d.level * CONFIG.baseXP}`);
    setText("credits", Math.floor(d.credits));
    setText("crystals", Math.floor(d.crystals));
  },

  refreshSettings() {
    const sfx = document.getElementById("sfx");
    if (sfx) sfx.value = Data.state.settings.sfx;

    for (const key of ["shake", "vibrate"]) {
      const el = document.getElementById(
        key === "shake" ? "shakeToggle" : "vibrateToggle"
      );

      if (el) el.classList.toggle("on", Data.state.settings[key]);
    }
  },

  daily() {
    const now = Date.now();
    const remaining = CONFIG.dailyCooldown - (now - Data.state.lastDaily);

    if (remaining > 0) {
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      this.toast(`المكافأة اليومية بعد ${hours} ساعة و${mins} دقيقة`);
      return;
    }

    Data.state.crystals += 50;
    Data.state.credits += 200;
    Data.state.lastDaily = now;

    Data.save();
    this.refresh();
    this.toast("🎁 حصلت على 50 جوهرة و200 عملة!");
    AudioFX.play("collect");
  },

  buildHangar() {
    const list = document.getElementById("hangarList");
    if (!list) return;

    list.replaceChildren();

    SHIPS.forEach((ship, i) => {
      const owned = Data.state.owned.includes(i);
      const equipped = Data.state.ship === i;

      const item = document.createElement("div");
      item.className = "item";

      const info = document.createElement("div");
      info.className = "item-info";

      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = `${ship.emoji} ${ship.name}`;

      const desc = document.createElement("div");
      desc.className = "item-desc";
      desc.textContent =
        `درع ${ship.hp} · ضرر ${ship.damage} · سرعة ${ship.speed}`;

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = equipped
        ? "مجهزة"
        : owned
          ? "تجهيز"
          : `${ship.price} 🪙`;

      btn.disabled = equipped || (!owned && Data.state.credits < ship.price);

      btn.addEventListener("click", () => {
        if (owned) {
          Data.state.ship = i;
        } else {
          if (Data.state.credits < ship.price) return;

          Data.state.credits -= ship.price;
          Data.state.owned.push(i);
          Data.state.ship = i;
        }

        Data.save();
        this.buildHangar();
        this.refresh();
        AudioFX.play("collect");
      });

      info.append(title, desc);
      item.append(info, btn);
      list.appendChild(item);
    });
  },

  buildUpgrades() {
    const list = document.getElementById("upgradeList");
    if (!list) return;

    list.replaceChildren();

    const descriptions = {
      hp: "يزيد الحد الأقصى للصحة",
      dmg: "يزيد الضرر وعدد الطلقات",
      speed: "يطور الحركة وسرعة الإطلاق"
    };

    for (const [key, upgrade] of Object.entries(UPGRADES)) {
      const level = Data.state.upgrades[key];
      const cost = upgrade.base * (level + 1);

      const item = document.createElement("div");
      item.className = "item";

      const info = document.createElement("div");
      info.className = "item-info";

      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = `${upgrade.name} · ${level}/${upgrade.max}`;

      const desc = document.createElement("div");
      desc.className = "item-desc";
      desc.textContent = descriptions[key];

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = level >= upgrade.max ? "الحد الأقصى" : `${cost} 💎`;
      btn.disabled = level >= upgrade.max || Data.state.crystals < cost;

      btn.addEventListener("click", () => {
        if (level >= upgrade.max || Data.state.crystals < cost) return;

        Data.state.crystals -= cost;
        Data.state.upgrades[key]++;
        Data.save();
        this.buildUpgrades();
        this.refresh();
        AudioFX.play("collect");
      });

      info.append(title, desc);
      item.append(info, btn);
      list.appendChild(item);
    }
  },

  buildMissions() {
    setText("bestScore", Data.state.best);
    setText("bossKills", Data.state.bosses);
    setText("totalKills", Data.state.kills);
    setText("gamesPlayed", Data.state.games);
  },

  start() {
    Game.start();
  },

  openRewardAd() {
    if (!CONFIG.adUrl) {
      this.toast("أضف رابط منصة الإعلانات في CONFIG.adUrl أولًا");
      return;
    }

    window.open(CONFIG.adUrl, "_blank", "noopener,noreferrer");
  }
};

const Game = {
  canvas: document.getElementById("game"),
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  state: "MENU",
  raf: 0,
  last: 0,
  time: 0,
  player: null,
  stats: null,

  enemies: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
  drops: [],
  stars: [],
  keys: {},

  score: 0,
  wave: 1,
  waveTime: 0,
  spawnTime: 0,
  credits: 0,
  crystals: 0,
  kills: 0,
  bosses: 0,
  boss: null,
  shake: 0,
  rewardDone: false,

  pointerDown: false,
  pointerX: null,
  pointerY: null,

  init() {
    if (!this.canvas) {
      console.error("لم يتم العثور على canvas#game");
      return;
    }

    this.ctx = this.canvas.getContext("2d");
    this.resize();

    this.stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      size: Math.random() * 1.8 + 0.4,
      speed: 20 + Math.random() * 70
    }));

    window.addEventListener("resize", () => this.resize(), { passive: true });
    this.bindInput();
    this.drawBackground();
  },

  resize() {
    this.W = Math.max(1, window.innerWidth);
    this.H = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);

    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.player) {
      this.player.x = Math.max(20, Math.min(this.W - 20, this.player.x));
      this.player.y = this.H - 105;
    }
  },

  bindInput() {
    this.canvas.addEventListener("pointerdown", e => {
      if (this.state !== "PLAYING") return;

      AudioFX.init();
      this.pointerDown = true;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;

      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
    });

    this.canvas.addEventListener("pointermove", e => {
      if (this.state !== "PLAYING") return;

      if (this.pointerDown || e.pointerType === "mouse") {
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;
      }
    });

    this.canvas.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });

    window.addEventListener("keydown", e => {
      this.keys[e.key.toLowerCase()] = true;

      if (e.key === "Escape") {
        if (this.state === "PLAYING") this.pause();
        else if (this.state === "PAUSED") this.resume();
      }
    });

    window.addEventListener("keyup", e => {
      this.keys[e.key.toLowerCase()] = false;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "PLAYING") this.pause();
    });
  },

  start() {
    cancelAnimationFrame(this.raf);

    this.stats = Data.shipStats();

    this.player = {
      x: this.W / 2,
      y: this.H - 105,
      targetX: this.W / 2,
      targetY: this.H - 105,
      hp: this.stats.hp,
      maxHp: this.stats.hp,
      r: 16,
      fire: 0,
      invulnerable: 1
    };

    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.drops = [];

    this.score = 0;
    this.wave = 1;
    this.waveTime = 0;
    this.spawnTime = 0.5;
    this.time = 0;
    this.credits = 0;
    this.crystals = 0;
    this.kills = 0;
    this.bosses = 0;
    this.boss = null;
    this.shake = 0;
    this.rewardDone = false;
    this.pointerDown = false;
    this.pointerX = null;
    this.pointerY = null;

    this.state = "PLAYING";
    this.last = performance.now();

    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));

    const topBar = document.getElementById("topBar");
    const hud = document.getElementById("hud");
    const bossBar = document.getElementById("bossBar");

    if (topBar) topBar.style.display = "none";
    if (hud) hud.style.display = "flex";
    if (bossBar) bossBar.style.display = "none";

    setText("shipLabel", SHIPS[Data.state.ship].name);

    AudioFX.init();
    UI.refresh();
    this.updateHUD();
    this.raf = requestAnimationFrame(t => this.loop(t));
  },

  pause() {
    if (this.state !== "PLAYING") return;

    this.state = "PAUSED";
    cancelAnimationFrame(this.raf);
    this.pointerDown = false;

    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));

    const screen = document.getElementById("screen-pause");
    if (screen) screen.classList.add("active");

    // إبقاء زر الإعدادات مخفيًا أثناء نافذة التوقف.
    const topBar = document.getElementById("topBar");
    if (topBar) topBar.style.display = "none";
  },

  resume() {
    if (this.state !== "PAUSED") return;

    this.state = "PLAYING";
    this.last = performance.now();

    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));

    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "flex";

    this.raf = requestAnimationFrame(t => this.loop(t));
  },

  quit() {
    if (!["PLAYING", "PAUSED"].includes(this.state)) return;

    this.state = "MENU";
    cancelAnimationFrame(this.raf);
    this.pointerDown = false;

    const hud = document.getElementById("hud");
    const bossBar = document.getElementById("bossBar");

    if (hud) hud.style.display = "none";
    if (bossBar) bossBar.style.display = "none";

    UI.show("menu");
  },

  loop(t) {
    if (this.state !== "PLAYING") return;

    const dt = Math.min(Math.max((t - this.last) / 1000, 0), CONFIG.maxDelta);
    this.last = t;

    this.time += dt;
    this.update(dt);
    this.draw();

    if (this.state === "PLAYING") {
      this.raf = requestAnimationFrame(next => this.loop(next));
    }
  },

  update(dt) {
    const p = this.player;
    if (!p || this.state !== "PLAYING") return;

    if (this.pointerDown && this.pointerX !== null) {
      p.targetX = this.pointerX;
      p.targetY = this.pointerY ?? p.y;
    } else {
      if (this.keys.arrowleft || this.keys.a) p.targetX -= this.stats.speed * dt;
      if (this.keys.arrowright || this.keys.d) p.targetX += this.stats.speed * dt;
      if (this.keys.arrowup || this.keys.w) p.targetY -= this.stats.speed * dt;
      if (this.keys.arrowdown || this.keys.s) p.targetY += this.stats.speed * dt;
    }

    // السماح بالمناورة في معظم الشاشة مع ترك مساحة لواجهة اللعب.
    p.targetX = Math.max(18, Math.min(this.W - 18, p.targetX));
    p.targetY = Math.max(85, Math.min(this.H - 25, p.targetY));

    p.x += (p.targetX - p.x) * Math.min(1, 12 * dt);
    p.y += (p.targetY - p.y) * Math.min(1, 12 * dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);

    p.fire -= dt;

    if (p.fire <= 0) {
      const count = Math.min(3, this.stats.weapon);

      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 12;

        this.bullets.push({
          x: p.x + offset,
          y: p.y - 18,
          vx: offset * 1.5,
          vy: -620,
          r: 4,
          dmg: this.stats.damage,
          type: i === 1 && count === 3 ? "rocket" : "normal"
        });
      }

      p.fire = this.stats.fireRate;
    }

    this.waveTime += dt;
    this.spawnTime -= dt;

    if (this.spawnTime <= 0) {
      this.spawnEnemy();
      this.spawnTime = Math.max(0.3, 1.2 - this.wave * 0.035);
    }

    if (this.waveTime >= CONFIG.waveDuration) {
      this.waveTime -= CONFIG.waveDuration;
      this.wave++;
      UI.toast(`🌌 الموجة ${this.wave}`);

      if (this.wave % CONFIG.bossEvery === 0) this.spawnBoss();
    }

    this.updateBullets(dt);
    if (this.state !== "PLAYING") return;

    this.updateEnemies(dt);
    if (this.state !== "PLAYING") return;

    this.updateDrops(dt);
    this.updateParticles(dt);
    this.updateStars(dt);

    this.shake = Math.max(0, this.shake - dt);
    this.updateHUD();
  },

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y < -30 || b.x < -30 || b.x > this.W + 30) {
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y < -30 || b.y > this.H + 30 || b.x < -30 || b.x > this.W + 30) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      const p = this.player;

      if (
        p.invulnerable <= 0 &&
        Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r
      ) {
        this.enemyBullets.splice(i, 1);
        this.damagePlayer(b.dmg);

        if (this.state !== "PLAYING") return;
      }
    }
  },

  updateEnemies(dt) {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.type === "boss") {
        e.x += e.dir * 110 * dt;

        if (e.x > this.W - e.r || e.x < e.r) {
          e.x = Math.max(e.r, Math.min(this.W - e.r, e.x));
          e.dir *= -1;
        }

        e.y = 95 + Math.sin(this.time * 1.6) * 28;
        e.fire -= dt;

        if (e.fire <= 0) {
          for (let j = 0; j < 12; j++) {
            const a = j * Math.PI * 2 / 12 + this.time * 0.35;

            this.enemyBullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 160,
              vy: Math.sin(a) * 160,
              r: 5,
              dmg: 12
            });
          }

          e.fire = 1.1;
        }
      } else {
        e.age += dt;

        // مسارات مختلفة: دخول جانبي، تموج، ومطاردة.
        if (e.path === "side") {
          e.x += e.dir * e.speed * dt;
          e.y += Math.sin(e.age * 4) * 65 * dt;

          if (e.x < -35 || e.x > this.W + 35) {
            e.dead = true;
          }
        } else if (e.path === "zigzag") {
          e.y += e.speed * dt;
          e.x += Math.sin(e.age * 3) * 95 * dt;
        } else if (e.type === "shooter") {
          e.y += e.speed * dt;
          e.fire -= dt;

          if (e.fire <= 0 && e.y > 0) {
            const a = Math.atan2(p.y - e.y, p.x - e.x);

            this.enemyBullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 220,
              vy: Math.sin(a) * 220,
              r: 5,
              dmg: e.damage
            });

            e.fire = 1.7;
          }
        } else {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.x += Math.cos(a) * e.speed * dt;
          e.y += Math.sin(a) * e.speed * dt;
        }
      }

      if (e.dead || (e.y > this.H + 60 && e.type !== "boss")) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (
        p.invulnerable <= 0 &&
        Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r
      ) {
        this.damagePlayer(e.type === "boss" ? 25 : e.damage || 15);

        if (this.state !== "PLAYING") return;

        if (e.type !== "boss") {
          this.explode(e.x, e.y, e.color);
          this.enemies.splice(i, 1);
          continue;
        }
      }

      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];

        if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
          e.hp -= b.dmg;
          this.bullets.splice(j, 1);

          if (e.hp <= 0) {
            this.killEnemy(e, i);
            break;
          }
        }
      }
    }
  },

  spawnEnemy() {
    const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const r = Math.random();

    const path = r < 0.2 ? "side" : r < 0.45 ? "zigzag" : "direct";
    const sideEntry = path === "side";
    const x = sideEntry
      ? (Math.random() < 0.5 ? -25 : this.W + 25)
      : 25 + Math.random() * Math.max(1, this.W - 50);

    this.enemies.push({
      type: type.name === "مهاجم مدرع" ? "shooter" : "enemy",
      name: type.name,
      emoji: type.emoji,
      x,
      y: sideEntry ? 100 + Math.random() * Math.min(250, this.H / 2) : -30,
      r: 18,
      hp: type.hp + this.wave * 4,
      speed: type.speed + Math.min(this.wave * 3, 90),
      damage: type.damage,
      reward: type.reward,
      color: type.color,
      fire: 1 + Math.random(),
      age: 0,
      path,
      dir: x < 0 ? 1 : -1
    });
  },

  spawnBoss() {
    if (this.boss) return;

    const hp = 500 + this.wave * 120;

    const boss = {
      type: "boss",
      name: "المدمر",
      emoji: "👹",
      x: this.W / 2,
      y: 100,
      r: 42,
      hp,
      maxHp: hp,
      dir: 1,
      fire: 0.8,
      color: "#ff00ff",
      reward: 500
    };

    this.enemies.push(boss);
    this.boss = boss;

    const bar = document.getElementById("bossBar");
    if (bar) bar.style.display = "block";

    UI.toast("⚠️ الزعيم يقترب!");
  },

  killEnemy(e, index) {
    this.explode(e.x, e.y, e.color, e.type === "boss" ? 40 : 14);
    this.score += e.reward || 20;
    this.credits += e.type === "boss" ? 500 : 5;
    this.kills++;

    if (e.type === "boss") {
      this.crystals += 10;
      this.bosses++;
      this.boss = null;

      const bar = document.getElementById("bossBar");
      if (bar) bar.style.display = "none";

      UI.toast("🏆 هُزم الزعيم! +10 جواهر");
    } else if (Math.random() < 0.2) {
      const r = Math.random();

      this.drops.push({
        x: e.x,
        y: e.y,
        r: 12,
        speed: 75,
        type: r < 0.2 ? "crystal" : r < 0.45 ? "heal" : "credit",
        emoji: r < 0.2 ? "💎" : r < 0.45 ? "❤️" : "🪙"
      });
    }

    this.enemies.splice(index, 1);
    AudioFX.play("explosion");
  },

  updateDrops(dt) {
    const p = this.player;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += d.speed * dt;

      if (Math.hypot(p.x - d.x, p.y - d.y) < p.r + d.r + 4) {
        if (d.type === "crystal") this.crystals++;
        else if (d.type === "heal") p.hp = Math.min(p.maxHp, p.hp + 25);
        else this.credits += 10;

        this.drops.splice(i, 1);
        AudioFX.play("collect");
        continue;
      }

      if (d.y > this.H + 25) this.drops.splice(i, 1);
    }
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const a = this.particles[i];

      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;

      if (a.life <= 0) this.particles.splice(i, 1);
    }
  },

  updateStars(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;

      if (s.y > this.H) {
        s.y = 0;
        s.x = Math.random() * this.W;
      }
    }
  },

  damagePlayer(amount) {
    if (this.state !== "PLAYING") return;

    this.player.hp -= amount;
    this.player.invulnerable = 0.65;
    this.shake = 0.25;

    AudioFX.play("hit");

    if (Data.state.settings.vibrate && navigator.vibrate) {
      navigator.vibrate(35);
    }

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.explode(this.player.x, this.player.y, "#00ffff", 35);
      this.gameOver();
    }
  },

  explode(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 170;

      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: 1 + Math.random() * 3,
        life: 0.35 + Math.random() * 0.55,
        max: 0.9,
        color
      });
    }

    this.shake = 0.12;
  },

  updateHUD() {
    if (!this.player) return;

    const hp = document.getElementById("hp");
    if (hp) {
      hp.style.width = Math.max(
        0,
        this.player.hp / this.player.maxHp * 100
      ) + "%";
    }

    setText("scoreLabel", this.score);

    if (this.boss) {
      const bar = document.getElementById("bossHp");
      if (bar) {
        bar.style.width = Math.max(
          0,
          this.boss.hp / this.boss.maxHp * 100
        ) + "%";
      }
    }
  },

  gameOver() {
    if (this.state !== "PLAYING" || this.rewardDone) return;

    this.state = "GAMEOVER";
    this.rewardDone = true;
    cancelAnimationFrame(this.raf);
    this.pointerDown = false;

    Data.state.credits += this.credits;
    Data.state.crystals += this.crystals;
    Data.state.best = Math.max(Data.state.best, this.score);
    Data.state.kills += this.kills;
    Data.state.bosses += this.bosses;
    Data.state.games++;

    Data.addXP(Math.floor(this.score / 10));
    Data.save();

    setText("endScore", this.score);
    setText("endWave", this.wave);
    setText("endCredits", this.credits);
    setText("endCrystals", this.crystals);

    const hud = document.getElementById("hud");
    const bossBar = document.getElementById("bossBar");

    if (hud) hud.style.display = "none";
    if (bossBar) bossBar.style.display = "none";

    UI.show("gameover");
  },

  drawBackground() {
    const ctx = this.ctx;

    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, this.W, this.H);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + Math.sin(this.time + s.x) * 0.25;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    ctx.globalAlpha = 1;
  },

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();

    if (this.shake > 0 && Data.state.settings.shake) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake * 28,
        (Math.random() - 0.5) * this.shake * 28
      );
    }

    this.drawBackground();

    for (const b of this.bullets) {
      ctx.fillStyle = b.type === "rocket" ? "#ffd700" : "#aaffff";
      ctx.shadowColor = b.type === "rocket" ? "#ff9900" : "#00ffff";
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.type === "rocket" ? 5 : b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of this.enemyBullets) {
      ctx.fillStyle = "#ff3b78";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    for (const e of this.enemies) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${e.type === "boss" ? 54 : 35}px sans-serif`;
      ctx.fillText(e.emoji || "👾", e.x, e.y);

      if (e.type === "boss") {
        ctx.fillStyle = "#45103f";
        ctx.fillRect(e.x - 40, e.y + 32, 80, 5);

        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(e.x - 40, e.y + 32, 80 * e.hp / e.maxHp, 5);
      }
    }

    for (const d of this.drops) {
      ctx.font = "23px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(d.emoji, d.x, d.y);
    }

    for (const a of this.particles) {
      ctx.globalAlpha = Math.max(0, a.life / a.max);
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    const p = this.player;

    if (p && this.state !== "GAMEOVER") {
      ctx.save();

      if (p.invulnerable > 0 && Math.floor(this.time * 18) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "42px sans-serif";
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 18;
      ctx.fillText(SHIPS[Data.state.ship].emoji, p.x, p.y);

      ctx.restore();
    }

    ctx.restore();
  }
};

/* ==========================================
   تهيئة الأحداث
   ========================================== */

const sfxInput = document.getElementById("sfx");

if (sfxInput) {
  sfxInput.addEventListener("input", e => {
    Data.state.settings.sfx = Math.max(
      0, Math.min(100, Number(e.target.value) || 0)
    );

    Data.save();
  });
}

document.addEventListener("pointerdown", () => AudioFX.init(), { once: true });

Game.init();
UI.refresh();
UI.refreshSettings();

/*
  واجهة إعلانية:
  يمكن ربط زر HTML بالدالة:
  onclick="UI.openRewardAd()"

  تنبيه:
  فتح رابط إعلاني وحده لا يثبت مشاهدة الإعلان،
  ولا يمنح مكافأة موثوقة. يجب ربط المكافأة
  بمزود إعلانات يدعم Rewarded Ads والتحقق من
  إشارة اكتمال المشاهدة قبل إضافة الرصيد.
*/
