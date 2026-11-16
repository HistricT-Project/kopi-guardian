// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a real game looks like
// and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const LEVELUP_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 600;

/** Pick a move that runs from the nearest pest while drifting to cherries. */
function autopilot(state, reckless) {
  const player = state.player;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { x: dx / (distance || 1), y: dy / (distance || 1) };
    }
  }
  let cherry = null;
  let cherryDistance = Infinity;
  for (const item of state.cherries) {
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < cherryDistance) {
      cherryDistance = distance;
      cherry = { x: dx / (distance || 1), y: dy / (distance || 1) };
    }
  }
  let x = 0;
  let y = 0;
  if (reckless && nearest) {
    // A hurried player runs straight at the nearest pest.
    x = nearest.x;
    y = nearest.y;
  } else {
    if (nearest && nearestDistance < 220) {
      x -= nearest.x * 1.6;
      y -= nearest.y * 1.6;
    }
    if (cherry && cherryDistance < 320) {
      x += cherry.x * 0.9;
      y += cherry.y * 0.9;
    }
    // Drift toward the centre when nothing nearby matters.
    if (x === 0 && y === 0) {
      x = (FIELD.width / 2 - player.x) / 400;
      y = (FIELD.height / 2 - player.y) / 400;
    }
  }
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Aim the sprayer at the nearest pest, so shots land where a player aims. */
function aimAtNearest(state) {
  const player = state.player;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { x: dx, y: dy };
    }
  }
  if (!nearest) return player.aim;
  return Math.atan2(nearest.y, nearest.x);
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the
 * best score to show and the level-up choices when the scene is one.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'levelup' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.stepAmbient(STEP);
    return { screen: SCREEN_TITLE, best: 0, choices: null };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'levelup' ? LEVELUP_LIMIT_SECONDS : PLAY_SECONDS;
  const reckless = name === 'end';
  let over = false;
  let won = false;
  let leveled = false;
  for (let index = 0; index < limit / STEP; index += 1) {
    const result = world.step(STEP, autopilot(world.state, reckless), aimAtNearest(world.state), false);
    if (result.events & EVENT_OVER) {
      over = true;
      break;
    }
    if (result.events & EVENT_WIN) {
      won = true;
      break;
    }
    if (result.events & EVENT_LEVELUP) {
      // Only the levelup scene stops to show the choice. The other scenes
      // take the first upgrade and keep playing, like a hurried player.
      if (name === 'levelup') {
        leveled = true;
        break;
      }
      const choices = world.state.levelUpChoices;
      if (choices && choices.length > 0) world.applyUpgrade(choices[0].id);
    }
  }
  if (won) return { screen: SCREEN_WIN, best: world.state.score, choices: null };
  if (over) return { screen: SCREEN_OVER, best: world.state.score, choices: null };
  if (leveled) return { screen: SCREEN_LEVELUP, best: 0, choices: world.state.levelUpChoices };
  return { screen: SCREEN_PLAY, best: 0, choices: null };
}
