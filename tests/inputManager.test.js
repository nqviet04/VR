import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InputManager } from '../src/InputManager.js';

describe('InputManager.finishAim', () => {
  it('keeps an under-threshold ball placed instead of returning it to the shelf', () => {
    const placedPos = new THREE.Vector3(0.2, 0.16, 0.4);
    const ball = new THREE.Object3D();
    ball.position.copy(placedPos);
    ball.userData = {
      state: 'placed',
      velocity: new THREE.Vector3(1, 0, -1)
    };
    const manager = Object.create(InputManager.prototype);
    manager.drag = {
      ball,
      placedPos: placedPos.clone(),
      aimArmed: true,
      aiming: true
    };
    manager._lastAim = { valid: false };
    manager.orbit = { enabled: false };
    manager.resetAimPreview = vi.fn();
    manager.game = {
      balls: {
        setSelectedBall: vi.fn(),
        launchBall: vi.fn()
      },
      hud: { updateHud: vi.fn() },
      currentLevelIndex: 0,
      mode: 'Easy',
      score: { score: 0, correctHits: 0 },
      remainingTime: Infinity
    };

    manager.finishAim();

    expect(ball.userData.state).toBe('placed');
    expect(ball.userData.velocity.length()).toBe(0);
    expect(ball.position.equals(placedPos)).toBe(true);
    expect(manager.drag).not.toBeNull();
    expect(manager.drag.aimArmed).toBe(false);
    expect(manager.drag.aiming).toBe(false);
    expect(manager.game.balls.setSelectedBall).toHaveBeenLastCalledWith(null);
    expect(manager.game.balls.launchBall).not.toHaveBeenCalled();
  });

  it('puts a placed ball back into positioning mode on the first click', () => {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial()
    );
    ball.userData.state = 'placed';
    ball.position.set(0, 0, 0);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const manager = Object.create(InputManager.prototype);
    manager.camera = camera;
    manager.renderer = {
      xr: { isPresenting: false },
      domElement: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
      }
    };
    manager.raycaster = { intersectObjects: vi.fn().mockReturnValue([]) };
    manager.setRaycasterFromEvent = vi.fn();
    manager.drag = {
      ball,
      placedPos: ball.position.clone(),
      aimArmed: false,
      aiming: false,
      startX: 0,
      startY: 0
    };
    manager.orbit = { enabled: true };
    manager.resetAimPreview = vi.fn();
    manager.game = {
      levelRunning: true,
      aimLine: { visible: false },
      balls: { setSelectedBall: vi.fn() },
      audio: { pick: vi.fn() },
      hud: { setAimPower: vi.fn(), updateHud: vi.fn() },
      currentLevelIndex: 0,
      mode: 'Easy',
      score: { score: 0, correctHits: 0 },
      remainingTime: Infinity
    };

    manager.onDesktopPointerDown({ button: 0, clientX: 530, clientY: 500 });

    expect(manager.placing).toMatchObject({ ball, repositioning: true });
    expect(manager.drag).toBeNull();
    expect(manager.orbit.enabled).toBe(false);
    expect(manager.game.aimLine.visible).toBe(false);
    expect(manager.game.hud.setAimPower).not.toHaveBeenCalled();
    expect(manager.game.balls.setSelectedBall).toHaveBeenCalledWith(ball);
  });

  it('arms aiming only after a repositioned ball has been released', () => {
    const ball = new THREE.Object3D();
    ball.userData = { state: 'placed' };
    ball.position.set(0, 0.16, 0.4);

    const manager = Object.create(InputManager.prototype);
    manager.placing = { ball, repositioning: true };
    manager.drag = null;
    manager.isBallInsidePlacementZone = vi.fn().mockReturnValue(true);
    manager.orbit = { enabled: false };
    manager.resetAimPreview = vi.fn();
    manager.game = {
      currentLevelIndex: 0,
      mode: 'Easy',
      score: { score: 0, correctHits: 0 },
      remainingTime: Infinity,
      balls: { setSelectedBall: vi.fn() },
      hud: { updateHud: vi.fn() }
    };

    manager.finishPlacing();

    expect(manager.placing).toBeNull();
    expect(manager.drag).toMatchObject({ ball, aimArmed: true, aiming: false });
    expect(manager.game.balls.setSelectedBall).toHaveBeenCalledWith(null);
  });
});

describe('InputManager Quest controller UI', () => {
  it('moves the XR rig forward with the left thumbstick', () => {
    const rig = new THREE.Group();
    rig.position.set(0, 0, 3.2);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.65, 0);
    rig.add(camera);
    rig.updateMatrixWorld(true);

    const manager = Object.create(InputManager.prototype);
    manager.camera = camera;
    manager.game = { playerRig: rig };
    const left = { gamepad: { axes: [0, 0, 0, -1] } };

    manager.moveXRPlayer(left, 0.5);

    expect(rig.position.z).toBeLessThan(3.2);
    expect(rig.position.x).toBeCloseTo(0);
  });

  it('snap-turns once until the right thumbstick returns to center', () => {
    const rig = new THREE.Group();
    rig.position.set(0, 0, 3.2);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.65, 0);
    rig.add(camera);
    rig.updateMatrixWorld(true);

    const manager = Object.create(InputManager.prototype);
    manager.camera = camera;
    manager.game = { playerRig: rig };
    manager.snapTurnReady = true;
    const right = { gamepad: { axes: [0, 0, 1, 0] } };

    manager.snapTurnXRPlayer(right);
    const firstRotation = rig.rotation.y;
    manager.snapTurnXRPlayer(right);

    expect(firstRotation).not.toBe(0);
    expect(rig.rotation.y).toBe(firstRotation);
  });

  it('activates a VR button before attempting to grab a ball', () => {
    const manager = Object.create(InputManager.prototype);
    const controller = new THREE.Object3D();
    const button = new THREE.Object3D();
    manager.game = {
      vrPanel: { activate: vi.fn().mockReturnValue(true) },
      audio: { startBgm: vi.fn() }
    };
    manager.findControllerVRButton = vi.fn().mockReturnValue(button);
    manager.findControllerBall = vi.fn();
    manager.pulseController = vi.fn();

    manager.onSelectStart(controller, {});

    expect(manager.game.vrPanel.activate).toHaveBeenCalledWith(button);
    expect(manager.findControllerBall).not.toHaveBeenCalled();
  });

  it('allows controller 0 and controller 1 to hover different buttons', () => {
    const manager = Object.create(InputManager.prototype);
    const buttons = [new THREE.Object3D(), new THREE.Object3D()];
    const controllers = [new THREE.Object3D(), new THREE.Object3D()];
    manager.game = {
      vrPanel: {
        setControllerHover: vi.fn().mockReturnValue(true)
      }
    };
    manager.findControllerVRButton = vi.fn((controller) => buttons[controllers.indexOf(controller)]);
    manager.pulseInputSource = vi.fn();

    manager.updateControllerVRHover(controllers[0], 0);
    manager.updateControllerVRHover(controllers[1], 1);

    expect(manager.game.vrPanel.setControllerHover).toHaveBeenNthCalledWith(1, 0, buttons[0]);
    expect(manager.game.vrPanel.setControllerHover).toHaveBeenNthCalledWith(2, 1, buttons[1]);
  });

  it('fires A/X toggle only on the pressed edge', () => {
    const manager = Object.create(InputManager.prototype);
    const controller = new THREE.Object3D();
    controller.userData.buttonPressedState = [];
    manager.controllers = [controller];
    const primary = { pressed: true };
    manager.renderer = {
      xr: {
        getSession: () => ({
          inputSources: [{ gamepad: { buttons: [{}, {}, {}, {}, primary, { pressed: false }] } }]
        })
      }
    };
    manager.game = { vrPanel: { toggle: vi.fn(), closeSecondary: vi.fn() } };
    manager.cancelControllerAction = vi.fn();

    manager.updateGamepadButtons();
    manager.updateGamepadButtons();

    expect(manager.game.vrPanel.toggle).toHaveBeenCalledOnce();
  });

  it('fires B/Y close only on the pressed edge', () => {
    const manager = Object.create(InputManager.prototype);
    const controller = new THREE.Object3D();
    controller.userData.buttonPressedState = [];
    manager.controllers = [controller];
    const secondary = { pressed: true };
    manager.renderer = {
      xr: {
        getSession: () => ({
          inputSources: [{ gamepad: { buttons: [{}, {}, {}, {}, { pressed: false }, secondary] } }]
        })
      }
    };
    manager.game = { vrPanel: { toggle: vi.fn(), closeSecondary: vi.fn().mockReturnValue(true) } };
    manager.cancelControllerAction = vi.fn();

    manager.updateGamepadButtons();
    manager.updateGamepadButtons();

    expect(manager.game.vrPanel.closeSecondary).toHaveBeenCalledOnce();
    expect(manager.cancelControllerAction).not.toHaveBeenCalled();
  });

  it('releaseHeldBalls safely returns held balls before a level rebuild', () => {
    const manager = Object.create(InputManager.prototype);
    const controller = new THREE.Object3D();
    const ball = new THREE.Object3D();
    ball.userData = {
      state: 'held',
      spawn: new THREE.Vector3(1, 2, 3),
      velocity: new THREE.Vector3(4, 5, 6)
    };
    controller.add(ball);
    controller.userData.grabbed = ball;
    manager.controllers = [controller];
    manager.game = {
      scene: new THREE.Scene(),
      mix: { clearMixSlotForBall: vi.fn() }
    };

    manager.releaseHeldBalls();

    expect(controller.userData.grabbed).toBeNull();
    expect(ball.parent).toBe(manager.game.scene);
    expect(ball.userData.state).toBe('ready');
    expect(ball.position.equals(ball.userData.spawn)).toBe(true);
    expect(ball.userData.velocity.length()).toBe(0);
  });

  it('clears controller history when XR visibility is hidden', () => {
    const manager = Object.create(InputManager.prototype);
    manager.controllers = [
      { userData: { history: [{ time: 1 }] } },
      { userData: { history: [{ time: 2 }] } }
    ];

    manager.clearControllerHistory();

    expect(manager.controllers[0].userData.history).toEqual([]);
    expect(manager.controllers[1].userData.history).toEqual([]);
  });
});
