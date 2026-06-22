import * as THREE from 'three';
import { AIM, LAYOUT } from './constants.js';

const GRAVITY = 5.8;

export function computeAim(dx, dy) {
  const pullLen = Math.abs(dy);
  const valid = pullLen >= AIM.minDragPx;

  const maxRad = (AIM.maxDirDeg * Math.PI) / 180;
  const dirRatio = THREE.MathUtils.clamp(dx / AIM.pixelsForMaxPower, -1, 1);
  // Pulling right (dx > 0) -> ball goes left: invert sign for slingshot feel.
  const directionRad = -dirRatio * maxRad;

  const rawPowerRatio = THREE.MathUtils.clamp(pullLen / AIM.pixelsForMaxPower, 0, 1);
  const activePowerRatio = THREE.MathUtils.clamp(
    (rawPowerRatio - AIM.minDragRatio) / (1 - AIM.minDragRatio),
    0,
    1
  );
  const curvedPowerRatio = Math.pow(activePowerRatio, AIM.powerExponent);
  const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * curvedPowerRatio;

  return { directionRad, power, powerRatio: curvedPowerRatio, dragLen: pullLen, valid };
}

export function aimVelocity(directionRad, power) {
  const angleRad = (AIM.launchAngleDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(directionRad) * power,
    Math.sin(angleRad) * power * 0.3,
    -Math.cos(directionRad) * power
  );
}

import { resolveSweptTriangleCollision, resolveTriangleCollision } from './triangleCollision.js';
import { resolveBoomerangCollision, resolveSweptBoomerangCollision } from './boomerangCollision.js';

export function predictParabola(directionRad, power, startPos, obstacles = [], mode = 'Easy') {
  const v = aimVelocity(directionRad, power);
  const pos = (startPos ? startPos.clone() : LAYOUT.releasePoint.clone());
  
  const sideLimit = LAYOUT.laneWidth * 0.5 - LAYOUT.ballRadius * 0.52;

  const subSteps = 8;
  const dt = AIM.trajectoryStep / subSteps;
  const sampleEvery = subSteps;

  const pts = [];
  pts.push({ x: pos.x, y: Math.max(pos.y, LAYOUT.ballRadius), z: pos.z });

  const MAX_SAMPLES = AIM.trajectoryPoints; 
  let step = 1;
  let bounces = 0;
  let bounceStep = -1;
  let previousPos = pos.clone();
  
  // Mô phỏng tới khi bóng rớt xuống rãnh hoặc lọt hố (tối đa MAX_SAMPLES điểm vẽ)
  while (pts.length < MAX_SAMPLES) {
    previousPos.copy(pos);
    v.y -= GRAVITY * dt;
    pos.x += v.x * dt;
    pos.y += v.y * dt;
    pos.z += v.z * dt;

    if (pos.y < LAYOUT.ballRadius) {
      pos.y = LAYOUT.ballRadius;
    }

    const rollingOnLane = pos.y <= LAYOUT.ballRadius + 0.025;
    const friction = rollingOnLane ? 0.996 : 0.999;
    v.x *= friction;
    v.z *= friction;

    if (Math.abs(pos.x) > sideLimit) {
      pos.x = Math.sign(pos.x) * sideLimit;
      v.x *= -0.72;
      v.z *= 0.992;
    }

    // Check obstacles if in Hard mode
    if (mode === 'Hard' && obstacles && obstacles.length > 0) {
      for (const obstacle of obstacles) {
        if (obstacle.userData.obstacleType === 'kicker') {
          const hit = resolveTriangleCollision(pos, LAYOUT.ballRadius, obstacle) ??
                      resolveSweptTriangleCollision(previousPos, pos, LAYOUT.ballRadius, obstacle);
          if (hit && bounces < 1) {
            const bounce = obstacle.userData.bounce ?? 1.48;
            const kick = obstacle.userData.kick ?? 2.6;
            const reflected = v.clone().reflect(hit.normal).multiplyScalar(bounce);
            reflected.addScaledVector(hit.tangent, hit.hitOffset * kick);
            
            const horizontalSpeed = Math.hypot(reflected.x, reflected.z);
            if (horizontalSpeed > 20) {
              const scale = 20 / horizontalSpeed;
              reflected.x *= scale;
              reflected.z *= scale;
            }
            v.x = reflected.x;
            v.z = reflected.z;
            v.y = Math.max(v.y, 1.15);
            pos.x = hit.resolvedPosition.x;
            pos.z = hit.resolvedPosition.z;
            bounces++;
            bounceStep = step;
          }
        } else if (obstacle.userData.obstacleType === 'boomerang') {
          const hit = resolveBoomerangCollision(pos, LAYOUT.ballRadius, obstacle) ??
                      resolveSweptBoomerangCollision(previousPos, pos, LAYOUT.ballRadius, obstacle);
          if (hit && bounces < 1) {
            const reflected = v.clone().reflect(hit.normal).multiplyScalar(obstacle.userData.bounce ?? 0.82);
            v.x = reflected.x;
            v.z = reflected.z;
            v.y = Math.max(v.y, 0.62);
            pos.x = hit.resolvedPosition.x;
            pos.z = hit.resolvedPosition.z;
            bounces++;
            bounceStep = step;
          }
        } else {
          // Bumper / Peg
          const dx = pos.x - obstacle.position.x;
          const dz = pos.z - obstacle.position.z;
          const minDist = obstacle.userData.radius + LAYOUT.ballRadius;
          const distSq = dx * dx + dz * dz;
          if (distSq <= minDist * minDist && bounces < 1) {
            const dist = Math.max(Math.sqrt(distSq), 0.001);
            const normal = new THREE.Vector3(dx / dist, 0, dz / dist);
            const bounce = obstacle.userData.bounce ?? 0.78;
            const reflected = v.clone().reflect(normal).multiplyScalar(bounce);
            
            if (obstacle.userData.obstacleType === 'bumper') {
              const horizontalSpeed = Math.hypot(reflected.x, reflected.z);
              if (horizontalSpeed > 18) {
                const scale = 18 / horizontalSpeed;
                reflected.x *= scale;
                reflected.z *= scale;
              }
            }
            v.x = reflected.x;
            v.z = reflected.z;
            const lift = obstacle.userData.obstacleType === 'bumper' ? 1.15 : 0.55;
            v.y = Math.max(v.y, lift);
            pos.x = obstacle.position.x + normal.x * minDist;
            pos.z = obstacle.position.z + normal.z * minDist;
            bounces++;
            bounceStep = step;
          }
        }
      }
    }

    if (step % sampleEvery === 0) {
      pts.push({ x: pos.x, y: Math.max(pos.y, LAYOUT.ballRadius), z: pos.z });
    }
    
    // Nếu đã nảy 1 lần vào vật cản, ta chỉ vẽ thêm một đoạn đường đi tiếp theo rồi ngắt tia ngắm
    if (bounces >= 1 && bounceStep > 0) {
      if ((step - bounceStep) / sampleEvery >= 20) break;
    }
    
    const rollSpeed = Math.hypot(v.x, v.z);
    if (pos.z < LAYOUT.laneEndZ - 0.75 || pos.z > LAYOUT.laneStartZ + 0.8 || rollSpeed < 0.1) {
      break; 
    }
    
    step++;
  }

  // Guarantee exactly AIM.trajectoryPoints samples for the BufferAttribute fill.
  const lastPt = pts[pts.length - 1];
  while (pts.length < MAX_SAMPLES) {
    pts.push({ x: lastPt.x, y: lastPt.y, z: lastPt.z });
  }
  return pts;
}

export function powerColor(powerRatio) {
  const r = THREE.MathUtils.clamp(powerRatio, 0, 1);
  // green (weak) -> yellow -> red (strong)
  const color = new THREE.Color();
  color.setHSL((1 - r) * 0.55, 1, 0.5);
  return color.getHex();
}
