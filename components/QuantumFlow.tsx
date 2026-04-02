import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const QuantumFlow = () => {
  const lineRef = useRef<any>();
  
  const points = useMemo(() => {
    const p = [];
    for (let i = 0; i < 100; i++) {
      const t = i / 10;
      p.push(new THREE.Vector3(Math.sin(t) * 2, Math.cos(t) * 2, (i - 50) / 10));
    }
    return p;
  }, []);

  useFrame((state, delta) => {
    if (lineRef.current) {
      lineRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color="#3b82f6"
      lineWidth={2}
      dashed={false}
    />
  );
};

export default QuantumFlow;
