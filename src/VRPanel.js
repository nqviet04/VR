import * as THREE from 'three';

const PANEL_WIDTH = 1.42;
const PANEL_HEIGHT = 1.26;
const BUTTON_LAYOUT = {
  easy: { label: 'Chơi Easy', y: 0.08 },
  hard: { label: 'Chơi Hard', y: -0.25 },
  next: { label: 'Level tiếp', y: 0.02 },
  reset: { label: 'Reset', y: -0.28 },
  changeMode: { label: 'Đổi chế độ', y: -0.58 },
  retry: { label: 'Chơi lại level', y: -0.12 },
  playAgain: { label: 'Chơi lại từ đầu', y: -0.12 }
};

const MODE_BUTTONS = {
  menu: ['easy', 'hard'],
  playing: ['next', 'reset', 'changeMode'],
  timeout: ['retry', 'changeMode', 'reset'],
  victory: ['playAgain', 'changeMode']
};

function stableSnapshot(snapshot) {
  return JSON.stringify({
    levelLabel: snapshot.levelLabel || '',
    mode: snapshot.mode || '',
    score: snapshot.score || 0,
    correctHits: snapshot.correctHits || 0,
    totalTargets: snapshot.totalTargets || 0,
    remainingTime: Number.isFinite(snapshot.remainingTime) ? Math.ceil(snapshot.remainingTime) : 'Infinity',
    status: snapshot.status || '',
    hasNextUnlocked: Boolean(snapshot.hasNextUnlocked)
  });
}

export class VRPanel {
  constructor(scene, camera, onAction, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.onAction = onAction;
    this.mode = 'menu';
    this.snapshot = {};
    this.snapshotKey = '';
    this.dirty = true;
    this.expanded = true;
    this.controllerHover = new Map();
    this.buttons = new Map();
    this.group = new THREE.Group();
    this.group.name = 'vr-control-panel';
    this.group.visible = false;

    Object.entries(BUTTON_LAYOUT).forEach(([id, config]) => {
      this.buttons.set(id, {
        id,
        label: config.label,
        y: config.y,
        visible: false,
        enabled: true,
        object: Object.assign(new THREE.Object3D(), {
          userData: { vrButtonId: id }
        })
      });
    });

    if (options.createVisuals !== false) {
      this.createVisuals();
      this.scene?.add(this.group);
    }
    this.applyMode();
  }

  createVisuals() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide
      })
    );
    background.name = 'vr-panel-surface';
    background.renderOrder = 100;
    this.group.add(background);

    this.buttons.forEach((button) => {
      const hitTarget = new THREE.Mesh(
        new THREE.PlaneGeometry(1.12, 0.25),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      hitTarget.name = `vr-button-${button.id}`;
      hitTarget.position.set(0, button.y, 0.012);
      hitTarget.userData.vrButtonId = button.id;
      hitTarget.renderOrder = 101;
      this.group.add(hitTarget);
      button.object = hitTarget;
    });
    this.render();
  }

  getButton(id) {
    return this.buttons.get(id);
  }

  getVisibleButtonIds() {
    return [...this.buttons.values()]
      .filter((button) => button.visible)
      .map((button) => button.id);
  }

  getInteractiveObjects() {
    if (!this.group.visible || !this.expanded) return [];
    return [...this.buttons.values()]
      .filter((button) => button.visible && button.enabled && button.object)
      .map((button) => button.object);
  }

  showMenu() {
    this.setMode('menu');
  }

  showPlaying() {
    this.setMode('playing');
  }

  showTimeout() {
    this.setMode('timeout');
  }

  showVictory() {
    this.setMode('victory');
  }

  setMode(mode) {
    if (!MODE_BUTTONS[mode]) return;
    if (this.mode !== mode) {
      this.mode = mode;
      this.dirty = true;
    }
    this.expanded = true;
    this.group.visible = true;
    this.applyMode();
  }

  applyMode() {
    const visibleIds = new Set(MODE_BUTTONS[this.mode]);
    this.buttons.forEach((button) => {
      button.visible = visibleIds.has(button.id);
      if (button.object) button.object.visible = button.visible && this.expanded;
    });
    const next = this.buttons.get('next');
    next.enabled = Boolean(this.snapshot.hasNextUnlocked);
    this.dirty = true;
    this.render();
  }

  update(snapshot = {}) {
    const nextKey = stableSnapshot(snapshot);
    if (nextKey === this.snapshotKey) return false;
    this.snapshot = { ...snapshot };
    this.snapshotKey = nextKey;
    this.buttons.get('next').enabled = Boolean(snapshot.hasNextUnlocked);
    this.dirty = true;
    this.render();
    return true;
  }

  consumeDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  resolveButton(buttonOrId) {
    if (typeof buttonOrId === 'string') return this.buttons.get(buttonOrId) || null;
    const id = buttonOrId?.userData?.vrButtonId;
    return id ? this.buttons.get(id) || null : null;
  }

  activate(buttonOrId) {
    const button = this.resolveButton(buttonOrId);
    if (!button?.visible || !button.enabled) return false;
    this.onAction?.(button.id);
    return true;
  }

  setControllerHover(controllerIndex, buttonObject) {
    const button = this.resolveButton(buttonObject);
    const nextId = button?.visible && button.enabled ? button.id : null;
    if (this.controllerHover.get(controllerIndex) === nextId) return false;
    if (nextId) this.controllerHover.set(controllerIndex, nextId);
    else this.controllerHover.delete(controllerIndex);
    this.dirty = true;
    this.render();
    return true;
  }

  getControllerHover(controllerIndex) {
    return this.controllerHover.get(controllerIndex) || null;
  }

  clearHover() {
    if (this.controllerHover.size === 0) return;
    this.controllerHover.clear();
    this.dirty = true;
    this.render();
  }

  toggle() {
    if (this.mode !== 'playing') {
      this.group.visible = true;
      this.expanded = true;
    } else {
      this.expanded = !this.expanded;
      this.group.visible = this.expanded;
    }
    this.applyMode();
  }

  closeSecondary() {
    if (this.mode === 'playing') {
      this.expanded = false;
      this.group.visible = false;
      this.applyMode();
      return true;
    }
    return false;
  }

  placeInFrontOfCamera() {
    if (!this.camera) return;
    const cameraPosition = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    this.camera.getWorldDirection(direction);
    right.set(1, 0, 0).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    this.group.position.copy(cameraPosition)
      .addScaledVector(direction, 1.55)
      .addScaledVector(right, -0.58);
    this.group.position.y += 0.16;
    this.group.lookAt(cameraPosition);
  }

  render() {
    if (!this.context || !this.dirty) return;
    const ctx = this.context;
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'rgba(10, 16, 31, 0.94)';
    ctx.strokeStyle = '#55e7ff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(18, 18, 988, 988, 46);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 52px Arial, sans-serif';
    ctx.fillText(this.getTitle(), 512, 100);

    ctx.font = '600 34px Arial, sans-serif';
    ctx.fillStyle = '#bcefff';
    ctx.fillText(this.getStatsLine(), 512, 164);

    ctx.font = '500 28px Arial, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    this.drawWrappedText(this.snapshot.status || this.getDefaultStatus(), 512, 218, 850, 38);

    this.buttons.forEach((button) => {
      if (!button.visible) return;
      const hovered = [...this.controllerHover.values()].includes(button.id);
      const x = 112;
      const y = 512 - button.y * 720 - 66;
      const width = 800;
      const height = 132;
      ctx.fillStyle = button.enabled
        ? hovered ? '#1bbbd1' : '#174b69'
        : '#303746';
      ctx.strokeStyle = button.enabled ? '#9af6ff' : '#667085';
      ctx.lineWidth = hovered ? 9 : 5;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = button.enabled ? '#ffffff' : '#8c96a8';
      ctx.font = '700 42px Arial, sans-serif';
      ctx.fillText(button.label, 512, y + 82);
    });

    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  drawWrappedText(text, centerX, startY, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (this.context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((item, index) => {
      this.context.fillText(item, centerX, startY + index * lineHeight);
    });
  }

  getTitle() {
    if (this.mode === 'menu') return 'VR Color Bowling';
    if (this.mode === 'timeout') return 'Hết giờ';
    if (this.mode === 'victory') return 'Chiến thắng';
    return this.snapshot.levelLabel || 'Đang chơi';
  }

  getStatsLine() {
    if (this.mode === 'menu') return 'Chọn chế độ bằng trigger';
    const time = Number.isFinite(this.snapshot.remainingTime)
      ? `${Math.ceil(Math.max(0, this.snapshot.remainingTime))}s`
      : 'Không giới hạn';
    return `${this.snapshot.mode || '-'} | Điểm ${this.snapshot.score || 0} | `
      + `${this.snapshot.correctHits || 0}/${this.snapshot.totalTargets || 0} | ${time}`;
  }

  getDefaultStatus() {
    if (this.mode === 'menu') return 'Dùng ray của tay trái hoặc tay phải để chọn.';
    if (this.mode === 'timeout') return 'Chọn chơi lại level hoặc đổi chế độ.';
    if (this.mode === 'victory') return 'Bạn đã hoàn thành toàn bộ game.';
    return 'A/X mở bảng. B/Y đóng hoặc hủy thao tác.';
  }

  dispose() {
    this.scene?.remove(this.group);
    this.group.traverse((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
    this.texture?.dispose?.();
    this.buttons.clear();
    this.controllerHover.clear();
  }
}
