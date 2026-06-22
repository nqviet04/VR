import * as THREE from 'three';

export const TIERS = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  TERTIARY: 'Tertiary',
  NEUTRAL: 'Neutral',
  TINT: 'Tint'
};

export const COLORS = [
  { id: 'red', label: 'Red', hex: 0xff2b2b, tier: TIERS.PRIMARY },
  { id: 'yellow', label: 'Yellow', hex: 0xffef00, tier: TIERS.PRIMARY },
  { id: 'blue', label: 'Blue', hex: 0x1548ff, tier: TIERS.PRIMARY },
  { id: 'orange', label: 'Orange', hex: 0xff8d00, tier: TIERS.SECONDARY },
  { id: 'green', label: 'Green', hex: 0x10c000, tier: TIERS.SECONDARY },
  { id: 'purple', label: 'Purple', hex: 0x9f27d9, tier: TIERS.SECONDARY },
  { id: 'red-orange', label: 'Red Orange', hex: 0xff5b1f, tier: TIERS.TERTIARY },
  { id: 'yellow-orange', label: 'Yellow Orange', hex: 0xffba00, tier: TIERS.TERTIARY },
  { id: 'yellow-green', label: 'Yellow Green', hex: 0x98e600, tier: TIERS.TERTIARY },
  { id: 'blue-green', label: 'Blue Green', hex: 0x0c9da5, tier: TIERS.TERTIARY },
  { id: 'blue-purple', label: 'Blue Purple', hex: 0x5f2dff, tier: TIERS.TERTIARY },
  { id: 'red-purple', label: 'Red Purple', hex: 0xcb1797, tier: TIERS.TERTIARY },
  { id: 'white', label: 'White', hex: 0xffffff, tier: TIERS.NEUTRAL },
  { id: 'red-tint', label: 'Red Tint', hex: 0xff9f9f, tier: TIERS.TINT },
  { id: 'yellow-tint', label: 'Yellow Tint', hex: 0xfff59a, tier: TIERS.TINT },
  { id: 'blue-tint', label: 'Blue Tint', hex: 0x9eb6ff, tier: TIERS.TINT },
  { id: 'orange-tint', label: 'Orange Tint', hex: 0xffc27d, tier: TIERS.TINT },
  { id: 'green-tint', label: 'Green Tint', hex: 0x9af09a, tier: TIERS.TINT },
  { id: 'purple-tint', label: 'Purple Tint', hex: 0xd6a1f2, tier: TIERS.TINT }
];

export const MIX_RECIPES = new Map([
  ['blue+red', 'purple'],
  ['blue+yellow', 'green'],
  ['red+yellow', 'orange'],
  ['blue+green', 'blue-green'],
  ['blue+purple', 'blue-purple'],
  ['orange+red', 'red-orange'],
  ['green+yellow', 'yellow-green'],
  ['orange+yellow', 'yellow-orange'],
  ['purple+red', 'red-purple'],
  ['blue+white', 'blue-tint'],
  ['green+white', 'green-tint'],
  ['orange+white', 'orange-tint'],
  ['purple+white', 'purple-tint'],
  ['red+white', 'red-tint'],
  ['white+yellow', 'yellow-tint']
]);

export const LEVELS = [
  {
    id: 1,
    label: 'Level 1 - Primary',
    tier: TIERS.PRIMARY,
    hardTime: 35,
    targetRadius: 0.34,
    bumperHeight: 0.36,
    targetLayout: 'fixed',
    hard: {
      targetLayout: 'fixed',
      obstacles: [
        { type: 'peg', x: -0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0, z: -2.2, radius: 0.13, bounce: 0.76 },
        { type: 'peg', x: -0.72, z: -3.15, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0.72, z: -3.15, radius: 0.11, bounce: 0.74 }
      ]
    },
    obstacles: []
  },
  {
    id: 2,
    label: 'Level 2 - Primary (Di chuyển dọc)',
    tier: TIERS.PRIMARY,
    hardOnly: true,
    hardTime: 45,
    targetRadius: 0.34,
    bumperHeight: 0.22,
    targetLayout: 'fixed',
    hard: {
      targetLayout: 'slideVertical',
      slideSpeed: 1.3,
      slideRange: 0.85,
      obstacles: [
        { type: 'peg', x: -0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0, z: -2.5, radius: 0.13, bounce: 0.76 },
        { type: 'bumper', x: -0.6, z: -3.6, radius: 0.15, bounce: 1.38 },
        { type: 'bumper', x: 0.6, z: -3.6, radius: 0.15, bounce: 1.38 },
        { type: 'peg', x: 0, z: -4.8, radius: 0.13, bounce: 0.76 }
      ]
    },
    obstacles: []
  },
  {
    id: 3,
    label: 'Level 3 - Primary (Di chuyển ngang)',
    tier: TIERS.PRIMARY,
    hardOnly: true,
    hardTime: 50,
    targetRadius: 0.34,
    bumperHeight: 0.22,
    targetLayout: 'fixed',
    hard: {
      targetLayout: 'slideHorizontal',
      slideSpeed: 1.1,
      slideRange: 0.52,
      obstacles: [
        { type: 'peg', x: -0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
        { type: 'bumper', x: 0, z: -2.4, radius: 0.15, bounce: 1.42 },
        { type: 'peg', x: -0.75, z: -3.4, radius: 0.12, bounce: 0.76 },
        { type: 'peg', x: 0.75, z: -3.4, radius: 0.12, bounce: 0.76 },
        { type: 'kicker', x: -0.22, z: -3.85, radius: 0.26, length: 0.52, width: 0.16, angle: Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 },
        { type: 'kicker', x: 0.22, z: -5.65, radius: 0.26, length: 0.52, width: 0.16, angle: -Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 }
      ]
    },
    obstacles: []
  },
  {
    id: 4,
    label: 'Level 4 - Mix Secondary',
    tier: TIERS.SECONDARY,
    hardTime: 70,
    targetRadius: 0.2,
    bumperHeight: 0.24,
    targetLayout: 'fixed',
    mixing: true,
    sourceTier: TIERS.PRIMARY,
    targetColorIds: ['red', 'yellow', 'blue', 'orange', 'green', 'purple'],
    hard: {
      targetLayout: 'roulette',
      rouletteSpeed: 0.38,
      rouletteCenterY: 0.95,
      rouletteRadiusX: 0.68,
      rouletteRadiusY: 0.68,
      obstacles: [
        { type: 'peg', x: -0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
        { type: 'peg', x: 0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
        { type: 'bumper', x: 0, z: -2.0, radius: 0.16, bounce: 1.42 },
        { type: 'boomerang', x: -0.72, z: -3.0, mirror: -1, angle: Math.PI / 6, bounce: 0.84 },
        { type: 'boomerang', x: 0.72, z: -3.0, mirror: 1, angle: -Math.PI / 6, bounce: 0.84 },
        { type: 'kicker', x: -0.22, z: -3.85, radius: 0.26, length: 0.52, width: 0.16, angle: Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 },
        { type: 'kicker', x: 0.22, z: -5.65, radius: 0.26, length: 0.52, width: 0.16, angle: -Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 },
        { type: 'peg', x: 0, z: -5.1, radius: 0.13, bounce: 0.76 }
      ]
    },
    obstacles: []
  },
  {
    id: 5,
    label: 'Level 5 - Mix Tertiary & Tint',
    tier: TIERS.TINT,
    hardTime: 130,
    targetRadius: 0.2,
    bumperHeight: 0.18,
    targetLayout: 'fixed',
    mixing: true,
    sourceColorIds: ['red', 'yellow', 'blue', 'white'],
    targetColorIds: [
      'red', 'yellow', 'blue', 'orange', 'green', 'purple',
      'red-orange', 'yellow-orange', 'yellow-green',
      'blue-green', 'blue-purple', 'red-purple',
      'red-tint', 'yellow-tint', 'blue-tint',
      'orange-tint', 'green-tint', 'purple-tint'
    ],
    hard: {
      targetLayout: 'roulette',
      targetRadius: 0.17,
      rouletteSpeed: 0.62,
      rouletteCenterY: 1.2,
      rouletteRadiusX: 1.0,
      rouletteRadiusY: 1.0,
      obstacles: [
        { type: 'peg', x: -0.78, z: -0.95, radius: 0.075, bounce: 0.73 },
        { type: 'peg', x: 0, z: -1.3, radius: 0.14, bounce: 0.77 },
        { type: 'peg', x: 0.78, z: -0.95, radius: 0.075, bounce: 0.73 },
        { type: 'bumper', x: -0.5, z: -2.25, radius: 0.17, bounce: 1.45 },
        { type: 'bumper', x: 0.5, z: -2.25, radius: 0.17, bounce: 1.45 },
        { type: 'peg', x: 0, z: -3.05, radius: 0.12, bounce: 0.76 },
        { type: 'kicker', x: -0.22, z: -3.85, radius: 0.26, length: 0.52, width: 0.16, angle: Math.PI * 2 / 3, bounce: 1.55, kick: 3.0 },
        { type: 'boomerang', x: -0.72, z: -4.65, mirror: -1, angle: Math.PI / 6, bounce: 0.84 },
        { type: 'boomerang', x: 0.72, z: -4.65, mirror: 1, angle: -Math.PI / 6, bounce: 0.84 },
        { type: 'bumper', x: 0, z: -5.3, radius: 0.18, bounce: 1.48 },
        { type: 'kicker', x: 0.22, z: -5.65, radius: 0.26, length: 0.52, width: 0.16, angle: -Math.PI * 2 / 3, bounce: 1.6, kick: 3.3 }
      ]
    },
    obstacles: []
  }
];

export const MODE = {
  EASY: 'Easy',
  HARD: 'Hard'
};

export function getAvailableLevels(mode) {
  if (mode === MODE.HARD) return LEVELS;
  return LEVELS.filter((level) => !level.hardOnly);
}

export function getLevelRuntimeConfig(level, mode) {
  const { hard, ...base } = level;
  const overlay = mode === MODE.HARD ? hard || {} : {};
  const runtime = { ...base, ...overlay };
  runtime.obstacles = (runtime.obstacles || []).map((obstacle) => ({ ...obstacle }));
  ['targetColorIds', 'sourceColorIds', 'scoringColorIds'].forEach((field) => {
    if (runtime[field]) runtime[field] = [...runtime[field]];
  });
  return runtime;
}

export const LAYOUT = {
  floorY: 0,
  floorLength: 14,
  floorCenterZ: -2.5,
  ballRadius: 0.16,
  mixSpawnLift: 0.38,
  laneWidth: 3.0,
  laneLength: 8.8,
  laneStartZ: 1.0,
  laneEndZ: -7.8,
  approachEndZ: 4.2,
  startLineZ: 0.68,
  startLineDepth: 0.045,
  releasePoint: new THREE.Vector3(0, 0.2, 0.68),
  returnOrigin: new THREE.Vector3(2.28, 0.33, 1.9),
  resultReturnOrigin: new THREE.Vector3(-2.08, 0.33, 1.9),
  resultShelfRowSlots: [2, 4],
  resultShelfSlotSpacingX: 0.36,
  returnSlotSpacingX: 0.44,
  returnSlotSpacingZ: 0.38,
  returnSettleSpeed: 6.0,
  resultOrigin: new THREE.Vector3(-2.5, 0.35, -0.1),
  mixBoxCenter: new THREE.Vector3(-2.3, 0.22, 0.72),
  mixSlotPositions: [
    new THREE.Vector3(-2.52, 0.43, 0.72),
    new THREE.Vector3(-2.08, 0.43, 0.72)
  ],
  targetZ: -7.25,
  targetY: 0.34,
  targetDenseSpacingX: 0.46,
  targetStackGap: 0.46,
  targetHitPadding: 0.14,
  vrPlayerPosition: new THREE.Vector3(0, 0, 3.2)
};

export const XR_LOCOMOTION = {
  moveSpeed: 1.8,
  deadzone: 0.18,
  snapTurnThreshold: 0.72,
  snapTurnAngle: Math.PI / 6,
  minX: -3.2,
  maxX: 3.2,
  minZ: 1.15,
  maxZ: 4.2
};

export const AIM = {
  minDragPx: 6,
  minDragRatio: 0.05,
  pixelsForMaxPower: 120,
  minPower: 2.6,
  maxPower: 16,
  powerExponent: 1.5,
  maxDirDeg: 50,
  launchAngleDeg: 7,
  trajectoryPoints: 100,
  trajectoryStep: 0.05
};
