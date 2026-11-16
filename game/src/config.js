// Every tuning number and colour for Kopi Guardian in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves in one run. Wave 10 is the boss wave; beating it wins the game. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 20,
  speed: 260,
  maxHp: 100,
  /** Seconds of invulnerability after taking a hit. */
  hurtGrace: 0.9,
  /** Dash: how far one dash carries, how long it lasts, its cooldown. */
  dashDistance: 170,
  dashTime: 0.16,
  dashCooldown: 2.2,
  /** Contact damage while dashing (0 until the Dash Segar upgrade). */
  dashDamage: 0,
};

export const SPRAY = {
  /** Coffee-bean shots per second at level 1. */
  fireRate: 3.2,
  bulletSpeed: 620,
  bulletRadius: 5,
  damage: 12,
  /** How many beans one trigger pull fires, side by side. */
  projectiles: 1,
  spread: 0.09,
  range: 520,
};

/** Experience: kills feed the level bar; each level offers a choice of 3 upgrades. */
export const XP = {
  perKill: 1,
  /** XP needed for level L (L starts at 1): base * L^1.35, rounded. */
  base: 6,
  exponent: 1.35,
};

/** Score: a kill is worth its base points times the combo multiplier. */
export const SCORE = {
  killBase: 10,
  cherry: 25,
  waveClear: 50,
  boss: 500,
  /** Combo multiplier grows 0.1 per chained kill, capped here. */
  comboCap: 3,
  /** Seconds between kills before the combo chain breaks. */
  comboWindow: 2.5,
};

/** Enemy kinds. Each kind has its own look, movement and toughness. */
export const ENEMIES = {
  aphid: {
    name: 'Kutu Daun',
    radius: 11,
    hp: 12,
    speed: 95,
    damage: 8,
    score: 10,
    xp: 1,
    color: '#7dc242',
    dark: '#4d8a26',
  },
  mite: {
    name: 'Tungau',
    radius: 7,
    hp: 8,
    speed: 150,
    damage: 5,
    score: 5,
    xp: 1,
    color: '#e8b64c',
    dark: '#b98a2e',
  },
  moth: {
    name: 'Ngengat',
    radius: 14,
    hp: 22,
    speed: 120,
    damage: 10,
    score: 20,
    xp: 1,
    color: '#b48ce0',
    dark: '#7d5aa8',
  },
  beetle: {
    name: 'Kumbang',
    radius: 18,
    hp: 40,
    speed: 62,
    damage: 14,
    score: 30,
    xp: 2,
    color: '#8a5a33',
    dark: '#5d3a1e',
  },
  boss: {
    name: 'Kumbang Raja',
    radius: 44,
    hp: 650,
    speed: 78,
    damage: 22,
    score: 500,
    xp: 10,
    color: '#a03d2d',
    dark: '#6e2818',
  },
};

/**
 * What each wave throws at the garden. `mix` lists [kind, count] pairs; the
 * wave also keeps a slow trickle of aphids so the field never feels empty.
 * Counts grow with the wave number; toughness grows a little too.
 */
export const WAVES = [
  { mix: [['aphid', 6]] },
  { mix: [['aphid', 9], ['mite', 4]] },
  { mix: [['aphid', 10], ['mite', 8], ['moth', 3]] },
  { mix: [['aphid', 12], ['moth', 6], ['beetle', 2]] },
  { mix: [['aphid', 12], ['mite', 12], ['moth', 6], ['beetle', 3]] },
  { mix: [['aphid', 14], ['mite', 14], ['moth', 9], ['beetle', 5]] },
  { mix: [['aphid', 16], ['mite', 16], ['moth', 12], ['beetle', 7]] },
  { mix: [['aphid', 18], ['mite', 18], ['moth', 14], ['beetle', 9]] },
  { mix: [['aphid', 20], ['mite', 20], ['moth', 16], ['beetle', 11]] },
  { mix: [['boss', 1], ['aphid', 10], ['mite', 10]] },
];

/** Enemy hit points scale a little every wave after the first. */
export const HP_SCALE_PER_WAVE = 0.09;
/** Enemy speed scales a little every wave after the first. */
export const SPEED_SCALE_PER_WAVE = 0.03;

/** Seconds between spawn ticks inside a wave, and the breather after a wave. */
export const SPAWN = { interval: 0.7, batch: 2, breather: 3.0 };

/** Coffee cherries: dropped by fallen pests, picked up for score and health. */
export const CHERRY = {
  radius: 10,
  score: 25,
  heal: 8,
  /** Chance a kill drops a cherry (boss always drops 5). */
  dropChance: 0.22,
  magnetRadius: 130,
  life: 14,
};

export const PALETTE = {
  soil: '#3d2f1e',
  soilLight: '#4a3a26',
  grass: '#2e4d23',
  grassLight: '#3a5f2c',
  leaf: '#1e3a17',
  fence: '#6b4f2a',
  player: '#f2e3c6',
  playerShirt: '#2f7d4f',
  hat: '#e8c96a',
  hatBand: '#8a5a33',
  bean: '#5d3a1e',
  beanLight: '#8a5a33',
  cherry: '#d9382b',
  cherryLeaf: '#3f8f3a',
  hp: '#e5484d',
  hpBack: '#3a2a2a',
  xp: '#f2c94c',
  text: '#f5efe0',
  muted: '#c9bd9f',
  panel: 'rgba(20, 16, 10, 0.82)',
  panelEdge: '#8a6d3b',
  card: '#2c2113',
  cardEdge: '#c9a44a',
  cardHover: '#3d2f1e',
  gold: '#f2c94c',
  danger: '#e5484d',
  bossBar: '#a03d2d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'kopi-guardian.best';
