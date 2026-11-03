'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { countryGreeting } from '@/lib/countryGreetings';
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

// ── Marker data shape — decorative greeting bubbles (default) or real/mock
// interactive avatars (when `markers`+`interactive` are passed by a caller) ──
export interface GlobeMarker {
  id:          string;
  lat:         number;
  lon:         number;
  flag:        string;
  label:       string;    // greeting text (decorative) or display name (interactive)
  initial?:    string;    // avatar initial letter — interactive mode only
  avatarUrl?: string;
  avatarColor?: string;   // avatar background color — interactive mode only
}

const DEFAULT_ITEMS: GlobeMarker[] = COUNTRIES.map((c, i) => ({
  id: String(i), lat: c.lat, lon: c.lon, flag: c.flag, label: c.text,
}));

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
  W: number, H: number, seed: number, opacityMul: number = 1,
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
    const a  = (0.35 + rand() * 0.2) * opacityMul;  // much lower opacity
    ctx.beginPath();
    ctx.arc(px, py, Math.max(r, 3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fill();
  }
}

type GlobeTheme = 'day' | 'night';

const THEME_COLORS: Record<GlobeTheme, {
  ocean: [number, string][]; grid: string; land: string; border: string; desert: string; cloud: number;
}> = {
  day: {
    ocean: [[0, '#1a5fa8'], [0.25, '#1065b8'], [0.5, '#1575cc'], [0.75, '#1068bc'], [1, '#0d52a0']],
    grid:   'rgba(255,255,255,0.05)',
    land:   '#8aad6e',
    border: 'rgba(255,255,255,0.28)',
    desert: '#c8a96e',
    cloud:  1,
  },
  // Dark/night palette — deep navy ocean, muted land, closer to a "live visitor map" look
  night: {
    ocean: [[0, '#050b1a'], [0.25, '#071327'], [0.5, '#0a1b33'], [0.75, '#071327'], [1, '#04080f']],
    grid:   'rgba(255,255,255,0.025)',
    land:   '#2e3d35',
    border: 'rgba(170,200,190,0.18)',
    desert: '#4a4030',
    cloud:  0.5,
  },
};

function createEarthTexture(theme: GlobeTheme): HTMLCanvasElement {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const c = THEME_COLORS[theme];

  // Ocean
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
  c.ocean.forEach(([stop, color]) => oceanGrad.addColorStop(stop, color));
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Countries — fill all land
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countries = topojson.feature(worldData, (worldData.objects as any).countries) as any;
  ctx.fillStyle = c.land;
  for (const feat of countries.features) {
    drawFeatureGeometry(ctx, feat.geometry, W, H);
    ctx.fill('evenodd');
  }

  // Country borders
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  for (const feat of countries.features) {
    drawFeatureGeometry(ctx, feat.geometry, W, H);
    ctx.stroke();
  }

  // Desert overlay — warm sandy tan, closer to real arid regions
  ctx.fillStyle = c.desert;
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
    drawCloudPatch(ctx, lon, lat, lonRad, W, H, seed, c.cloud);
    // Also draw wrapped version for clouds near ±180 longitude
    if (lon < -140) drawCloudPatch(ctx, lon + 360, lat, lonRad, W, H, seed + 1, c.cloud);
    if (lon >  140) drawCloudPatch(ctx, lon - 360, lat, lonRad, W, H, seed + 1, c.cloud);
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

interface GlobeHeroProps {
  /** Real/mock markers to plot. Omit to keep the default decorative greeting bubbles. */
  markers?:       GlobeMarker[];
  /** Makes markers tappable (avatar-style) instead of inert decorative speech bubbles. */
  interactive?:   boolean;
  onMarkerClick?: (markerId: string) => void;
  /** 'day' (default, original LP look) or 'night' (dark/muted, live-visitor-map style). */
  theme?: GlobeTheme;
  /**
   * Non-interactive marker rendering. 'bubble' (default) keeps the original
   * speech-bubble-with-greeting look (LP default). 'dot' renders small glowing
   * dots with no text. 'avatar' renders small round avatar bubbles (initial +
   * color, with a small decorative status dot) clustered at real locations —
   * a live-visitor-map feel (DataFast-style), used for the purely decorative
   * /app landing globe (no drag/tap/popover affordance implied).
   * Ignored when `interactive` is true.
   */
  markerStyle?: 'bubble' | 'dot' | 'avatar';
  /** false disables mouse/touch drag-to-rotate (the globe still auto-rotates). Default true. */
  draggable?: boolean;
  /** Preview can stop the frame loop without changing the default LP. */
  paused?: boolean;
  pixelRatio?: number;
}

function GreetingLabel({ item, alwaysVisible = false }: { item: GlobeMarker; alwaysVisible?: boolean }) {
  const greeting = countryGreeting(item.flag);
  const colors = ['#b8553e', '#34695e', '#7152a2', '#98601f', '#3f609a', '#a34265'];
  const index = Array.from(item.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  return (
    <span className={`globe-greeting${alwaysVisible ? ' globe-greeting-static' : ''}`} lang={greeting.lang} dir="auto"
      style={{ '--greeting-color': colors[index], '--greeting-tilt': `${index % 2 === 0 ? -4 : 4}deg` } as CSSProperties}>
      <span aria-hidden="true">{item.flag}</span> {greeting.text}
    </span>
  );
}

export default function GlobeHero({ markers, interactive = false, onMarkerClick, theme = 'day', markerStyle = 'bubble', draggable = true, paused = false, pixelRatio = 2 }: GlobeHeroProps = {}) {
  const pausedRef = useRef(paused);
  const redrawRef = useRef<(() => void) | null>(null);
  const mountRef   = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLElement | null)[]>([]);
  const visRef     = useRef<boolean[]>([]);
  const animRef    = useRef<(Animation | null)[]>([]);
  const itemsRef       = useRef<GlobeMarker[]>(markers ?? DEFAULT_ITEMS);
  const interactiveRef = useRef(interactive);
  const markerStyleRef = useRef(markerStyle);
  const draggableRef   = useRef(draggable);

  useEffect(() => { itemsRef.current = markers ?? DEFAULT_ITEMS; }, [markers]);
  useEffect(() => { interactiveRef.current = interactive; }, [interactive]);
  useEffect(() => { markerStyleRef.current = markerStyle; }, [markerStyle]);
  useEffect(() => { draggableRef.current = draggable; }, [draggable]);

  const isDragging = useRef(false);
  const prevMouse  = useRef({ x: 0, y: 0 });
  const yawRef     = useRef(0);
  const pitchRef   = useRef(0.1);
  const velRef     = useRef(0);
  const rafRef     = useRef<number>(0);
  useEffect(() => {
    pausedRef.current = paused;
    cancelAnimationFrame(rafRef.current);
    redrawRef.current?.();
  }, [paused]);


  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let w = el.clientWidth;
    let h = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
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
      if (pausedRef.current) redrawRef.current?.();
    });
    ro.observe(el);

    const isNight = theme === 'night';
    scene.add(new THREE.AmbientLight(0xffffff, isNight ? 0.22 : 0.45));
    const key = new THREE.DirectionalLight(isNight ? 0xcfe3ff : 0xfff8f0, isNight ? 1.0 : 1.6);
    key.position.set(4, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x3a6bff, isNight ? 0.4 : 0.30);
    fill.position.set(-3, -1, 2);
    scene.add(fill);

    const texCanvas = createEarthTexture(theme);
    const tex = new THREE.CanvasTexture(texCanvas);
    const mat = new THREE.MeshPhongMaterial({
      map: tex,
      shininess: isNight ? 8 : 18,
      specular: new THREE.Color(isNight ? '#0f2a4a' : '#2a80c0'),
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
    scene.add(mesh);


    const euler = new THREE.Euler();

    const animate = () => {
      if (!pausedRef.current) rafRef.current = requestAnimationFrame(animate);
      if (!pausedRef.current && !isDragging.current) {
        velRef.current *= 0.96;
        yawRef.current += velRef.current + 0.0007;
      }
      mesh.rotation.y = yawRef.current;
      mesh.rotation.x = pitchRef.current;

      euler.set(pitchRef.current, yawRef.current, 0);

      itemsRef.current.forEach(({ lat, lon }, i) => {
        const el = bubbleRefs.current[i];
        if (!el) return;

        const pos = toCartesian(lat, lon);
        pos.applyEuler(euler);

        // Use separate show/hide thresholds to avoid flickering at the edge
        const shouldShow = pos.z > 0.38;
        const shouldHide = pos.z < 0.30;
        const wasVis = visRef.current[i] ?? false;

        const anchorY = (interactiveRef.current || markerStyleRef.current === 'dot') ? '-50%' : '-110%';

        if (!wasVis && shouldShow) {
          // Country just rotated into view — pop in
          visRef.current[i] = true;
          animRef.current[i]?.cancel();
          el.style.display = 'flex';
          animRef.current[i] = el.animate(
            [
              { opacity: 0, transform: `translate(-50%, ${anchorY}) scale(0.4)` },
              { opacity: 1, transform: `translate(-50%, ${anchorY}) scale(1.12)`, offset: 0.65 },
              { opacity: 1, transform: `translate(-50%, ${anchorY}) scale(1)` },
            ],
            { duration: pausedRef.current ? 0 : 480, easing: 'ease-out', fill: 'forwards' },
          );
        } else if (wasVis && shouldHide) {
          // Country rotating away — pop out
          visRef.current[i] = false;
          animRef.current[i]?.cancel();
          const anim = el.animate(
            [
              { opacity: 1, transform: `translate(-50%, ${anchorY}) scale(1)` },
              { opacity: 0, transform: `translate(-50%, ${anchorY}) scale(0.6)` },
            ],
            { duration: pausedRef.current ? 0 : 220, easing: 'ease-in', fill: 'forwards' },
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
    redrawRef.current = animate;
    animate();

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!draggableRef.current) return;
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
      if (pausedRef.current) animate();
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
      redrawRef.current = null;
      animRef.current.forEach(animation => animation?.cancel());
      visRef.current = [];
      bubbleRefs.current.forEach(element => { if (element) element.style.display = 'none'; });
      mesh.geometry.dispose(); mat.dispose(); tex.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [theme, pixelRatio]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className={`absolute inset-0 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ zIndex: 10, touchAction: 'pan-y' }} />
      {(markers ?? DEFAULT_ITEMS).map((item, index) => {
        const position = {
          position: 'absolute' as const,
          display: 'none',
          transform: markerStyle === 'bubble' && !interactive ? 'translate(-50%, -120%)' : 'translate(-50%, -50%)',
          zIndex: 20,
        };
        if (interactive) return (
          <button key={item.id} ref={el => { bubbleRefs.current[index] = el; }} type="button"
            aria-label={item.label} onClick={() => onMarkerClick?.(item.id)}
            className="flex items-center justify-center w-11 h-11 rounded-full shadow-lg ring-2 ring-white/70 text-white font-semibold text-sm"
            style={{ ...position, background: item.avatarColor ?? '#2b8fff' }}>
            {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : item.initial ?? item.label.slice(0, 1)}
            <span className="absolute -bottom-1 -right-1 text-xs">{item.flag}</span>
          </button>
        );
        if (markerStyle === 'dot') return <span key={item.id} ref={el => { bubbleRefs.current[index] = el; }}
          aria-hidden="true" style={{ ...position, width: 9, height: 9, borderRadius: '50%', background: '#fff5d9', border: '2px solid #73915e' }} />;
        if (markerStyle === 'avatar') {
          const greeting = countryGreeting(item.flag);
          return <button type="button" key={item.id} ref={el => { bubbleRefs.current[index] = el; }}
            aria-label={`${item.label}: ${greeting.text}`} className="globe-avatar flex items-center justify-center w-10 h-10 rounded-full ring-2 ring-white/70 text-white text-xs shadow-lg"
            style={{ ...position, background: item.avatarColor ?? '#2b8fff' }}>
            {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : item.initial ?? item.label.slice(0, 1)}
            <GreetingLabel item={item} />
          </button>;
        }
        return (
          <div key={item.id} ref={el => { bubbleRefs.current[index] = el; }} aria-hidden="true"
            className="w-0 h-0"
            style={{ ...position, pointerEvents: 'none' }}>
            <GreetingLabel item={item} alwaysVisible />
          </div>
        );
      })}
    </div>
  );
}
