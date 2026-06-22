import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/constants.js';
import { BallManager } from '../src/BallManager.js';
import { createObstacleMesh } from '../src/ObstacleFactory.js';

// Test pure ball position logic (same as BallManager.getBallSpawnPosition)
function getBallSpawnPosition(index, source = false, sourceCount = 3) {
  const getShelfGridOffset = (slotIndex, columns) => {
    const col = slotIndex % columns;
    const row = Math.floor(slotIndex / columns);
    return new THREE.Vector3(
      (col - (columns - 1) * 0.5) * LAYOUT.returnSlotSpacingX,
      row * 0.03,
      -row * LAYOUT.returnSlotSpacingZ
    );
  };

  const getResultShelfOffset = (slotIndex) => {
    let offset = slotIndex;
    const rows = LAYOUT.resultShelfRowSlots;
    const spacingX = LAYOUT.resultShelfSlotSpacingX;

    for (let row = 0; row < rows.length; row += 1) {
      const columns = rows[row];
      if (offset < columns) {
        const z = -(rows.length - 1 - row) * LAYOUT.returnSlotSpacingZ;
        return new THREE.Vector3(
          (offset - (columns - 1) * 0.5) * spacingX,
          row * 0.03,
          z
        );
      }
      offset -= columns;
    }

    return new THREE.Vector3();
  };

  if (source) {
    const columns = sourceCount <= 4 ? sourceCount : 2;
    return LAYOUT.returnOrigin.clone().add(getShelfGridOffset(index, columns));
  }

  return LAYOUT.resultReturnOrigin.clone().add(getResultShelfOffset(index));
}

describe('getBallSpawnPosition', () => {
  describe('source balls', () => {
    it('returns positions near returnOrigin for source balls', () => {
      const pos = getBallSpawnPosition(0, true, 3);
      expect(pos.x).toBeCloseTo(LAYOUT.returnOrigin.x - 0.44, 2);
      expect(pos.z).toBeCloseTo(LAYOUT.returnOrigin.z, 2);
    });

    it('lays out 3 source balls in a row', () => {
      const pos0 = getBallSpawnPosition(0, true, 3);
      const pos1 = getBallSpawnPosition(1, true, 3);
      const pos2 = getBallSpawnPosition(2, true, 3);

      expect(pos0.x).toBeLessThan(pos1.x);
      expect(pos1.x).toBeLessThan(pos2.x);
    });

    it('keeps source balls clear of the lane boundary', () => {
      const pos0 = getBallSpawnPosition(0, true, 3);
      const laneEdge = LAYOUT.laneWidth * 0.5;
      expect(pos0.x - LAYOUT.ballRadius).toBeGreaterThan(laneEdge + 0.15);
    });

    it('handles 4 source balls in one long row', () => {
      const positions = [];
      for (let i = 0; i < 4; i++) {
        positions.push(getBallSpawnPosition(i, true, 4));
      }

      positions.forEach((pos) => {
        expect(pos.z).toBeCloseTo(LAYOUT.returnOrigin.z, 2);
      });
      expect(positions[0].x).toBeLessThan(positions[1].x);
      expect(positions[1].x).toBeLessThan(positions[2].x);
      expect(positions[2].x).toBeLessThan(positions[3].x);
    });
  });

  describe('result balls', () => {
    it('returns positions near resultReturnOrigin for result balls', () => {
      const pos = getBallSpawnPosition(0, false);
      expect(pos.x).toBeCloseTo(LAYOUT.resultReturnOrigin.x - LAYOUT.resultShelfSlotSpacingX / 2, 2);
      expect(pos.z).toBeCloseTo(LAYOUT.resultReturnOrigin.z - LAYOUT.returnSlotSpacingZ, 2);
    });

    it('lays out 2 inner slots and 4 outside slots', () => {
      const pos0 = getBallSpawnPosition(0, false);
      const pos1 = getBallSpawnPosition(1, false);
      const pos2 = getBallSpawnPosition(2, false);
      const pos5 = getBallSpawnPosition(5, false);

      expect(pos1.x).toBeGreaterThan(pos0.x);
      expect(pos2.z).toBeGreaterThan(pos0.z);
      expect(pos5.z).toBeCloseTo(pos2.z, 2);
      expect(pos5.x).toBeGreaterThan(pos2.x);
    });

    it('places the fifth and sixth balls on the outside row', () => {
      const pos4 = getBallSpawnPosition(4, false);
      const pos5 = getBallSpawnPosition(5, false);

      expect(pos4.z).toBeCloseTo(LAYOUT.resultReturnOrigin.z, 2);
      expect(pos5.z).toBeCloseTo(LAYOUT.resultReturnOrigin.z, 2);
    });

    it('keeps inside result shelf row clear of the mix box', () => {
      const pos0 = getBallSpawnPosition(0, false);
      expect(pos0.z).toBeGreaterThan(LAYOUT.mixBoxCenter.z + 0.7);
    });

    it('keeps result balls clear of the lane boundary', () => {
      const pos2 = getBallSpawnPosition(2, false);
      const laneEdge = -LAYOUT.laneWidth * 0.5;
      expect(pos2.x + LAYOUT.ballRadius).toBeLessThan(laneEdge - 0.1);
    });
  });
});

describe('BallManager visuals', () => {
  it('keeps the selected ball emissive color unchanged', () => {
    const scene = new THREE.Scene();
    const manager = new BallManager(scene, {});
    const ball = manager.createReturnBall({ id: 'red', label: 'Red', hex: 0xff2b2b, tier: 'Primary' }, 0, {
      source: true,
      sourceCount: 3
    });
    const before = ball.material.emissive.clone();

    manager.setSelectedBall(ball);

    expect(ball.material.emissive.equals(before)).toBe(true);
    manager.dispose();
  });

  it('keeps the ring visible around a selected ball while it is being held', () => {
    const scene = new THREE.Scene();
    const manager = new BallManager(scene, {});
    const ball = manager.createReturnBall({ id: 'blue', label: 'Blue', hex: 0x1548ff, tier: 'Primary' }, 0, {
      source: true,
      sourceCount: 3
    });

    manager.setHoveredBall(ball);
    expect(manager.hoverRing.visible).toBe(true);
    expect(manager.hoverRing.position.x).toBeCloseTo(ball.position.x, 5);

    manager.setSelectedBall(ball);
    expect(manager.hoverRing.visible).toBe(true);

    ball.position.x += 1;
    manager.updateHoverRing();
    expect(manager.hoverRing.position.x).toBeCloseTo(ball.position.x, 5);

    manager.setSelectedBall(null);
    expect(manager.hoverRing.visible).toBe(false);
    manager.dispose();
  });
});

describe('result shelf capacity', () => {
  it('allows only six active mixed ball slots', () => {
    const scene = new THREE.Scene();
    const manager = new BallManager(scene, {});
    const color = { id: 'mixed', label: 'Mixed', hex: 0xff8d00, tier: 'Secondary' };

    for (let i = 0; i < 6; i++) {
      const slot = manager.getAvailableResultShelfSlot();
      expect(slot).toBe(i);
      manager.createReturnBall({ ...color, id: `mixed-${i}` }, slot, {
        source: false,
        resultShelfSlot: slot,
        resultShelfOrder: i
      });
    }

    expect(manager.getAvailableResultShelfSlot()).toBeNull();
    manager.dispose();
  });
});

describe('computeRackRestX', () => {
  const spacing = LAYOUT.returnSlotSpacingX;

  it('centers a single ball at offset 0', () => {
    expect(BallManager.computeRackRestX(0, 1)).toBeCloseTo(0, 5);
  });

  it('lays three balls symmetric around center', () => {
    expect(BallManager.computeRackRestX(0, 3)).toBeCloseTo(-spacing, 5);
    expect(BallManager.computeRackRestX(1, 3)).toBeCloseTo(0, 5);
    expect(BallManager.computeRackRestX(2, 3)).toBeCloseTo(spacing, 5);
  });

  it('lays two balls half a spacing apart from center', () => {
    expect(BallManager.computeRackRestX(0, 2)).toBeCloseTo(-spacing / 2, 5);
    expect(BallManager.computeRackRestX(1, 2)).toBeCloseTo(spacing / 2, 5);
  });

  it('keeps adjacent slots exactly one spacing apart', () => {
    const a = BallManager.computeRackRestX(1, 4);
    const b = BallManager.computeRackRestX(2, 4);
    expect(b - a).toBeCloseTo(spacing, 5);
  });
});

describe('updateReturnSettle', () => {
  function makeManager() {
    const scene = new THREE.Scene();
    const manager = new BallManager(scene, {});
    const reds = [
      { id: 'red', label: 'Red', hex: 0xff2b2b, tier: 'Primary' },
      { id: 'yellow', label: 'Yellow', hex: 0xffef00, tier: 'Primary' },
      { id: 'blue', label: 'Blue', hex: 0x1548ff, tier: 'Primary' }
    ];
    reds.forEach((c, i) => manager.createReturnBall(c, i, { source: true, sourceCount: 3 }));
    return manager;
  }

  it('pulls remaining ready balls toward centered rest positions', () => {
    const manager = makeManager();
    manager.balls[1].userData.state = 'held';
    for (let i = 0; i < 200; i++) manager.updateReturnSettle(0.033);
    const ready = manager.balls.filter((b) => b.userData.state === 'ready');
    const xs = ready.map((b) => b.position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(LAYOUT.returnOrigin.x - LAYOUT.returnSlotSpacingX / 2, 2);
    expect(xs[1]).toBeCloseTo(LAYOUT.returnOrigin.x + LAYOUT.returnSlotSpacingX / 2, 2);
    manager.dispose();
  });

  it('pulls ready mixed balls toward the left result shelf', () => {
    const scene = new THREE.Scene();
    const manager = new BallManager(scene, {});
    const ball = manager.createReturnBall(
      { id: 'orange', label: 'Orange', hex: 0xff8d00, tier: 'Secondary' },
      4,
      { source: false, resultShelfSlot: 4, resultShelfOrder: 1 }
    );

    ball.position.set(0, 1, 0);
    for (let i = 0; i < 200; i++) manager.updateReturnSettle(0.033);
    const target = manager.getBallSpawnPosition(4, false);

    expect(ball.position.x).toBeCloseTo(target.x, 2);
    expect(ball.position.z).toBeCloseTo(target.z, 2);
    manager.dispose();
  });

  it('does not move balls that are not ready', () => {
    const manager = makeManager();
    manager.balls[0].userData.state = 'rolling';
    const before = manager.balls[0].position.clone();
    for (let i = 0; i < 50; i++) manager.updateReturnSettle(0.033);
    expect(manager.balls[0].position.equals(before)).toBe(true);
    manager.dispose();
  });
});

describe('handleObstacleCollisions', () => {
  function makeFixture(bounce) {
    const scene = new THREE.Scene();
    const obstacle = new THREE.Object3D();
    obstacle.position.set(0, 0, 0);
    obstacle.userData.radius = 0.1;
    if (bounce !== undefined) {
      obstacle.userData.bounce = bounce;
    }

    const game = {
      obstacleObjects: [obstacle],
      audio: {
        bumper: vi.fn()
      },
      particles: {
        spawnSpark: vi.fn()
      }
    };

    const manager = new BallManager(scene, game);
    const ball = new THREE.Object3D();
    ball.position.set(obstacle.userData.radius + LAYOUT.ballRadius, LAYOUT.ballRadius, 0);
    ball.userData = {
      cooldown: 0,
      velocity: new THREE.Vector3(-10, 0, 0)
    };

    return { manager, obstacle, ball, game };
  }

  it('uses per-obstacle bounce when present', () => {
    const { manager, ball, game } = makeFixture(0.92);

    manager.handleObstacleCollisions(ball);

    expect(ball.userData.velocity.x).toBeCloseTo(9.2, 5);
    expect(ball.userData.velocity.y).toBeCloseTo(0.55, 5);
    expect(game.audio.bumper).toHaveBeenCalledTimes(1);
    expect(game.particles.spawnSpark).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it('gives red bumpers a strong rebound and lift', () => {
    const { manager, ball, obstacle } = makeFixture(1.45);
    obstacle.userData.obstacleType = 'bumper';

    manager.handleObstacleCollisions(ball);

    expect(ball.userData.velocity.x).toBeCloseTo(14.5, 5);
    expect(ball.userData.velocity.y).toBeCloseTo(1.15, 5);
    manager.dispose();
  });

  it('caps red bumper rebound speed at 18', () => {
    const { manager, ball, obstacle } = makeFixture(1.48);
    obstacle.userData.obstacleType = 'bumper';
    ball.userData.velocity.x = -30;

    manager.handleObstacleCollisions(ball);

    expect(Math.hypot(ball.userData.velocity.x, ball.userData.velocity.z)).toBeCloseTo(18, 5);
    manager.dispose();
  });

  it('falls back to the default bounce when absent', () => {
    const { manager, ball } = makeFixture();

    manager.handleObstacleCollisions(ball);

    expect(ball.userData.velocity.x).toBeCloseTo(7.8, 5);
    manager.dispose();
  });
});

describe('triangle kicker collisions', () => {
  function makeHarness(kick = 3.3, bounce = 1.6) {
    const obstacle = createObstacleMesh({
      type: 'kicker',
      x: 0,
      z: 0,
      radius: 0.5,
      length: 1,
      width: 0.3,
      angle: 0,
      bounce,
      kick
    });
    const game = {
      obstacleObjects: [obstacle],
      audio: { bumper: vi.fn() },
      particles: { spawnSpark: vi.fn() }
    };
    return { manager: new BallManager(new THREE.Scene(), game), game, obstacle };
  }

  function makeBall(x, speed = -10) {
    const ball = new THREE.Object3D();
    ball.position.set(x, LAYOUT.ballRadius, 0.52);
    ball.userData = { cooldown: 0, velocity: new THREE.Vector3(0, 0, speed) };
    return ball;
  }

  it('applies a stronger reflected velocity and kicker lift', () => {
    const { manager, game, obstacle } = makeHarness();
    const ball = makeBall(0.08);

    manager.handleObstacleCollisions(ball);

    expect(Math.hypot(ball.userData.velocity.x, ball.userData.velocity.z)).toBeGreaterThan(10);
    expect(ball.userData.velocity.y).toBeCloseTo(1.15, 5);
    expect(ball.userData.cooldown).toBeCloseTo(0.1, 5);
    expect(game.audio.bumper).toHaveBeenCalledOnce();
    expect(Math.abs(obstacle.userData.kickerAnimation.angularVelocity)).toBeGreaterThan(0);
    expect(obstacle.userData.kickerAnimation.flash).toBe(1);
    manager.dispose();
  });

  it('changes lateral direction from the impact offset', () => {
    const left = makeHarness();
    const right = makeHarness();
    const leftBall = makeBall(-0.12);
    const rightBall = makeBall(0.12);

    left.manager.handleObstacleCollisions(leftBall);
    right.manager.handleObstacleCollisions(rightBall);

    expect(Math.sign(leftBall.userData.velocity.x)).toBe(-Math.sign(rightBall.userData.velocity.x));
    left.manager.dispose();
    right.manager.dispose();
  });

  it('caps horizontal speed at 20', () => {
    const { manager } = makeHarness(8, 2);
    const ball = makeBall(0.1, -20);

    manager.handleObstacleCollisions(ball);

    expect(Math.hypot(ball.userData.velocity.x, ball.userData.velocity.z)).toBeLessThanOrEqual(20.00001);
    manager.dispose();
  });

  it('bounces a fast ball that crosses the kicker between physics frames', () => {
    const { manager, game } = makeHarness();
    const ball = makeBall(0.08, -14);
    ball.userData.previousPosition = new THREE.Vector3(0.08, LAYOUT.ballRadius, 0.9);
    ball.position.z = -0.9;

    manager.handleObstacleCollisions(ball);

    expect(ball.userData.velocity.z).toBeGreaterThan(0);
    expect(game.audio.bumper).toHaveBeenCalledOnce();
    manager.dispose();
  });
});

describe('boomerang collisions', () => {
  it('reflects a ball from the actual boomerang branch', () => {
    const obstacle = createObstacleMesh({
      type: 'boomerang',
      x: 0,
      z: 0,
      mirror: 1,
      angle: 0,
      bounce: 0.9
    });
    const game = {
      obstacleObjects: [obstacle],
      audio: { bumper: vi.fn() },
      particles: { spawnSpark: vi.fn() }
    };
    const manager = new BallManager(new THREE.Scene(), game);
    const ball = new THREE.Object3D();
    ball.position.set(0.08, LAYOUT.ballRadius, 0.13);
    ball.userData = {
      cooldown: 0,
      velocity: new THREE.Vector3(0, 0, -8)
    };

    manager.handleObstacleCollisions(ball);

    expect(ball.userData.velocity.z).toBeGreaterThan(-8);
    expect(game.audio.bumper).toHaveBeenCalledOnce();
    manager.dispose();
  });
});
