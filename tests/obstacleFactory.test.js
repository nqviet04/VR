import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/constants.js';
import {
  createObstacleMesh,
  triggerKickerBounce,
  updateObstacleAnimations
} from '../src/ObstacleFactory.js';

describe('createObstacleMesh', () => {
  it('creates a peg mesh with matching placement and metadata', () => {
    const item = { type: 'peg', x: -0.4, z: -2.2, radius: 0.12, bounce: 0.75 };

    const mesh = createObstacleMesh(item);

    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.position.x).toBeCloseTo(item.x, 5);
    expect(mesh.position.z).toBeCloseTo(item.z, 5);
    expect(mesh.position.y).toBeCloseTo(LAYOUT.floorY + 0.04, 5);
    expect(mesh.userData).toEqual({
      obstacleType: 'peg',
      radius: 0.12,
      bounce: 0.75
    });
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(mesh.geometry.parameters.radiusTop).toBeCloseTo(0.12, 5);
  });

  it('makes bumpers and pegs flat and makes bumpers more emissive', () => {
    const peg = createObstacleMesh({ type: 'peg', x: 0, z: 0, radius: 0.12, bounce: 0.75 });
    const bumper = createObstacleMesh({ type: 'bumper', x: 0, z: 0, radius: 0.12, bounce: 0.75 });
    const bumperBody = bumper.getObjectByName('bumper-body');

    expect(bumperBody.geometry.parameters.height).toBeCloseTo(0.08, 5);
    expect(peg.geometry.parameters.height).toBeCloseTo(0.08, 5);
    expect(bumperBody.material.emissiveIntensity).toBeGreaterThan(peg.material.emissiveIntensity);
    expect(bumper.userData.obstacleType).toBe('bumper');
  });

  it('creates a red bumper with a white five-point star on top', () => {
    const bumper = createObstacleMesh({
      type: 'bumper',
      x: 0,
      z: -3,
      radius: 0.16,
      bounce: 1.2
    });
    const star = bumper.getObjectByName('bumper-star');

    expect(bumper).toBeInstanceOf(THREE.Group);
    expect(bumper.userData.obstacleType).toBe('bumper');
    expect(bumper.userData.radius).toBeCloseTo(0.16, 5);
    expect(star).toBeInstanceOf(THREE.Mesh);
    expect(star.geometry.getAttribute('position').count).toBeGreaterThanOrEqual(10);
    expect(star.material.color.getHex()).toBe(0xfff4d6);
    expect(star.position.y).toBeGreaterThan(0.08);
  });

  it('creates a solid triangle boomerang with inset face, border and star', () => {
    const boomerang = createObstacleMesh({
      type: 'boomerang',
      x: -0.5,
      z: -4.8,
      mirror: -1,
      angle: Math.PI / 6,
      bounce: 0.82
    });

    expect(boomerang).toBeInstanceOf(THREE.Group);
    expect(boomerang.getObjectByName('boomerang-base')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.getObjectByName('boomerang-face')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.getObjectByName('boomerang-border-0')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.getObjectByName('boomerang-border-1')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.getObjectByName('boomerang-border-2')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.getObjectByName('boomerang-star')).toBeInstanceOf(THREE.Mesh);
    expect(boomerang.userData).toMatchObject({
      obstacleType: 'boomerang',
      bounce: 0.82
    });
    expect(boomerang.userData.vertices).toHaveLength(3);
    boomerang.userData.vertices.forEach((vertex) => {
      expect(vertex).toHaveProperty('x');
      expect(vertex).toHaveProperty('z');
    });
    expect(boomerang.userData.cornerRadius).toBeCloseTo(0.035, 5);

    const [tip, upperBase, lowerBase] = boomerang.userData.vertices
      .map(({ x, z }) => new THREE.Vector2(x, z));
    const upperEdge = upperBase.clone().sub(tip);
    const lowerEdge = lowerBase.clone().sub(tip);
    const apexAngle = upperEdge.angleTo(lowerEdge);

    expect(THREE.MathUtils.radToDeg(apexAngle)).toBeCloseTo(120, 1);
    expect(upperEdge.length()).toBeCloseTo(lowerEdge.length(), 5);

    const base = boomerang.getObjectByName('boomerang-base');
    expect(base.geometry.getAttribute('position').count).toBeGreaterThan(18);
    base.geometry.computeBoundingBox();
    const baseSize = new THREE.Vector3();
    base.geometry.boundingBox.getSize(baseSize);
    expect(baseSize.z).toBeGreaterThanOrEqual(0.48);

    const centroidX = boomerang.userData.vertices
      .reduce((sum, vertex) => sum + vertex.x, 0) / 3;
    const star = boomerang.getObjectByName('boomerang-star');
    expect(star.position.x).toBeCloseTo(centroidX, 5);
    expect(star.position.z).toBeCloseTo(0, 5);

    const worldVertices = boomerang.userData.vertices.map(({ x, z }) =>
      new THREE.Vector3(x, 0, z).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        boomerang.rotation.y
      )
    );
    const [worldTip, worldUpperBase, worldLowerBase] = worldVertices;
    const baseMidZ = (worldUpperBase.z + worldLowerBase.z) * 0.5;
    const shortEdges = [
      worldUpperBase.clone().sub(worldTip),
      worldLowerBase.clone().sub(worldTip)
    ];
    expect(worldTip.z).toBeGreaterThan(baseMidZ);
    expect(Math.min(...shortEdges.map((edge) => Math.abs(edge.x)))).toBeCloseTo(0, 5);
  });

  it('creates a pachinko kicker assembly with hinge, rubber rails and physics metadata', () => {
    const kicker = createObstacleMesh({
      type: 'kicker',
      x: 0,
      z: -3,
      radius: 0.18,
      length: 0.52,
      width: 0.16,
      angle: Math.PI / 6,
      bounce: 1.22,
      kick: 1.8
    });

    expect(kicker).toBeInstanceOf(THREE.Group);
    expect(kicker.rotation.y).toBeCloseTo(Math.PI / 6, 5);
    expect(kicker.userData).toMatchObject({
      obstacleType: 'kicker',
      radius: 0.18,
      length: 0.52,
      width: 0.16,
      height: 0.055,
      angle: Math.PI / 6,
      bounce: 1.22,
      kick: 1.8
    });
    expect(kicker.getObjectByName('kicker-body')).toBeInstanceOf(THREE.Mesh);
    expect(kicker.getObjectByName('kicker-rubber-left')).toBeInstanceOf(THREE.Mesh);
    expect(kicker.getObjectByName('kicker-rubber-right')).toBeInstanceOf(THREE.Mesh);
    expect(kicker.getObjectByName('kicker-hinge')).toBeInstanceOf(THREE.Mesh);
    expect(kicker.getObjectByName('kicker-tip')).toBeInstanceOf(THREE.Mesh);
    expect(kicker.userData.kickerVisual).toBeInstanceOf(THREE.Group);

    const body = kicker.getObjectByName('kicker-body');
    body.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    body.geometry.boundingBox.getSize(size);
    expect(size.z).toBeCloseTo(0.52, 5);
    expect(size.x).toBeCloseTo(0.16, 5);
    expect(size.y).toBeCloseTo(0.055, 5);
    expect(size.z / size.x).toBeGreaterThan(3);
  });

  it('animates a triggered kicker with a damped spring and light flash', () => {
    const kicker = createObstacleMesh({
      type: 'kicker',
      x: 0,
      z: -3,
      radius: 0.18,
      angle: 0,
      bounce: 1.22,
      kick: 1.8
    });
    const visual = kicker.userData.kickerVisual;
    const body = kicker.getObjectByName('kicker-body');
    const restingEmissive = body.material.emissiveIntensity;

    triggerKickerBounce(kicker, 1);
    updateObstacleAnimations([kicker], 0.016);

    expect(Math.abs(visual.rotation.y)).toBeGreaterThan(0);
    expect(visual.scale.z).toBeLessThan(1);
    expect(body.material.emissiveIntensity).toBeGreaterThan(restingEmissive);

    for (let frame = 0; frame < 240; frame += 1) {
      updateObstacleAnimations([kicker], 1 / 60);
    }

    expect(visual.rotation.y).toBeCloseTo(0, 2);
    expect(visual.scale.z).toBeCloseTo(1, 2);
    expect(body.material.emissiveIntensity).toBeCloseTo(restingEmissive, 2);
  });
});
