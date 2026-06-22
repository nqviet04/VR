import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreManager } from '../src/ScoreManager.js';

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('ScoreManager', () => {
  let score;

  beforeEach(() => {
    localStorageMock.clear();
    score = new ScoreManager();
  });

  it('starts with zero score and hits', () => {
    expect(score.score).toBe(0);
    expect(score.correctHits).toBe(0);
  });

  it('addHit increments score and hits', () => {
    score.addHit(100);
    expect(score.score).toBe(100);
    expect(score.correctHits).toBe(1);

    score.addHit(100);
    expect(score.score).toBe(200);
    expect(score.correctHits).toBe(2);
  });

  it('reset clears score and hits', () => {
    score.addHit(100);
    score.addHit(100);
    score.reset();
    expect(score.score).toBe(0);
    expect(score.correctHits).toBe(0);
  });

  it('getHighScore returns 0 when no saved data', () => {
    expect(score.getHighScore(1, 'Easy')).toBe(0);
  });

  it('saveScore persists high score', () => {
    const isNew = score.saveScore(1, 'Easy', 300);
    expect(isNew).toBe(true);
    expect(score.getHighScore(1, 'Easy')).toBe(300);
  });

  it('saveScore does not overwrite higher score', () => {
    score.saveScore(1, 'Easy', 300);
    const isNew = score.saveScore(1, 'Easy', 200);
    expect(isNew).toBe(false);
    expect(score.getHighScore(1, 'Easy')).toBe(300);
  });

  it('saveScore overwrites lower score', () => {
    score.saveScore(1, 'Easy', 200);
    const isNew = score.saveScore(1, 'Easy', 400);
    expect(isNew).toBe(true);
    expect(score.getHighScore(1, 'Easy')).toBe(400);
  });

  it('tracks separate scores per level and mode', () => {
    score.saveScore(1, 'Easy', 100);
    score.saveScore(1, 'Hard', 200);
    score.saveScore(2, 'Easy', 300);

    expect(score.getHighScore(1, 'Easy')).toBe(100);
    expect(score.getHighScore(1, 'Hard')).toBe(200);
    expect(score.getHighScore(2, 'Easy')).toBe(300);
    expect(score.getHighScore(2, 'Hard')).toBe(0);
  });

  it('getAllHighScores returns all saved data', () => {
    score.saveScore(1, 'Easy', 100);
    score.saveScore(2, 'Hard', 200);
    const all = score.getAllHighScores();
    expect(all['Easy-1']).toBe(100);
    expect(all['Hard-2']).toBe(200);
  });

  it('resetScores clears all data', () => {
    score.saveScore(1, 'Easy', 100);
    score.saveScore(2, 'Hard', 200);
    score.resetScores();
    expect(score.getHighScore(1, 'Easy')).toBe(0);
    expect(score.getHighScore(2, 'Hard')).toBe(0);
  });
});
