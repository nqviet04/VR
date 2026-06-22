import * as THREE from 'three';
import { COLORS, LEVELS, LAYOUT } from './constants.js';
import { resolveSweptTriangleCollision, resolveTriangleCollision } from './triangleCollision.js';
import { resolveBoomerangCollision, resolveSweptBoomerangCollision } from './boomerangCollision.js';
import { triggerKickerBounce } from './ObstacleFactory.js';

export class BallManager {
  static computeRackRestX(slotIndex, readyCount) {
    return (slotIndex - (readyCount - 1) * 0.5) * LAYOUT.returnSlotSpacingX;
  }

  static computeShelfGridOffset(slotIndex, columns) {
    const col = slotIndex % columns;
    const row = Math.floor(slotIndex / columns);
    return new THREE.Vector3(
      (col - (columns - 1) * 0.5) * LAYOUT.returnSlotSpacingX,
      row * 0.03,
      -row * LAYOUT.returnSlotSpacingZ
    );
  }

  static computeResultShelfOffset(slotIndex) {
    let offset = slotIndex;
    const rows = LAYOUT.resultShelfRowSlots;
    const spacingX = LAYOUT.resultShelfSlotSpacingX;

    for (let row = 0; row < rows.length; row += 1) {
      const columns = rows[row];
      if (offset < columns) {
        const z = -(rows.length - 1 - row) * LAYOUT.returnSlotSpacingZ;
        return new THREE.Vector3(
          (offset - (columns - 1) * 0.5) * spacingX,
          row * 0.03,
          z
        );
      }
      offset -= columns;
    }

    return new THREE.Vector3();
  }

  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.balls = [];
    this.ballTimers = [];
    this.selectedBall = null;
    this.hoveredBall = null;
    this.resultShelfOrder = 0;

    // Shared geometry for all balls (performance)
    this.sharedBallGeo = new THREE.SphereGeometry(LAYOUT.ballRadius, 32, 32);
    this.hoverRing = this.createHoverRing();
  }

  createHoverRing() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(LAYOUT.ballRadius * 1.16, 0.02, 14, 48),
      new THREE.MeshStandardMaterial({
        color: 0x8df6ff,
        emissive: 0x39e4ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.95,
        roughness: 0.18,
        metalness: 0.35
      })
    );
    ring.rotation.x = Math.PI * 0.5;
    ring.visible = false;
    this.scene.add(ring);
    return ring;
  }

  restoreBallGlow(ball) {
    if (!ball?.material?.emissive) return;
    ball.material.emissive.setHex(ball.userData.colorHex);
    ball.material.emissive.multiplyScalar(0.08);
  }

  positionHoverRing(ball) {
    if (!ball) return;
    this.hoverRing.position.copy(ball.position);
    this.hoverRing.position.y += 0.03;
  }

  getLevelSourceColors(cfg) {
    if (cfg.sourceColorIds) {
      return cfg.sourceColorIds.map((id) => COLORS.find((color) => color.id === id)).filter(Boolean);
    }
    const sourceTier = cfg.sourceTier || cfg.tier;
    return COLORS.filter((color) => color.tier === sourceTier);
  }

  getBallSpawnPosition(index, source = false, sourceCount = 3) {
    if (source) {
      const columns = sourceCount <= 4 ? sourceCount : 2;
      return LAYOUT.returnOrigin.clone().add(BallManager.computeShelfGridOffset(index, columns));
    }

    return LAYOUT.resultReturnOrigin.clone().add(BallManager.computeResultShelfOffset(index));
  }

  createReturnBall(color, index, extraData = {}) {
    const material = new THREE.MeshStandardMaterial({
      color: color.hex,
      roughness: 0.21,
      metalness: 0.18,
      emissive: new THREE.Color(color.hex).multiplyScalar(0.08)
    });

    const ball = new THREE.Mesh(this.sharedBallGeo, material);

    const spawn = this.getBallSpawnPosition(index, extraData.source, extraData.sourceCount);
    ball.position.copy(spawn);
    ball.userData = {
      colorId: color.id,
      colorHex: color.hex,
      tier: color.tier,
      label: color.label,
      spawn,
      velocity: new THREE.Vector3(),
      state: 'ready',
      rollAngle: 0,
      cooldown: 0,
      spent: false,
      slotIndex: index,
      ...extraData
    };

    this.scene.add(ball);
    this.balls.push(ball);
    return ball;
  }

  spawnReturnBalls(cfg) {
    const colors = this.getLevelSourceColors(cfg);
    colors.forEach((color, index) =>
      this.createReturnBall(color, index, { source: true, sourceCount: colors.length })
    );
  }

  getMaxResultShelfSlots() {
    return LAYOUT.resultShelfRowSlots.reduce((total, slots) => total + slots, 0);
  }

  isActiveMixedBall(ball) {
    return Boolean(ball && !ball.userData.source && !ball.userData.spent);
  }

  getActiveMixedBalls(excludeBall = null) {
    return this.balls.filter((ball) => this.isActiveMixedBall(ball) && ball !== excludeBall);
  }

  getAvailableResultShelfSlot(excludeBall = null) {
    const usedSlots = new Set(
      this.getActiveMixedBalls(excludeBall)
        .map((ball) => ball.userData.resultShelfSlot)
        .filter((slot) => slot !== undefined)
    );

    for (let slot = 0; slot < this.getMaxResultShelfSlots(); slot += 1) {
      if (!usedSlots.has(slot)) return slot;
    }
    return null;
  }

  getOldestReadyMixedBall() {
    return this.getActiveMixedBalls()
      .filter((ball) =>
        ball.userData.state === 'ready' &&
        ball.visible !== false &&
        ball !== this.selectedBall
      )
      .sort((a, b) => (a.userData.resultShelfOrder ?? 0) - (b.userData.resultShelfOrder ?? 0))[0] || null;
  }

  launchBall(ball, position, velocity) {
    ball.userData.state = 'rolling';
    ball.userData.velocity.copy(velocity);
    ball.userData.previousPosition = position.clone();
    ball.userData.cooldown = 0;
    ball.position.copy(position);
    ball.position.y = Math.max(ball.position.y, LAYOUT.ballRadius);
    this.game.audio.launch();
    this.game.audio.startRolling();
    this.game.hud.updateHud(`Bóng ${ball.userData.label} đang lăn...`,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime);
  }

  updateBallPhysics(ball, dt) {
    const data = ball.userData;
    if (data.state !== 'rolling') return;

    data.previousPosition = ball.position.clone();
    data.cooldown = Math.max(0, data.cooldown - dt);
    data.velocity.y -= 5.8 * dt;
    ball.position.addScaledVector(data.velocity, dt);

    if (ball.position.y < LAYOUT.ballRadius) {
      ball.position.y = LAYOUT.ballRadius;
      if (Math.abs(data.velocity.y) > 0.65) {
        data.velocity.y *= -0.42;
        this.game.audio.bumper();
      } else {
        data.velocity.y = 0;
      }
    }

    const rollingOnLane = ball.position.y <= LAYOUT.ballRadius + 0.025;
    const friction = rollingOnLane ? 0.996 : 0.999;
    data.velocity.x *= friction;
    data.velocity.z *= friction;

    const sideLimit = LAYOUT.laneWidth * 0.5 - LAYOUT.ballRadius * 0.52;
    if (Math.abs(ball.position.x) > sideLimit) {
      ball.position.x = Math.sign(ball.position.x) * sideLimit;
      data.velocity.x *= -0.72;
      data.velocity.z *= 0.992;
      this.game.audio.bumper();
      this.game.particles.spawnSpark(ball.position, 0x39e4ff, 12, 0.26);
    }

    this.handleObstacleCollisions(ball);
    this.game.targets.handleTargetCollisions(ball);
    if (data.state !== 'rolling') return;

    const rollSpeed = Math.hypot(data.velocity.x, data.velocity.z);
    data.rollAngle += (rollSpeed * dt) / LAYOUT.ballRadius;
    ball.rotation.x += (data.velocity.z * dt) / LAYOUT.ballRadius;
    ball.rotation.z -= (data.velocity.x * dt) / LAYOUT.ballRadius;

    if (
      ball.position.z < LAYOUT.laneEndZ - 0.75 ||
      rollSpeed < 0.35 ||
      ball.position.z > LAYOUT.laneStartZ + 0.8
    ) {
      this.onBallMissed(ball);
    }
  }

  handleObstacleCollisions(ball) {
    this.game.obstacleObjects.forEach((obstacle) => {
      if (obstacle.userData.obstacleType === 'kicker') {
        this.handleKickerCollision(ball, obstacle);
        return;
      } else if (obstacle.userData.obstacleType === 'boomerang') {
        this.handleBoomerangCollision(ball, obstacle);
        return;
      }

      const dx = ball.position.x - obstacle.position.x;
      const dz = ball.position.z - obstacle.position.z;
      const minDist = obstacle.userData.radius + LAYOUT.ballRadius;
      const distSq = dx * dx + dz * dz;

      if (distSq > minDist * minDist || ball.userData.cooldown > 0) return;

      const dist = Math.max(Math.sqrt(distSq), 0.001);
      const normal = new THREE.Vector3(dx / dist, 0, dz / dist);
      const velocity = ball.userData.velocity;
      const bounce = obstacle.userData.bounce ?? 0.78;
      const reflected = velocity.clone().reflect(normal).multiplyScalar(bounce);
      if (obstacle.userData.obstacleType === 'bumper') {
        const horizontalSpeed = Math.hypot(reflected.x, reflected.z);
        if (horizontalSpeed > 18) {
          const scale = 18 / horizontalSpeed;
          reflected.x *= scale;
          reflected.z *= scale;
        }
      }
      velocity.x = reflected.x;
      velocity.z = reflected.z;
      const lift = obstacle.userData.obstacleType === 'bumper' ? 1.15 : 0.55;
      velocity.y = Math.max(velocity.y, lift);
      ball.position.x = obstacle.position.x + normal.x * minDist;
      ball.position.z = obstacle.position.z + normal.z * minDist;
      ball.userData.cooldown = 0.08;
      this.game.audio.bumper();
      this.game.particles.spawnSpark(ball.position, 0xfff0b8, 14, 0.28);
    });
  }

  distancePointToBallPath(point, start, end) {
    const segment = end.clone().sub(start);
    const lengthSq = segment.lengthSq();
    if (lengthSq <= 0.0001) {
      return point.distanceTo(end);
    }
    const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
    const closest = start.clone().addScaledVector(segment, t);
    return point.distanceTo(closest);
  }

  onBallMissed(ball) {
    if (ball.userData.state !== 'rolling') return;
    this.game.particles.spawnSmoke(ball.position);
    this.game.audio.wrong();
    this.resetBall(ball, 0.75);
    this.game.hud.updateHud('Bóng trượt mục tiêu. Nhặt bóng khác và căn lại.',
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime);
  }

  resetBall(ball, delay = 0) {
    this.game.mix.clearMixSlotForBall(ball);
    ball.userData.state = 'returning';
    ball.userData.velocity.set(0, 0, 0);

    const timer = window.setTimeout(() => {
      const idx = this.ballTimers.indexOf(timer);
      if (idx !== -1) this.ballTimers.splice(idx, 1);
      if (!this.balls.includes(ball)) return;
      ball.position.copy(ball.userData.spawn);
      ball.rotation.set(0, 0, 0);
      ball.visible = true;
      ball.userData.state = 'ready';
      this.stopRollingIfIdle();
    }, delay * 1000);

    this.ballTimers.push(timer);
  }

  retireMixedBall(ball) {
    ball.userData.state = 'spent';
    ball.userData.spent = true;
    ball.userData.velocity.set(0, 0, 0);
    ball.visible = false;
    ball.position.copy(ball.userData.spawn);
    ball.rotation.set(0, 0, 0);
    this.stopRollingIfIdle();
  }

  stopRollingIfIdle() {
    const anyRolling = this.balls.some((ball) => ball.userData.state === 'rolling');
    if (!anyRolling) this.game.audio.stopRolling();
  }

  setSelectedBall(ball) {
    this.restoreBallGlow(this.selectedBall);
    this.selectedBall = ball;
    if (ball && this.hoveredBall === ball) {
      this.hoveredBall = null;
    }

    this.hoverRing.visible = Boolean(ball);
    if (ball) {
      this.positionHoverRing(ball);
    }
  }

  setHoveredBall(ball) {
    const canShow =
      ball &&
      ball !== this.selectedBall &&
      (ball.userData?.state === 'ready' || ball.userData?.state === 'placed') &&
      ball.visible !== false;

    this.hoveredBall = canShow ? ball : null;
    this.hoverRing.visible = Boolean(this.hoveredBall);

    if (this.hoveredBall) {
      this.positionHoverRing(this.hoveredBall);
    }
  }

  updateHoverRing() {
    const ringBall = this.selectedBall || this.hoveredBall;
    if (!ringBall || !this.hoverRing.visible) return;
    if (this.selectedBall) {
      if (this.selectedBall.visible === false) {
        this.setSelectedBall(null);
        return;
      }
      this.positionHoverRing(this.selectedBall);
      return;
    }
    if ((this.hoveredBall.userData?.state !== 'ready' && this.hoveredBall.userData?.state !== 'placed') || this.hoveredBall.visible === false) {
      this.setHoveredBall(null);
      return;
    }
    this.positionHoverRing(this.hoveredBall);
  }

  updateReturnSettle(dt) {
    const sourceReady = this.balls
      .filter(
        (ball) =>
          ball.userData.state === 'ready' &&
          ball.visible !== false &&
          ball.userData.source === true &&
          ball !== this.selectedBall
      )
      .sort((a, b) => a.userData.slotIndex - b.userData.slotIndex);

    const alpha = 1 - Math.exp(-LAYOUT.returnSettleSpeed * dt);

    sourceReady.forEach((ball, i) => {
      const targetX = LAYOUT.returnOrigin.x + BallManager.computeRackRestX(i, sourceReady.length);
      const prevX = ball.position.x;
      ball.position.x += (targetX - prevX) * alpha;
      ball.position.y += (LAYOUT.returnOrigin.y - ball.position.y) * alpha;
      ball.position.z += (LAYOUT.returnOrigin.z - ball.position.z) * alpha;
      const deltaX = ball.position.x - prevX;
      ball.rotation.z -= deltaX / LAYOUT.ballRadius;
    });

    const resultReady = this.balls
      .filter(
        (ball) =>
          ball.userData.state === 'ready' &&
          ball.visible !== false &&
          !ball.userData.source &&
          ball.userData.resultShelfSlot !== undefined &&
          ball !== this.selectedBall
      )
      .sort((a, b) => a.userData.resultShelfSlot - b.userData.resultShelfSlot);

    resultReady.forEach((ball) => {
      const target = this.getBallSpawnPosition(ball.userData.resultShelfSlot, false);
      const prevX = ball.position.x;
      ball.position.x += (target.x - ball.position.x) * alpha;
      ball.position.y += (target.y - ball.position.y) * alpha;
      ball.position.z += (target.z - ball.position.z) * alpha;
      const deltaX = ball.position.x - prevX;
      ball.rotation.z -= deltaX / LAYOUT.ballRadius;
    });
  }

  handleKickerCollision(ball, obstacle) {
    if (ball.userData.cooldown > 0) return;

    const directHit = resolveTriangleCollision(ball.position, LAYOUT.ballRadius, obstacle);
    const previousPosition = ball.userData.previousPosition;
    const hit = directHit || (
      previousPosition
        ? resolveSweptTriangleCollision(previousPosition, ball.position, LAYOUT.ballRadius, obstacle)
        : null
    );
    if (!hit) return;

    const velocity = ball.userData.velocity;
    const bounce = obstacle.userData.bounce ?? 1.2;
    const kick = obstacle.userData.kick ?? 1.8;
    const reflected = velocity.clone().reflect(hit.normal).multiplyScalar(bounce);
    reflected.addScaledVector(hit.tangent, hit.hitOffset * kick);

    const horizontalSpeed = Math.hypot(reflected.x, reflected.z);
    if (horizontalSpeed > 20) {
      const scale = 20 / horizontalSpeed;
      reflected.x *= scale;
      reflected.z *= scale;
    }

    velocity.x = reflected.x;
    velocity.z = reflected.z;
    velocity.y = Math.max(velocity.y, 1.15);
    ball.position.x = hit.resolvedPosition.x;
    ball.position.z = hit.resolvedPosition.z;
    ball.userData.cooldown = 0.1;
    triggerKickerBounce(obstacle, hit.hitOffset);
    this.game.audio.bumper();
    this.game.particles.spawnSpark(ball.position, 0x31d8ff, 22, 0.36);
  }

  handleBoomerangCollision(ball, obstacle) {
    if (ball.userData.cooldown > 0) return;

    const directHit = resolveBoomerangCollision(ball.position, LAYOUT.ballRadius, obstacle);
    const previousPosition = ball.userData.previousPosition;
    const hit = directHit || (
      previousPosition
        ? resolveSweptBoomerangCollision(
          previousPosition,
          ball.position,
          LAYOUT.ballRadius,
          obstacle
        )
        : null
    );
    if (!hit) return;

    const velocity = ball.userData.velocity;
    const bounce = obstacle.userData.bounce ?? 0.82;
    const reflected = velocity.clone().reflect(hit.normal).multiplyScalar(bounce);

    velocity.x = reflected.x;
    velocity.z = reflected.z;
    velocity.y = Math.max(velocity.y, 0.62);
    ball.position.x = hit.resolvedPosition.x;
    ball.position.z = hit.resolvedPosition.z;
    ball.userData.cooldown = 0.1;
    this.game.audio.bumper();
    this.game.particles.spawnSpark(ball.position, 0xffbb22, 18, 0.3);
  }

  clear() {
    this.cancelTimers();
    this.setHoveredBall(null);
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      ball.material.dispose();
    });
    this.balls = [];
    this.selectedBall = null;
    this.resultShelfOrder = 0;
  }

  cancelTimers() {
    this.ballTimers.forEach((t) => window.clearTimeout(t));
    this.ballTimers = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.hoverRing);
    this.hoverRing.geometry.dispose();
    this.hoverRing.material.dispose();
    this.sharedBallGeo.dispose();
  }
}
