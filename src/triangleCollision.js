import * as THREE from 'three';

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
    t,
    tangent: new THREE.Vector3(edgeX, 0, edgeZ).normalize()
  };
}

function signedArea(point, a, b) {
  return (point.x - b.x) * (a.z - b.z) - (a.x - b.x) * (point.z - b.z);
}

function isInsideTriangle(point, vertices) {
  const d1 = signedArea(point, vertices[0], vertices[1]);
  const d2 = signedArea(point, vertices[1], vertices[2]);
  const d3 = signedArea(point, vertices[2], vertices[0]);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

export function getTriangleVertices(obstacle) {
  const length = obstacle.userData.length ?? 0.52;
  const width = obstacle.userData.width ?? 0.16;
  const angle = obstacle.userData.angle ?? obstacle.rotation.y ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localVertices = [
    { x: 0, z: length * 0.5 },
    { x: width * 0.5, z: -length * 0.5 },
    { x: -width * 0.5, z: -length * 0.5 }
  ];

  return localVertices.map((vertex) => {
    return new THREE.Vector3(
      obstacle.position.x + vertex.x * cos + vertex.z * sin,
      obstacle.position.y,
      obstacle.position.z - vertex.x * sin + vertex.z * cos
    );
  });
}

export function resolveTriangleCollision(ballPosition, ballRadius, obstacle) {
  const vertices = getTriangleVertices(obstacle);
  const inside = isInsideTriangle(ballPosition, vertices);
  let nearest = null;

  for (let index = 0; index < vertices.length; index += 1) {
    const candidate = closestPointOnSegment(
      ballPosition,
      vertices[index],
      vertices[(index + 1) % vertices.length]
    );
    const distanceSq = candidate.point.distanceToSquared(ballPosition);
    if (!nearest || distanceSq < nearest.distanceSq) {
      nearest = { ...candidate, distanceSq };
    }
  }

  const distance = Math.sqrt(nearest.distanceSq);
  if (!inside && distance > ballRadius) return null;

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
    tangent: nearest.tangent,
    hitOffset: (nearest.t - 0.5) * 2,
    resolvedPosition: nearest.point.clone().addScaledVector(normal, ballRadius)
  };
}

export function resolveSweptTriangleCollision(start, end, ballRadius, obstacle) {
  const travelX = end.x - start.x;
  const travelZ = end.z - start.z;
  const travelDistance = Math.hypot(travelX, travelZ);
  if (travelDistance <= 0.0001) {
    return resolveTriangleCollision(end, ballRadius, obstacle);
  }

  const sampleSpacing = Math.max(ballRadius * 0.45, 0.025);
  const sampleCount = Math.min(64, Math.max(1, Math.ceil(travelDistance / sampleSpacing)));
  const sample = new THREE.Vector3();

  for (let index = 1; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    sample.lerpVectors(start, end, t);
    const hit = resolveTriangleCollision(sample, ballRadius, obstacle);
    if (hit) return { ...hit, sweepT: t };
  }

  return null;
}
