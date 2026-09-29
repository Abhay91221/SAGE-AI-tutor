import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Atom() {
  const root = useRef<THREE.Group>(null);
  const electrons = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (root.current) root.current.rotation.y += dt * 0.13;
    electrons.current.forEach((electron, index) => {
      if (!electron) return;
      const t = clock.elapsedTime * (0.65 + index * 0.12) + index * Math.PI * 0.66;
      const radius = 2.05;
      // Three tilted orbital planes, each matching its corresponding ring.
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      const angle = index * Math.PI / 3;
      electron.position.set(x, y * Math.cos(angle), y * Math.sin(angle));
    });
  });
  return <group ref={root} rotation={[0.22, 0.15, -0.12]}>
    <mesh castShadow>
      <icosahedronGeometry args={[0.82, 4]} />
      <meshPhysicalMaterial color="#c5ddca" roughness={0.26} metalness={0.12} clearcoat={0.8} clearcoatRoughness={0.14} />
    </mesh>
    <mesh scale={0.82} position={[0.07, -0.05, 0.12]}>
      <icosahedronGeometry args={[0.82, 2]} />
      <meshStandardMaterial color="#5e917b" roughness={0.5} />
    </mesh>
    {[0, 1, 2].map((index) => <group key={index} rotation={[index * Math.PI / 3, 0, 0]}>
      <mesh>
        <torusGeometry args={[2.05, 0.018, 8, 128]} />
        <meshStandardMaterial color={index === 1 ? "#df9e7d" : "#8daea0"} metalness={0.25} roughness={0.4} transparent opacity={0.9} />
      </mesh>
    </group>)}
    {[0, 1, 2].map((index) => <mesh key={index} ref={(node) => { electrons.current[index] = node; }} castShadow>
      <sphereGeometry args={[index === 1 ? 0.16 : 0.13, 24, 16]} />
      <meshPhysicalMaterial color={index === 1 ? "#eab08f" : "#e8f5db"} roughness={0.2} metalness={0.18} clearcoat={1} />
    </mesh>)}
  </group>;
}

export function AtomScene() {
  return <div className="atom-canvas" aria-label="Animated three-dimensional atom illustration">
    <Canvas camera={{ position: [0, 0, 7.2], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.25} />
      <directionalLight position={[3, 5, 6]} intensity={2.2} />
      <pointLight position={[-4, -2, 3]} color="#ecb78f" intensity={28} distance={12} />
      <Environment>
        <Lightformer intensity={2} position={[0, 5, 3]} scale={[8, 8, 1]} />
        <Lightformer intensity={1.5} color="#a9d4bd" position={[-5, 0, 2]} scale={[5, 8, 1]} />
      </Environment>
      <Atom />
    </Canvas>
  </div>;
}
