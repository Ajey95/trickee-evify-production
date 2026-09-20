"use client";

import { Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getSceneFrame } from "@/lib/journey-motion.mjs";
import { useJourneyStore } from "./journey-store";

const ROUTE_POINTS: [number, number, number][] = [
  [-4.6, -1.8, 2.8], [-3.5, -1.25, 1.9], [-2.45, -1.42, 1.05], [-1.5, -0.62, 0.25],
  [-0.55, -0.86, -0.75], [0.42, 0.18, -1.7], [1.22, -0.18, -2.7], [2.1, 0.82, -3.7],
  [3.15, 0.48, -4.9], [4.35, 1.15, -6.1],
];

const CAMERA_FRAMES = [
  { position: [0, 1.05, 6.4], target: [0, -0.2, -1.3] },
  { position: [1.65, 0.5, 5.35], target: [0.2, -0.15, -2.1] },
  { position: [-1.05, 1.35, 4.95], target: [0.25, 0, -2.7] },
  { position: [0.4, 2.2, 4.45], target: [0.45, -0.1, -3.1] },
  { position: [-1.55, 0.45, 4.15], target: [0.6, -0.2, -3.7] },
  { position: [0.15, 1.25, 5.8], target: [0.8, 0.1, -4.4] },
] as const;

const TOWER_POSITIONS = [
  [-3.4, -1.62, 0.3, 0.8], [-2.8, -1.45, -1.5, 1.4], [-2.05, -1.35, -2.9, 0.95],
  [2.8, -1.5, -0.5, 1.25], [3.45, -1.3, -2.4, 1.8], [2.65, -1.4, -4.25, 1.05],
] as const;

function createTelemetryPositions(count: number) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.39996;
    const radius = 1.1 + ((index * 17) % 73) / 18;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (((index * 29) % 100) / 100 - 0.5) * 5.8;
    positions[index * 3 + 2] = Math.sin(angle) * radius - 2.4;
  }
  return positions;
}

function LivingRouteWorld() {
  const world = useRef<THREE.Group>(null);
  const vehicle = useRef<THREE.Group>(null);
  const vehicleHalo = useRef<THREE.Mesh>(null);
  const telemetry = useRef<THREE.Points>(null);
  const photons = useRef<THREE.Points>(null);
  const tunnel = useRef<THREE.Group>(null);
  const towerGroup = useRef<THREE.Group>(null);
  const routeCore = useRef<THREE.MeshStandardMaterial>(null);
  const routeGlow = useRef<THREE.MeshBasicMaterial>(null);
  const cyanLight = useRef<THREE.PointLight>(null);
  const yellowLight = useRef<THREE.PointLight>(null);
  const cameraTarget = useRef(new THREE.Vector3(0, -0.2, -1.3));
  const telemetryPositions = useMemo(() => createTelemetryPositions(480), []);
  const photonPositions = useMemo(() => new Float32Array(96 * 3), []);
  const photonPhases = useMemo(() => Array.from({ length: 96 }, (_, index) => index / 96), []);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
    [],
  );

  useFrame(({ camera, clock, scene }) => {
    const progress = useJourneyStore.getState().progress;
    const frame = getSceneFrame(progress);
    const elapsed = clock.getElapsedTime();
    const routeT = Math.min(0.985, 0.025 + progress * 0.95);
    const routePosition = curve.getPoint(routeT);
    const routeTangent = curve.getTangent(routeT);
    const ease = frame.local * frame.local * (3 - 2 * frame.local);
    const currentCamera = CAMERA_FRAMES[frame.chapter];
    const nextCamera = CAMERA_FRAMES[Math.min(frame.chapter + 1, CAMERA_FRAMES.length - 1)];

    if (vehicle.current) {
      vehicle.current.position.copy(routePosition);
      vehicle.current.rotation.y = Math.atan2(routeTangent.x, routeTangent.z);
      vehicle.current.position.y += Math.sin(elapsed * 3.1) * 0.035;
      const vehicleScale = 1.08 + frame.routeEnergy * 0.28;
      vehicle.current.scale.setScalar(vehicleScale);
    }

    if (vehicleHalo.current) {
      const pulsePhase = (elapsed * 0.55) % 1;
      vehicleHalo.current.position.copy(routePosition);
      vehicleHalo.current.rotation.x = -Math.PI / 2;
      vehicleHalo.current.scale.setScalar(1 + pulsePhase * 2.4);
      const haloMaterial = vehicleHalo.current.material as THREE.MeshBasicMaterial;
      haloMaterial.opacity = Math.max(0, 0.58 - pulsePhase * 0.58);
    }

    if (photons.current) {
      const positionAttribute = photons.current.geometry.attributes.position as THREE.BufferAttribute;
      photonPhases.forEach((phase, index) => {
        const t = (phase * 0.34 + elapsed * (0.075 + frame.routeEnergy * 0.08) + progress * 0.9) % 1;
        const point = curve.getPoint(t);
        const spread = Math.sin(index * 12.31 + elapsed * 2) * 0.035;
        positionAttribute.setXYZ(index, point.x + spread, point.y + spread * 0.6, point.z);
      });
      positionAttribute.needsUpdate = true;
      const material = photons.current.material as THREE.PointsMaterial;
      material.opacity = 0.5 + frame.routeEnergy * 0.5;
      material.size = 0.045 + frame.routeEnergy * 0.035;
    }

    if (telemetry.current) {
      telemetry.current.rotation.y = elapsed * 0.035 + progress * 1.8;
      telemetry.current.rotation.z = Math.sin(progress * Math.PI * 3) * 0.12;
      telemetry.current.position.y = Math.sin(elapsed * 0.22) * 0.18;
      const material = telemetry.current.material as THREE.PointsMaterial;
      material.opacity = 0.18 + frame.telemetry * 0.68;
      material.size = 0.012 + frame.telemetry * 0.026;
    }

    if (tunnel.current) {
      tunnel.current.rotation.z = elapsed * 0.035 + progress * Math.PI * 1.5;
      tunnel.current.position.z = -2.3 - frame.camera.travel * 0.35;
      tunnel.current.scale.setScalar(0.8 + frame.transition * 0.45);
      tunnel.current.children.forEach((child, index) => {
        const ring = child as THREE.Mesh;
        ring.rotation.z = elapsed * (index % 2 ? -0.07 : 0.05) + index * 0.14;
        const material = ring.material as THREE.MeshBasicMaterial;
        material.opacity = 0.025 + frame.transition * 0.11 + (index % 3) * 0.012;
      });
    }

    if (towerGroup.current) {
      towerGroup.current.position.z = frame.camera.travel * 0.2;
      towerGroup.current.children.forEach((child, index) => {
        child.scale.y = 0.72 + Math.sin(elapsed * 1.7 + index * 1.3) * 0.08 + frame.telemetry * 0.35;
      });
    }

    if (routeCore.current) routeCore.current.emissiveIntensity = 2.2 + frame.routeEnergy * 4.8;
    if (routeGlow.current) routeGlow.current.opacity = 0.09 + frame.routeEnergy * 0.16;
    if (cyanLight.current) cyanLight.current.intensity = 20 + frame.telemetry * 34;
    if (yellowLight.current) yellowLight.current.intensity = 24 + frame.routeEnergy * 42;

    if (world.current) {
      world.current.rotation.z = Math.sin(progress * Math.PI * 2) * 0.055;
      world.current.position.y = progress * 0.38;
      world.current.position.x = frame.camera.drift * 0.28;
    }

    const desiredX = THREE.MathUtils.lerp(currentCamera.position[0], nextCamera.position[0], ease);
    const desiredY = THREE.MathUtils.lerp(currentCamera.position[1], nextCamera.position[1], ease);
    const desiredZ = THREE.MathUtils.lerp(currentCamera.position[2], nextCamera.position[2], ease);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredX, 0.055);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredY, 0.055);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredZ, 0.055);
    cameraTarget.current.set(
      THREE.MathUtils.lerp(currentCamera.target[0], nextCamera.target[0], ease),
      THREE.MathUtils.lerp(currentCamera.target[1], nextCamera.target[1], ease),
      THREE.MathUtils.lerp(currentCamera.target[2], nextCamera.target[2], ease),
    );
    camera.lookAt(cameraTarget.current);

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = 5.2 - frame.transition * 1.1;
      scene.fog.far = 18 - frame.telemetry * 3;
    }
  });

  return (
    <group ref={world} scale={1.14}>
      <ambientLight intensity={0.32} color="#a8d9e5" />
      <pointLight ref={cyanLight} color="#48dff4" intensity={42} distance={13} position={[-2.7, 2.2, 3.4]} />
      <pointLight ref={yellowLight} color="#ffe000" intensity={48} distance={12} position={[3.2, 1.2, -1.4]} />
      <directionalLight color="#d8f7ff" intensity={1.7} position={[0, 5, 3]} />

      <mesh><tubeGeometry args={[curve, 180, 0.115, 16, false]} /><meshBasicMaterial ref={routeGlow} color="#ffe000" transparent opacity={0.2} toneMapped={false} /></mesh>
      <mesh><tubeGeometry args={[curve, 180, 0.032, 12, false]} /><meshStandardMaterial ref={routeCore} color="#fff4a4" emissive="#ffe000" emissiveIntensity={6} metalness={0.15} roughness={0.12} toneMapped={false} /></mesh>
      <Line points={ROUTE_POINTS} color="#48dff4" lineWidth={1.4} transparent opacity={0.55} dashed dashSize={0.08} gapSize={0.16} />

      <points ref={photons}><bufferGeometry><bufferAttribute attach="attributes-position" args={[photonPositions, 3]} /></bufferGeometry><pointsMaterial color="#fff5a8" size={0.07} transparent opacity={0.9} sizeAttenuation toneMapped={false} /></points>
      <points ref={telemetry}><bufferGeometry><bufferAttribute attach="attributes-position" args={[telemetryPositions, 3]} /></bufferGeometry><pointsMaterial color="#48dff4" size={0.03} transparent opacity={0.72} sizeAttenuation depthWrite={false} toneMapped={false} /></points>

      <group ref={tunnel}>
        {Array.from({ length: 13 }, (_, index) => (
          <mesh key={index} position={[0.5, 0, -index * 0.58]} rotation={[0, 0, index * 0.13]}>
            <torusGeometry args={[2.1 + index * 0.065, 0.008 + (index % 3) * 0.004, 8, 72]} />
            <meshBasicMaterial color={index % 3 === 0 ? "#ffe000" : "#48dff4"} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>

      <group ref={towerGroup}>
        {TOWER_POSITIONS.map(([x, y, z, height], index) => (
          <group key={`${x}-${z}`} position={[x, y, z]}>
            <mesh position={[0, height / 2, 0]}><boxGeometry args={[0.16 + (index % 2) * 0.08, height, 0.16]} /><meshStandardMaterial color="#071923" emissive="#0b6574" emissiveIntensity={0.8} metalness={0.7} roughness={0.3} /></mesh>
            <mesh position={[0, height + 0.05, 0]}><sphereGeometry args={[0.045, 12, 12]} /><meshBasicMaterial color="#48dff4" toneMapped={false} /></mesh>
          </group>
        ))}
      </group>

      <group ref={vehicle}>
        <mesh castShadow><boxGeometry args={[0.72, 0.3, 1.08]} /><meshStandardMaterial color="#06121a" metalness={0.88} roughness={0.18} /></mesh>
        <mesh position={[0, 0.24, -0.12]}><boxGeometry args={[0.62, 0.24, 0.52]} /><meshStandardMaterial color="#123242" emissive="#062d3a" emissiveIntensity={0.9} metalness={0.75} roughness={0.16} /></mesh>
        <mesh position={[-0.22, 0.02, 0.56]}><sphereGeometry args={[0.055, 12, 12]} /><meshBasicMaterial color="#fff8c8" toneMapped={false} /></mesh>
        <mesh position={[0.22, 0.02, 0.56]}><sphereGeometry args={[0.055, 12, 12]} /><meshBasicMaterial color="#fff8c8" toneMapped={false} /></mesh>
        <mesh position={[0, 0.01, -0.56]}><boxGeometry args={[0.46, 0.045, 0.022]} /><meshBasicMaterial color="#ffe000" toneMapped={false} /></mesh>
      </group>

      <mesh ref={vehicleHalo}><ringGeometry args={[0.16, 0.19, 56]} /><meshBasicMaterial color="#48dff4" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

export default function CinematicScene() {
  return (
    <div className="journey-canvas" aria-hidden="true">
      <div className="journey-canvas-fallback" />
      <Canvas camera={{ position: [0, 1.05, 6.4], fov: 46, near: 0.1, far: 60 }} dpr={[1, 1.5]} frameloop="always" gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}>
        <fog attach="fog" args={["#020609", 5, 17]} />
        <LivingRouteWorld />
      </Canvas>
    </div>
  );
}
