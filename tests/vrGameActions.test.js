import { describe, expect, it, vi } from 'vitest';
import { MODE } from '../src/constants.js';
import { VRColorBowling } from '../src/VRColorBowling.js';

function makeGame() {
  const game = Object.create(VRColorBowling.prototype);
  Object.assign(game, {
    mode: MODE.EASY,
    currentLevelIndex: 0,
    unlockedLevel: 1,
    remainingTime: Infinity,
    levelRunning: true,
    levelTransitionTimer: null,
    renderer: { xr: { isPresenting: true, getSession: vi.fn().mockReturnValue(null) } },
    _availableLevels: [],
    score: { score: 0, correctHits: 0, saveScore: vi.fn() },
    hud: {
      lastStatus: 'Sẵn sàng',
      hideVictoryOverlay: vi.fn(),
      showVictoryOverlay: vi.fn(),
      updateHud: vi.fn()
    },
    audio: {
      stopRolling: vi.fn(),
      startBgm: vi.fn(),
      win: vi.fn(),
      lose: vi.fn()
    },
    input: {
      releaseHeldBalls: vi.fn(),
      clearControllerHistory: vi.fn()
    },
    vrPanel: {
      showMenu: vi.fn(),
      showPlaying: vi.fn(),
      showTimeout: vi.fn(),
      showVictory: vi.fn(),
      update: vi.fn(),
      placeInFrontOfCamera: vi.fn(),
      clearHover: vi.fn(),
      group: { visible: false }
    },
    startLevel: vi.fn(function startLevel(levelId) {
      this.currentLevelIndex = levelId - 1;
      this.levelRunning = true;
    }),
    cancelLevelTransition: vi.fn()
  });
  return game;
}

describe('VRColorBowling shared actions', () => {
  it('startMode starts level 1 and enters playing panel mode', () => {
    const game = makeGame();

    game.startMode(MODE.HARD);

    expect(game.mode).toBe(MODE.HARD);
    expect(game.unlockedLevel).toBe(1);
    expect(game.startLevel).toHaveBeenCalledWith(1);
    expect(game.vrPanel.showPlaying).toHaveBeenCalledOnce();
  });

  it('goToNextLevel refuses locked levels', () => {
    const game = makeGame();
    game.mode = MODE.HARD;
    game._availableLevels = [{ id: 1 }, { id: 2 }];
    game.unlockedLevel = 1;

    expect(game.goToNextLevel()).toBe(false);
    expect(game.startLevel).not.toHaveBeenCalled();
  });

  it('goToNextLevel starts an unlocked next level', () => {
    const game = makeGame();
    game.mode = MODE.HARD;
    game._availableLevels = [{ id: 1 }, { id: 2 }];
    game.unlockedLevel = 2;

    expect(game.goToNextLevel()).toBe(true);
    expect(game.startLevel).toHaveBeenCalledWith(2);
  });

  it('resetProgress releases held balls and restarts level 1', () => {
    const game = makeGame();
    game.unlockedLevel = 4;

    game.resetProgress();

    expect(game.input.releaseHeldBalls).toHaveBeenCalledOnce();
    expect(game.unlockedLevel).toBe(1);
    expect(game.startLevel).toHaveBeenCalledWith(1);
  });

  it('playAgain restarts from level 1', () => {
    const game = makeGame();
    game.unlockedLevel = 5;

    game.playAgain();

    expect(game.unlockedLevel).toBe(1);
    expect(game.startLevel).toHaveBeenCalledWith(1);
  });

  it('XR session start opens the VR mode menu', () => {
    const game = makeGame();

    game.onXRSessionStart();

    expect(game.levelRunning).toBe(false);
    expect(game.input.releaseHeldBalls).toHaveBeenCalledOnce();
    expect(game.vrPanel.showMenu).toHaveBeenCalledOnce();
    expect(game.vrPanel.placeInFrontOfCamera).toHaveBeenCalledOnce();
  });

  it('timeout opens the matching VR result panel', () => {
    const game = makeGame();
    game.onTimeUp();

    expect(game.vrPanel.showTimeout).toHaveBeenCalledOnce();
  });

  it('victory opens the matching VR result panel', () => {
    const game = makeGame();
    game._availableLevels = [{ id: 1 }];

    game.onLevelCompleted();

    expect(game.vrPanel.showVictory).toHaveBeenCalledOnce();
  });
});
