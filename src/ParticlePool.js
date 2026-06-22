import * as THREE from 'three';

const MAX_PARTICLES_PER_SYSTEM = 48;

export class ParticlePool {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];
    this.maxPoolSize = 32;

    this.sharedGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES_PER_SYSTEM * 3);
    this.sharedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }

  _createSystem() {
    const geometry = this.sharedGeometry.clone();
    const material = new THREE.PointsMaterial({
      size: 0.055,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    const system = new THREE.Points(geometry, material);
    system.visible = false;
    system.userData = {
      life: 0,
      maxLife: 0,
      smoke: false,
      velocities: new Array(MAX_PARTICLES_PER_SYSTEM).fill(null).map(() => new THREE.Vector3()),
      count: 0
    };

    return system;
  }

  acquire(position, hex, count, life, speed, smoke = false) {
    count = Math.min(count, MAX_PARTICLES_PER_SYSTEM);

    let system = this.pool.pop();
    if (!system) {
      system = this._createSystem();
      this.scene.add(system);
    }

    const data = system.userData;
    data.life = life;
    data.maxLife = life;
    data.smoke = smoke;
    data.count = count;

    system.material.color.setHex(hex);
    system.material.size = smoke ? 0.085 : 0.055;
    system.material.opacity = smoke ? 0.62 : 0.9;
    system.position.copy(position);
    system.visible = true;

    const attr = system.geometry.getAttribute('position');
    for (let i = 0; i < count; i += 1) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        smoke ? Math.random() * 0.85 : Math.random() * 1.7 - 0.2,
        Math.random() * 2 - 1
      ).normalize();
      const vel = dir.multiplyScalar(speed * (0.45 + Math.random() * 0.9));
      data.velocities[i].copy(vel);
      attr.array[i * 3] = 0;
      attr.array[i * 3 + 1] = 0;
      attr.array[i * 3 + 2] = 0;
    }

    for (let i = count; i < MAX_PARTICLES_PER_SYSTEM; i += 1) {
      attr.array[i * 3] = 0;
      attr.array[i * 3 + 1] = -999;
      attr.array[i * 3 + 2] = 0;
    }
    attr.needsUpdate = true;

    this.active.push(system);
    return system;
  }

  _release(index) {
    const system = this.active[index];
    system.visible = false;
    system.material.opacity = 0;
    this.active.splice(index, 1);

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(system);
    } else {
      this.scene.remove(system);
      system.geometry.dispose();
      system.material.dispose();
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const system = this.active[i];
      const data = system.userData;
      data.life -= dt;

      const attr = system.geometry.getAttribute('position');
      for (let j = 0; j < data.count; j += 1) {
        const v = data.velocities[j];
        attr.array[j * 3] += v.x * dt;
        attr.array[j * 3 + 1] += v.y * dt;
        attr.array[j * 3 + 2] += v.z * dt;
        if (data.smoke) {
          v.y += 0.22 * dt;
          v.multiplyScalar(0.992);
        } else {
          v.y -= 1.25 * dt;
        }
      }
      attr.needsUpdate = true;
      system.material.opacity = Math.max(data.life / data.maxLife, 0) * (data.smoke ? 0.62 : 0.9);

      if (data.life <= 0) {
        this._release(i);
      }
    }
  }

  spawnFirework(position, hex) {
    this.acquire(position, hex, 42, 0.9, 0.9);
  }

  spawnSpark(position, hex, count = 12, life = 0.25) {
    this.acquire(position, hex, count, life, 0.38);
  }

  spawnSmoke(position) {
    this.acquire(position, 0x151515, 28, 0.85, 0.5, true);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      this._release(i);
    }
  }

  dispose() {
    for (const system of this.active) {
      this.scene.remove(system);
      system.geometry.dispose();
      system.material.dispose();
    }
    for (const system of this.pool) {
      this.scene.remove(system);
      system.geometry.dispose();
      system.material.dispose();
    }
    this.active = [];
    this.pool = [];
    this.sharedGeometry.dispose();
  }
}
