// The simulation: one garden, one guardian, waves of pests. Pure logic, no
// drawing and no sound: the loop in main.js feeds it input and reads back an
// event bitmask. Everything here runs in fixed 1/60 s steps, so the same
// seed always plays the same game.

import {
  CHERRY,
  ENEMIES,
  FIELD,
  FINAL_WAVE,
  HP_SCALE_PER_WAVE,
  PLAYER,
  SCORE,
  SPAWN,
  SPEED_SCALE_PER_WAVE,
  SPRAY,
  WAVES,
  XP,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_LEVELUP = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_BOSS = 32;

/** The eight level-up choices, each with its own stack cap. */
export const UPGRADES = [
  { id: 'double', name: 'Semprotan Ganda', desc: '+1 biji kopi tiap tembakan', max: 3 },
  { id: 'sharp', name: 'Biji Tajam', desc: '+25% damage semprotan', max: 5 },
  { id: 'rapid', name: 'Semprotan Cepat', desc: '+20% kecepatan tembak', max: 5 },
  { id: 'boots', name: 'Sepatu Lincah', desc: '+15% kecepatan gerak', max: 4 },
  { id: 'heart', name: 'Kantong Cherry', desc: '+25 HP maks dan pulih 25 HP', max: 4 },
  { id: 'magnet', name: 'Magnet Cherry', desc: 'Cherry terbang ke arahmu dari jauh', max: 2 },
  { id: 'thorns', name: 'Duri Pelindung', desc: 'Hama yang menyentuhmu kena 10 damage', max: 3 },
  { id: 'dash', name: 'Dash Segar', desc: 'Dash lebih cepat dan melukai hama', max: 2 },
];

function xpForLevel(level) {
  return Math.round(XP.base * Math.pow(level, XP.exponent));
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    wave: 1,
    phase: 'breather',
    breatherTimer: 1.2,
    combo: 0,
    comboTimer: 0,
    player: null,
    enemies: [],
    bullets: [],
    cherries: [],
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    levelUpChoices: null,
    boss: null,
    ambient: [],
  };

  function makePlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      aim: -Math.PI / 2,
      fireTimer: 0,
      dashTimeLeft: 0,
      dashCooldownLeft: 0,
      dashX: 0,
      dashY: 0,
      hurtTimer: 0,
      moveX: 0,
      moveY: 0,
      upgrades: {
        double: 0,
        sharp: 0,
        rapid: 0,
        boots: 0,
        heart: 0,
        magnet: 0,
        thorns: 0,
        dash: 0,
      },
    };
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.wave = 1;
    state.phase = 'breather';
    state.breatherTimer = 1.2;
    state.combo = 0;
    state.comboTimer = 0;
    state.player = makePlayer();
    state.enemies = [];
    state.bullets = [];
    state.cherries = [];
    state.particles = [];
    state.floaters = [];
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.levelUpChoices = null;
    state.boss = null;
    state.ambient = [];
  }

  function spawnPoint() {
    const player = state.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const side = Math.floor(random() * 4);
      let x;
      let y;
      if (side === 0) {
        x = range(random, 30, FIELD.width - 30);
        y = 30;
      } else if (side === 1) {
        x = range(random, 30, FIELD.width - 30);
        y = FIELD.height - 30;
      } else if (side === 2) {
        x = 30;
        y = range(random, 30, FIELD.height - 30);
      } else {
        x = FIELD.width - 30;
        y = range(random, 30, FIELD.height - 30);
      }
      const dx = x - player.x;
      const dy = y - player.y;
      if (dx * dx + dy * dy > 220 * 220) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const waveScale = state.wave - 1;
    const point = spawnPoint();
    const enemy = {
      kind,
      x: point.x,
      y: point.y,
      radius: def.radius,
      hp: Math.round(def.hp * (1 + HP_SCALE_PER_WAVE * waveScale)),
      maxHp: Math.round(def.hp * (1 + HP_SCALE_PER_WAVE * waveScale)),
      speed: def.speed * (1 + SPEED_SCALE_PER_WAVE * waveScale),
      damage: def.damage,
      score: def.score,
      xp: def.xp,
      phase: random() * Math.PI * 2,
      wobbleT: 0,
      touchTimer: 0,
      dashHurtTimer: 0,
      chargeTimer: kind === 'boss' ? 3.5 : 0,
      charging: 0,
      telegraph: 0,
      flash: 0,
    };
    state.enemies.push(enemy);
    if (kind === 'boss') {
      state.boss = enemy;
      return EVENT_BOSS;
    }
    return 0;
  }

  function buildWaveQueue(wave) {
    const def = WAVES[wave - 1];
    const queue = [];
    for (const [kind, count] of def.mix) {
      for (let i = 0; i < count; i += 1) queue.push(kind);
    }
    // Shuffle with the seeded random so the same seed plays the same wave.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWaveQueue(wave);
    state.spawnTimer = 0.2;
    state.phase = 'fighting';
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = range(random, speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: range(random, 0.25, 0.55),
        maxLife: 0.55,
        size: range(random, 2, 5),
        color,
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 1, color });
  }

  function dropCherry(x, y, force) {
    if (!force && random() > CHERRY.dropChance) return;
    state.cherries.push({
      x: clamp(x, 20, FIELD.width - 20),
      y: clamp(y, 20, FIELD.height - 20),
      vx: range(random, -30, 30),
      vy: range(random, -30, 30),
      life: CHERRY.life,
    });
  }

  function killEnemy(index) {
    const enemy = state.enemies[index];
    const def = ENEMIES[enemy.kind];
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = SCORE.comboWindow;
    const multiplier = Math.min(1 + (state.combo - 1) * 0.1, SCORE.comboCap);
    const gained = Math.round(enemy.score * multiplier);
    state.score += gained;
    floater(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#f2c94c');
    burst(enemy.x, enemy.y, def.color, enemy.kind === 'boss' ? 40 : 10, 160);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.score += SCORE.boss;
      for (let i = 0; i < 5; i += 1) dropCherry(enemy.x + range(random, -50, 50), enemy.y + range(random, -50, 50), true);
    } else {
      dropCherry(enemy.x, enemy.y, false);
    }
    gainXp(enemy.xp);
  }

  function gainXp(amount) {
    const player = state.player;
    player.xp += amount;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level += 1;
      player.xpNext = xpForLevel(player.level);
      offerLevelUp();
    }
  }

  function offerLevelUp() {
    const player = state.player;
    const available = UPGRADES.filter((u) => player.upgrades[u.id] < u.max);
    const choices = [];
    while (choices.length < 3 && available.length > 0) {
      const pickIndex = Math.floor(random() * available.length);
      choices.push(available.splice(pickIndex, 1)[0]);
    }
    state.levelUpChoices = choices;
  }

  function applyUpgrade(id) {
    const player = state.player;
    player.upgrades[id] += 1;
    if (id === 'heart') {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    }
    state.levelUpChoices = null;
  }

  function fireBullets() {
    const player = state.player;
    const count = SPRAY.projectiles + player.upgrades.double;
    const damage = SPRAY.damage * (1 + 0.25 * player.upgrades.sharp);
    const baseAngle = player.aim;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * SPRAY.spread;
      const angle = baseAngle + offset;
      state.bullets.push({
        x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
        y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
        vx: Math.cos(angle) * SPRAY.bulletSpeed,
        vy: Math.sin(angle) * SPRAY.bulletSpeed,
        damage,
        life: SPRAY.range / SPRAY.bulletSpeed,
      });
    }
  }

  function stepPlayer(dt, move, aimAngle, wantDash) {
    const player = state.player;
    player.aim = aimAngle;
    player.moveX = move.x;
    player.moveY = move.y;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    if (player.dashCooldownLeft > 0) player.dashCooldownLeft -= dt;

    const speed = PLAYER.speed * (1 + 0.15 * player.upgrades.boots);
    if (player.dashTimeLeft > 0) {
      player.dashTimeLeft -= dt;
      player.x += player.dashX * (PLAYER.dashDistance / PLAYER.dashTime) * dt;
      player.y += player.dashY * (PLAYER.dashDistance / PLAYER.dashTime) * dt;
    } else {
      const length = Math.hypot(move.x, move.y);
      if (length > 0) {
        player.x += (move.x / length) * speed * dt;
        player.y += (move.y / length) * speed * dt;
      }
      if (wantDash && player.dashCooldownLeft <= 0 && length > 0) {
        player.dashTimeLeft = PLAYER.dashTime;
        player.dashCooldownLeft = PLAYER.dashCooldown * (player.upgrades.dash > 0 ? 0.6 : 1);
        player.dashX = move.x / length;
        player.dashY = move.y / length;
        return 'dash';
      }
    }
    player.x = clamp(player.x, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y, PLAYER.radius, FIELD.height - PLAYER.radius);

    // Auto-fire toward the aim, as fast as the sprayer allows.
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      fireBullets();
      player.fireTimer = 1 / (SPRAY.fireRate * (1 + 0.2 * player.upgrades.rapid));
      return 'shoot';
    }
    return null;
  }

  function stepEnemies(dt) {
    const player = state.player;
    let hitPlayer = false;
    for (const enemy of state.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      if (enemy.touchTimer > 0) enemy.touchTimer -= dt;
      if (enemy.dashHurtTimer > 0) enemy.dashHurtTimer -= dt;
      enemy.wobbleT += dt;
      let dx = player.x - enemy.x;
      let dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      dx /= distance;
      dy /= distance;
      let speed = enemy.speed;
      if (enemy.kind === 'moth') {
        // Moths weave side to side as they close in.
        const wobble = Math.sin(enemy.wobbleT * 3 + enemy.phase) * 0.6;
        const px = -dy * wobble;
        const py = dx * wobble;
        dx += px;
        dy += py;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      }
      if (enemy.kind === 'boss') {
        enemy.chargeTimer -= dt;
        if (enemy.telegraph > 0) {
          enemy.telegraph -= dt;
          speed *= 0.3;
          if (enemy.telegraph <= 0) enemy.charging = 0.9;
        } else if (enemy.charging > 0) {
          enemy.charging -= dt;
          speed *= 2.2;
          if (Math.random() < 0.4) burst(enemy.x, enemy.y, '#c9bd9f', 1, 40);
        } else if (enemy.chargeTimer <= 0) {
          enemy.telegraph = 0.5;
          enemy.chargeTimer = 4;
        }
      }
      enemy.x += dx * speed * dt;
      enemy.y += dy * speed * dt;

      // Touching the guardian hurts, once per grace window. Distance is
      // measured after the move, so a pest cannot hit from a stale spot.
      const afterDx = player.x - enemy.x;
      const afterDy = player.y - enemy.y;
      const afterDistance = Math.hypot(afterDx, afterDy) || 1;
      const overlap = afterDistance < enemy.radius + PLAYER.radius;
      if (overlap && player.hurtTimer <= 0 && player.dashTimeLeft <= 0) {
        player.hp -= enemy.damage;
        player.hurtTimer = PLAYER.hurtGrace;
        hitPlayer = true;
        // Knock the guardian back a little so hits read clearly.
        player.x = clamp(player.x + (afterDx / afterDistance) * 24, PLAYER.radius, FIELD.width - PLAYER.radius);
        player.y = clamp(player.y + (afterDy / afterDistance) * 24, PLAYER.radius, FIELD.height - PLAYER.radius);
        burst(player.x, player.y, '#e5484d', 8, 140);
        if (player.upgrades.thorns > 0 && enemy.touchTimer <= 0) {
          enemy.hp -= 10 * player.upgrades.thorns;
          enemy.flash = 0.15;
          enemy.touchTimer = 0.5;
        }
      }
      // A dashing guardian bowls pests over.
      if (overlap && player.dashTimeLeft > 0 && player.upgrades.dash > 0 && enemy.dashHurtTimer <= 0) {
        enemy.hp -= 25 * player.upgrades.dash;
        enemy.flash = 0.15;
        enemy.dashHurtTimer = 0.4;
        enemy.x += dx * -30;
        enemy.y += dy * -30;
      }
    }
    // Gentle separation so pests do not stack on one pixel.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (distance > 0 && distance < min) {
          const push = ((min - distance) / 2) * 0.5;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    return hitPlayer;
  }

  function stepBullets(dt) {
    let kills = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < 0 || bullet.x > FIELD.width || bullet.y < 0 || bullet.y > FIELD.height;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const reach = enemy.radius + SPRAY.bulletRadius;
          if (dx * dx + dy * dy < reach * reach) {
            enemy.hp -= bullet.damage;
            enemy.flash = 0.12;
            burst(bullet.x, bullet.y, '#f2c94c', 3, 90);
            dead = true;
            if (enemy.hp <= 0) {
              killEnemy(j);
              kills += 1;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return kills;
  }

  function stepCherries(dt) {
    const player = state.player;
    const magnetRadius = player.upgrades.magnet === 0 ? CHERRY.magnetRadius : player.upgrades.magnet === 1 ? 220 : 340;
    let picked = 0;
    for (let i = state.cherries.length - 1; i >= 0; i -= 1) {
      const cherry = state.cherries[i];
      cherry.life -= dt;
      const dx = player.x - cherry.x;
      const dy = player.y - cherry.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < magnetRadius) {
        cherry.vx += (dx / distance) * 900 * dt;
        cherry.vy += (dy / distance) * 900 * dt;
      }
      cherry.vx *= 1 - 2.5 * dt;
      cherry.vy *= 1 - 2.5 * dt;
      cherry.x += cherry.vx * dt;
      cherry.y += cherry.vy * dt;
      if (distance < PLAYER.radius + CHERRY.radius) {
        state.score += CHERRY.score;
        player.hp = Math.min(player.maxHp, player.hp + CHERRY.heal);
        floater(player.x, player.y - 30, `+${CHERRY.score}`, '#d9382b');
        burst(cherry.x, cherry.y, '#d9382b', 6, 110);
        state.cherries.splice(i, 1);
        picked += 1;
      } else if (cherry.life <= 0) {
        state.cherries.splice(i, 1);
      }
    }
    return picked;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt * 0.9;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
  }

  /**
   * Advance the world one fixed step. `move` is {x, y} in -1..1, `aimAngle`
   * is the sprayer's direction in radians, `wantDash` requests a dash.
   * Returns { events, kills, picked, action } for sounds and screens.
   */
  function step(dt, move, aimAngle, wantDash) {
    state.time += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    let events = 0;
    let action = null;

    if (state.phase === 'breather') {
      state.breatherTimer -= dt;
      if (state.breatherTimer <= 0) startWave(state.wave);
    } else if (state.phase === 'fighting') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = SPAWN.interval;
          const batch = Math.min(SPAWN.batch, state.spawnQueue.length);
          for (let i = 0; i < batch; i += 1) {
            events |= spawnEnemy(state.spawnQueue.shift());
          }
        }
      } else if (state.enemies.length === 0) {
        state.phase = 'breather';
        state.score += SCORE.waveClear;
        if (state.wave >= FINAL_WAVE) {
          events |= EVENT_WIN;
        } else {
          state.wave += 1;
          state.breatherTimer = SPAWN.breather;
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }

    action = stepPlayer(dt, move, aimAngle, wantDash);
    const kills = stepBullets(dt);
    if (stepEnemies(dt)) events |= EVENT_HIT;
    const picked = stepCherries(dt);
    stepParticles(dt);

    if (state.player.hp <= 0) events |= EVENT_OVER;
    if (state.levelUpChoices) events |= EVENT_LEVELUP;
    return { events, kills, picked, action };
  }

  /** A calm garden for the title screen: a few aphids wander, nothing attacks. */
  function stepAmbient(dt) {
    state.time += dt;
    if (state.ambient.length < 6) {
      state.ambient.push({
        kind: 'aphid',
        x: range(random, 80, FIELD.width - 80),
        y: range(random, 80, FIELD.height - 80),
        angle: random() * Math.PI * 2,
        turn: 0,
        phase: random() * Math.PI * 2,
        wobbleT: 0,
      });
    }
    for (const bug of state.ambient) {
      bug.turn -= dt;
      if (bug.turn <= 0) {
        bug.angle += range(random, -1.2, 1.2);
        bug.turn = range(random, 0.8, 2.2);
      }
      bug.wobbleT += dt;
      bug.x = clamp(bug.x + Math.cos(bug.angle) * 34 * dt, 40, FIELD.width - 40);
      bug.y = clamp(bug.y + Math.sin(bug.angle) * 34 * dt, 40, FIELD.height - 40);
    }
    stepParticles(dt);
  }

  reset();

  return {
    state,
    reset,
    step,
    stepAmbient,
    applyUpgrade,
    /** The three choices on offer, or null when no level-up is waiting. */
    get levelUpChoices() {
      return state.levelUpChoices;
    },
  };
}
