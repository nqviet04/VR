import { describe, it, expect } from 'vitest';
import { computeAim, predictParabola, powerColor } from '../src/aimMath.js';
import { AIM } from '../src/constants.js';

describe('computeAim', () => {
  it('marks drags shorter than minDragPx as invalid', () => {
    const r = computeAim(0, AIM.minDragPx - 5);
    expect(r.valid).toBe(false);
  });

  it('uses a 5 percent dead zone', () => {
    const below = computeAim(0, AIM.pixelsForMaxPower * 0.049);
    const threshold = computeAim(0, AIM.pixelsForMaxPower * 0.05);

    expect(below.valid).toBe(false);
    expect(threshold.valid).toBe(true);
  });

  it('produces straight shot (direction 0) when dx is 0', () => {
    const r = computeAim(0, 120);
    expect(r.valid).toBe(true);
    expect(r.directionRad).toBeCloseTo(0, 5);
  });

  it('positive dx aims to one side, negative dx to the other', () => {
    const right = computeAim(100, 120);
    const left = computeAim(-100, 120);
    expect(Math.sign(right.directionRad)).toBe(-Math.sign(left.directionRad));
    expect(right.directionRad).not.toBeCloseTo(0, 5);
  });

  it('clamps direction to +/- maxDirDeg', () => {
    const r = computeAim(100000, 120);
    const maxRad = (AIM.maxDirDeg * Math.PI) / 180;
    expect(Math.abs(r.directionRad)).toBeLessThanOrEqual(maxRad + 1e-6);
  });

  it('clamps power to maxPower for very long drags', () => {
    const r = computeAim(0, 100000);
    expect(r.power).toBeCloseTo(AIM.maxPower, 5);
  });

  it('uses minPower at the active threshold', () => {
    const r = computeAim(0, AIM.pixelsForMaxPower * 0.05);
    expect(r.power).toBeGreaterThanOrEqual(AIM.minPower);
    expect(r.power).toBeCloseTo(AIM.minPower, 5);
  });

  it('creates a much wider difference between 11 percent and max power', () => {
    const low = computeAim(0, AIM.pixelsForMaxPower * 0.11);
    const max = computeAim(0, AIM.pixelsForMaxPower);

    expect(low.valid).toBe(true);
    expect(max.power / low.power).toBeGreaterThan(4);
  });
});

describe('predictParabola', () => {
  it('returns the configured number of 3D points', () => {
    const pts = predictParabola(0, 10);
    expect(pts.length).toBe(AIM.trajectoryPoints);
    expect(pts[0]).toHaveProperty('x');
    expect(pts[0]).toHaveProperty('y');
    expect(pts[0]).toHaveProperty('z');
  });

  it('moves the ball forward (decreasing z) over time', () => {
    const pts = predictParabola(0, 10);
    expect(pts[pts.length - 1].z).toBeLessThan(pts[0].z);
  });
});

describe('powerColor', () => {
  it('returns a numeric hex color that changes with power ratio', () => {
    const low = powerColor(0);
    const high = powerColor(1);
    expect(typeof low).toBe('number');
    expect(typeof high).toBe('number');
    expect(low).not.toBe(high);
  });
});
