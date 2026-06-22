import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getTriangleVertices,
  resolveSweptTriangleCollision,
  resolveTriangleCollision
} from '../src/triangleCollision.js';

function makeKicker(angle = 0) {
  const obstacle = new THREE.Object3D();
  obstacle.position.set(0, 0.16, 0);
  obstacle.userData = {
    radius: 0.26,
    length: 1,
    width: 0.3,
    angle,
    obstacleType: 'kicker'
  };
  return obstacle;
}

describe('triangle collision', () => {
  it('creates a long narrow wedge from configured length and width', () => {
    const vertices = getTriangleVertices(makeKicker());

    expect(vertices).toHaveLength(3);
    expect(vertices[0].x).toBeCloseTo(0, 5);
    expect(vertices[0].z).toBeCloseTo(0.5, 5);
    expect(vertices[1].x).toBeCloseTo(0.15, 5);
    expect(vertices[1].z).toBeCloseTo(-0.5, 5);
    expect(vertices[2].x).toBeCloseTo(-0.15, 5);
    expect(vertices[2].z).toBeCloseTo(-0.5, 5);
  });

  it('rotates a horizontal kicker tip toward the lane center', () => {
    const left = getTriangleVertices(makeKicker(Math.PI / 2));
    const right = getTriangleVertices(makeKicker(-Math.PI / 2));

    expect(left[0].x).toBeCloseTo(0.5, 5);
    expect(right[0].x).toBeCloseTo(-0.5, 5);
  });

  it('returns no collision outside the triangle and ball radius', () => {
    const hit = resolveTriangleCollision(new THREE.Vector3(3, 0.16, 0), 0.16, makeKicker());
    expect(hit).toBeNull();
  });

  it('resolves an outside edge overlap away from the triangle', () => {
    const obstacle = makeKicker();
    const ball = new THREE.Vector3(0, 0.16, 0.58);
    const hit = resolveTriangleCollision(ball, 0.16, obstacle);

    expect(hit).not.toBeNull();
    expect(hit.normal.z).toBeGreaterThan(0);
    expect(hit.resolvedPosition.z).toBeGreaterThan(ball.z);
    expect(hit.hitOffset).toBeGreaterThanOrEqual(-1);
    expect(hit.hitOffset).toBeLessThanOrEqual(1);
  });

  it('pushes a ball inside the triangle beyond the nearest edge', () => {
    const obstacle = makeKicker();
    const hit = resolveTriangleCollision(new THREE.Vector3(0, 0.16, 0), 0.16, obstacle);

    expect(hit).not.toBeNull();
    expect(Math.hypot(hit.resolvedPosition.x, hit.resolvedPosition.z)).toBeGreaterThan(0.15);
  });

  it('produces different normals on different triangle edges', () => {
    const obstacle = makeKicker();
    const top = resolveTriangleCollision(new THREE.Vector3(0, 0.16, 0.58), 0.16, obstacle);
    const left = resolveTriangleCollision(new THREE.Vector3(-0.2, 0.16, -0.42), 0.16, obstacle);

    expect(top).not.toBeNull();
    expect(left).not.toBeNull();
    expect(top.normal.distanceTo(left.normal)).toBeGreaterThan(0.5);
  });

  it('detects a fast ball that crosses the triangle between frames', () => {
    const obstacle = makeKicker();
    const start = new THREE.Vector3(0.05, 0.16, 0.9);
    const end = new THREE.Vector3(0.05, 0.16, -0.9);

    expect(resolveTriangleCollision(start, 0.16, obstacle)).toBeNull();
    expect(resolveTriangleCollision(end, 0.16, obstacle)).toBeNull();

    const hit = resolveSweptTriangleCollision(start, end, 0.16, obstacle);

    expect(hit).not.toBeNull();
    expect(hit.resolvedPosition.z).toBeGreaterThan(-0.9);
  });
});
