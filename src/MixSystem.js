import * as THREE from 'three';
import { COLORS, MIX_RECIPES, LEVELS, LAYOUT } from './constants.js';

export class MixSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.mixSlots = [];
    this.mixSlotObjects = [];
  }

  getMixResultId(a, b) {
    const key = [a, b].sort().join('+');
    return MIX_RECIPES.get(key) || null;
  }

  addMixBox() {
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2b2442,
      roughness: 0.48,
      metalness: 0.22,
      emissive: 0x150b2d
    });
    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x463785,
      roughness: 0.3,
      metalness: 0.12,
      emissive: 0x181044
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.26, 0.82), baseMat);
    base.position.copy(LAYOUT.mixBoxCenter);
    this.scene.add(base);

    const label = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.025, 0.08), glowMat);
    label.position.set(LAYOUT.mixBoxCenter.x, LAYOUT.mixBoxCenter.y + 0.16, LAYOUT.mixBoxCenter.z - 0.47);
    this.scene.add(label);

    this.mixSlots = LAYOUT.mixSlotPositions.map((position, index) => {
      const slot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.045, 36), slotMat.clone());
      slot.position.copy(position);
      slot.userData.mixSlotIndex = index;
      this.scene.add(slot);
      this.mixSlotObjects.push(slot);
      return { index, position: position.clone(), mesh: slot, ball: null };
    });
  }

  tryPlaceBallInNearestMixSlot(ball) {
    const cfg = LEVELS[this.game.currentLevelIndex];
    if (!cfg.mixing || !this.mixSlots.length) return false;
    if (!['ready', 'held'].includes(ball.userData.state)) return false;

    let bestSlot = null;
    let bestDist = Infinity;
    this.mixSlots.forEach((slot) => {
      if (slot.ball) return;
      const dist = ball.position.distanceTo(slot.position);
      if (dist < bestDist) {
        bestSlot = slot;
        bestDist = dist;
      }
    });

    if (!bestSlot || bestDist > 0.62) return false;
    this.placeBallInMixSlot(ball, bestSlot);
    return true;
  }

  placeBallInMixSlot(ball, slot) {
    const cfg = LEVELS[this.game.currentLevelIndex];
    if (!cfg.mixing) {
      this.game.hud.updateHud('Hộp mix chỉ dùng ở các level Mix Màu.',
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime);
      return;
    }

    this.clearMixSlotForBall(ball);
    slot.ball = ball;
    if (slot.mesh?.material?.emissive) {
      slot.mesh.material.emissive.setHex(0xffd24a);
    }

    ball.userData.state = 'mixing';
    ball.userData.velocity.set(0, 0, 0);
    ball.userData.slotIndex = slot.index;
    ball.position.copy(slot.position);
    ball.rotation.set(0, 0, 0);
    ball.visible = true;
    this.game.balls.setSelectedBall(null);
    this.game.audio.pick();
    this.game.hud.updateHud(`Đã đặt bóng ${ball.userData.label} vào slot ${slot.index + 1}.`,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime);

    if (this.mixSlots.every((item) => item.ball)) {
      window.setTimeout(() => this.processMixBox(), 180);
    }
  }

  processMixBox() {
    const [firstSlot, secondSlot] = this.mixSlots;
    const firstBall = firstSlot?.ball;
    const secondBall = secondSlot?.ball;
    if (!firstBall || !secondBall) return;

    const resultId = this.getMixResultId(firstBall.userData.colorId, secondBall.userData.colorId);
    const center = LAYOUT.mixBoxCenter.clone();

    if (!resultId) {
      this.game.particles.spawnSmoke(center);
      this.game.audio.wrong();
      this.game.input.pulseAll(0.45, 80);
      this.game.hud.updateHud(
        `${firstBall.userData.label} + ${secondBall.userData.label} không có công thức. Bóng đã quay về giá.`,
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime
      );
      this.releaseMixSlotBall(firstBall, 0.35);
      this.releaseMixSlotBall(secondBall, 0.35);
      return;
    }

    const resultColor = COLORS.find((color) => color.id === resultId);
    const existing = this.game.balls.balls.find(
      (candidate) => candidate.userData.colorId === resultId && !candidate.userData.source && !candidate.userData.spent
    );

    let resultSlot = existing?.userData.resultShelfSlot;
    if (resultSlot === undefined) {
      resultSlot = this.game.balls.getAvailableResultShelfSlot(existing);
    }

    if (resultSlot === null) {
      const retiredBall = this.game.balls.getOldestReadyMixedBall();
      if (!retiredBall) {
        this.game.particles.spawnSmoke(center);
        this.game.audio.wrong();
        this.game.hud.updateHud(
          'Giá bóng mix đã đầy. Hãy dùng bớt bóng đang có trước khi mix thêm.',
          this.game.currentLevelIndex, this.game.mode, this.game.score.score,
          this.game.score.correctHits, this.game.remainingTime
        );
        this.releaseMixSlotBall(firstBall, 0.35);
        this.releaseMixSlotBall(secondBall, 0.35);
        return;
      }

      resultSlot = retiredBall.userData.resultShelfSlot;
      this.game.balls.retireMixedBall(retiredBall);
    }

    const resultBall = existing || this.game.balls.createReturnBall(resultColor, resultSlot, {
      source: false,
      resultShelfSlot: resultSlot,
      mixedFrom: [firstBall.userData.colorId, secondBall.userData.colorId]
    });
    this.game.targets.revealMixedTarget(resultId);

    resultBall.userData.resultShelfSlot = resultSlot;
    resultBall.userData.resultShelfOrder = this.game.balls.resultShelfOrder += 1;
    resultBall.userData.spawn = this.game.balls.getBallSpawnPosition(resultSlot, false);
    resultBall.visible = true;
    resultBall.userData.state = 'ready';
    resultBall.userData.spent = false;
    resultBall.userData.velocity.set(0, 0, 0);
    resultBall.position.copy(center);

    this.releaseMixSlotBall(firstBall, 0.45);
    this.releaseMixSlotBall(secondBall, 0.45);
    this.game.particles.spawnFirework(center, resultColor.hex);
    this.game.audio.mix();
    this.game.input.pulseAll(0.55, 80);
    this.game.hud.updateHud(
      `${firstBall.userData.label} + ${secondBall.userData.label} = ${resultColor.label}. Nhặt bóng mới ở hộp mix rồi ném vào target.`,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime
    );
  }

  releaseMixSlotBall(ball, delay = 0) {
    this.clearMixSlotForBall(ball);
    this.game.balls.resetBall(ball, delay);
  }

  clearMixSlotForBall(ball) {
    if (!ball?.userData || ball.userData.slotIndex === undefined) return;
    const slot = this.mixSlots[ball.userData.slotIndex];
    if (slot?.ball === ball) {
      slot.ball = null;
      if (slot.mesh?.material?.emissive) {
        slot.mesh.material.emissive.setHex(0x181044);
      }
    }
    delete ball.userData.slotIndex;
  }

  clearMixSlots() {
    this.mixSlots.forEach((slot) => {
      slot.ball = null;
      if (slot.mesh?.material?.emissive) {
        slot.mesh.material.emissive.setHex(0x181044);
      }
    });
  }
}
