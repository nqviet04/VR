import * as THREE from 'three';

function toWorldPoint(local, obstacle) {
  const point = new THREE.Vector3(local.x, obstacle.position.y, local.z);
  point.applyAxisAngle(new THREE.Vector3(0, 1, 0), obstacle.rotation.y);
  point.x += obstacle.position.x;
  point.z += obstacle.position.z;
  return point;
}

function closestPointOnSegment(point, start, end) {
  const edgeX = end.x - start.x;
  const edgeZ = end.z - start.z;
  const lengthSq = edgeX * edgeX + edgeZ * edgeZ;
  const t = THREE.MathUtils.clamp(
    ((point.x - start.x) * edgeX + (point.z - start.z) * edgeZ) / lengthSq,
    0,
    1
  );
  return {
    point: new THREE.Vector3(start.x + edgeX * t, point.y, start.z + edgeZ * t),
    tangent: new THREE.Vector3(edgeX, 0, edgeZ).normalize()
  };
}

function signedArea(point, a, b) {
  return (point.x - b.x) * (a.z - b.z) - (a.x - b.x) * (point.z - b.z);
}

function isInsideTriangle(point, vertices) {
  const signs = vertices.map((vertex, index) =>
    signedArea(point, vertex, vertices[(index + 1) % vertices.length])
  );
  const hasNegative = signs.some((value) => value < 0);
  const hasPositive = signs.some((value) => value > 0);
  return !(hasNegative && hasPositive);
}

export function resolveBoomerangCollision(ballPosition, ballRadius, obstacle) {
  const vertices = obstacle.userData.vertices.map((vertex) => toWorldPoint(vertex, obstacle));
  const inside = isInsideTriangle(ballPosition, vertices);
  let nearest = null;

  vertices.forEach((vertex, index) => {
    const candidate = closestPointOnSegment(
      ballPosition,
      vertex,
      vertices[(index + 1) % vertices.length]
    );
    const distanceSq = candidate.point.distanceToSquared(ballPosition);
    if (!nearest || distanceSq < nearest.distanceSq) {
      nearest = { ...candidate, distanceSq };
    }
  });

  if (!inside && nearest.distanceSq > ballRadius * ballRadius) return null;

  const normal = inside
    ? nearest.point.clone().sub(ballPosition)
    : ballPosition.clone().sub(nearest.point);
  normal.y = 0;
  if (normal.lengthSq() < 0.000001) {
    normal.set(-nearest.tangent.z, 0, nearest.tangent.x);
  } else {
    normal.normalize();
  }

  return {
    normal,
    resolvedPosition: nearest.point.clone().addScaledVector(normal, ballRadius)
  };
}

export function resolveSweptBoomerangCollision(start, end, ballRadius, obstacle) {
  const travelDistance = Math.hypot(end.x - start.x, end.z - start.z);
  if (travelDistance <= 0.0001) {
    return resolveBoomerangCollision(end, ballRadius, obstacle);
  }

  const sampleCount = Math.min(
    64,
    Math.max(1, Math.ceil(travelDistance / Math.max(ballRadius * 0.45, 0.02)))
  );
  const sample = new THREE.Vector3();

  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    sample.lerpVectors(start, end, t);
    const hit = resolveBoomerangCollision(sample, ballRadius, obstacle);
    if (hit) return { ...hit, sweepT: t };
  }
  return null;
}
