import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { LEVELS, MODE, LAYOUT, AIM, getLevelRuntimeConfig, getAvailableLevels } from './constants.js';
import { AudioEngine } from './AudioEngine.js';
import { ParticlePool } from './ParticlePool.js';
import { BallManager } from './BallManager.js';
import { TargetManager } from './TargetManager.js';
import { MixSystem } from './MixSystem.js';
import { InputManager } from './InputManager.js';
import { ScoreManager } from './ScoreManager.js';
import { HUD } from './HUD.js';
import { VRPanel } from './VRPanel.js';
import { createObstacleMesh, updateObstacleAnimations } from './ObstacleFactory.js';

export class VRColorBowling {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10121d);
    this.scene.fog = new THREE.Fog(0x10121d, 8, 18);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 60);
    this.camera.position.set(0, 1.65, 4.2);

    this.playerRig = new THREE.Group();
    this.playerRig.name = 'xr-player-rig';
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.clock = new THREE.Clock();

    this.mode = MODE.EASY;
    this.currentLevelIndex = 0;
    this.unlockedLevel = 1;
    this.remainingTime = Infinity;
    this.levelRunning = false;
    this.levelTransitionTimer = null;
    this.obstacleObjects = [];
    this._availableLevels = getAvailableLevels(this.mode);

    // Initialize subsystems
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.vrPanel = new VRPanel(this.scene, this.camera, (action) => this.handleVRAction(action));
    this.score = new ScoreManager();
    this.particles = new ParticlePool(this.scene);
    this.balls = new BallManager(this.scene, this);
    this.targets = new TargetManager(this.scene, this);
    this.mix = new MixSystem(this.scene, this);
    this.input = new InputManager(this.renderer, this.camera, this);

    this.setupWorld();
    this.bindUI();
    this.startLevel(1);

    window.addEventListener('resize', () => this.onResize());
    this.renderer.xr.addEventListener('sessionstart', () => this.onXRSessionStart());
    this.renderer.xr.addEventListener('sessionend', () => this.onXRSessionEnd());
    this.renderer.setAnimationLoop(() => this.animate());
  }

  setupWorld() {
    this.scene.add(new THREE.HemisphereLight(0x6fe7ff, 0x2b1f30, 1.05));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(2.5, 5, 2.5);
    this.scene.add(keyLight);

    const neonA = new THREE.PointLight(0xff2bd6, 1.7, 8);
    neonA.position.set(-2.6, 2.2, -2.2);
    this.scene.add(neonA);

    const neonB = new THREE.PointLight(0x34d7ff, 1.5, 8);
    neonB.position.set(2.7, 1.8, -5.5);
    this.scene.add(neonB);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, LAYOUT.floorLength),
      new THREE.MeshStandardMaterial({ color: 0x1f2232, roughness: 0.88, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.set(0, LAYOUT.floorY - 0.018, LAYOUT.floorCenterZ);
    this.scene.add(floor);

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(LAYOUT.laneWidth, 0.08, LAYOUT.laneLength),
      new THREE.MeshStandardMaterial({ color: 0xc58b4a, roughness: 0.42, metalness: 0.05 })
    );
    lane.position.set(0, LAYOUT.floorY - 0.04, (LAYOUT.laneStartZ + LAYOUT.laneEndZ) * 0.5);
    this.scene.add(lane);

    this.addLaneStripes();
    this.addBallReturn();
    this.mix.addMixBox();
    this.addAimGuide();
    this.addBackWall();
  }

  addLaneStripes() {
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.34 });
    [-0.72, -0.36, 0, 0.36, 0.72].forEach((x) => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.012, LAYOUT.laneLength - 0.5),
        stripeMat
      );
      stripe.position.set(x, LAYOUT.floorY + 0.012, -3.35);
      this.scene.add(stripe);
    });

    const foul = new THREE.Mesh(
      new THREE.BoxGeometry(LAYOUT.laneWidth, 0.014, LAYOUT.startLineDepth),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8 })
    );
    foul.position.set(0, LAYOUT.floorY + 0.018, LAYOUT.startLineZ);
    this.scene.add(foul);
  }

  addBallReturn() {
    this.addBallShelf(LAYOUT.returnOrigin, [4], 0x39e4ff);
    this.addBallShelf(LAYOUT.resultReturnOrigin, LAYOUT.resultShelfRowSlots, 0xffd24a, LAYOUT.resultShelfSlotSpacingX);
  }

  addBallShelf(origin, rowSlots, glowColor, slotSpacingX = LAYOUT.returnSlotSpacingX) {
    const ox = origin.x;
    const oy = origin.y;
    const r = LAYOUT.ballRadius;
    const maxColumns = Math.max(...rowSlots);
    const rackWidth = slotSpacingX * (maxColumns - 1) + r * 2 + 0.4;
    const rackDepth = 0.62 + LAYOUT.returnSlotSpacingZ * (rowSlots.length - 1);
    const baseZ = origin.z - LAYOUT.returnSlotSpacingZ * (rowSlots.length - 1) * 0.5;

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 0.55, metalness: 0.38 });
    const troughMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.4 });
    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.45 });

    // Đế hộp
    const base = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 0.18, rackDepth), baseMat);
    base.position.set(ox, oy - r - 0.05, baseZ);
    this.scene.add(base);

    const troughRadius = r * 1.55;
    for (let row = 0; row < rowSlots.length; row += 1) {
      const columns = rowSlots[row];
      const rowWidth = slotSpacingX * (columns - 1) + r * 2 + 0.4;
      const rowZ = origin.z - (rowSlots.length - 1 - row) * LAYOUT.returnSlotSpacingZ;

      // Lòng máng cong lõm (nửa dưới cylinder nằm ngang theo X)
      const trough = new THREE.Mesh(
        new THREE.CylinderGeometry(troughRadius, troughRadius, rowWidth, 28, 1, true, 0, Math.PI),
        troughMat.clone()
      );
      trough.rotation.z = -Math.PI * 0.5; // trục cylinder dọc theo X, phần đặc nằm dưới (lòng máng lõm lên)
      trough.position.set(ox, oy - r + troughRadius, rowZ);
      this.scene.add(trough);

      // Gờ sau (cao) + gờ trước (thấp)
      const railBack = new THREE.Mesh(new THREE.BoxGeometry(rowWidth, r * 1.1, 0.05), railMat.clone());
      railBack.position.set(ox, oy, rowZ - troughRadius);
      this.scene.add(railBack);

      const railFront = new THREE.Mesh(new THREE.BoxGeometry(rowWidth, r * 0.55, 0.05), railMat.clone());
      railFront.position.set(ox, oy - r * 0.3, rowZ + troughRadius);
      this.scene.add(railFront);
    }

    const glow = new THREE.Mesh(new THREE.BoxGeometry(rackWidth * 0.85, 0.03, 0.04), glowMat);
    glow.position.set(ox, oy - r - 0.02, origin.z + 0.31);
    this.scene.add(glow);
  }

  addAimGuide() {
    const pointCount = AIM.trajectoryPoints;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3));
    const material = new THREE.LineDashedMaterial({
      color: 0x39e4ff,
      transparent: true,
      opacity: 0.9,
      dashSize: 0.2,
      gapSize: 0.1
    });

    this.aimLine = new THREE.Line(geometry, material);
    this.aimLine.visible = false;
    this.aimLine.userData.pointCount = pointCount;
    this.scene.add(this.aimLine);

    const arrowGeo = new THREE.ConeGeometry(0.06, 0.2, 12);
    arrowGeo.translate(0, 0.1, 0);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x39e4ff, transparent: true, opacity: 0.9 });
    this.aimArrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);
  }

  addBackWall() {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.6, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x171923, roughness: 0.7, metalness: 0.12 })
    );
    wall.position.set(0, 0.75, -7.75);
    this.scene.add(wall);

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: 0xff2bd6 })
    );
    glow.position.set(0, 1.5, -7.66);
    this.scene.add(glow);
  }

  buildBumpers(cfg) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x31394a,
      roughness: 0.5,
      metalness: 0.35,
      emissive: 0x101626
    });

    [-1, 1].forEach((side) => {
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, cfg.bumperHeight, LAYOUT.laneLength),
        mat.clone()
      );
      bumper.position.set(
        side * (LAYOUT.laneWidth * 0.5 + 0.08),
        LAYOUT.floorY + cfg.bumperHeight * 0.5,
        (LAYOUT.laneStartZ + LAYOUT.laneEndZ) * 0.5
      );
      bumper.userData.side = side;
      group.add(bumper);
    });

    this.scene.add(group);
    this.bumperGroup = group;
  }

  buildObstacles(cfg) {
    cfg.obstacles.forEach((item) => {
      const obstacle = createObstacleMesh(item);
      this.scene.add(obstacle);
      this.obstacleObjects.push(obstacle);
    });
  }

  bindUI() {
    this.hud.ui.easyBtn.addEventListener('click', () => this.startMode(MODE.EASY));
    this.hud.ui.hardBtn.addEventListener('click', () => this.startMode(MODE.HARD));
    this.hud.ui.nextBtn.addEventListener('click', () => this.goToNextLevel());
    this.hud.ui.resetBtn.addEventListener('click', () => this.resetProgress());
    this.hud.ui.playAgainBtn.addEventListener('click', () => this.playAgain());

    const unlockAudio = () => {
      this.audio.startBgm();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
  }

  startMode(mode) {
    if (mode !== MODE.EASY && mode !== MODE.HARD) return false;
    this.releaseHeldControllerBalls();
    this.mode = mode;
    this._availableLevels = getAvailableLevels(mode);
    this.unlockedLevel = 1;
    this.hud.hideVictoryOverlay();
    this.startLevel(1);
    if (this.isXRPresenting()) {
      this.vrPanel.showPlaying();
      this.vrPanel.placeInFrontOfCamera();
    }
    this.audio.startBgm();
    this.syncVRPanel();
    return true;
  }

  getNextAvailableLevel() {
    const currentLevelId = this.currentLevelIndex + 1;
    const currentPos = this._availableLevels.findIndex((level) => level.id === currentLevelId);
    return currentPos >= 0 ? this._availableLevels[currentPos + 1] || null : null;
  }

  goToNextLevel() {
    const nextLevel = this.getNextAvailableLevel();
    if (!nextLevel) {
      this.hud.updateHud('Bạn đang ở level cuối.',
        this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
      this.syncVRPanel();
      return false;
    }
    if (nextLevel.id > this.unlockedLevel) {
      this.hud.updateHud('Level tiếp theo chưa mở khóa.',
        this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
      this.syncVRPanel();
      return false;
    }
    this.releaseHeldControllerBalls();
    this.hud.hideVictoryOverlay();
    this.startLevel(nextLevel.id);
    if (this.isXRPresenting()) this.vrPanel.showPlaying();
    this.syncVRPanel();
    return true;
  }

  resetProgress() {
    this.releaseHeldControllerBalls();
    this.unlockedLevel = 1;
    this.hud.hideVictoryOverlay();
    this.startLevel(1);
    if (this.isXRPresenting()) this.vrPanel.showPlaying();
    this.hud.updateHud('Đã reset về Level 1.', this.currentLevelIndex, this.mode,
      this.score.score, this.score.correctHits, this.remainingTime);
    this.syncVRPanel();
    return true;
  }

  retryCurrentLevel() {
    this.releaseHeldControllerBalls();
    this.hud.hideVictoryOverlay();
    this.startLevel(this.currentLevelIndex + 1);
    if (this.isXRPresenting()) this.vrPanel.showPlaying();
    this.syncVRPanel();
    return true;
  }

  playAgain() {
    this.releaseHeldControllerBalls();
    this.unlockedLevel = 1;
    this.hud.hideVictoryOverlay();
    this.startLevel(1);
    if (this.isXRPresenting()) this.vrPanel.showPlaying();
    this.syncVRPanel();
    return true;
  }

  changeMode() {
    this.releaseHeldControllerBalls();
    this.cancelLevelTransition();
    this.levelRunning = false;
    this.audio.stopRolling();
    this.vrPanel.showMenu();
    this.vrPanel.placeInFrontOfCamera();
    this.syncVRPanel();
    return true;
  }

  handleVRAction(action) {
    const actions = {
      easy: () => this.startMode(MODE.EASY),
      hard: () => this.startMode(MODE.HARD),
      next: () => this.goToNextLevel(),
      reset: () => this.resetProgress(),
      retry: () => this.retryCurrentLevel(),
      playAgain: () => this.playAgain(),
      changeMode: () => this.changeMode()
    };
    if (!actions[action]) return false;
    this.audio.startBgm();
    return actions[action]();
  }

  releaseHeldControllerBalls() {
    this.input?.releaseHeldBalls?.();
  }

  isXRPresenting() {
    return Boolean(this.renderer?.xr?.isPresenting);
  }

  syncVRPanel() {
    if (!this.vrPanel) return;
    const level = LEVELS[this.currentLevelIndex];
    const totalTargets = level?.targetColorIds?.length || 3;
    const nextLevel = this.getNextAvailableLevel();
    this.vrPanel.update({
      levelLabel: level?.label || '',
      mode: this.mode,
      score: this.score.score,
      correctHits: this.score.correctHits,
      totalTargets,
      remainingTime: this.remainingTime,
      status: this.hud.lastStatus || '',
      hasNextUnlocked: Boolean(nextLevel && nextLevel.id <= this.unlockedLevel)
    });
  }

  onXRSessionStart() {
    this.cancelLevelTransition();
    this.releaseHeldControllerBalls();
    this.input?.clearControllerHistory?.();
    this.setXRPlayerRigActive(true);
    this.levelRunning = false;
    this.vrPanel.showMenu();
    this.vrPanel.placeInFrontOfCamera();
    this.syncVRPanel();

    this.xrSession = this.renderer?.xr?.getSession?.() || null;
    if (this.xrSession) {
      this.xrVisibilityHandler = () => {
        if (this.xrSession.visibilityState !== 'visible') {
          this.input?.clearControllerHistory?.();
        }
      };
      this.xrSession.addEventListener('visibilitychange', this.xrVisibilityHandler);
    }
  }

  onXRSessionEnd() {
    if (this.xrSession && this.xrVisibilityHandler) {
      this.xrSession.removeEventListener('visibilitychange', this.xrVisibilityHandler);
    }
    this.xrSession = null;
    this.xrVisibilityHandler = null;
    this.vrPanel.group.visible = false;
    this.vrPanel.clearHover();
    this.input?.clearControllerHistory?.();
    this.setXRPlayerRigActive(false);
  }

  setXRPlayerRigActive(active) {
    if (!this.playerRig || !this.camera) return;

    if (active) {
      this.playerRig.position.copy(LAYOUT.vrPlayerPosition);
      // Keep a sensible pose for the first XR frame; WebXR then supplies the
      // headset's live local pose while the rig preserves this world offset.
      this.camera.position.set(0, 1.65, 0);
      this.camera.lookAt(0, 0.45, LAYOUT.targetZ);
    } else {
      this.playerRig.position.set(0, 0, 0);
      this.camera.position.set(0, 1.65, 4.2);
      this.camera.lookAt(0, 0.45, -3.35);
      if (this.input?.orbit) {
        this.input.orbit.target.set(0, 0.45, -3.35);
        this.input.orbit.update();
      }
    }

    this.playerRig.updateMatrixWorld(true);
  }

  startLevel(levelId) {
    this.cancelLevelTransition();

    if (levelId > this.unlockedLevel) {
      this.hud.updateHud('Level chưa mở khóa.', this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
      return;
    }

    const baseCfg = LEVELS.find((l) => l.id === levelId);
    if (!baseCfg) return;
    const cfg = getLevelRuntimeConfig(baseCfg, this.mode);
    this.currentLevelIndex = levelId - 1;
    this.levelRunning = true;
    this.score.reset();
    this._availableLevels = getAvailableLevels(this.mode);
    this.remainingTime = Infinity;

    this.input.cancelDrag();
    this.balls.setSelectedBall(null);
    this.mix.clearMixSlots();
    this.hud.hideVictoryOverlay();
    this.clearLevelObjects();
    this.buildBumpers(cfg);
    this.buildObstacles(cfg);
    this.targets.buildTargets(cfg);
    this.balls.spawnReturnBalls(cfg);
    this.input.focusDesktopView();

    const layout = cfg.targetLayout;
    let targetHint = 'bia cố định';
    if (layout === 'roulette') targetHint = 'bia đang xoay';
    else if (layout === 'slideVertical') targetHint = 'bia di chuyển lên xuống';
    else if (layout === 'slideHorizontal') targetHint = 'bia di chuyển ngang';

    if (cfg.mixing) {
      this.hud.updateHud(`${cfg.label}: đặt 2 bóng vào hộp mix để tạo màu mới, rồi ném bóng đúng màu vào ${targetHint}.`,
        this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
    } else {
      this.hud.updateHud(`${cfg.label}: ném bóng đúng màu vào ${targetHint}.`,
        this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
    }
  }

  clearLevelObjects() {
    this.balls.clear();
    this.targets.clear();
    this.particles.clear();

    this.obstacleObjects.forEach((obj) => {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      });
    });
    this.obstacleObjects = [];

    if (this.bumperGroup) {
      this.scene.remove(this.bumperGroup);
      this.bumperGroup.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      this.bumperGroup = null;
    }

    this.audio.stopRolling();
  }

  onLevelCompleted() {
    this.levelRunning = false;
    this.audio.stopRolling();
    const levelNum = this.currentLevelIndex + 1;

    this.score.saveScore(levelNum, this.mode, this.score.score);

    const available = this._availableLevels;
    const currentPos = available.findIndex((l) => l.id === levelNum);
    const isLastLevel = currentPos === available.length - 1;

    if (isLastLevel) {
      this.audio.win();
      this.hud.updateHud(`Chiến thắng! Điểm Level ${levelNum}: ${this.score.score}.`,
        this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
      this.hud.showVictoryOverlay();
      if (this.isXRPresenting()) {
        this.vrPanel.showVictory();
        this.vrPanel.placeInFrontOfCamera();
      }
      this.syncVRPanel();
      return;
    }

    const nextLevel = available[currentPos + 1];
    this.unlockedLevel = Math.max(this.unlockedLevel, nextLevel.id);
    this.audio.win();
    this.hud.updateHud(`Qua màn! Tự động chuyển sang Level ${nextLevel.id}...`,
      this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
    if (this.isXRPresenting()) this.vrPanel.showPlaying();
    this.syncVRPanel();

    this.levelTransitionTimer = window.setTimeout(() => {
      this.hud.hideVictoryOverlay();
      this.startLevel(nextLevel.id);
    }, 1500);
  }

  onTimeUp() {
    if (!this.levelRunning) return;
    this.levelRunning = false;
    this.audio.stopRolling();
    this.audio.lose();
    this.hud.updateHud('Hết giờ! Chơi lại level này để phục thù.',
      this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
    if (this.isXRPresenting()) {
      this.vrPanel.showTimeout();
      this.vrPanel.placeInFrontOfCamera();
    }
    this.syncVRPanel();
  }

  cancelLevelTransition() {
    if (!this.levelTransitionTimer) return;
    window.clearTimeout(this.levelTransitionTimer);
    this.levelTransitionTimer = null;
  }

  animate() {
    const dt = Math.min(this.clock.getDelta(), 0.033);

    this.input.update();
    this.targets.animateTargets(dt);
    updateObstacleAnimations(this.obstacleObjects, dt);
    this.balls.balls.forEach((ball) => this.balls.updateBallPhysics(ball, dt));
    this.balls.updateReturnSettle(dt);
    this.particles.update(dt);
    this.balls.stopRollingIfIdle();

    if (this.levelRunning && this.mode === MODE.HARD && Number.isFinite(this.remainingTime)) {
      this.remainingTime -= dt;
      if (this.remainingTime <= 0) {
        this.remainingTime = 0;
        this.onTimeUp();
      }
      this.hud.renderLabels(this.currentLevelIndex, this.mode, this.score.score, this.score.correctHits, this.remainingTime);
    }

    this.syncVRPanel();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
