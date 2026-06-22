import * as THREE from 'three';
import { COLORS, LAYOUT } from './constants.js';

export class TargetManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.targets = [];
    this.rouletteGroup = null;
    this.currentConfig = null;

    // Shared geometries (performance)
    this._geoCache = {};
  }

  getLevelTargetColors(cfg) {
    if (cfg.targetColorIds) {
      return cfg.targetColorIds.map((id) => COLORS.find((color) => color.id === id)).filter(Boolean);
    }
    return COLORS.filter((color) => color.tier === cfg.tier);
  }

  getLevelScoreColors(cfg) {
    if (cfg.scoringColorIds) {
      return cfg.scoringColorIds.map((id) => COLORS.find((color) => color.id === id)).filter(Boolean);
    }
    return this.getLevelTargetColors(cfg);
  }

  getTargetStackY(row, rows) {
    return LAYOUT.targetY + (rows - 1 - row) * LAYOUT.targetStackGap;
  }

  getFixedTargetSlot(index, count) {
    if (count <= 3) {
      return {
        position: new THREE.Vector3((index - (count - 1) * 0.5) * 0.72, LAYOUT.targetY, LAYOUT.targetZ),
        column: index,
        row: 0,
        rows: 1
      };
    }

    if (count > 6) {
      const columns = Math.ceil(count / 3);
      const rows = Math.ceil(count / columns);
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = (col - (columns - 1) * 0.5) * LAYOUT.targetDenseSpacingX;
      const y = this.getTargetStackY(row, rows);
      return {
        position: new THREE.Vector3(x, y, LAYOUT.targetZ),
        column: col,
        row,
        rows
      };
    }

    const spacing = 0.42;
    const y = LAYOUT.targetY + 0.08;
    return {
      position: new THREE.Vector3((index - (count - 1) * 0.5) * spacing, y, LAYOUT.targetZ),
      column: index,
      row: 0,
      rows: 1
    };
  }

  _getCachedGeo(key, factory) {
    if (!this._geoCache[key]) {
      this._geoCache[key] = factory();
    }
    return this._geoCache[key];
  }

  createTarget(color, radius) {
    const group = new THREE.Group();

    const ringGeo = this._getCachedGeo(`torus-${radius}`, () =>
      new THREE.TorusGeometry(radius, 0.035, 14, 38)
    );
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.2,
      emissive: 0x101010
    }));
    group.add(ring);

    const faceGeo = this._getCachedGeo(`cyl-${radius}`, () =>
      new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, 0.06, 36)
    );
    const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({
      color: color.hex,
      roughness: 0.33,
      metalness: 0.08,
      emissive: new THREE.Color(color.hex).multiplyScalar(0.25)
    }));
    face.rotation.x = Math.PI * 0.5;
    group.add(face);

    group.userData = {
      colorId: color.id,
      colorHex: color.hex,
      tier: color.tier,
      label: color.label,
      radius,
      completed: false,
      baseScale: 1
    };

    return group;
  }

  buildTargets(cfg) {
    this.currentConfig = cfg;
    const colors = this.getLevelTargetColors(cfg);
    const isSlide = cfg.targetLayout === 'slideVertical' || cfg.targetLayout === 'slideHorizontal';
    const parent = cfg.targetLayout === 'roulette' ? new THREE.Group() : this.scene;

    if (cfg.targetLayout === 'roulette') {
      parent.position.set(0, cfg.rouletteCenterY ?? 0.72, LAYOUT.targetZ);
      this.scene.add(parent);
      this.rouletteGroup = parent;
    }

    colors.forEach((color, index) => {
      const target = this.createTarget(color, cfg.targetRadius);

      if (cfg.targetLayout === 'roulette') {
        const radiusX = cfg.rouletteRadiusX ?? 0.72;
        const radiusY = cfg.rouletteRadiusY ?? 0.44;
        const angle = (index / colors.length) * Math.PI * 2;
        target.position.set(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, 0);
        target.userData.localOffset = target.position.clone();
        parent.add(target);
      } else if (isSlide) {
        const slot = this.getFixedTargetSlot(index, colors.length);
        const laneHalfWidth = LAYOUT.laneWidth * 0.5;
        target.position.set(slot.position.x, slot.position.y, LAYOUT.targetZ);
        target.userData.baseX = slot.position.x;
        target.userData.baseY = slot.position.y;
        target.userData.slideAxis = cfg.targetLayout === 'slideVertical' ? 'y' : 'x';
        target.userData.slidePhase = (index / colors.length) * Math.PI * 2;
        target.userData.slideSpeed = cfg.slideSpeed ?? 1.2;
        target.userData.slideRange = target.userData.slideAxis === 'x'
          ? (laneHalfWidth - cfg.targetRadius)
          : (cfg.slideRange ?? 0.4);
        target.userData.slideGap = target.userData.slideAxis === 'x'
          ? cfg.targetRadius * 2 + 0.02
          : 0;
        parent.add(target);
      } else {
        const slot = this.getFixedTargetSlot(index, colors.length);
        target.position.set(slot.position.x, slot.position.y, LAYOUT.targetZ);
        target.userData.stackColumn = slot.column;
        target.userData.stackRow = slot.row;
        target.userData.stackRows = slot.rows;
        target.userData.fallTargetY = slot.position.y;
        parent.add(target);
      }

      this.targets.push(target);
    });
  }

  handleTargetCollisions(ball) {
    if (ball.userData.cooldown > 0) return;

    const ballStart = ball.userData.previousPosition || ball.position;
    const ballEnd = ball.position;
    let bestHit = null;

    for (const target of this.targets) {
      if (!target.visible || target.userData.completed) continue;

      const center = new THREE.Vector3();
      target.getWorldPosition(center);
      const dist = this.game.balls.distancePointToBallPath(center, ballStart, ballEnd);
      const hitRadius = target.userData.radius + LAYOUT.ballRadius + LAYOUT.targetHitPadding;

      if (dist > hitRadius) continue;
      if (!bestHit || dist < bestHit.dist) {
        bestHit = { target, center, dist };
      }
    }

    if (!bestHit) return;

    const { target, center } = bestHit;
    if (ball.userData.colorId === target.userData.colorId) {
      if (target.userData.completed) {
        this.game.balls.resetBall(ball, 0.45);
        this.game.hud.updateHud(`Ô ${target.userData.label} đã ghi điểm.`,
          this.game.currentLevelIndex, this.game.mode, this.game.score.score,
          this.game.score.correctHits, this.game.remainingTime);
      } else {
        this.onCorrectHit(ball, target, center);
      }
      return;
    }

    this.onWrongHit(ball, target, center);
  }

  onCorrectHit(ball, target, center) {
    target.userData.completed = true;
    const cfg = this.currentConfig;
    target.visible = false;
    const droppedTargets = this.dropTargetsAbove(target);
    this.game.score.addHit(100);
    this.game.particles.spawnFirework(center, ball.userData.colorHex);
    this.game.audio.ping();
    this.game.input.pulseAll(0.85, 95);

    if (ball.userData.mixedFrom) {
      this.game.balls.retireMixedBall(ball);
    } else {
      this.game.balls.resetBall(ball, 0.7);
    }

    const total = this.getLevelScoreColors(cfg).length;
    if (this.game.score.correctHits >= total) {
      this.game.onLevelCompleted();
    } else {
      const dropText = droppedTargets > 0 ? ' Bia phía trên đã rơi xuống.' : '';
      this.game.hud.updateHud(
        `Ping! Đúng ${this.game.score.correctHits}/${total}. Điểm: ${this.game.score.score}.${dropText}`,
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime
      );
    }
  }

  dropTargetsAbove(hitTarget) {
    const column = hitTarget.userData.stackColumn;
    const hitRow = hitTarget.userData.stackRow;
    const rows = hitTarget.userData.stackRows;
    if (column === undefined || hitRow === undefined || rows <= 1) return 0;

    let dropped = 0;
    this.targets.forEach((target) => {
      const data = target.userData;
      if (target === hitTarget || data.completed || data.stackColumn !== column) return;
      if (data.stackRow >= hitRow) return;

      data.stackRow += 1;
      data.fallTargetY = this.getTargetStackY(data.stackRow, data.stackRows);
      this.game.particles.spawnSpark(target.position, data.colorHex, 10, 0.22);
      dropped += 1;
    });

    return dropped;
  }

  onWrongHit(ball, target, center) {
    this.game.particles.spawnSmoke(center);
    this.game.audio.wrong();
    this.game.input.pulseAll(0.6, 80);

    if (this.game.mode === 'Hard' && Number.isFinite(this.game.remainingTime)) {
      this.game.remainingTime = Math.max(0, this.game.remainingTime - 2);
    }

    const label = target.userData.label;
    this.game.balls.resetBall(ball, 0.85);
    this.game.hud.updateHud(
      `Sai màu: bóng ${ball.userData.label} trúng ${label}. Thử lại.`,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime
    );
  }

  revealMixedTarget(colorId) {
    const target = this.targets.find((item) => item.userData.colorId === colorId);
    if (!target || target.userData.completed) return;
    target.visible = true;
  }

  findTargetRoot(object) {
    let current = object;
    while (current && !this.targets.includes(current)) {
      current = current.parent;
    }
    return current;
  }

  animateTargets(dt) {
    const speed = this.currentConfig?.rouletteSpeed ?? 0;
    if (this.rouletteGroup && this.game.levelRunning) {
      this.rouletteGroup.rotation.z += speed * dt;
    }

    const t = performance.now() * 0.001;
    const horizontalTargets = [];

    this.targets.forEach((target) => {
      if (target.userData.completed) return;

      // Animation slide dọc (trục Y)
      if (target.userData.slideAxis === 'y' && this.game.levelRunning) {
        const offset = ((Math.sin(t * target.userData.slideSpeed + target.userData.slidePhase) + 1) * 0.5)
          * target.userData.slideRange;
        target.position.y = target.userData.baseY + offset;
      }

      // Animation slide ngang (trục X)
      if (target.userData.slideAxis === 'x' && this.game.levelRunning) {
        horizontalTargets.push(target);
      }

      // Rơi theo cột (fixed layout)
      if (Number.isFinite(target.userData.fallTargetY)) {
        target.position.y = THREE.MathUtils.lerp(
          target.position.y,
          target.userData.fallTargetY,
          Math.min(dt * 8, 1)
        );
      }
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.025;
      target.scale.setScalar(pulse);
    });

    if (horizontalTargets.length > 0 && this.game.levelRunning) {
      const laneHalfWidth = LAYOUT.laneWidth * 0.5;
      const radius = this.currentConfig?.targetRadius ?? 0;
      const laneMinX = -laneHalfWidth + radius;
      const laneMaxX = laneHalfWidth - radius;
      const sortedTargets = horizontalTargets
        .map((target) => ({
          target,
          desiredX: Math.sin(t * target.userData.slideSpeed + target.userData.slidePhase) * target.userData.slideRange
        }))
        .sort((a, b) => a.desiredX - b.desiredX);

      sortedTargets[0].resolvedX = Math.max(sortedTargets[0].desiredX, laneMinX);
      for (let index = 1; index < sortedTargets.length; index += 1) {
        const gap = sortedTargets[index].target.userData.slideGap ?? radius * 2;
        sortedTargets[index].resolvedX = Math.max(
          sortedTargets[index].desiredX,
          sortedTargets[index - 1].resolvedX + gap
        );
      }

      sortedTargets[sortedTargets.length - 1].resolvedX = Math.min(
        sortedTargets[sortedTargets.length - 1].resolvedX,
        laneMaxX
      );
      for (let index = sortedTargets.length - 2; index >= 0; index -= 1) {
        const gap = sortedTargets[index].target.userData.slideGap ?? radius * 2;
        sortedTargets[index].resolvedX = Math.min(
          sortedTargets[index].resolvedX,
          sortedTargets[index + 1].resolvedX - gap
        );
      }

      sortedTargets.forEach(({ target, resolvedX }) => {
        target.position.x = THREE.MathUtils.clamp(resolvedX, laneMinX, laneMaxX);
      });
    }
  }

  clear() {
    this.targets.forEach((target) => {
      if (target.parent) target.parent.remove(target);
      target.traverse((child) => {
        if (child.isMesh) {
          child.material.dispose();
        }
      });
    });
    this.targets = [];

    if (this.rouletteGroup) {
      this.scene.remove(this.rouletteGroup);
      this.rouletteGroup = null;
    }

    this.currentConfig = null;
  }

  dispose() {
    this.clear();
    Object.values(this._geoCache).forEach((geo) => geo.dispose());
    this._geoCache = {};
  }
}
