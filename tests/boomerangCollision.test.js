import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createObstacleMesh } from '../src/ObstacleFactory.js';
import {
  resolveBoomerangCollision,
  resolveSweptBoomerangCollision
} from '../src/boomerangCollision.js';

function createBoomerang() {
  return createObstacleMesh({
    type: 'boomerang',
    x: 0,
    z: 0,
    mirror: 1,
    angle: 0,
    bounce: 0.82
  });
}

describe('boomerang collision', () => {
  it('collides with the upper and lower solid triangle edges', () => {
    const obstacle = createBoomerang();
    const upper = resolveBoomerangCollision(
      new THREE.Vector3(0.1, 0.16, 0.12),
      0.04,
      obstacle
    );
    const lower = resolveBoomerangCollision(
      new THREE.Vector3(0.1, 0.16, -0.12),
      0.04,
      obstacle
    );

    expect(upper).not.toBeNull();
    expect(lower).not.toBeNull();
    expect(Math.sign(upper.normal.z)).toBe(-Math.sign(lower.normal.z));
  });

  it('does not collide outside the solid triangle silhouette', () => {
    const hit = resolveBoomerangCollision(
      new THREE.Vector3(-0.32, 0.16, 0.28),
      0.04,
      createBoomerang()
    );

    expect(hit).toBeNull();
  });

  it('detects a fast ball crossing one branch between frames', () => {
    const obstacle = createBoomerang();
    const start = new THREE.Vector3(0.08, 0.16, 0.45);
    const end = new THREE.Vector3(0.08, 0.16, -0.45);

    const hit = resolveSweptBoomerangCollision(start, end, 0.06, obstacle);

    expect(hit).not.toBeNull();
    expect(hit.sweepT).toBeGreaterThan(0);
    expect(hit.sweepT).toBeLessThanOrEqual(1);
  });
});
