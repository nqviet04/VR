import { describe, it, expect } from 'vitest';
import {
  COLORS,
  MIX_RECIPES,
  LEVELS,
  TIERS,
  MODE,
  LAYOUT,
  AIM,
  getLevelRuntimeConfig,
  getAvailableLevels
} from '../src/constants.js';

describe('COLORS', () => {
  it('has 19 colors total', () => {
    expect(COLORS).toHaveLength(19);
  });

  it('has 3 primary colors', () => {
    const primaries = COLORS.filter((c) => c.tier === TIERS.PRIMARY);
    expect(primaries).toHaveLength(3);
    expect(primaries.map((c) => c.id)).toEqual(['red', 'yellow', 'blue']);
  });

  it('has 3 secondary colors', () => {
    const secondaries = COLORS.filter((c) => c.tier === TIERS.SECONDARY);
    expect(secondaries).toHaveLength(3);
    expect(secondaries.map((c) => c.id)).toEqual(['orange', 'green', 'purple']);
  });

  it('has 6 tertiary colors', () => {
    const tertiaries = COLORS.filter((c) => c.tier === TIERS.TERTIARY);
    expect(tertiaries).toHaveLength(6);
  });

  it('has 1 neutral (white)', () => {
    const neutrals = COLORS.filter((c) => c.tier === TIERS.NEUTRAL);
    expect(neutrals).toHaveLength(1);
    expect(neutrals[0].id).toBe('white');
  });

  it('has 6 tint colors', () => {
    const tints = COLORS.filter((c) => c.tier === TIERS.TINT);
    expect(tints).toHaveLength(6);
  });

  it('each color has id, label, hex, tier', () => {
    COLORS.forEach((color) => {
      expect(color).toHaveProperty('id');
      expect(color).toHaveProperty('label');
      expect(color).toHaveProperty('hex');
      expect(color).toHaveProperty('tier');
      expect(typeof color.hex).toBe('number');
    });
  });

  it('all color ids are unique', () => {
    const ids = COLORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MIX_RECIPES', () => {
  it('has 15 recipes', () => {
    expect(MIX_RECIPES.size).toBe(15);
  });

  it('creates secondary colors from primaries', () => {
    expect(MIX_RECIPES.get('red+yellow')).toBe('orange');
    expect(MIX_RECIPES.get('blue+yellow')).toBe('green');
    expect(MIX_RECIPES.get('blue+red')).toBe('purple');
  });

  it('creates tertiary colors from primary+secondary', () => {
    expect(MIX_RECIPES.get('orange+red')).toBe('red-orange');
    expect(MIX_RECIPES.get('orange+yellow')).toBe('yellow-orange');
    expect(MIX_RECIPES.get('green+yellow')).toBe('yellow-green');
    expect(MIX_RECIPES.get('blue+green')).toBe('blue-green');
    expect(MIX_RECIPES.get('blue+purple')).toBe('blue-purple');
    expect(MIX_RECIPES.get('purple+red')).toBe('red-purple');
  });

  it('creates tint colors from color+white', () => {
    expect(MIX_RECIPES.get('red+white')).toBe('red-tint');
    expect(MIX_RECIPES.get('white+yellow')).toBe('yellow-tint');
    expect(MIX_RECIPES.get('blue+white')).toBe('blue-tint');
    expect(MIX_RECIPES.get('orange+white')).toBe('orange-tint');
    expect(MIX_RECIPES.get('green+white')).toBe('green-tint');
    expect(MIX_RECIPES.get('purple+white')).toBe('purple-tint');
  });

  it('all recipe values map to valid color ids', () => {
    const colorIds = new Set(COLORS.map((c) => c.id));
    for (const value of MIX_RECIPES.values()) {
      expect(colorIds.has(value)).toBe(true);
    }
  });
});

describe('LEVELS', () => {
  it('has 5 levels total', () => {
    expect(LEVELS).toHaveLength(5);
  });

  it('level 1 is Primary with no mixing', () => {
    const level = LEVELS.find((l) => l.id === 1);
    expect(level.id).toBe(1);
    expect(level.tier).toBe(TIERS.PRIMARY);
    expect(level.mixing).toBeUndefined();
  });

  it('level 4 is Secondary with mixing enabled', () => {
    const level = LEVELS.find((l) => l.id === 4);
    expect(level.id).toBe(4);
    expect(level.mixing).toBe(true);
    expect(level.targetColorIds).toHaveLength(6);
  });

  it('level 5 has 18 targets', () => {
    const level = LEVELS.find((l) => l.id === 5);
    expect(level.targetColorIds).toHaveLength(18);
  });

  it('level 5 outer targets fit within the lane width', () => {
    const level = LEVELS.find((l) => l.id === 5);
    const columns = Math.ceil(level.targetColorIds.length / 3);
    const outerCenterX = ((columns - 1) * 0.5) * LAYOUT.targetDenseSpacingX;
    const outerEdgeX = outerCenterX + level.targetRadius;
    expect(outerEdgeX).toBeLessThanOrEqual(LAYOUT.laneWidth * 0.5);
  });

  it('level 2 and 3 are hardOnly Primary levels', () => {
    const level2 = LEVELS.find((l) => l.id === 2);
    const level3 = LEVELS.find((l) => l.id === 3);
    expect(level2.hardOnly).toBe(true);
    expect(level2.tier).toBe(TIERS.PRIMARY);
    expect(level3.hardOnly).toBe(true);
    expect(level3.tier).toBe(TIERS.PRIMARY);
  });

  it('each level has required fields', () => {
    LEVELS.forEach((level) => {
      expect(level).toHaveProperty('id');
      expect(level).toHaveProperty('label');
      expect(level).toHaveProperty('tier');
      expect(level).toHaveProperty('hardTime');
      expect(level).toHaveProperty('targetRadius');
      expect(level).toHaveProperty('bumperHeight');
      expect(typeof level.hardTime).toBe('number');
    });
  });

  it('keeps base obstacles empty', () => {
    LEVELS.forEach((level) => {
      expect(level.obstacles).toEqual([]);
    });
  });
});

describe('getAvailableLevels', () => {
  it('Easy mode returns only 3 non-hardOnly levels', () => {
    const easyLevels = getAvailableLevels(MODE.EASY);
    expect(easyLevels).toHaveLength(3);
    easyLevels.forEach((l) => expect(l.hardOnly).toBeUndefined());
  });

  it('Hard mode returns all 5 levels', () => {
    const hardLevels = getAvailableLevels(MODE.HARD);
    expect(hardLevels).toHaveLength(5);
  });

  it('Hard levels are in order by id', () => {
    const hardLevels = getAvailableLevels(MODE.HARD);
    for (let i = 1; i < hardLevels.length; i++) {
      expect(hardLevels[i].id).toBeGreaterThan(hardLevels[i - 1].id);
    }
  });
});

describe('MODE', () => {
  it('has Easy and Hard', () => {
    expect(MODE.EASY).toBe('Easy');
    expect(MODE.HARD).toBe('Hard');
  });
});

describe('LAYOUT', () => {
  it('has all required layout properties', () => {
    expect(LAYOUT).toHaveProperty('floorY');
    expect(LAYOUT).toHaveProperty('ballRadius');
    expect(LAYOUT).toHaveProperty('laneWidth');
    expect(LAYOUT).toHaveProperty('laneLength');
    expect(LAYOUT).toHaveProperty('startLineZ');
    expect(LAYOUT).toHaveProperty('startLineDepth');
    expect(LAYOUT).toHaveProperty('targetDenseSpacingX');
    expect(LAYOUT).toHaveProperty('targetZ');
    expect(LAYOUT).toHaveProperty('mixBoxCenter');
    expect(LAYOUT).toHaveProperty('resultReturnOrigin');
    expect(LAYOUT.mixSlotPositions).toHaveLength(2);
    expect(LAYOUT.resultShelfRowSlots).toEqual([2, 4]);
    expect(LAYOUT.resultShelfRowSlots.reduce((total, slots) => total + slots, 0)).toBe(6);
    expect(LAYOUT.resultShelfSlotSpacingX).toBeCloseTo(0.36, 5);
  });
});

describe('getLevelRuntimeConfig', () => {
  it('returns a fresh easy runtime without hard overlay for every level', () => {
    LEVELS.forEach((level) => {
      const runtime = getLevelRuntimeConfig(level, MODE.EASY);

      expect(runtime).not.toBe(level);
      expect(runtime.hard).toBeUndefined();
      expect(runtime.targetLayout).toBe('fixed');
      expect(runtime.obstacles).toEqual([]);
    });
  });

  it('returns the exact hard level 1 overlay', () => {
    const level1 = LEVELS.find((l) => l.id === 1);
    const runtime = getLevelRuntimeConfig(level1, MODE.HARD);

    expect(runtime.targetLayout).toBe('fixed');
    expect(runtime.obstacles).toEqual([
      { type: 'peg', x: -0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
      { type: 'peg', x: 0.55, z: -1.2, radius: 0.11, bounce: 0.74 },
      { type: 'peg', x: 0, z: -2.2, radius: 0.13, bounce: 0.76 },
      { type: 'peg', x: -0.72, z: -3.15, radius: 0.11, bounce: 0.74 },
      { type: 'peg', x: 0.72, z: -3.15, radius: 0.11, bounce: 0.74 }
    ]);
  });

  it('returns the exact hard level 4 and 5 overlays (old level 2 and 3)', () => {
    const level4 = LEVELS.find((l) => l.id === 4);
    const level5 = LEVELS.find((l) => l.id === 5);
    const cfg4 = getLevelRuntimeConfig(level4, MODE.HARD);
    const cfg5 = getLevelRuntimeConfig(level5, MODE.HARD);

    expect(cfg4.targetLayout).toBe('roulette');
    expect(cfg4.rouletteSpeed).toBeCloseTo(0.38, 5);
    expect(cfg4.rouletteCenterY).toBeCloseTo(0.95, 5);
    expect(cfg4.rouletteRadiusX).toBeCloseTo(0.68, 5);
    expect(cfg4.rouletteRadiusY).toBeCloseTo(0.68, 5);
    expect(cfg4.obstacles).toEqual([
      { type: 'peg', x: -0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
      { type: 'peg', x: 0.62, z: -1.1, radius: 0.11, bounce: 0.74 },
      { type: 'bumper', x: 0, z: -2.0, radius: 0.16, bounce: 1.42 },
      { type: 'boomerang', x: -0.72, z: -3.0, mirror: -1, angle: Math.PI / 6, bounce: 0.84 },
      { type: 'boomerang', x: 0.72, z: -3.0, mirror: 1, angle: -Math.PI / 6, bounce: 0.84 },
      { type: 'kicker', x: -0.22, z: -3.85, radius: 0.26, length: 0.52, width: 0.16, angle: Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 },
      { type: 'kicker', x: 0.22, z: -5.65, radius: 0.26, length: 0.52, width: 0.16, angle: -Math.PI * 2 / 3, bounce: 1.48, kick: 2.6 },
      { type: 'peg', x: 0, z: -5.1, radius: 0.13, bounce: 0.76 }
    ]);

    expect(cfg5.targetLayout).toBe('roulette');
    expect(cfg5.targetRadius).toBeCloseTo(0.17, 5);
    expect(cfg5.rouletteSpeed).toBeCloseTo(0.62, 5);
    expect(cfg5.rouletteCenterY).toBeCloseTo(1.2, 5);
    expect(cfg5.rouletteRadiusX).toBeCloseTo(1.0, 5);
    expect(cfg5.rouletteRadiusY).toBeCloseTo(1.0, 5);
    expect(cfg5.obstacles).toEqual([
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
    ]);
  });

  it('hard level 2 has slideVertical layout', () => {
    const level2 = LEVELS.find((l) => l.id === 2);
    const cfg = getLevelRuntimeConfig(level2, MODE.HARD);
    expect(cfg.targetLayout).toBe('slideVertical');
    expect(cfg.slideSpeed).toBeGreaterThan(0);
    expect(cfg.slideRange).toBeGreaterThan(0);
  });

  it('hard level 3 has slideHorizontal layout', () => {
    const level3 = LEVELS.find((l) => l.id === 3);
    const cfg = getLevelRuntimeConfig(level3, MODE.HARD);
    expect(cfg.targetLayout).toBe('slideHorizontal');
    expect(cfg.slideSpeed).toBeGreaterThan(0);
    expect(cfg.slideRange).toBeGreaterThan(0);
  });

  it('keeps runtime obstacles and color id arrays isolated from LEVELS', () => {
    const level5 = LEVELS.find((l) => l.id === 5);
    const runtime = getLevelRuntimeConfig(level5, MODE.HARD);
    runtime.obstacles[0].x = 999;
    runtime.targetColorIds.push('bogus');
    runtime.sourceColorIds.push('bogus-source');

    const fresh = getLevelRuntimeConfig(level5, MODE.HARD);
    const freshEasy = getLevelRuntimeConfig(level5, MODE.EASY);

    expect(fresh.obstacles[0].x).toBe(-0.78);
    expect(fresh.targetColorIds).not.toContain('bogus');
    expect(fresh.sourceColorIds).not.toContain('bogus-source');
    expect(level5.targetColorIds).not.toContain('bogus');
    expect(level5.sourceColorIds).not.toContain('bogus-source');
    expect(freshEasy.sourceColorIds).toEqual(['red', 'yellow', 'blue', 'white']);
    expect(level5.obstacles).toEqual([]);
  });

  it('clones scoringColorIds from a synthetic hard runtime config', () => {
    const syntheticLevel = {
      id: 99,
      label: 'Synthetic',
      tier: TIERS.NEUTRAL,
      hardTime: 1,
      targetRadius: 0.2,
      bumperHeight: 0.2,
      targetLayout: 'fixed',
      scoringColorIds: ['cyan', 'magenta'],
      obstacles: [],
      hard: {
        scoringColorIds: ['cyan', 'magenta'],
        obstacles: []
      }
    };

    const runtime = getLevelRuntimeConfig(syntheticLevel, MODE.HARD);
    runtime.scoringColorIds.push('yellow');

    expect(syntheticLevel.scoringColorIds).toEqual(['cyan', 'magenta']);
    expect(runtime.scoringColorIds).toEqual(['cyan', 'magenta', 'yellow']);
    expect(getLevelRuntimeConfig(syntheticLevel, MODE.HARD).scoringColorIds).toEqual([
      'cyan',
      'magenta'
    ]);
  });

  it('keeps every hard obstacle inside the lane and uses valid types', () => {
    const hardLevels = LEVELS.map((level) => getLevelRuntimeConfig(level, MODE.HARD));

    hardLevels.forEach((runtime) => {
      runtime.obstacles.forEach((obstacle) => {
        const extent = obstacle.type === 'boomerang' ? 0.31 : obstacle.radius;
        expect(Math.abs(obstacle.x) + extent + LAYOUT.ballRadius).toBeLessThanOrEqual(
          LAYOUT.laneWidth / 2
        );
        expect(obstacle.z).toBeLessThan(LAYOUT.releasePoint.z - 0.75);
        expect(obstacle.z).toBeGreaterThan(LAYOUT.targetZ + 0.6);
        if (obstacle.type !== 'boomerang') {
          expect(obstacle.radius).toBeGreaterThan(0);
        }
        if (obstacle.type === 'kicker') {
          expect(obstacle.bounce).toBeGreaterThanOrEqual(1.48);
          expect(obstacle.bounce).toBeLessThanOrEqual(1.6);
          expect(obstacle.kick).toBeGreaterThanOrEqual(2.6);
          expect(typeof obstacle.angle).toBe('number');
        } else if (obstacle.type === 'bumper') {
          expect(obstacle.bounce).toBeGreaterThanOrEqual(1.38);
          expect(obstacle.bounce).toBeLessThanOrEqual(1.48);
        } else if (obstacle.type === 'boomerang') {
          expect(obstacle.bounce).toBeGreaterThanOrEqual(0.8);
          expect(obstacle.bounce).toBeLessThanOrEqual(0.9);
          expect([-1, 1]).toContain(obstacle.mirror);
        } else {
          expect(obstacle.bounce).toBeGreaterThanOrEqual(0.72);
          expect(obstacle.bounce).toBeLessThanOrEqual(0.77);
        }
        expect(['peg', 'bumper', 'kicker', 'boomerang']).toContain(obstacle.type);
      });
    });

    // Mỗi level có kicker đều dùng đúng một cái ở trên và một cái ở dưới.
    const level4runtime = getLevelRuntimeConfig(LEVELS.find((l) => l.id === 4), MODE.HARD);
    const level5runtime = getLevelRuntimeConfig(LEVELS.find((l) => l.id === 5), MODE.HARD);
    expect(level4runtime.obstacles.filter((o) => o.type === 'kicker')).toHaveLength(2);
    expect(level5runtime.obstacles.filter((o) => o.type === 'kicker')).toHaveLength(2);
  });

  it('uses more hard obstacles in higher roulette levels', () => {
    const level4 = getLevelRuntimeConfig(LEVELS.find((l) => l.id === 4), MODE.HARD);
    const level5 = getLevelRuntimeConfig(LEVELS.find((l) => l.id === 5), MODE.HARD);

    expect(level4.obstacles.length).toBeLessThan(level5.obstacles.length);
    expect(level4.rouletteSpeed).toBeGreaterThan(0);
    expect(level5.rouletteSpeed).toBeGreaterThan(level4.rouletteSpeed);
  });

  it('tilts the upper and lower kicker tips upward toward the targets', () => {
    const levelsWithKickers = LEVELS
      .map((level) => getLevelRuntimeConfig(level, MODE.HARD))
      .filter((runtime) => runtime.obstacles.some((obstacle) => obstacle.type === 'kicker'));

    levelsWithKickers.forEach((runtime) => {
      const kickers = runtime.obstacles.filter((obstacle) => obstacle.type === 'kicker');
      expect(kickers).toHaveLength(2);
      const [top, bottom] = [...kickers].sort((a, b) => b.z - a.z);
      expect(top.z).toBeGreaterThan(bottom.z);
      expect(top.x).toBeLessThan(0);
      expect(bottom.x).toBeGreaterThan(0);
      expect(top.angle).toBeCloseTo(Math.PI * 2 / 3, 5);
      expect(bottom.angle).toBeCloseTo(-Math.PI * 2 / 3, 5);
      expect(Math.cos(top.angle)).toBeLessThan(0);
      expect(Math.cos(bottom.angle)).toBeLessThan(0);
      [top, bottom].forEach((kicker) => {
        expect(kicker.length).toBeCloseTo(0.52, 5);
        expect(kicker.width).toBeCloseTo(0.16, 5);
      });
    });
  });

  it('uses small upper pegs and mirrored lower boomerangs in hard level 5', () => {
    const runtime = getLevelRuntimeConfig(LEVELS.find((level) => level.id === 5), MODE.HARD);
    const smallPegs = runtime.obstacles.filter(
      (obstacle) => obstacle.type === 'peg' && Math.abs(obstacle.x) > 0.5 && obstacle.z > -2
    );
    const boomerangs = runtime.obstacles.filter((obstacle) => obstacle.type === 'boomerang');
    const centerBumpers = runtime.obstacles.filter(
      (obstacle) => obstacle.type === 'bumper' && Math.abs(obstacle.x) < 0.01
    );

    expect(smallPegs).toHaveLength(2);
    smallPegs.forEach((peg) => expect(peg.radius).toBeCloseTo(0.075, 5));
    expect(boomerangs).toHaveLength(2);
    expect(boomerangs.map((item) => item.mirror).sort()).toEqual([-1, 1]);
    expect(boomerangs.find((item) => item.x < 0)).toMatchObject({
      mirror: -1,
      angle: Math.PI / 6
    });
    expect(boomerangs.find((item) => item.x > 0)).toMatchObject({
      mirror: 1,
      angle: -Math.PI / 6
    });
    expect(boomerangs[0].z).toBeCloseTo(boomerangs[1].z, 5);
    expect(centerBumpers.length).toBeGreaterThanOrEqual(1);
  });

  it('replaces the diagonal level 4 pegs with boomerangs and removes the bumper beside the upper kicker', () => {
    const runtime = getLevelRuntimeConfig(LEVELS.find((level) => level.id === 4), MODE.HARD);
    const boomerangs = runtime.obstacles.filter((obstacle) => obstacle.type === 'boomerang');

    expect(boomerangs).toHaveLength(2);
    expect(boomerangs.map((item) => item.mirror).sort()).toEqual([-1, 1]);
    expect(boomerangs.every((item) => item.z === -3.0)).toBe(true);
    expect(
      runtime.obstacles.some(
        (item) => item.type === 'bumper' && item.x === 0.58 && item.z === -5.8
      )
    ).toBe(false);
  });
});

describe('AIM constants', () => {
  it('exposes drag-to-shoot tuning values', () => {
    expect(AIM.minDragPx).toBeGreaterThan(0);
    expect(AIM.pixelsForMaxPower).toBeGreaterThan(AIM.minDragPx);
    expect(AIM.minDragRatio).toBeCloseTo(0.05, 5);
    expect(AIM.minPower).toBeCloseTo(2.6, 5);
    expect(AIM.maxPower).toBeCloseTo(16, 5);
    expect(AIM.powerExponent).toBeCloseTo(1.5, 5);
    expect(AIM.maxDirDeg).toBe(50);
    expect(AIM.launchAngleDeg).toBeGreaterThan(0);
    expect(AIM.trajectoryPoints).toBeGreaterThanOrEqual(2);
  });
});

describe('LAYOUT ball return rack', () => {
  it('moves the rack clear of the pink foul line', () => {
    expect(LAYOUT.returnOrigin.z).toBeGreaterThan(LAYOUT.startLineZ + 0.3);
  });

  it('exposes rack slot spacing and settle speed', () => {
    expect(LAYOUT.returnSlotSpacingX).toBeCloseTo(0.44, 5);
    expect(LAYOUT.returnSlotSpacingZ).toBeCloseTo(0.38, 5);
    expect(LAYOUT.returnSettleSpeed).toBeGreaterThan(0);
  });

  it('aligns source and mixed ball shelves in parallel across the lane', () => {
    expect(LAYOUT.returnOrigin.z).toBeCloseTo(LAYOUT.resultReturnOrigin.z, 5);
  });
});
