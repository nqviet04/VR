import { describe, expect, it, vi } from 'vitest';
import { VRPanel } from '../src/VRPanel.js';

function createPanel(onAction = vi.fn()) {
  return new VRPanel(null, null, onAction, { createVisuals: false });
}

describe('VRPanel', () => {
  it('shows Easy and Hard actions in menu mode', () => {
    const panel = createPanel();

    panel.showMenu();

    expect(panel.getVisibleButtonIds()).toEqual(['easy', 'hard']);
  });

  it('disables next level when no unlocked next level exists', () => {
    const panel = createPanel();

    panel.showPlaying();
    panel.update({ hasNextUnlocked: false });

    expect(panel.getButton('next').enabled).toBe(false);
    expect(panel.getInteractiveObjects()).not.toContain(panel.getButton('next').object);
  });

  it('dispatches the selected enabled action once', () => {
    const onAction = vi.fn();
    const panel = createPanel(onAction);
    panel.showMenu();

    expect(panel.activate('easy')).toBe(true);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('easy');
  });

  it('does not dispatch a disabled action', () => {
    const onAction = vi.fn();
    const panel = createPanel(onAction);
    panel.showPlaying();
    panel.update({ hasNextUnlocked: false });

    expect(panel.activate('next')).toBe(false);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('keeps independent hover state for controller 0 and 1', () => {
    const panel = createPanel();
    panel.showMenu();

    panel.setControllerHover(0, panel.getButton('easy').object);
    panel.setControllerHover(1, panel.getButton('hard').object);

    expect(panel.getControllerHover(0)).toBe('easy');
    expect(panel.getControllerHover(1)).toBe('hard');
  });

  it('does not mark the texture dirty for an unchanged snapshot', () => {
    const panel = createPanel();
    const snapshot = {
      levelLabel: 'Level 1',
      mode: 'Easy',
      score: 0,
      correctHits: 0,
      totalTargets: 3,
      remainingTime: Infinity,
      status: 'Sẵn sàng',
      hasNextUnlocked: false
    };

    panel.update(snapshot);
    panel.consumeDirty();
    panel.update({ ...snapshot });

    expect(panel.consumeDirty()).toBe(false);
  });
});
