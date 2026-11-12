'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ScrollProgress } from './SkyCanvas';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Palette } from './palette';
import { landscapeProjection } from './LandscapeView';

// World-space relief, shared by the ground and every blade's root.
export function meadowHeight(x:number,z:number) {
  return -.5 + 1.8*Math.exp(-((x+10)**2/240+(z+23)**2/260))
    - .8*Math.exp(-((x-4)**2/110+(z+40)**2/700)) + 8.8*Math.exp(-((x+31)**2/1900+(z+65)**2/2400))
    + 12.1*Math.exp(-((x-48)**2/2400+(z+100)**2/3100))
    + .72*Math.sin(x*.039+z*.016) + .38*Math.sin(z*.073-x*.021)
    + .11*Math.sin(x*.19+z*.11)*Math.sin(z*.15) + .035*Math.sin(x*.63+z*.32);
}
const common = `
  uniform mat4 landscapeProjection;
  uniform float reveal;
  varying vec3 world;
  varying vec3 normalWorld;
  void projectLandscape(vec3 p) {
    world=p;
    gl_Position=landscapeProjection*vec4(p,1.);
    gl_Position.y-=reveal*gl_Position.w;
  }
`;
const terrainVertex = `${common}
  void main(){normalWorld=normal;projectLandscape(position);}
`;
const terrainFragment = `
  uniform vec3 groundColor,hillColor,hazeColor,lightColor;
  uniform float night;
  varying vec3 world,normalWorld;
  float groundPatch(vec2 p){return sin(p.x*.17+p.y*.07)*sin(p.y*.13-p.x*.09)*.5+.5;}
  void main(){
    vec3 n=normalize(normalWorld);
    float sun=max(0.,dot(n,normalize(vec3(-.55,1.,.35))));
    float broad=groundPatch(world.xz);
    float detail=sin(world.x*5.+sin(world.z*2.))*sin(world.z*6.3+world.x)*.5+.5;
    vec3 base=mix(groundColor*.75,hillColor,broad*.55+.2);
    base*=.72+sun*.39;
    base*=.94+detail*.10;
    base+=lightColor*pow(sun,4.)*.035*(1.-night*.6);
    float distance=length(vec3(world.x*.22,0.,world.z-10.));
    float haze=smoothstep(28.,145.,distance);
    base=mix(base,hazeColor,haze*.91);
    float alpha=1.-smoothstep(65.,190.,distance);
    gl_FragColor=vec4(base,alpha);
    #include <colorspace_fragment>
  }
`;
const grassVertex = `${common}
  attribute vec3 root;
  attribute vec4 shape;
  attribute vec2 variation;
  uniform float windTime,windStrength;
  varying vec2 bladeUv;
  varying float tint;
  void main(){
    float t=uv.y;
    float phase=root.x*.13+root.z*.095-windTime*.43;
    float wave=sin(phase)*.065+sin(phase*.57-windTime*.19)*.035;
    float bend=(shape.z+wave*windStrength)*t*t;
    float angle=shape.w;
    vec3 p=vec3(position.x*shape.x,position.y*shape.y,0.);
    p.x+=bend*shape.y;
    p.z+=shape.y*t*t*.12;
    p.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p.xz;
    p+=root;
    bladeUv=uv;tint=variation.x;
    normalWorld=normalize(vec3(sin(angle)*.3,.7,cos(angle)*.3));
    projectLandscape(p);
  }
`;
const grassFragment = `
  uniform vec3 groundColor,hillColor,hazeColor,lightColor;
  uniform float night;
  varying vec3 world,normalWorld;
  varying vec2 bladeUv;
  varying float tint;
  void main(){
    vec3 rootColor=mix(groundColor*.13,groundColor*.39,tint);
    vec3 tipColor=mix(groundColor*.9,hillColor,tint*.6+.4);
    // Upper-left sunlight / moonlight touches the tips; the root stays in shade.
    float warmth=clamp((lightColor.r-lightColor.b)*3.,0.,1.);
    tipColor=mix(tipColor,lightColor,(.02+warmth*.09)*(1.-night*.45));
    vec3 c=mix(rootColor,tipColor,smoothstep(.02,.9,pow(bladeUv.y,1.15)));
    float edge=1.-abs(bladeUv.x-.5)*2.;
    c*=.72+.28*edge;
    c*=.86+.24*tint;
    float sun=max(0.,dot(normalize(normalWorld),normalize(vec3(-.55,1.,.35))));
    c*=.62+.52*sun;
    float transmission=pow(max(0.,dot(normalize(normalWorld),normalize(vec3(.55,.4,-.35)))),2.);
    c+=tipColor*transmission*.12*bladeUv.y*(1.-night*.7);
    float distance=length(vec3(world.x*.22,0.,world.z-10.));
    float haze=smoothstep(25.,100.,distance);
    c=mix(c,mix(groundColor,hazeColor,.32),haze*.65);
    float alpha=1.-smoothstep(36.,78.,distance);
    gl_FragColor=vec4(c,alpha);
    #include <colorspace_fragment>
  }
`;
export function makeGrass(mobile:boolean,heightAt:(x:number,z:number)=>number=meadowHeight,densityScale=1,accept?:(x:number,z:number)=>boolean) {
  const geometry=new THREE.InstancedBufferGeometry();
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const segments=7;
  for(let i=0;i<=segments;i++) {
    const t=i/segments;
    const half=Math.pow(1-t,.72)*.5;
    positions.push(-half,t,0,half,t,0);uvs.push(0,t,1,t);
    if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  const roots:number[]=[],shapes:number[]=[],variations:number[]=[];
  let seed=18439;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const clumps=Math.round((mobile?6500:44000)*densityScale);
  for(let i=0;i<clumps;i++) {
    const z=6.2-Math.pow(random(),1.55)*101.2;
    const x=(random()-.5)*(10-z)*(mobile?.95:2.2);
    if(accept&&!accept(x,z))continue;
    // Broad patches, smaller tufts and open channels, rather than an even grid.
    const patch=.5+.28*Math.sin(x*.61+z*.19)*Math.sin(z*.36-x*.15)+.16*Math.sin(x*1.4+z*.81);
    if(random()>patch+.15)continue;
    const height=.60+random()*.82;
    for(let blade=0;blade<3;blade++) {
      const bx=x+(random()-.5)*.17,bz=z+(random()-.5)*.17;
      roots.push(bx,heightAt(bx,bz)-.025,bz);
      shapes.push(.04+random()*.04,height*(.7+random()*.65),.04+random()*.24,random()*Math.PI*2);
      variations.push(random(),random());
    }
  }
  geometry.setAttribute('root',new THREE.InstancedBufferAttribute(new Float32Array(roots),3));
  geometry.setAttribute('shape',new THREE.InstancedBufferAttribute(new Float32Array(shapes),4));
  geometry.setAttribute('variation',new THREE.InstancedBufferAttribute(new Float32Array(variations),2));
  geometry.instanceCount=roots.length/3;
  return geometry;
}
export default function MeadowField({palette,progress,reduced,mobile,still}:{palette:Palette;progress:ScrollProgress;reduced:boolean;mobile:boolean;still:boolean}) {
  const field = useRef<THREE.Group>(null);
  const canvas=useThree(state=>state.gl.domElement);
  const size=useThree(state=>state.size);
  const invalidate=useThree(state=>state.invalidate);
  const terrain=useMemo(()=>{
    const mesh=new THREE.PlaneGeometry(330,210,mobile?110:220,mobile?90:180);
    mesh.rotateX(-Math.PI/2);mesh.translate(0,0,-93);
    const position=mesh.getAttribute('position');
    for(let i=0;i<position.count;i++)position.setY(i,meadowHeight(position.getX(i),position.getZ(i)));
    mesh.computeVertexNormals();return mesh;
  },[mobile]);
  const grass=useMemo(()=>makeGrass(mobile),[mobile]);
  useEffect(()=>{
    canvas.dataset.meadowInstances=String(grass.instanceCount);
    canvas.dataset.meadowWind=reduced||still?'still':'flowing';
    return ()=>{delete canvas.dataset.meadowInstances;delete canvas.dataset.meadowWind;};
  },[canvas,grass,reduced,still]);
  const uniforms=useMemo(()=>({landscapeProjection:{value:new THREE.Matrix4()},reveal:{value:2},groundColor:{value:new THREE.Color()},hillColor:{value:new THREE.Color()},hazeColor:{value:new THREE.Color()},lightColor:{value:new THREE.Color()},night:{value:0},windTime:{value:0},windStrength:{value:0}}),[]);
  useEffect(()=>{
    uniforms.landscapeProjection.value.copy(landscapeProjection(size.width,size.height));
    invalidate();
  },[size,uniforms,invalidate]);
  useEffect(()=>{
    uniforms.groundColor.value.set(palette.grass).lerp(new THREE.Color('#365c24'),(1-palette.night)*.65);
    uniforms.hillColor.value.set(palette.hill).lerp(new THREE.Color('#a4bc4a'),(1-palette.night)*.75);
    uniforms.hazeColor.value.set(palette.middle).lerp(new THREE.Color(palette.horizon),.26);
    uniforms.lightColor.value.set(palette.cloud);
    uniforms.night.value=palette.night;
    invalidate();
  },[palette,uniforms,invalidate]);
  useFrame((_, delta) => {
    const scroll = typeof progress === 'number' ? progress : progress.current;
    const reveal = Math.max(0, Math.min(1, (scroll - .12) / .88));
    const moving = !reduced && !still && scroll >= .5;
    if (field.current) field.current.visible = reveal > 0;
    uniforms.reveal.value = (1 - reveal) * 1.55;
    uniforms.windStrength.value = moving ? Math.min(1, (scroll - .5) * 8) : 0;
    if (moving) uniforms.windTime.value += Math.min(delta, .05);
  });
  useEffect(() => { invalidate(); }, [progress, reduced, still, invalidate]);
  useEffect(()=>()=>{terrain.dispose();grass.dispose();},[terrain,grass]);
  return <group ref={field} visible={false}>
    <mesh geometry={terrain} frustumCulled={false} renderOrder={10}>
      <shaderMaterial uniforms={uniforms} vertexShader={terrainVertex} fragmentShader={terrainFragment} transparent depthWrite side={THREE.DoubleSide}/>
    </mesh>
    <mesh geometry={grass} frustumCulled={false} renderOrder={11}>
      <shaderMaterial uniforms={uniforms} vertexShader={grassVertex} fragmentShader={grassFragment} transparent depthWrite side={THREE.DoubleSide}/>
    </mesh>
  </group>;
}
