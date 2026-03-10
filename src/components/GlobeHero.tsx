'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as topojson from 'topojson-client';
import type { Topology } from 'topojson-specification';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const worldData = require('world-atlas/countries-50m.json') as Topology;

// ── Individual country bubbles — greeting in each country's own language ─────
const COUNTRIES = [
  { flag: '🇺🇸', text: 'Hello!',        lat:  38, lon:  -97 },
  { flag: '🇲🇽', text: '¡Hola!',        lat:  23, lon: -102 },
  { flag: '🇧🇷', text: 'Olá!',          lat: -15, lon:  -48 },
  { flag: '🇫🇷', text: 'Bonjour !',     lat:  47, lon:    3 },
  { flag: '🇩🇪', text: 'Hallo!',        lat:  51, lon:   10 },
  { flag: '🇸🇦', text: 'مرحبًا!',       lat:  24, lon:   45 },
  { flag: '🇮🇳', text: 'नमस्ते!',        lat:  22, lon:   79 },
  { flag: '🇨🇳', text: '你好！',         lat:  35, lon:  105 },
  { flag: '🇯🇵', text: 'こんにちは！',   lat:  36, lon:  138 },
  { flag: '🇦🇺', text: "G'day!",        lat: -27, lon:  134 },
];

// ── GeoJSON ring drawer (handles antimeridian splits) ────────────────────────
function drawGeoRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  W: number, H: number,
) {
  let prevLon: number | null = null;
  ring.forEach(([lon, lat], i) => {
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    if (i === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    prevLon = lon;
  });
  ctx.closePath();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFeatureGeometry(ctx: CanvasRenderingContext2D, geom: any, W: number, H: number) {
  ctx.beginPath();
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) drawGeoRing(ctx, ring, W, H);
  } else if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.coordinates)
      for (const ring of polygon) drawGeoRing(ctx, ring, W, H);
  }
}

// Desert/arid regions drawn on top in sandy color
const DESERTS: [number, number][][] = [
  // Sahara
  [
    [-18,18],[-14,22],[-8,30],[-4,34],[0,34],[4,34],[8,36],
    [10,38],[14,38],[18,36],[22,36],[26,34],[30,30],[34,26],
    [36,22],[38,18],[36,16],[30,16],[24,16],[18,18],[12,18],
    [6,20],[0,22],[-4,22],[-10,22],[-14,20],[-18,18],
  ],
  // Arabian Peninsula
  [
    [36,30],[38,30],[40,28],[44,26],[50,28],[56,24],[58,22],
    [58,16],[54,14],[50,12],[46,14],[44,12],[42,14],
    [40,16],[38,18],[36,22],[36,26],[36,30],
  ],
  // Central Asian steppe / Gobi (lighter, muted)
  [
    [78,50],[90,50],[100,52],[110,50],[120,46],[118,42],
    [110,40],[100,40],[90,40],[80,44],[78,50],
  ],
];


// Cloud formations: [centerLon, centerLat, lonRadius] — lon radius in degrees
// Fewer, smaller patches — enough to look natural without blanketing the globe
const CLOUD_PATCHES: [number, number, number][] = [
  [-40, 52,  8],
  [-28, 58,  7],
  [-150, 46, 9],
  [-60,  4,  6],
  [ 20,  6,  6],
  [-50,-50,  8],
  [ 60,-46,  7],
  [  0, 46,  6],
  [ 80, 28,  6],
];

function drawCloudPatch(
  ctx: CanvasRenderingContext2D,
  lon: number, lat: number, lonRad: number,
  W: number, H: number, seed: number,
) {
  const cx = ((lon + 180) / 360) * W;
  const cy = ((90 - lat) / 180) * H;
  const rx = (lonRad / 360) * W;          // horizontal spread in px
  const ry = (lonRad * 0.35 / 180) * H;  // vertical spread (compressed)

  // XOR-shift seeded RNG — deterministic, no Math.random
  let s = seed | 1;
  const rand = () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return Math.abs(s) / 2147483648;
  };

  const count = 8 + Math.floor(rand() * 5);
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist  = Math.sqrt(rand()); // sqrt gives more center-weighted distribution
    const px = cx + Math.cos(angle) * dist * rx;
    const py = cy + Math.sin(angle) * dist * ry;
    const r  = (0.2 + rand() * 0.4) * ry * 1.4;
    const a  = 0.35 + rand() * 0.2;  // much lower opacity
    ctx.beginPath();
    ctx.arc(px, py, Math.max(r, 3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fill();
  }
}

function createEarthTexture(): HTMLCanvasElement {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Ocean — deep, rich blue like a real Earth
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  oceanGrad.addColorStop(0,    '#1a5fa8');
  oceanGrad.addColorStop(0.25, '#1065b8');
  oceanGrad.addColorStop(0.5,  '#1575cc');
  oceanGrad.addColorStop(0.75, '#1068bc');
  oceanGrad.addColorStop(1,    '#0d52a0');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Countries — fill all land with natural green
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countries = topojson.feature(worldData, (worldData.objects as any).countries) as any;
  ctx.fillStyle = '#8aad6e';
  for (const feat of countries.features) {
    drawFeatureGeometry(ctx, feat.geometry, W, H);
    ctx.fill('evenodd');
  }

  // Country borders
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  for (const feat of countries.features) {
    drawFeatureGeometry(ctx, feat.geometry, W, H);
    ctx.stroke();
  }

  // Desert overlay — warm sandy tan, closer to real arid regions
  ctx.fillStyle = '#c8a96e';
  for (const poly of DESERTS) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  // Clouds — cluster-based, deterministic seeded RNG, drawn last
  CLOUD_PATCHES.forEach(([lon, lat, lonRad], idx) => {
    const seed = (idx + 1) * 1013904223;
    drawCloudPatch(ctx, lon, lat, lonRad, W, H, seed);
    // Also draw wrapped version for clouds near ±180 longitude
    if (lon < -140) drawCloudPatch(ctx, lon + 360, lat, lonRad, W, H, seed + 1);
    if (lon >  140) drawCloudPatch(ctx, lon - 360, lat, lonRad, W, H, seed + 1);
  });

  return canvas;
}


function toCartesian(latDeg: number, lonDeg: number): THREE.Vector3 {
  // THREE.js SphereGeometry (v0.183): x=-cos(L)*sin(θ), y=cos(θ), z=sin(L)*sin(θ)
  // where L = phi (azimuthal U angle) and θ = polar V angle.
  // For geographic coords: sin(θ)=cos(lat), cos(θ)=sin(lat), L=(lon+180)*π/180
  const lat = (latDeg * Math.PI) / 180;
  const L   = ((lonDeg + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -Math.cos(L) * Math.cos(lat),
     Math.sin(lat),
     Math.sin(L) * Math.cos(lat),
  );
}

const N = COUNTRIES.length;

export default function GlobeHero() {
  const mountRef   = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visRef     = useRef<boolean[]>(new Array(N).fill(false));
  const animRef    = useRef<(Animation | null)[]>(new Array(N).fill(null));

  const isDragging = useRef(false);
  const prevMouse  = useRef({ x: 0, y: 0 });
  const yawRef     = useRef(0);
  const pitchRef   = useRef(0.1);
  const velRef     = useRef(0);
  const rafRef     = useRef<number>(0);


  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let w = el.clientWidth;
    let h = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100);
    camera.position.set(0, -0.2, 2.6);
    camera.lookAt(0, 0, 0);

    const ro = new ResizeObserver(() => {
      w = el.clientWidth;
      h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(el);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xfff8f0, 1.6);
    key.position.set(4, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88bbff, 0.30);
    fill.position.set(-3, -1, 2);
    scene.add(fill);

    const texCanvas = createEarthTexture();
    const tex = new THREE.CanvasTexture(texCanvas);
    const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 18, specular: new THREE.Color('#2a80c0') });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
    scene.add(mesh);


    const euler = new THREE.Euler();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!isDragging.current) {
        velRef.current *= 0.96;
        yawRef.current += velRef.current + 0.0007;
      }
      mesh.rotation.y = yawRef.current;
      mesh.rotation.x = pitchRef.current;

      euler.set(pitchRef.current, yawRef.current, 0);

      COUNTRIES.forEach(({ lat, lon }, i) => {
        const el = bubbleRefs.current[i];
        if (!el) return;

        const pos = toCartesian(lat, lon);
        pos.applyEuler(euler);

        // Use separate show/hide thresholds to avoid flickering at the edge
        const shouldShow = pos.z > 0.38;
        const shouldHide = pos.z < 0.30;
        const wasVis = visRef.current[i];

        if (!wasVis && shouldShow) {
          // Country just rotated into view — pop in
          visRef.current[i] = true;
          animRef.current[i]?.cancel();
          el.style.display = 'flex';
          animRef.current[i] = el.animate(
            [
              { opacity: 0, transform: 'translate(-50%, -110%) scale(0.4)' },
              { opacity: 1, transform: 'translate(-50%, -110%) scale(1.12)', offset: 0.65 },
              { opacity: 1, transform: 'translate(-50%, -110%) scale(1)' },
            ],
            { duration: 480, easing: 'ease-out', fill: 'forwards' },
          );
        } else if (wasVis && shouldHide) {
          // Country rotating away — pop out
          visRef.current[i] = false;
          animRef.current[i]?.cancel();
          const anim = el.animate(
            [
              { opacity: 1, transform: 'translate(-50%, -110%) scale(1)' },
              { opacity: 0, transform: 'translate(-50%, -110%) scale(0.6)' },
            ],
            { duration: 220, easing: 'ease-in', fill: 'forwards' },
          );
          animRef.current[i] = anim;
          anim.onfinish = () => { el.style.display = 'none'; };
        }

        // Keep position locked to country while visible
        if (visRef.current[i]) {
          const proj = pos.clone();
          proj.project(camera);
          el.style.left = `${(proj.x + 1) * 0.5 * w}px`;
          el.style.top  = `${(1 - proj.y) * 0.5 * h}px`;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onDown = (e: MouseEvent | TouchEvent) => {
      isDragging.current = true;
      velRef.current = 0;
      const p = 'touches' in e ? e.touches[0] : e;
      prevMouse.current = { x: p.clientX, y: p.clientY };
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      e.stopPropagation();
      const p = 'touches' in e ? e.touches[0] : e;
      const dx = p.clientX - prevMouse.current.x;
      const dy = p.clientY - prevMouse.current.y;
      velRef.current    = dx * 0.008;
      yawRef.current   += dx * 0.008;
      pitchRef.current  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchRef.current + dy * 0.004));
      prevMouse.current = { x: p.clientX, y: p.clientY };
    };
    const onUp = () => { isDragging.current = false; };

    renderer.domElement.addEventListener('mousedown',  onDown);
    renderer.domElement.addEventListener('touchstart', onDown, { passive: false });
    renderer.domElement.addEventListener('mousemove',  onMove);
    renderer.domElement.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',  onUp);
    window.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.domElement.removeEventListener('mousedown',  onDown);
      renderer.domElement.removeEventListener('touchstart', onDown);
      renderer.domElement.removeEventListener('mousemove',  onMove);
      renderer.domElement.removeEventListener('touchmove',  onMove);
      window.removeEventListener('mouseup',  onUp);
      window.removeEventListener('touchend', onUp);
      ro.disconnect();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Three.js canvas — fills container */}
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ zIndex: 10 }}
      />

      {/* One bubble per country — position + visibility driven by animation loop */}
      {COUNTRIES.map((c, i) => (
        <div
          key={c.flag + c.lon}
          ref={el => { bubbleRefs.current[i] = el; }}
          style={{
            position: 'absolute',
            display: 'none',
            zIndex: 20,
            pointerEvents: 'none',
            background: 'rgba(43,143,255,0.55)',
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[20px] rounded-bl-[5px] shadow-lg text-sm font-semibold text-white whitespace-nowrap"
        >
          <span className="text-base leading-none">{c.flag}</span>
          <span>{c.text}</span>
        </div>
      ))}

    </div>
  );
}
