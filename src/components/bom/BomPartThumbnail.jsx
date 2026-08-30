import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** 삼각 메시를 정면 뷰로 렌더링한 썸네일 */
export default function BomPartThumbnail({ mesh, size = 56 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!mesh?.positions?.length || !canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
    geometry.setIndex(mesh.indices);
    geometry.computeVertexNormals();
    geometry.center();

    const material = new THREE.MeshStandardMaterial({ color: 0x93a5c4, roughness: 0.55, metalness: 0.1 });
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(2, 3, 4);
    scene.add(dir);

    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere?.radius || 1;
    const camera = new THREE.PerspectiveCamera(38, 1, radius / 100, radius * 20);
    camera.position.set(radius * 1.9, radius * 1.6, radius * 2.4);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    return () => {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [mesh, size]);

  if (!mesh?.positions?.length) {
    return <div className="rounded bg-muted" style={{ width: size, height: size }} />;
  }

  return <canvas ref={canvasRef} width={size} height={size} className="rounded bg-secondary" />;
}