import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LEVELS, LAYOUT, AIM } from './constants.js';
import { computeAim, aimVelocity, predictParabola, powerColor } from './aimMath.js';

export class InputManager {
  constructor(renderer, camera, game) {
    this.renderer = renderer;
    this.camera = camera;
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.controllers = [];
    this.drag = null;
    this.placing = null;
    this.targetInfoTextures = new Map();
    this.targetTooltip = {
      root: document.getElementById('targetTooltip'),
      swatch: document.getElementById('targetTooltipSwatch'),
      label: document.getElementById('targetTooltipLabel')
    };

    this.orbit = new OrbitControls(camera, renderer.domElement);
    this.orbit.target.set(0, 0.45, -3.35);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 9;
    this.orbit.maxPolarAngle = Math.PI * 0.48;
    this.orbit.update();

    this.setupDesktopControls();
    this.setupControllers();
  }

  setupDesktopControls() {
    this.renderer.domElement.addEventListener('pointerdown', (event) => this.onDesktopPointerDown(event));
    this.renderer.domElement.addEventListener('pointermove', (event) => this.onDesktopPointerMove(event));
    this.renderer.domElement.addEventListener('pointerleave', () => this.onDesktopPointerLeave());
    window.addEventListener('pointerup', (event) => this.onDesktopPointerUp(event));
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'f') this.focusDesktopView();
      if (event.key === 'Escape') this.cancelDrag();
    });
  }

  focusDesktopView() {
    if (this.renderer.xr.isPresenting) return;
    this.camera.position.set(0, 1.65, 4.2);
    this.camera.lookAt(0, 0.45, -3.35);
    if (this.orbit) {
      this.orbit.target.set(0, 0.45, -3.35);
      this.orbit.update();
    }
  }

  setupControllers() {
    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.grabbed = null;
      controller.userData.history = [];
      controller.userData.hoveredTarget = null;
      controller.userData.hoveredVRButton = null;
      controller.userData.buttonPressedState = [];
      controller.userData.inputSource = null;
      controller.userData.index = i;

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1)
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.68 })
      );
      line.name = 'ray';
      line.scale.z = 4.5;
      controller.add(line);
      controller.add(this.createControllerTargetInfoSprite());

      controller.addEventListener('selectstart', (event) => this.onSelectStart(controller, event));
      controller.addEventListener('selectend', (event) => this.onSelectEnd(controller, event));
      controller.addEventListener('connected', (event) => {
        controller.userData.inputSource = event.data || null;
      });
      controller.addEventListener('disconnected', () => {
        controller.userData.inputSource = null;
        controller.userData.buttonPressedState = [];
      });

      // Controllers must share the camera's XR rig so headset and hands keep
      // the same world-space offset behind the bowling lane.
      (this.game.playerRig || this.game.scene).add(controller);
      this.controllers.push(controller);
    }
  }

  createControllerTargetInfoSprite() {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      opacity: 0.96,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = 'targetInfo';
    sprite.visible = false;
    sprite.position.set(0, 0.14, -0.78);
    sprite.scale.set(0.62, 0.22, 1);
    sprite.renderOrder = 20;
    return sprite;
  }

  onSelectStart(controller, event) {
    const vrButton = this.findControllerVRButton(controller);
    if (vrButton) {
      this.game.audio.startBgm();
      if (this.game.vrPanel.activate(vrButton)) {
        this.pulseController(event, 0.32, 55);
      }
      return;
    }

    if (!this.game.levelRunning) return;

    const hit = this.findControllerBall(controller);
    if (!hit) return;

    const ball = hit.object;
    if (ball.userData.state !== 'ready') return;

    controller.userData.grabbed = ball;
    ball.userData.state = 'held';
    controller.attach(ball);
    ball.position.set(0, 0, -0.18);
    this.game.audio.pick();
    this.pulseController(event, 0.35, 65);
    this.game.hud.updateHud(`Đang cầm bóng ${ball.userData.label}.`,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime);
  }

  onSelectEnd(controller, event) {
    const ball = controller.userData.grabbed;
    if (!ball) return;

    this.game.scene.attach(ball);
    controller.userData.grabbed = null;

    if (this.game.mix.tryPlaceBallInNearestMixSlot(ball)) {
      this.pulseController(event, 0.25, 60);
      return;
    }

    const velocity = this.getControllerThrowVelocity(controller);
    if (velocity.length() < 1.1) {
      this.game.balls.resetBall(ball);
      this.game.hud.updateHud('Ném mạnh hơn để bóng lăn xuống lane.',
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime);
      return;
    }

    velocity.x = THREE.MathUtils.clamp(velocity.x, -4.8, 4.8);
    velocity.y = THREE.MathUtils.clamp(velocity.y + 0.25, -0.2, 3.2);
    velocity.z = Math.min(velocity.z - 3.6, -4.2);
    this.game.balls.launchBall(ball, ball.position.clone(), velocity);
    this.pulseController(event, 0.18, 45);
  }

  findControllerBall(controller) {
    this.setRaycasterFromController(controller);

    const candidates = this.game.balls.balls.filter((ball) => ball.userData.state === 'ready');
    const hits = this.raycaster.intersectObjects(candidates, false);
    return hits[0] || null;
  }

  findControllerVRButton(controller) {
    const interactive = this.game.vrPanel?.getInteractiveObjects?.() || [];
    if (interactive.length === 0) return null;
    this.setRaycasterFromController(controller);
    return this.raycaster.intersectObjects(interactive, false)[0]?.object || null;
  }

  setRaycasterFromController(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  }

  getControllerThrowVelocity(controller) {
    const history = controller.userData.history;
    if (history.length < 2) return new THREE.Vector3(0, 0, -4);

    const newest = history[history.length - 1];
    let oldest = history[0];
    for (let i = history.length - 2; i >= 0; i -= 1) {
      if (newest.time - history[i].time > 0.07) {
        oldest = history[i];
        break;
      }
    }

    const dt = Math.max(newest.time - oldest.time, 0.016);
    return newest.pos.clone().sub(oldest.pos).divideScalar(dt);
  }

  setRaycasterFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  isPointerNearPlacedBall(event, ball, tolerancePx = 40) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    ball.updateWorldMatrix(true, false);
    const projected = ball.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const screenX = rect.left + (projected.x + 1) * 0.5 * rect.width;
    const screenY = rect.top + (1 - projected.y) * 0.5 * rect.height;
    return Math.hypot(event.clientX - screenX, event.clientY - screenY) <= tolerancePx;
  }

  getPlacementXLimit() {
    return LAYOUT.laneWidth * 0.5 - LAYOUT.ballRadius;
  }

  getPlacementZ() {
    return LAYOUT.startLineZ;
  }

  isBallInsidePlacementZone(ball) {
    const xLimit = this.getPlacementXLimit();
    return (
      Math.abs(ball.position.x) <= xLimit + 0.0001 &&
      Math.abs(ball.position.z - this.getPlacementZ()) <= 0.0001
    );
  }

  restoreBallToSpawn(ball) {
    ball.userData.state = 'ready';
    ball.position.copy(ball.userData.spawn);
    ball.rotation.set(0, 0, 0);
  }

  updateDesktopHover(event) {
    if (this.renderer.xr.isPresenting || !this.game.levelRunning || this.placing || this.drag?.aiming) {
      this.game.balls.setHoveredBall(null);
      this.hideTargetTooltip();
      return;
    }

    this.setRaycasterFromEvent(event);
    this.updateTargetTooltip(event);

    if (this.drag) {
      const placedHits = this.raycaster.intersectObjects([this.drag.ball], false);
      if (placedHits.length > 0 || this.isPointerNearPlacedBall(event, this.drag.ball)) {
        this.game.balls.setHoveredBall(this.drag.ball);
      } else {
        this.game.balls.setHoveredBall(null);
      }
      return;
    }

    const readyBalls = this.game.balls.balls.filter((ball) => ball.userData.state === 'ready');
    const hit = this.raycaster.intersectObjects(readyBalls, false)[0];
    this.game.balls.setHoveredBall(hit?.object || null);
  }

  updateTargetTooltip(event) {
    const targetHits = this.raycaster.intersectObjects(this.game.targets.targets, true);
    const target = targetHits
      .map((hit) => this.game.targets.findTargetRoot(hit.object))
      .find((item) => item && !item.userData.completed && item.visible !== false);

    if (!target) {
      this.hideTargetTooltip();
      return;
    }

    const color = `#${target.userData.colorHex.toString(16).padStart(6, '0')}`;
    this.targetTooltip.swatch.style.background = color;
    this.targetTooltip.label.textContent = target.userData.label;
    this.targetTooltip.root.classList.add('show');
    this.targetTooltip.root.setAttribute('aria-hidden', 'false');

    const offset = 16;
    const width = this.targetTooltip.root.offsetWidth || 126;
    const height = this.targetTooltip.root.offsetHeight || 38;
    const x = THREE.MathUtils.clamp(event.clientX + offset, 8, window.innerWidth - width - 8);
    const y = THREE.MathUtils.clamp(event.clientY + offset, 8, window.innerHeight - height - 8);
    this.targetTooltip.root.style.transform = `translate(${x}px, ${y}px)`;
  }

  hideTargetTooltip() {
    this.targetTooltip.root.classList.remove('show');
    this.targetTooltip.root.setAttribute('aria-hidden', 'true');
  }

  getTargetInfoTexture(target) {
    const key = target.userData.colorId;
    if (this.targetInfoTextures.has(key)) {
      return this.targetInfoTextures.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 19, 31, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 4;
    this.roundRect(ctx, 8, 8, 496, 144, 20);
    ctx.fill();
    ctx.stroke();

    const color = `#${target.userData.colorHex.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.arc(78, 80, 32, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.stroke();

    ctx.font = '700 42px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = '#f6f7f9';
    ctx.textBaseline = 'middle';
    ctx.fillText(target.userData.label, 132, 80);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.targetInfoTextures.set(key, texture);
    return texture;
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  updateControllerTargetInfo(controller) {
    const info = controller.getObjectByName('targetInfo');
    if (!info) return;
    if (!this.renderer.xr.isPresenting || !this.game.levelRunning || controller.userData.grabbed) {
      info.visible = false;
      controller.userData.hoveredTarget = null;
      return;
    }

    this.setRaycasterFromController(controller);
    const targetHits = this.raycaster.intersectObjects(this.game.targets.targets, true);
    const target = targetHits
      .map((hit) => this.game.targets.findTargetRoot(hit.object))
      .find((item) => item && !item.userData.completed && item.visible !== false);

    if (!target) {
      info.visible = false;
      controller.userData.hoveredTarget = null;
      return;
    }

    if (controller.userData.hoveredTarget !== target) {
      info.material.map = this.getTargetInfoTexture(target);
      info.material.needsUpdate = true;
      controller.userData.hoveredTarget = target;
    }
    info.visible = true;
  }

  resetAimPreview() {
    this._lastAim = null;
    if (this.game.aimLine) this.game.aimLine.visible = false;
    if (this.game.aimArrow) this.game.aimArrow.visible = false;
    this.game.hud.hideAimPower();
  }

  onDesktopPointerDown(event) {
    if (event.button !== 0 || this.renderer.xr.isPresenting || !this.game.levelRunning) return;

    this.setRaycasterFromEvent(event);

    // Phase B has two deliberate actions: the first click selects/holds the
    // placed ball; a later press starts the drag used to aim and launch it.
    if (this.drag && this.drag.ball.userData.state === 'placed') {
      this.drag.ball.updateWorldMatrix(true, false);
      const placedHits = this.raycaster.intersectObjects([this.drag.ball], false);
      if (
        placedHits.length === 0 &&
        !this.isPointerNearPlacedBall(event, this.drag.ball)
      ) return;
      this.game.balls.setSelectedBall(this.drag.ball);

      if (!this.drag.aimArmed) {
        const ball = this.drag.ball;
        this.placing = {
          ball,
          startX: event.clientX,
          startY: event.clientY,
          repositioning: true
        };
        this.drag = null;
        this.resetAimPreview();
        this.orbit.enabled = false;
        this.game.audio.pick();
        this.game.hud.updateHud('Đang cầm bóng. Kéo đến vị trí mới rồi thả để đặt lại.',
          this.game.currentLevelIndex, this.game.mode, this.game.score.score,
          this.game.score.correctHits, this.game.remainingTime);
        return;
      }

      this.drag.startX = event.clientX;
      this.drag.startY = event.clientY;
      this.drag.aiming = true;
      this.resetAimPreview();
      this.orbit.enabled = false;
      this.game.aimLine.visible = true;
      if (this.game.aimArrow) this.game.aimArrow.visible = true;
      this.game.hud.setAimPower(0);
      return;
    }

    // Phase A start: pick up a ready ball from the shelf to place it.
    const readyBalls = this.game.balls.balls.filter((ball) => ball.userData.state === 'ready');
    const ballHits = this.raycaster.intersectObjects(readyBalls, false);
    if (ballHits.length > 0) {
      const hitBall = ballHits[0].object;
      this.game.balls.setHoveredBall(null);
      this.game.balls.setSelectedBall(hitBall);
      this.game.audio.pick();
      this.placing = { ball: hitBall, startX: event.clientX, startY: event.clientY };
      this.orbit.enabled = false;
      this.game.hud.updateHud('Kéo bóng ra đường băng rồi thả để đặt.',
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime);
    }
  }

  onDesktopPointerMove(event) {
    if (this.placing) {
      this.game.balls.setHoveredBall(null);
      this.placing.targetSlot = null;
      this.setRaycasterFromEvent(event);

      const cfg = LEVELS[this.game.currentLevelIndex];
      if (cfg.mixing) {
        const slotHits = this.raycaster.intersectObjects(this.game.mix.mixSlotObjects, false);
        if (slotHits.length > 0) {
          const slot = this.game.mix.mixSlots[slotHits[0].object.userData.mixSlotIndex];
          this.placing.targetSlot = slot;
          this.placing.ball.position.copy(slot.position);
          return;
        }
      }

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAYOUT.ballRadius);
      const point = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(plane, point)) return;

      // Lane placement is a start-line choice: X is free, Z stays on the line.
      const xLimit = this.getPlacementXLimit();
      point.x = THREE.MathUtils.clamp(point.x, -xLimit, xLimit);
      point.z = this.getPlacementZ();
      point.y = LAYOUT.ballRadius;
      this.placing.ball.position.copy(point);
      return;
    }

    if (this.drag && this.drag.aiming) {
      this.game.balls.setHoveredBall(null);
      const dx = this.drag.startX - event.clientX;
      const dy = event.clientY - this.drag.startY;
      const aim = computeAim(dx, dy);
      this._lastAim = aim;
      this.renderAimTrajectory(aim);
      return;
    }

    this.updateDesktopHover(event);
  }

  renderAimTrajectory(aim) {
    const line = this.game.aimLine;
    const pts = predictParabola(aim.directionRad, aim.power, this.drag.placedPos, this.game.obstacleObjects, this.game.mode);
    const arr = line.geometry.attributes.position.array;
    for (let i = 0; i < pts.length; i += 1) {
      arr[i * 3] = pts[i].x;
      arr[i * 3 + 1] = pts[i].y;
      arr[i * 3 + 2] = pts[i].z;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.computeLineDistances();
    
    const ratio = (aim.power - AIM.minPower) / (AIM.maxPower - AIM.minPower);
    const color = powerColor(ratio);
    line.material.color.setHex(color);
    line.material.opacity = aim.valid ? 0.9 : 0.35;
    
    line.material.dashSize = 0.2 + ratio * 0.4;
    line.material.gapSize = 0.4 - ratio * 0.3;
    
    this.game.hud.setAimPower(aim.dragLen / AIM.pixelsForMaxPower, color);

    if (this.game.aimArrow) {
      this.game.aimArrow.visible = aim.valid;
      if (aim.valid && pts.length > 1) {
         let lastIdx = pts.length - 1;
         while(lastIdx > 0 && pts[lastIdx].x === pts[lastIdx-1].x && pts[lastIdx].z === pts[lastIdx-1].z) {
           lastIdx--;
         }
         const pEnd = pts[lastIdx];
         const pPrev = pts[Math.max(0, lastIdx - 1)];
         
         this.game.aimArrow.position.set(pEnd.x, pEnd.y, pEnd.z);
         this.game.aimArrow.material.color.setHex(color);
         this.game.aimArrow.material.opacity = 0.9;
         
         if (pEnd.x !== pPrev.x || pEnd.z !== pPrev.z || pEnd.y !== pPrev.y) {
           const dir = new THREE.Vector3(pEnd.x - pPrev.x, pEnd.y - pPrev.y, pEnd.z - pPrev.z).normalize();
           const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
           this.game.aimArrow.quaternion.copy(quaternion);
         }
      }
    }
  }

  onDesktopPointerLeave() {
    if (!this.placing && !this.drag?.aiming) {
      this.game.balls.setHoveredBall(null);
      this.hideTargetTooltip();
    }
  }

  onDesktopPointerUp(event) {
    if (this.placing) {
      this.finishPlacing(event);
      return;
    }

    if (this.drag && this.drag.aiming) {
      this.finishAim();
    }
  }

  finishPlacing(event) {
    const placing = this.placing;
    const ball = placing.ball;
    const cfg = LEVELS[this.game.currentLevelIndex];

    // Mix levels: dropping the ball over a mix slot keeps the existing behavior.
    if (cfg.mixing) {
      let targetSlot = placing.targetSlot || null;
      if (!targetSlot && event) {
        this.setRaycasterFromEvent(event);
        const slotHits = this.raycaster.intersectObjects(this.game.mix.mixSlotObjects, false);
        if (slotHits.length > 0) {
          targetSlot = this.game.mix.mixSlots[slotHits[0].object.userData.mixSlotIndex];
        }
      }
      if (targetSlot) {
        if (targetSlot.ball) {
          // Slot already taken: return the dragged ball to its shelf home so it
          // isn't left stranded near the mix box.
          this.restoreBallToSpawn(ball);
          this.game.hud.updateHud('Slot mix này đã có bóng. Chọn slot còn trống.',
            this.game.currentLevelIndex, this.game.mode, this.game.score.score,
            this.game.score.correctHits, this.game.remainingTime);
        } else {
          this.game.mix.placeBallInMixSlot(ball, targetSlot);
        }
        this.placing = null;
        this.orbit.enabled = true;
        this.game.balls.setSelectedBall(null);
        this.resetAimPreview();
        return;
      }
    }

    if (!this.isBallInsidePlacementZone(ball)) {
      this.restoreBallToSpawn(ball);
      this.placing = null;
      this.orbit.enabled = true;
      this.game.balls.setSelectedBall(null);
      this.resetAimPreview();
      this.game.hud.updateHud('Thả bóng lên đường băng để đặt đúng vị trí bạn muốn.',
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime);
      return;
    }

    // Transition to Phase B: keep the ball exactly where the user placed it.
    ball.userData.state = 'placed';
    this.drag = {
      ball,
      placedPos: ball.position.clone(),
      startX: 0,
      startY: 0,
      aimArmed: Boolean(placing.repositioning),
      aiming: false
    };
    this.placing = null;
    this.game.balls.setSelectedBall(null);
    this.orbit.enabled = true;
    this.resetAimPreview();
    const placedMessage = placing.repositioning
      ? 'Đã đặt lại bóng. Nhấn giữ và kéo để căn lực bắn.'
      : 'Đã đặt bóng. Click vào bóng để cầm và đổi vị trí trước khi bắn.';
    this.game.hud.updateHud(placedMessage,
      this.game.currentLevelIndex, this.game.mode, this.game.score.score,
      this.game.score.correctHits, this.game.remainingTime);
  }

  finishAim() {
    const drag = this.drag;
    const aim = this._lastAim;

    if (!aim || !aim.valid) {
      drag.ball.userData.state = 'placed';
      drag.ball.userData.velocity.set(0, 0, 0);
      drag.ball.position.copy(drag.placedPos);
      this.game.balls.setSelectedBall(null);
      drag.aimArmed = false;
      drag.aiming = false;
      this.orbit.enabled = true;
      this.resetAimPreview();
      this.game.hud.updateHud('Lực dưới 5%. Bóng vẫn ở vị trí đặt; kéo lại để căn lực.',
        this.game.currentLevelIndex, this.game.mode, this.game.score.score,
        this.game.score.correctHits, this.game.remainingTime);
      return;
    }

    const velocity = aimVelocity(aim.directionRad, aim.power);
    this.game.balls.launchBall(drag.ball, drag.placedPos.clone(), velocity);
    this.game.balls.setSelectedBall(null);
    this.drag = null;
    this.orbit.enabled = true;
    this.resetAimPreview();
  }

  cancelDrag() {
    // Return any held (placing) or placed (aiming) ball back to the shelf.
    const ball = this.placing?.ball || this.drag?.ball;
    if (ball) {
      this.restoreBallToSpawn(ball);
      this.game.balls.setSelectedBall(null);
    }
    this.drag = null;
    this.placing = null;
    this.orbit.enabled = true;
    this.game.balls.setHoveredBall(null);
    this.resetAimPreview();
  }

  pulseController(event, intensity, duration) {
    const actuator = event?.data?.gamepad?.hapticActuators?.[0] || event?.inputSource?.gamepad?.hapticActuators?.[0];
    if (actuator?.pulse) {
      try {
        actuator.pulse(intensity, duration);
      } catch {
        // Haptic feedback is optional and must never block gameplay.
      }
    }
  }

  pulseInputSource(inputSource, intensity, duration) {
    const actuator = inputSource?.gamepad?.hapticActuators?.[0];
    if (!actuator?.pulse) return;
    try {
      actuator.pulse(intensity, duration);
    } catch {
      // Some runtimes expose an actuator that can reject pulses.
    }
  }

  pulseAll(intensity, duration) {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    session.inputSources.forEach((source) => {
      const actuator = source.gamepad?.hapticActuators?.[0];
      if (actuator?.pulse) {
        try {
          actuator.pulse(intensity, duration);
        } catch {
          // Continue pulsing other controllers.
        }
      }
    });
  }

  updateControllerVRHover(controller, index) {
    const button = this.findControllerVRButton(controller);
    const changed = this.game.vrPanel?.setControllerHover?.(index, button) || false;
    controller.userData.hoveredVRButton = button;
    if (changed && button) {
      this.pulseInputSource(controller.userData.inputSource, 0.08, 22);
    }
    return button;
  }

  updateGamepadButtons() {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    this.controllers.forEach((controller, index) => {
      const inputSource = controller.userData.inputSource || session.inputSources[index];
      const buttons = inputSource?.gamepad?.buttons;
      if (!buttons) return;
      const previous = controller.userData.buttonPressedState || [];
      const primaryPressed = Boolean(buttons[4]?.pressed);
      const secondaryPressed = Boolean(buttons[5]?.pressed);

      if (primaryPressed && !previous[4]) {
        this.game.vrPanel?.toggle?.();
        this.game.vrPanel?.placeInFrontOfCamera?.();
        this.pulseInputSource(inputSource, 0.18, 35);
      }
      if (secondaryPressed && !previous[5]) {
        const closed = this.game.vrPanel?.closeSecondary?.() || false;
        if (!closed) this.cancelControllerAction(controller);
        this.pulseInputSource(inputSource, 0.14, 30);
      }

      previous[4] = primaryPressed;
      previous[5] = secondaryPressed;
      controller.userData.buttonPressedState = previous;
    });
  }

  cancelControllerAction(controller) {
    const ball = controller?.userData?.grabbed;
    if (ball) {
      this.game.scene.attach(ball);
      controller.userData.grabbed = null;
      this.game.balls.resetBall(ball);
      return;
    }
    this.cancelDrag();
  }

  releaseHeldBalls() {
    this.controllers.forEach((controller) => {
      const ball = controller.userData.grabbed;
      if (!ball) return;
      this.game.scene.attach(ball);
      controller.userData.grabbed = null;
      this.game.mix?.clearMixSlotForBall?.(ball);
      ball.userData.state = 'ready';
      ball.userData.velocity?.set?.(0, 0, 0);
      if (ball.userData.spawn) ball.position.copy(ball.userData.spawn);
      ball.rotation.set(0, 0, 0);
      ball.visible = true;
    });
    this.clearControllerHistory();
  }

  clearControllerHistory() {
    this.controllers.forEach((controller) => {
      controller.userData.history = [];
    });
  }

  updateControllers() {
    const now = performance.now() / 1000;
    this.controllers.forEach((controller, index) => {
      const pos = new THREE.Vector3();
      pos.setFromMatrixPosition(controller.matrixWorld);
      controller.userData.history.push({ time: now, pos });
      while (controller.userData.history.length > 8) {
        controller.userData.history.shift();
      }
      this.updateControllerVRHover(controller, index);
      this.updateControllerTargetInfo(controller);
    });
    this.updateGamepadButtons();
  }

  update() {
    if (this.orbit && !this.renderer.xr.isPresenting) {
      this.orbit.update();
    }
    this.updateControllers();
    this.game.balls.updateHoverRing();
  }
}
