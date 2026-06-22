const STORAGE_KEY = 'vr-color-bowling-scores';

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.correctHits = 0;
  }

  reset() {
    this.score = 0;
    this.correctHits = 0;
  }

  addHit(points = 100) {
    this.score += points;
    this.correctHits += 1;
  }

  getHighScore(level, mode) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data[`${mode}-${level}`] || 0;
    } catch {
      return 0;
    }
  }

  saveScore(level, mode, score) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const key = `${mode}-${level}`;
      if (score > (data[key] || 0)) {
        data[key] = score;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getAllHighScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  resetScores() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
