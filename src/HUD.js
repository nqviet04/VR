import { LEVELS } from './constants.js';

export class HUD {
  constructor() {
    this.ui = {
      level: document.getElementById('levelLabel'),
      mode: document.getElementById('modeLabel'),
      timer: document.getElementById('timerLabel'),
      status: document.getElementById('statusLabel'),
      powerMeter: document.getElementById('powerMeter'),
      powerFill: document.getElementById('powerMeterFill'),
      powerValue: document.getElementById('powerMeterValue'),
      easyBtn: document.getElementById('easyBtn'),
      hardBtn: document.getElementById('hardBtn'),
      nextBtn: document.getElementById('nextBtn'),
      resetBtn: document.getElementById('resetBtn'),
      victoryOverlay: document.getElementById('victoryOverlay'),
      playAgainBtn: document.getElementById('playAgainBtn')
    };
  }

  updateStatus(text) {
    this.lastStatus = text;
    this.ui.status.textContent = text;
  }

  renderLabels(levelIndex, mode, score, correctHits, remainingTime) {
    const level = LEVELS[levelIndex];
    const total = this.getLevelTotal(level);
    this.ui.level.textContent = `Level: ${level.label}`;
    this.ui.mode.textContent = `Mode: ${mode} | Score: ${score} | Hit: ${correctHits}/${total}`;

    if (remainingTime !== Infinity && remainingTime !== undefined) {
      this.ui.timer.textContent = `Time: ${Math.ceil(Math.max(remainingTime, 0))}`;
    } else {
      this.ui.timer.textContent = 'Time: Unlimited';
    }
  }

  getLevelTotal(level) {
    if (level.targetColorIds) return level.targetColorIds.length;
    return 3;
  }

  updateHud(text, levelIndex, mode, score, correctHits, remainingTime) {
    this.updateStatus(text);
    this.renderLabels(levelIndex, mode, score, correctHits, remainingTime);
  }

  setAimPower(ratio, colorHex = 0x39e4ff) {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    this.ui.powerMeter.classList.add('show');
    this.ui.powerMeter.setAttribute('aria-hidden', 'false');
    this.ui.powerFill.style.height = `${Math.round(clamped * 100)}%`;
    this.ui.powerFill.style.background = `linear-gradient(180deg, #ffffff 0%, ${this.hexToCss(colorHex)} 100%)`;
    this.ui.powerValue.textContent = `${Math.round(clamped * 100)}%`;
  }

  hideAimPower() {
    this.ui.powerMeter.classList.remove('show');
    this.ui.powerMeter.setAttribute('aria-hidden', 'true');
    this.ui.powerFill.style.height = '0%';
    this.ui.powerValue.textContent = '0%';
  }

  hexToCss(hex) {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }

  showVictoryOverlay() {
    this.ui.victoryOverlay.classList.add('show');
    this.ui.victoryOverlay.setAttribute('aria-hidden', 'false');
  }

  hideVictoryOverlay() {
    this.ui.victoryOverlay.classList.remove('show');
    this.ui.victoryOverlay.setAttribute('aria-hidden', 'true');
  }

}
