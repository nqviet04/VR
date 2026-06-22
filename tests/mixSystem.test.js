import { describe, it, expect } from 'vitest';
import { MIX_RECIPES } from '../src/constants.js';

// Test the pure recipe lookup logic (same as MixSystem.getMixResultId)
function getMixResultId(a, b) {
  const key = [a, b].sort().join('+');
  return MIX_RECIPES.get(key) || null;
}

describe('getMixResultId', () => {
  it('returns orange for red+yellow', () => {
    expect(getMixResultId('red', 'yellow')).toBe('orange');
  });

  it('returns orange for yellow+red (order independent)', () => {
    expect(getMixResultId('yellow', 'red')).toBe('orange');
  });

  it('returns green for blue+yellow', () => {
    expect(getMixResultId('blue', 'yellow')).toBe('green');
  });

  it('returns purple for blue+red', () => {
    expect(getMixResultId('blue', 'red')).toBe('purple');
  });

  it('returns tint for color+white', () => {
    expect(getMixResultId('red', 'white')).toBe('red-tint');
    expect(getMixResultId('white', 'red')).toBe('red-tint');
  });

  it('returns null for invalid combo', () => {
    expect(getMixResultId('red', 'red')).toBeNull();
    expect(getMixResultId('orange', 'green')).toBeNull();
    expect(getMixResultId('white', 'white')).toBeNull();
  });

  it('returns tertiary for primary+secondary combos', () => {
    expect(getMixResultId('orange', 'red')).toBe('red-orange');
    expect(getMixResultId('green', 'yellow')).toBe('yellow-green');
    expect(getMixResultId('purple', 'blue')).toBe('blue-purple');
  });

  it('all 15 recipes produce valid results', () => {
    for (const [key, value] of MIX_RECIPES) {
      const [a, b] = key.split('+');
      expect(getMixResultId(a, b)).toBe(value);
      expect(getMixResultId(b, a)).toBe(value);
    }
  });
});
