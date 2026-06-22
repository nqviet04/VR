import * as THREE from 'three';
import { LAYOUT } from './constants.js';

const OBSTACLE_STYLES = {
  peg: {
    height: 0.08,
    color: 0x29313b,
    emissive: 0x101626,
    emissiveIntensity: 0.45,
    radialSegments: 28
  },
  bumper: {
    color: 0xe62936,
    emissive: 0x7d0c18,
    emissiveIntensity: 1.2,
    height: 0.08,
    radialSegments: 28
  }
};

const KICKER = {
  length: 0.52,
  width: 0.16,
  height: 0.055,
  bodyColor: 0x137da3,
  bodyEmissive: 0x063d59,
  bodyEmissiveIntensity: 0.65,
  rubberColor: 0x58eaff,
  rubberEmissive: 0x12a7d3,
  rubberEmissiveIntensity: 1.45,
  metalColor: 0xd7f7ff
};

function createStandardObstacle(item) {
  const style = OBSTACLE_STYLES[item.type] ?? OBSTACLE_STYLES.peg;
  const geometry = new THREE.CylinderGeometry(
    item.radius,
    item.radius,
    style.height,
    style.radialSegments
  );
  const material = new THREE.MeshStandardMaterial({
    color: style.color,
    emissive: style.emissive,
    emissiveIntensity: style.emissiveIntensity,
    roughness: 0.4,
    metalness: 0.35
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(item.x, LAYOUT.floorY + style.height * 0.5, item.z);
  mesh.userData = {
    obstacleType: item.type,
    radius: item.radius,
    bounce: item.bounce
  };
  return mesh;
}

function createStarShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = Math.PI * 0.5 + index * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createBumper(item) {
  const style = OBSTACLE_STYLES.bumper;
  const group = new THREE.Group();
  group.position.set(item.x, LAYOUT.floorY, item.z);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(item.radius, item.radius, style.height, style.radialSegments),
    new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.emissive,
      emissiveIntensity: style.emissiveIntensity,
      roughness: 0.32,
      metalness: 0.28
    })
  );
  body.name = 'bumper-body';
  body.position.y = style.height * 0.5;
  group.add(body);

  const star = new THREE.Mesh(
    new THREE.ShapeGeometry(createStarShape(item.radius * 0.58, item.radius * 0.25)),
    new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xffc96b,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide
    })
  );
  star.name = 'bumper-star';
  star.rotation.x = -Math.PI * 0.5;
  star.position.y = style.height + 0.008;
  group.add(star);

  group.userData = {
    obstacleType: 'bumper',
    radius: item.radius,
    bounce: item.bounce
  };
  return group;
}

function createPrismFromVertices(vertices, height) {
  const positions = [];
  vertices.forEach((vertex) => positions.push(vertex.x, 0, vertex.z));
  vertices.forEach((vertex) => positions.push(vertex.x, height, vertex.z));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    1, 2, 5, 1, 5, 4,
    2, 0, 3, 2, 3, 5
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedContour(vertices, cornerDistance, curveSegments = 5) {
  const contour = [];

  vertices.forEach((vertex, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const towardPrevious = previous.clone().sub(vertex).normalize();
    const towardNext = next.clone().sub(vertex).normalize();
    const start = vertex.clone().addScaledVector(towardPrevious, cornerDistance);
    const end = vertex.clone().addScaledVector(towardNext, cornerDistance);

    contour.push(new THREE.Vector2(start.x, start.z));
    for (let step = 1; step <= curveSegments; step += 1) {
      const t = step / curveSegments;
      const inverse = 1 - t;
      contour.push(new THREE.Vector2(
        inverse * inverse * start.x + 2 * inverse * t * vertex.x + t * t * end.x,
        inverse * inverse * start.z + 2 * inverse * t * vertex.z + t * t * end.z
      ));
    }
  });

  return contour;
}

function createRoundedPrismGeometry(vertices, height, cornerDistance) {
  const contour = createRoundedContour(vertices, cornerDistance);
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions = [];
  const indices = [];

  contour.forEach((point) => positions.push(point.x, 0, point.y));
  contour.forEach((point) => positions.push(point.x, height, point.y));

  triangles.forEach(([a, b, c]) => {
    indices.push(c, b, a);
    indices.push(a + contour.length, b + contour.length, c + contour.length);
  });

  contour.forEach((_, index) => {
    const next = (index + 1) % contour.length;
    const upper = index + contour.length;
    const upperNext = next + contour.length;
    indices.push(index, next, upperNext, index, upperNext, upper);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function insetVertices(vertices, scale) {
  const center = vertices
    .reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
    .multiplyScalar(1 / vertices.length);
  return vertices.map((vertex) => center.clone().lerp(vertex, scale));
}

function createBoomerang(item) {
  const group = new THREE.Group();
  group.position.set(item.x, LAYOUT.floorY, item.z);
  group.rotation.y = item.angle ?? 0;

  const mirror = item.mirror ?? 1;
  const height = item.height ?? 0.065;
  const cornerRadius = item.cornerRadius ?? 0.035;
  const halfBase = item.halfBase ?? 0.27;
  const apexDepth = halfBase / Math.tan(THREE.MathUtils.degToRad(60));
  const tipX = mirror * 0.13;
  const baseX = tipX - mirror * apexDepth;
  const vertices = [
    new THREE.Vector3(tipX, 0, 0),
    new THREE.Vector3(baseX, 0, halfBase),
    new THREE.Vector3(baseX, 0, -halfBase)
  ];
  const faceVertices = insetVertices(vertices, 0.82);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x101a2b,
    emissive: 0x040914,
    emissiveIntensity: 0.5,
    roughness: 0.34,
    metalness: 0.58
  });
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d2b43,
    emissive: 0x0a1830,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.5
  });
  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9f8ff,
    emissive: 0x4edcff,
    emissiveIntensity: 1.15,
    roughness: 0.22,
    metalness: 0.35
  });

  const base = new THREE.Mesh(
    createRoundedPrismGeometry(vertices, height, cornerRadius),
    baseMaterial
  );
  base.name = 'boomerang-base';
  group.add(base);

  const face = new THREE.Mesh(
    createRoundedPrismGeometry(faceVertices, 0.014, cornerRadius * 0.72),
    faceMaterial
  );
  face.name = 'boomerang-face';
  face.position.y = height;
  group.add(face);

  faceVertices.forEach((vertex, index) => {
    const next = faceVertices[(index + 1) % faceVertices.length];
    group.add(createRail(
      `boomerang-border-${index}`,
      vertex,
      next,
      height + 0.022,
      0.012,
      borderMaterial
    ));
  });

  const star = new THREE.Mesh(
    new THREE.ShapeGeometry(createStarShape(0.07, 0.03)),
    new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xffd27a,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );
  star.name = 'boomerang-star';
  star.rotation.x = -Math.PI * 0.5;
  const triangleCenter = vertices
    .reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3())
    .multiplyScalar(1 / vertices.length);
  star.position.set(triangleCenter.x, height + 0.038, triangleCenter.z);
  group.add(star);

  group.userData = {
    obstacleType: 'boomerang',
    bounce: item.bounce ?? 0.82,
    cornerRadius,
    vertices: vertices.map((vertex) => ({ x: vertex.x, z: vertex.z }))
  };
  return group;
}

function getKickerLocalVertices(length, width) {
  return [
    new THREE.Vector3(0, 0, length * 0.5),
    new THREE.Vector3(width * 0.5, 0, -length * 0.5),
    new THREE.Vector3(-width * 0.5, 0, -length * 0.5)
  ];
}

function createTrianglePrismGeometry(length, width, height) {
  const points = getKickerLocalVertices(length, width);
  const positions = [];

  points.forEach((point) => positions.push(point.x, 0, point.z));
  points.forEach((point) => positions.push(point.x, height, point.z));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    1, 2, 5, 1, 5, 4,
    2, 0, 3, 2, 3, 5
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function createRail(name, start, end, y, radius, material) {
  const from = new THREE.Vector3(start.x, y, start.z);
  const to = new THREE.Vector3(end.x, y, end.z);
  const direction = to.clone().sub(from);
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 12),
    material
  );
  rail.name = name;
  rail.position.copy(from).add(to).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return rail;
}

function createKicker(item) {
  const length = item.length ?? KICKER.length;
  const width = item.width ?? KICKER.width;
  const height = item.height ?? KICKER.height;
  const root = new THREE.Group();
  root.position.set(item.x, LAYOUT.floorY, item.z);
  root.rotation.y = item.angle ?? 0;

  const visual = new THREE.Group();
  visual.name = 'kicker-visual';
  root.add(visual);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: KICKER.bodyColor,
    emissive: KICKER.bodyEmissive,
    emissiveIntensity: KICKER.bodyEmissiveIntensity,
    roughness: 0.32,
    metalness: 0.42
  });
  const rubberMaterial = new THREE.MeshStandardMaterial({
    color: KICKER.rubberColor,
    emissive: KICKER.rubberEmissive,
    emissiveIntensity: KICKER.rubberEmissiveIntensity,
    roughness: 0.28,
    metalness: 0.16
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: KICKER.metalColor,
    emissive: 0x204b5a,
    emissiveIntensity: 0.38,
    roughness: 0.24,
    metalness: 0.8
  });

  const body = new THREE.Mesh(
    createTrianglePrismGeometry(length, width, height),
    bodyMaterial
  );
  body.name = 'kicker-body';
  visual.add(body);

  const [tip, rightBase, leftBase] = getKickerLocalVertices(length, width);
  const railY = height + 0.012;
  const railRadius = Math.max(0.012, width * 0.085);

  visual.add(createRail(
    'kicker-rubber-left',
    tip,
    leftBase,
    railY,
    railRadius,
    rubberMaterial
  ));
  visual.add(createRail(
    'kicker-rubber-right',
    tip,
    rightBase,
    railY,
    railRadius,
    rubberMaterial
  ));

  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.19, width * 0.19, height + 0.055, 24),
    metalMaterial
  );
  hinge.name = 'kicker-hinge';
  hinge.position.set(0, (height + 0.055) * 0.5, -length * 0.39);
  visual.add(hinge);

  const hingeRing = new THREE.Mesh(
    new THREE.TorusGeometry(width * 0.25, width * 0.045, 10, 28),
    rubberMaterial
  );
  hingeRing.name = 'kicker-hinge-ring';
  hingeRing.rotation.x = Math.PI * 0.5;
  hingeRing.position.set(0, height + 0.032, -length * 0.39);
  visual.add(hingeRing);

  const tipCap = new THREE.Mesh(
    new THREE.CylinderGeometry(railRadius * 1.15, railRadius * 1.15, height + 0.035, 18),
    rubberMaterial
  );
  tipCap.name = 'kicker-tip';
  tipCap.position.set(0, (height + 0.035) * 0.5, length * 0.5);
  visual.add(tipCap);

  root.userData = {
    obstacleType: 'kicker',
    radius: item.radius,
    length,
    width,
    height,
    bounce: item.bounce,
    kick: item.kick,
    angle: item.angle ?? 0,
    kickerVisual: visual,
    kickerMaterials: [
      { material: bodyMaterial, rest: KICKER.bodyEmissiveIntensity },
      { material: rubberMaterial, rest: KICKER.rubberEmissiveIntensity }
    ],
    kickerAnimation: {
      angle: 0,
      angularVelocity: 0,
      compression: 0,
      flash: 0
    }
  };

  return root;
}

export function createObstacleMesh(item) {
  if (item.type === 'kicker') return createKicker(item);
  if (item.type === 'bumper') return createBumper(item);
  if (item.type === 'boomerang') return createBoomerang(item);
  return createStandardObstacle(item);
}

export function triggerKickerBounce(obstacle, impactDirection = 1) {
  const animation = obstacle?.userData?.kickerAnimation;
  if (!animation) return;

  const direction = impactDirection < 0 ? -1 : 1;
  animation.angularVelocity = direction * 8.5;
  animation.compression = 1;
  animation.flash = 1;
}

export function updateObstacleAnimations(obstacles, dt) {
  obstacles.forEach((obstacle) => {
    const animation = obstacle.userData.kickerAnimation;
    const visual = obstacle.userData.kickerVisual;
    if (!animation || !visual) return;

    const springAcceleration = -95 * animation.angle - 15 * animation.angularVelocity;
    animation.angularVelocity += springAcceleration * dt;
    animation.angle += animation.angularVelocity * dt;
    animation.compression *= Math.exp(-11 * dt);
    animation.flash *= Math.exp(-9 * dt);

    if (Math.abs(animation.angle) < 0.0001 && Math.abs(animation.angularVelocity) < 0.001) {
      animation.angle = 0;
      animation.angularVelocity = 0;
    }

    visual.rotation.y = animation.angle;
    visual.scale.set(1 + animation.compression * 0.07, 1, 1 - animation.compression * 0.16);

    obstacle.userData.kickerMaterials.forEach(({ material, rest }) => {
      material.emissiveIntensity = rest + animation.flash * 1.8;
    });
  });
}
