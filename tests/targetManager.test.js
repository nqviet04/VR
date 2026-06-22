import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LEVELS, MODE, LAYOUT, getLevelRuntimeConfig } from '../src/constants.js';
import { TargetManager } from '../src/TargetManager.js';

// Test pure target layout functions (same logic as TargetManager)
function getTargetStackY(row, rows) {
  return LAYOUT.targetY + (rows - 1 - row) * LAYOUT.targetStackGap;
}

function getFixedTargetSlot(index, count) {
  if (count <= 3) {
    return {
      position: new THREE.Vector3((index - (count - 1) * 0.5) * 0.72, LAYOUT.targetY, LAYOUT.targetZ),
      column: index,
      row: 0,
      rows: 1
    };
  }

  if (count > 6) {
    const columns = Math.ceil(count / 3);
    const rows = Math.ceil(count / columns);
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = (col - (columns - 1) * 0.5) * LAYOUT.targetDenseSpacingX;
    const y = getTargetStackY(row, rows);
    return {
      position: new THREE.Vector3(x, y, LAYOUT.targetZ),
      column: col,
      row,
      rows
    };
  }

  const spacing = 0.42;
  const y = LAYOUT.targetY + 0.08;
  return {
    position: new THREE.Vector3((index - (count - 1) * 0.5) * spacing, y, LAYOUT.targetZ),
    column: index,
    row: 0,
    rows: 1
  };
}

function distancePointToBallPath(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 0.0001) {
    return point.distanceTo(end);
  }
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  const closest = start.clone().addScaledVector(segment, t);
  return point.distanceTo(closest);
}

describe('getFixedTargetSlot', () => {
  it('places 3 targets in a single row', () => {
    const slot0 = getFixedTargetSlot(0, 3);
    const slot1 = getFixedTargetSlot(1, 3);
    const slot2 = getFixedTargetSlot(2, 3);

    expect(slot0.row).toBe(0);
    expect(slot1.row).toBe(0);
    expect(slot2.row).toBe(0);
    expect(slot0.position.y).toBe(LAYOUT.targetY);
  });

  it('center-aligns 3 targets', () => {
    const slot1 = getFixedTargetSlot(1, 3);
    expect(slot1.position.x).toBeCloseTo(0, 5);
  });

  it('handles >6 targets with multi-row layout', () => {
    const slot = getFixedTargetSlot(0, 18);
    expect(slot.rows).toBeGreaterThan(1);
    expect(slot).toHaveProperty('column');
    expect(slot).toHaveProperty('row');
  });

  it('all slots for 18 targets have valid positions', () => {
    for (let i = 0; i < 18; i++) {
      const slot = getFixedTargetSlot(i, 18);
      expect(slot.position).toBeInstanceOf(THREE.Vector3);
      expect(slot.position.z).toBe(LAYOUT.targetZ);
      expect(typeof slot.column).toBe('number');
      expect(typeof slot.row).toBe('number');
    }
  });
});

describe('getTargetStackY', () => {
  it('row 0 of 1-row layout is at targetY', () => {
    expect(getTargetStackY(0, 1)).toBe(LAYOUT.targetY);
  });

  it('higher rows have higher Y', () => {
    const y0 = getTargetStackY(1, 3);
    const y1 = getTargetStackY(0, 3);
    expect(y1).toBeGreaterThan(y0);
  });

  it('uses targetStackGap for spacing', () => {
    const y0 = getTargetStackY(1, 2);
    const y1 = getTargetStackY(0, 2);
    expect(y1 - y0).toBeCloseTo(LAYOUT.targetStackGap, 5);
  });
});

describe('distancePointToBallPath', () => {
  it('returns 0 when point is on the path', () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(0, 0, -10);
    const point = new THREE.Vector3(0, 0, -5);
    expect(distancePointToBallPath(point, start, end)).toBeCloseTo(0, 5);
  });

  it('returns correct distance for point off path', () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(0, 0, -10);
    const point = new THREE.Vector3(1, 0, -5);
    expect(distancePointToBallPath(point, start, end)).toBeCloseTo(1, 5);
  });

  it('clamps to start when point is before start', () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(0, 0, -10);
    const point = new THREE.Vector3(0, 0, 5);
    expect(distancePointToBallPath(point, start, end)).toBeCloseTo(5, 5);
  });

  it('clamps to end when point is past end', () => {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(0, 0, -10);
    const point = new THREE.Vector3(0, 0, -15);
    expect(distancePointToBallPath(point, start, end)).toBeCloseTo(5, 5);
  });

  it('handles zero-length segment', () => {
    const start = new THREE.Vector3(1, 2, 3);
    const end = new THREE.Vector3(1, 2, 3);
    const point = new THREE.Vector3(4, 5, 6);
    expect(distancePointToBallPath(point, start, end)).toBeCloseTo(point.distanceTo(end), 5);
  });
});

describe('roulette runtime layout', () => {
  function buildManager(levelId) {
    const scene = new THREE.Scene();
    const game = { levelRunning: true };
    const manager = new TargetManager(scene, game);
    const level = LEVELS.find((l) => l.id === levelId);
    const cfg = getLevelRuntimeConfig(level, MODE.HARD);
    manager.buildTargets(cfg);
    return { manager, cfg };
  }

  it('Hard Level 4 creates rouletteGroup and parents all targets under it', () => {
    const { manager, cfg } = buildManager(4);

    try {
      expect(manager.rouletteGroup).not.toBeNull();
      expect(manager.targets).toHaveLength(cfg.targetColorIds.length);
      manager.targets.forEach((target) => {
        expect(target.parent).toBe(manager.rouletteGroup);
      });
    } finally {
      manager.dispose();
    }
  });

  it('Hard Level 5 fits 18 targets around the configured circle with no adjacent overlaps', () => {
    const { manager, cfg } = buildManager(5);

    try {
      expect(manager.targets).toHaveLength(18);

      let minAdjacentDistance = Infinity;
      for (let i = 0; i < manager.targets.length; i += 1) {
        const current = manager.targets[i].position;
        const next = manager.targets[(i + 1) % manager.targets.length].position;
        minAdjacentDistance = Math.min(minAdjacentDistance, current.distanceTo(next));
      }

      expect(minAdjacentDistance).toBeGreaterThanOrEqual(cfg.targetRadius * 2 - 0.001);
      expect(cfg.rouletteRadiusX + cfg.targetRadius).toBeLessThan(LAYOUT.laneWidth / 2);
      expect(cfg.rouletteCenterY - cfg.rouletteRadiusY - cfg.targetRadius).toBeGreaterThanOrEqual(LAYOUT.floorY - 0.001);
    } finally {
      manager.dispose();
    }
  });

  it('keeps roulette targets on a circular orbit above the lane at every rotation angle', () => {
    [4, 5].forEach((levelId) => {
      const { manager, cfg } = buildManager(levelId);

      try {
        const orbitRadii = manager.targets.map((target) => Math.hypot(target.position.x, target.position.y));
        orbitRadii.forEach((radius) => {
          expect(radius).toBeCloseTo(orbitRadii[0], 5);
        });

        for (let step = 0; step < 16; step += 1) {
          manager.rouletteGroup.rotation.z = (step / 16) * Math.PI * 2;
          manager.rouletteGroup.updateMatrixWorld(true);

          manager.targets.forEach((target) => {
            const center = new THREE.Vector3();
            target.getWorldPosition(center);
            expect(center.y - cfg.targetRadius).toBeGreaterThanOrEqual(LAYOUT.floorY);
          });
        }
      } finally {
        manager.dispose();
      }
    });
  });

  it('animateTargets rotates rouletteGroup by runtime rouletteSpeed', () => {
    const { manager, cfg } = buildManager(4);

    try {
      manager.animateTargets(0.5);
      expect(manager.rouletteGroup.rotation.z).toBeCloseTo(cfg.rouletteSpeed * 0.5, 5);
    } finally {
      manager.dispose();
    }
  });

  it('first Level 4 target world position changes after roulette rotation', () => {
    const { manager } = buildManager(4);

    try {
      const before = new THREE.Vector3();
      const after = new THREE.Vector3();

      manager.targets[0].updateMatrixWorld(true);
      manager.targets[0].getWorldPosition(before);

      manager.animateTargets(0.5);
      manager.rouletteGroup.updateMatrixWorld(true);
      manager.targets[0].updateMatrixWorld(true);
      manager.targets[0].getWorldPosition(after);

      expect(before.distanceTo(after)).toBeGreaterThan(0.01);
    } finally {
      manager.dispose();
    }
  });

  it('detects a correct collision against a rotated Level 4 target using world position', () => {
    const { manager } = buildManager(4);

    try {
      manager.animateTargets(0.5);
      manager.rouletteGroup.updateMatrixWorld(true);

      const target = manager.targets[0];
      const center = new THREE.Vector3();
      target.getWorldPosition(center);

      manager.game.balls = {
        distancePointToBallPath: (point) => point.distanceTo(center)
      };
      manager.onCorrectHit = vi.fn();

      const ball = {
        position: center.clone(),
        userData: {
          cooldown: 0,
          previousPosition: center.clone().add(new THREE.Vector3(0, 0, 0.5)),
          colorId: target.userData.colorId
        }
      };

      manager.handleTargetCollisions(ball);

      expect(manager.onCorrectHit).toHaveBeenCalledTimes(1);
      expect(manager.onCorrectHit.mock.calls[0][1]).toBe(target);
      expect(manager.onCorrectHit.mock.calls[0][2].distanceTo(center)).toBeLessThanOrEqual(0.001);
    } finally {
      manager.dispose();
    }
  });

  it('slide vertical layout stores baseY and slideAxis y on each target', () => {
    const scene = new THREE.Scene();
    const game = { levelRunning: true };
    const manager = new TargetManager(scene, game);
    const level2 = LEVELS.find((l) => l.id === 2);
    const cfg = getLevelRuntimeConfig(level2, MODE.HARD);
    manager.buildTargets(cfg);

    try {
      expect(manager.rouletteGroup).toBeNull();
      manager.targets.forEach((target) => {
        expect(target.userData.slideAxis).toBe('y');
        expect(typeof target.userData.baseY).toBe('number');
        expect(typeof target.userData.slideSpeed).toBe('number');
        expect(typeof target.userData.slideRange).toBe('number');
        expect(typeof target.userData.slidePhase).toBe('number');
      });
    } finally {
      manager.dispose();
    }
  });

  it('slide vertical targets never go below baseY', () => {
    const scene = new THREE.Scene();
    const game = { levelRunning: true };
    const manager = new TargetManager(scene, game);
    const level2 = LEVELS.find((l) => l.id === 2);
    const cfg = getLevelRuntimeConfig(level2, MODE.HARD);
    manager.buildTargets(cfg);

    try {
      for (let t = 0; t < 10; t += 0.05) {
        vi.spyOn(performance, 'now').mockReturnValue(t * 1000);
        manager.animateTargets(0.05);

        manager.targets.forEach((target) => {
          expect(target.position.y).toBeGreaterThanOrEqual(target.userData.baseY);
          expect(target.position.y).toBeLessThanOrEqual(target.userData.baseY + target.userData.slideRange);
        });
      }
    } finally {
      vi.restoreAllMocks();
      manager.dispose();
    }
  });

  it('slide horizontal layout stores baseX and slideAxis x on each target', () => {
    const scene = new THREE.Scene();
    const game = { levelRunning: true };
    const manager = new TargetManager(scene, game);
    const level3 = LEVELS.find((l) => l.id === 3);
    const cfg = getLevelRuntimeConfig(level3, MODE.HARD);
    manager.buildTargets(cfg);

    try {
      expect(manager.rouletteGroup).toBeNull();
      manager.targets.forEach((target) => {
        expect(target.userData.slideAxis).toBe('x');
        expect(typeof target.userData.baseX).toBe('number');
        expect(typeof target.userData.slideSpeed).toBe('number');
        expect(typeof target.userData.slideRange).toBe('number');
      });
    } finally {
      manager.dispose();
    }
  });

  it('slide horizontal targets keep distinct motion phases and stay separated for a full cycle', () => {
    const scene = new THREE.Scene();
    const game = { levelRunning: true };
    const manager = new TargetManager(scene, game);
    const level3 = LEVELS.find((l) => l.id === 3);
    const cfg = getLevelRuntimeConfig(level3, MODE.HARD);
    manager.buildTargets(cfg);
    const nowSpy = vi.spyOn(performance, 'now');

    try {
      expect(new Set(manager.targets.map((target) => target.userData.slidePhase)).size).toBeGreaterThan(1);
      const minimumDistance = cfg.targetRadius * 2;
      const laneHalfWidth = LAYOUT.laneWidth * 0.5;
      const laneMinX = -laneHalfWidth + cfg.targetRadius;
      const laneMaxX = laneHalfWidth - cfg.targetRadius;
      const cycleSeconds = (Math.PI * 2) / cfg.slideSpeed;
      const observedRanges = manager.targets.map(() => ({ min: Infinity, max: -Infinity }));

      for (let step = 0; step <= 360; step += 1) {
        nowSpy.mockReturnValue((step / 360) * cycleSeconds * 6 * 1000);
        manager.animateTargets(1 / 60);

        const orderedTargets = [...manager.targets].sort((a, b) => a.position.x - b.position.x);
        for (let index = 1; index < orderedTargets.length; index += 1) {
          const distance = orderedTargets[index].position.x - orderedTargets[index - 1].position.x;
          expect(distance).toBeGreaterThanOrEqual(minimumDistance - 0.001);
        }

        manager.targets.forEach((target, index) => {
          observedRanges[index].min = Math.min(observedRanges[index].min, target.position.x);
          observedRanges[index].max = Math.max(observedRanges[index].max, target.position.x);
          expect(Math.abs(target.position.x) + cfg.targetRadius).toBeLessThanOrEqual(laneHalfWidth + 0.001);
        });
      }

      observedRanges.forEach((range) => {
        expect(range.min).toBeLessThanOrEqual(laneMinX + 0.12);
        expect(range.max).toBeGreaterThanOrEqual(laneMaxX - 0.12);
      });
    } finally {
      nowSpy.mockRestore();
      manager.dispose();
    }
  });
});
