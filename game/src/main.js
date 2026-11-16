// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, level-up, paused, game over and victory.
//
// ?seed=N fixes the random pattern. ?shot=start|play|levelup|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PICK_1,
  ACTION_PICK_2,
  ACTION_PICK_3,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: scene.best,
      choices: scene.choices,
      muted: audio.muted,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // A read-only handle for playtesting and screenshots: the live state and screen.
  window.__kopi = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
  };
  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the coffee garden.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.victory();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function pickUpgrade(index) {
    const choices = world.levelUpChoices;
    if (!choices || index < 0 || index >= choices.length) return;
    audio.levelUp();
    world.applyUpgrade(choices[index].id);
    screen = SCREEN_PLAY;
    announce(`Upgrade: ${choices[index].name}.`);
  }

  function aimAngle() {
    const player = world.state.player;
    const mouse = input.mouse();
    if (!mouse) return player.aim;
    const field = renderer.toField(mouse.x, mouse.y);
    return Math.atan2(field.y - player.y, field.x - player.x);
  }

  /** One-shot presses for this frame; the frame takes them once and hands them here and to step(). */
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_LEVELUP) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        // A bare confirm key picks the middle card so keyboard players can continue.
        // (A click on a card is handled by the pointer handler below instead.)
        pickUpgrade(1);
      }
    }
  }

  /** A click while choosing an upgrade picks the card under the pointer. */
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== SCREEN_LEVELUP) return;
    const rect = canvas.getBoundingClientRect();
    const field = renderer.toField(event.clientX - rect.left, event.clientY - rect.top);
    const choices = world.levelUpChoices;
    if (!choices) return;
    const cardWidth = 300;
    const cardHeight = 190;
    const gap = 30;
    const total = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (1280 - total) / 2;
    const y = 300;
    choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap);
      if (field.x >= x && field.x <= x + cardWidth && field.y >= y && field.y <= y + cardHeight) {
        pickUpgrade(index);
      }
    });
  });

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.stepAmbient(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const wantDash = Boolean(actions & ACTION_DASH);
    const result = world.step(STEP, input.direction(), aimAngle(), wantDash);
    if (result.action === 'shoot') audio.shoot();
    else if (result.action === 'dash') audio.dash();
    if (result.kills > 0) audio.pop();
    if (result.picked > 0) audio.cherry();
    if (result.events & EVENT_HIT) {
      audio.hurt();
      announce(`Hit! ${Math.ceil(world.state.player.hp)} health left.`);
    }
    if (result.events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      announce(`Wave ${world.state.wave - 1} cleared.`);
    }
    if (result.events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      announce('Level up! Choose an upgrade.');
    } else if (result.events & EVENT_WIN) {
      endGame(true);
    } else if (result.events & EVENT_OVER) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Take this frame's one-shot presses exactly once.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      choices: world.levelUpChoices,
      muted: audio.muted,
    });
  }

  // Leaving the tab pauses a running game rather than letting pests eat unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Kopi Guardian. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
