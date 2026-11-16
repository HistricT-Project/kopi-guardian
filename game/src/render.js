// All drawing: the garden, the guardian, the pests, the HUD and every
// screen. The renderer only paints; it never changes the world. One logical
// field of 1280x720 is scaled to fit the window, so the game looks the same
// on any desktop size.

import { CHERRY, ENEMIES, FIELD, FINAL_WAVE, FONT, PALETTE, PLAYER, SCORE, SPRAY } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Coffee bushes planted once, in fixed rows, so the garden never shuffles. */
const BUSHES = [];
for (let row = 0; row < 4; row += 1) {
  for (let col = 0; col < 9; col += 1) {
    BUSHES.push({
      x: 90 + col * 140 + (row % 2) * 60,
      y: 96 + row * 168,
      size: 34 + ((row * 7 + col * 13) % 14),
    });
  }
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  function circle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function text(string, x, y, size, color, align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(string, x, y);
  }

  function drawGarden(time) {
    // Soil base with a soft vignette.
    ctx.fillStyle = PALETTE.soil;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.soilLight;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(0, 60 + i * 140, FIELD.width, 46);
    }
    // Grass strips between the rows.
    ctx.fillStyle = PALETTE.grass;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(0, 106 + i * 168, FIELD.width, 22);
    }
    // Coffee bushes: dark canopy, lighter leaves, a few red cherries.
    for (const bush of BUSHES) {
      circle(bush.x, bush.y, bush.size, PALETTE.leaf);
      circle(bush.x - bush.size * 0.3, bush.y - bush.size * 0.25, bush.size * 0.55, PALETTE.grassLight);
      circle(bush.x + bush.size * 0.35, bush.y + bush.size * 0.2, bush.size * 0.4, PALETTE.grass);
      circle(bush.x - bush.size * 0.1, bush.y + bush.size * 0.45, 3.5, PALETTE.cherry);
      circle(bush.x + bush.size * 0.5, bush.y - bush.size * 0.35, 3, PALETTE.cherry);
    }
    // A firefly drifts across the garden so the title scene feels alive.
    const fireflyX = 200 + ((time * 24) % (FIELD.width - 400));
    const fireflyY = 120 + Math.sin(time * 0.9) * 40;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 3);
    circle(fireflyX, fireflyY, 4, PALETTE.gold);
    ctx.globalAlpha = 1;
    // Wooden fence around the plot.
    ctx.strokeStyle = PALETTE.fence;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, FIELD.width - 12, FIELD.height - 12);
    ctx.fillStyle = PALETTE.fence;
    for (let x = 40; x < FIELD.width; x += 120) {
      ctx.fillRect(x, 0, 10, 18);
      ctx.fillRect(x, FIELD.height - 18, 10, 18);
    }
  }

  function drawCherry(cherry) {
    const pulse = 1 + Math.sin(cherry.life * 6) * 0.08;
    circle(cherry.x, cherry.y, CHERRY.radius * pulse, PALETTE.cherry);
    circle(cherry.x - 3, cherry.y - 3, 3, '#ff8a7a');
    ctx.strokeStyle = PALETTE.cherryLeaf;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cherry.x, cherry.y - CHERRY.radius);
    ctx.lineTo(cherry.x + 6, cherry.y - CHERRY.radius - 6);
    ctx.stroke();
  }

  function drawBullet(bullet) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.fillStyle = PALETTE.bean;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, SPRAY.bulletRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.beanLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(player, time) {
    const flashing = player.hurtTimer > 0 && Math.floor(time * 14) % 2 === 0;
    const dashing = player.dashTimeLeft > 0;
    ctx.save();
    if (dashing) ctx.globalAlpha = 0.75;
    // Soft shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + PLAYER.radius - 2, PLAYER.radius * 0.9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: green shirt, cream arms.
    circle(player.x, player.y, PLAYER.radius, flashing ? '#ffffff' : PALETTE.playerShirt);
    circle(player.x, player.y, PLAYER.radius * 0.62, flashing ? '#ffffff' : PALETTE.player);
    // Straw hat: wide brim and a dome, with a brown band.
    ctx.fillStyle = PALETTE.hat;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y - 6, PLAYER.radius + 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x, player.y - 8, PLAYER.radius * 0.62, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hatBand;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 8, PLAYER.radius * 0.62, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // The sprayer nozzle points where the guardian aims.
    const nx = player.x + Math.cos(player.aim) * (PLAYER.radius + 12);
    const ny = player.y + Math.sin(player.aim) * (PLAYER.radius + 12);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.aim) * PLAYER.radius * 0.5, player.y + Math.sin(player.aim) * PLAYER.radius * 0.5);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    circle(nx, ny, 4, '#c9a44a');
    // Dash cooldown: a thin ring that fills as the dash recharges.
    if (player.dashCooldownLeft > 0) {
      const total = 2.2 * (player.upgrades.dash > 0 ? 0.6 : 1);
      const fraction = 1 - player.dashCooldownLeft / total;
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 6, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const def = ENEMIES[enemy.kind];
    const flashing = enemy.flash > 0 && Math.floor(time * 20) % 2 === 0;
    const body = flashing ? '#ffffff' : def.color;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === 'aphid') {
      circle(0, 0, enemy.radius, body);
      circle(-4, -3, 3, def.dark);
      circle(4, -3, 3, def.dark);
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -enemy.radius + 2);
      ctx.lineTo(-10, -enemy.radius - 6);
      ctx.moveTo(6, -enemy.radius + 2);
      ctx.lineTo(10, -enemy.radius - 6);
      ctx.stroke();
    } else if (enemy.kind === 'mite') {
      circle(0, 0, enemy.radius, body);
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 2;
      for (let leg = 0; leg < 3; leg += 1) {
        const a = (leg / 3) * Math.PI * 2 + time * 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * enemy.radius * 0.6, Math.sin(a) * enemy.radius * 0.6);
        ctx.lineTo(Math.cos(a) * (enemy.radius + 5), Math.sin(a) * (enemy.radius + 5));
        ctx.stroke();
      }
      circle(-2.5, -2, 1.8, '#2a1a0c');
      circle(2.5, -2, 1.8, '#2a1a0c');
    } else if (enemy.kind === 'moth') {
      // Flapping wings, then the body.
      const flap = Math.sin(time * 10 + enemy.phase) * 0.5 + 0.5;
      ctx.fillStyle = flashing ? '#ffffff' : def.dark;
      ctx.beginPath();
      ctx.ellipse(-enemy.radius * 0.8, -4 - flap * 6, enemy.radius * 0.9, enemy.radius * (0.35 + flap * 0.35), -0.5, 0, Math.PI * 2);
      ctx.ellipse(enemy.radius * 0.8, -4 - flap * 6, enemy.radius * 0.9, enemy.radius * (0.35 + flap * 0.35), 0.5, 0, Math.PI * 2);
      ctx.fill();
      circle(0, 0, enemy.radius * 0.62, body);
      circle(-3, -3, 2, '#2a1a0c');
      circle(3, -3, 2, '#2a1a0c');
    } else if (enemy.kind === 'beetle' || enemy.kind === 'boss') {
      const big = enemy.kind === 'boss';
      circle(0, 0, enemy.radius, body);
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(0, enemy.radius);
      ctx.stroke();
      // Horns on the boss, antennae on the beetle.
      if (big) {
        ctx.strokeStyle = '#e8c96a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-8, -enemy.radius + 4);
        ctx.lineTo(-16, -enemy.radius - 14);
        ctx.moveTo(8, -enemy.radius + 4);
        ctx.lineTo(16, -enemy.radius - 14);
        ctx.stroke();
      } else {
        ctx.strokeStyle = def.dark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, -enemy.radius + 2);
        ctx.lineTo(-9, -enemy.radius - 7);
        ctx.moveTo(5, -enemy.radius + 2);
        ctx.lineTo(9, -enemy.radius - 7);
        ctx.stroke();
      }
      circle(-6, -4, big ? 5 : 3, '#fff');
      circle(6, -4, big ? 5 : 3, '#fff');
      circle(-6, -4, big ? 2.5 : 1.5, '#2a1a0c');
      circle(6, -4, big ? 2.5 : 1.5, '#2a1a0c');
      // Telegraph: the boss flashes white just before it charges.
      if (big && enemy.telegraph > 0) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 30);
        circle(0, 0, enemy.radius + 8, '#ff5a3c');
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    // A small health bar over anything tougher than an aphid.
    if (enemy.hp < enemy.maxHp && enemy.maxHp > 12) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 5);
      ctx.fillStyle = PALETTE.hp;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 20, f.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, ui) {
    const player = state.player;
    const width = FIELD.width;
    // Top-left: health bar and level.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(14, 14, 300, 54);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 300, 54);
    text(`LV ${player.level}`, 30, 41, 22, PALETTE.gold, 'left');
    ctx.fillStyle = PALETTE.hpBack;
    ctx.fillRect(86, 26, 210, 18);
    ctx.fillStyle = PALETTE.hp;
    ctx.fillRect(86, 26, 210 * Math.max(0, player.hp / player.maxHp), 18);
    text(`${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`, 191, 36, 14, PALETTE.text);
    text(`Dash: ${player.dashCooldownLeft <= 0 ? 'SIAP' : '...'}`, 30, 59, 13, PALETTE.muted, 'left', 600);
    // Top-centre: wave and timer.
    text(`WAVE ${Math.min(state.wave, FINAL_WAVE)} / ${FINAL_WAVE}`, width / 2, 30, 26, PALETTE.text);
    text(formatTime(state.time), width / 2, 56, 18, PALETTE.muted);
    // Top-right: score, combo, kills.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(width - 314, 14, 300, 54);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(width - 314, 14, 300, 54);
    text(`SKOR ${state.score}`, width - 30, 32, 22, PALETTE.gold, 'right');
    const comboText = state.combo > 1 ? `COMBO x${Math.min(1 + (state.combo - 1) * 0.1, SCORE.comboCap).toFixed(1)} (${state.combo})` : 'COMBO -';
    text(comboText, width - 30, 56, 14, state.combo > 4 ? PALETTE.gold : PALETTE.muted, 'right', 600);
    // Boss bar.
    if (state.boss) {
      const boss = state.boss;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(width / 2 - 220, 78, 440, 26);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.strokeRect(width / 2 - 220, 78, 440, 26);
      ctx.fillStyle = PALETTE.bossBar;
      ctx.fillRect(width / 2 - 214, 84, 428 * Math.max(0, boss.hp / boss.maxHp), 14);
      text('KUMBANG RAJA', width / 2, 91, 14, PALETTE.text);
    }
    // Bottom: XP bar. The numbers are stroked so they read on gold and on dark alike.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, FIELD.height - 22, FIELD.width, 22);
    ctx.fillStyle = PALETTE.xp;
    ctx.fillRect(0, FIELD.height - 22, FIELD.width * (player.xp / player.xpNext), 22);
    const xpLabel = `XP ${player.xp} / ${player.xpNext}`;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(xpLabel, FIELD.width / 2, FIELD.height - 11);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(xpLabel, FIELD.width / 2, FIELD.height - 11);
    // Controls hint just above the bar, where the garden is dark.
    text('WASD gerak · Mouse arah · Space/Shift dash · P jeda · M suara', FIELD.width / 2, FIELD.height - 36, 13, PALETTE.muted, 'center', 500);
    if (ui.muted) text('SUARA MATI (M)', width - 20, FIELD.height - 44, 14, PALETTE.muted, 'right');
  }

  function drawCards(choices) {
    const cardWidth = 300;
    const cardHeight = 190;
    const gap = 30;
    const total = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (FIELD.width - total) / 2;
    const y = 300;
    choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap);
      ctx.fillStyle = PALETTE.card;
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.strokeStyle = PALETTE.cardEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cardWidth, cardHeight);
      text(`[${index + 1}]`, x + cardWidth / 2, y + 36, 20, PALETTE.gold);
      text(choice.name, x + cardWidth / 2, y + 78, 24, PALETTE.text);
      // Wrap the description over two lines if it is long.
      const words = choice.desc.split(' ');
      let line = '';
      let lineY = y + 122;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26 && line) {
          text(line.trim(), x + cardWidth / 2, lineY, 16, PALETTE.muted, 'center', 500);
          line = word;
          lineY += 24;
        } else {
          line += ' ' + word;
        }
      }
      text(line.trim(), x + cardWidth / 2, lineY, 16, PALETTE.muted, 'center', 500);
    });
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 8, 5, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(title, FIELD.width / 2, 210, 64, accent || PALETTE.text);
    let y = 300;
    for (const line of lines) {
      text(line.text, FIELD.width / 2, y, line.size || 22, line.color || PALETTE.text, 'center', line.weight || 600);
      y += line.gap || 40;
    }
  }

  function draw(state, screen, ui) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14100a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const time = state.time;

    drawGarden(time);
    if (screen === SCREEN_TITLE) {
      for (const bug of state.ambient) {
        ctx.save();
        ctx.translate(bug.x, bug.y);
        circle(0, 0, 11, ENEMIES.aphid.color);
        circle(-4, -3, 3, ENEMIES.aphid.dark);
        circle(4, -3, 3, ENEMIES.aphid.dark);
        ctx.restore();
      }
      drawOverlay('KOPI GUARDIAN', [
        { text: 'Penjaga Kebun Kopi — bertahanlah 10 gelombang dari hama.', size: 24, color: PALETTE.muted },
        { text: 'WASD / panah untuk bergerak  ·  Mouse untuk mengarahkan semprotan', size: 20 },
        { text: 'Semprotan biji kopi menembak sendiri  ·  Space / Shift untuk dash', size: 20 },
        { text: 'Kalahkan hama, kumpulkan cherry, naik level, pilih upgrade', size: 20 },
        { text: 'Gelombang 10: Kumbang Raja. Kalahkan dia dan kebun selamat!', size: 20, color: PALETTE.gold },
        { text: 'Tekan SPASI atau KLIK untuk mulai', size: 26, color: PALETTE.gold, gap: 64 },
      ], PALETTE.gold);
      if (ui.best > 0) text(`SKOR TERBAIK: ${ui.best}`, FIELD.width / 2, 620, 22, PALETTE.muted);
      return;
    }

    for (const cherry of state.cherries) drawCherry(cherry);
    for (const bullet of state.bullets) drawBullet(bullet);
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    drawPlayer(state.player, time);
    drawParticles(state);
    drawHud(state, ui);

    if (screen === SCREEN_LEVELUP && ui.choices) {
      ctx.fillStyle = 'rgba(10, 8, 5, 0.55)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      text('NAIK LEVEL!', FIELD.width / 2, 220, 52, PALETTE.gold);
      text(`Level ${state.player.level} — pilih satu upgrade (klik atau tekan 1 / 2 / 3)`, FIELD.width / 2, 268, 22, PALETTE.text, 'center', 500);
      drawCards(ui.choices);
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay('JEDA', [
        { text: 'Tekan P atau SPASI untuk lanjut bermain.', size: 22, color: PALETTE.muted },
      ]);
    } else if (screen === SCREEN_OVER) {
      drawOverlay('KEBUN KOLAPS', [
        { text: `Hama menguasai kebun di gelombang ${Math.min(state.wave, FINAL_WAVE)}.`, size: 24 },
        { text: `Skor: ${state.score}   ·   Hama dikalahkan: ${state.kills}   ·   Waktu: ${formatTime(state.time)}`, size: 22, color: PALETTE.muted },
        { text: ui.best > 0 ? `Skor terbaik: ${ui.best}` : '', size: 22, color: PALETTE.gold },
        { text: 'Tekan SPASI atau KLIK untuk main lagi', size: 26, color: PALETTE.gold, gap: 64 },
      ], PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawOverlay('KEBUN SELAMAT!', [
        { text: 'Kumbang Raja tumbang. Panen kopi tahun ini aman!', size: 24 },
        { text: `Skor: ${state.score}   ·   Hama dikalahkan: ${state.kills}   ·   Waktu: ${formatTime(state.time)}`, size: 22, color: PALETTE.muted },
        { text: ui.best > 0 ? `Skor terbaik: ${ui.best}` : '', size: 22, color: PALETTE.gold },
        { text: 'Tekan SPASI atau KLIK untuk main lagi', size: 26, color: PALETTE.gold, gap: 64 },
      ], PALETTE.gold);
    }
  }

  return {
    draw,
    /** Convert canvas pixels to field coordinates (for mouse aim). */
    toField(px, py) {
      return { x: (px * (canvas.width / (canvas.clientWidth || FIELD.width)) - offsetX) / scale, y: (py * (canvas.height / (canvas.clientHeight || FIELD.height)) - offsetY) / scale };
    },
    /** The current view transform, for tests. */
    view() {
      return { scale, offsetX, offsetY, width: canvas.width, height: canvas.height };
    },
  };
}
