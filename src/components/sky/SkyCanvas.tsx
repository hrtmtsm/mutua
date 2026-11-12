'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useRef, useState, type ReactNode, lazy, Suspense } from 'react';
import * as THREE from 'three';
const MeadowField = lazy(() => import('./MeadowField'));
export type ScrollProgress = number | { readonly current: number };
import type { Palette } from './palette';

// Local CC0 images. Replace paths here; attribution lives in public/clouds/ATTRIBUTION.md.
export const CLOUD_PATHS = [1,2,3,4,5].map(i => `/clouds/cloud-${String(i).padStart(2,'0')}`);
const PLACEMENTS = [
  { x:-.57, y:.29, w:.62, speed:.004, opacity:.57, depth:0, asset:1 },
  { x:.62, y:.36, w:.60, speed:-.003, opacity:.54, depth:1, asset:4 },
  { x:-.50, y:-.34, w:.66, speed:.005, opacity:.66, depth:2, asset:0 },
  { x:.59, y:-.26, w:.70, speed:-.004, opacity:.62, depth:2, asset:2 },
  { x:-.29, y:.43, w:.29, speed:.0015, opacity:.46, depth:0, asset:3 },
  { x:.49, y:.01, w:.35, speed:-.002, opacity:.5, depth:0, asset:3 },
  { x:-.69, y:.02, w:.38, speed:.002, opacity:.6, depth:1, asset:4 },
];
function Clouds({ palette, progress, reduced, mobile, onFailure }: { palette: Palette; progress: ScrollProgress; reduced: boolean; mobile: boolean; onFailure:()=>void }) {
  const viewport = useThree(state => state.viewport);
  const invalidate = useThree(state => state.invalidate);
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const time = useRef(0);
  const color = useRef(new THREE.Color(palette.cloud));
  const target = useRef(new THREE.Color(palette.cloud));
  target.current.set(palette.cloud);
  useEffect(() => { invalidate(); }, [palette, progress, invalidate]);
  useEffect(() => {
    let cancelled = false;
    const loaded: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    Promise.all(CLOUD_PATHS.map(path => new Promise<THREE.Texture>((resolve,reject) => {
      loader.load(`${path}${mobile ? '-mobile' : ''}.png`, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        if (cancelled) { texture.dispose(); reject(new Error('unmounted')); return; }
        loaded.push(texture); resolve(texture);
      }, undefined, reject);
    }))).then(result => { if (!cancelled) { setTextures(result); invalidate(); } }).catch(() => { if (!cancelled) onFailure(); });
    return () => { cancelled = true; loaded.forEach(texture => texture.dispose()); };
  }, [mobile, invalidate, onFailure]);
  const placements = mobile ? PLACEMENTS.slice(0,4) : PLACEMENTS;
  useFrame((_, delta) => {
    const dt = Math.min(delta,.05);
    if (!reduced) time.current += dt;
    color.current.lerp(target.current, reduced ? 1 : 1 - Math.exp(-dt * 3));
    const scroll = typeof progress === 'number' ? progress : progress.current;
    placements.forEach((placement, i) => {
      const mesh = refs.current[i]; if (!mesh) return;
      // Full-width wrap takes several minutes; keep the central copy clear.
      const x = ((placement.x + time.current * placement.speed * .35 + 1.5) % 3 + 3) % 3 - 1.5;
      mesh.position.x = x * viewport.width;
      mesh.position.y = placement.y * viewport.height + scroll * viewport.height * (.06 + placement.depth * .055);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.copy(color.current);
      const centralFade = THREE.MathUtils.smoothstep(Math.abs(x), .16, .40);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 1.1, 1.45);
      material.opacity = placement.opacity * centralFade * edgeFade;
    });
  });
  return <>{textures.length === 5 && placements.map((placement, i) => {
    const texture = textures[placement.asset];
    const image = texture.image as HTMLImageElement;
    const aspect = image.width / image.height;
    const width = viewport.width * placement.w;
    return <mesh key={i} ref={node => { refs.current[i] = node; }} position={[placement.x*viewport.width, placement.y*viewport.height, placement.depth]} renderOrder={placement.depth}>
      <planeGeometry args={[width, width/aspect]} />
      <meshBasicMaterial map={texture} color={palette.cloud} transparent opacity={placement.opacity} depthWrite={false} depthTest={false} toneMapped={false} alphaTest={.002} />
    </mesh>;
  })}</>;
}
function ContextLossGuard({ onFailure }: { onFailure:()=>void }) {
  const canvas = useThree(state=>state.gl.domElement);
  useEffect(()=>{
    canvas.addEventListener('webglcontextlost',onFailure);
    return ()=>canvas.removeEventListener('webglcontextlost',onFailure);
  },[canvas,onFailure]);
  return null;
}
class CanvasBoundary extends Component<{ children: ReactNode; onFailure:()=>void }, { failed: boolean }> {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function ScrollInvalidation({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!active) return;
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [active, invalidate]);
  return null;
}
export default function SkyCanvas({ palette, progress, reduced, mobile, paused, onFailure, grassStill, hour=12, showMeadow = true, onSceneReady }: { grassStill:boolean; hour?:number; palette:Palette; progress:ScrollProgress; reduced:boolean; mobile:boolean; paused:boolean; onFailure:()=>void; showMeadow?: boolean; onSceneReady?:()=>void }) {
  return <CanvasBoundary onFailure={onFailure}><Canvas
    aria-hidden="true" orthographic camera={{ position:[0,0,10], zoom:100, near:.1, far:30 }}
    dpr={mobile ? 1 : [1,1.5]} frameloop={paused || reduced ? 'demand' : 'always'}
    gl={{ alpha:true, antialias:!mobile, powerPreference:'low-power' }}
    fallback={null}
    onCreated={({ gl }) => { gl.setClearColor(0,0); onSceneReady?.(); }}
    style={{ pointerEvents:'none' }}>
      <ContextLossGuard onFailure={onFailure}/>
      <ScrollInvalidation active={typeof progress !== 'number' && reduced && !paused}/>
      {showMeadow && <Suspense fallback={null}><MeadowField palette={palette} progress={progress} reduced={reduced||paused} mobile={mobile} still={grassStill}/></Suspense>}
      <Clouds palette={palette} progress={progress} reduced={reduced} mobile={mobile} onFailure={onFailure} />
  </Canvas></CanvasBoundary>;
}
