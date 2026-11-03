'use client';
import {useMemo,useEffect} from 'react';
import {useThree,useFrame} from '@react-three/fiber';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {landscapeProjection,landscapeReveal} from './LandscapeView';
import type {Palette} from './palette';
export default function MeadowBlossoms({palette,progress,mobile,reduced,still,height}:{palette:Palette;progress:number;mobile:boolean;reduced:boolean;still:boolean;height:(x:number,z:number)=>number}){
 const size=useThree(s=>s.size),invalidate=useThree(s=>s.invalidate);
 const g=useMemo(()=>{
  const petals=[];
  for(let i=0;i<5;i++){const p=new T.SphereGeometry(.045,5,3);p.scale(1,.35,.7);p.translate(Math.cos(i*1.256)*.055,0,Math.sin(i*1.256)*.055);petals.push(p);}
  const base=mergeGeometries(petals)!;petals.forEach(p=>p.dispose());
  const result=new T.InstancedBufferGeometry();result.index=base.index;result.attributes=base.attributes;
  const roots=[],colors=[];
  for(let i=0;i<(mobile?36:100);i++){
   const clump=Math.floor(i/6),cx=Math.sin(clump*4.71)*15,cz=5-((clump*7.13)%29);const x=cx+Math.sin(i*7.31)*.7,z=cz+Math.cos(i*4.17)*.7;roots.push(x,height(x,z)+1.0+Math.sin(i)*.22,z);
   const c=new T.Color(i%4===0?'#e4d28a':'#f2f0db');colors.push(c.r,c.g,c.b);
  }
  result.setAttribute('root',new T.InstancedBufferAttribute(new Float32Array(roots),3));result.setAttribute('petalColor',new T.InstancedBufferAttribute(new Float32Array(colors),3));result.instanceCount=roots.length/3;return result;
 },[mobile,height]);
 const uniforms=useMemo(()=>({projection:{value:new T.Matrix4()},reveal:{value:2},clock:{value:0},night:{value:0},haze:{value:new T.Color()}}),[]);
 useEffect(()=>{uniforms.projection.value.copy(landscapeProjection(size.width,size.height));uniforms.reveal.value=landscapeReveal(progress);uniforms.night.value=palette.night;uniforms.haze.value.set(palette.middle);invalidate();},[size,palette,progress,uniforms,invalidate]);
 useFrame((_,delta)=>{if(!reduced&&!still)uniforms.clock.value+=Math.min(delta,.05);});
 useEffect(()=>()=>g.dispose(),[g]);
 return <mesh geometry={g} frustumCulled={false} renderOrder={12}><shaderMaterial transparent side={T.DoubleSide} uniforms={uniforms}
 vertexShader={`attribute vec3 root,petalColor;uniform mat4 projection;uniform float reveal,clock;varying vec3 color;varying float distance;void main(){vec3 p=position+root;p.x+=sin(root.x*.13+root.z*.095-clock*.43)*.045;color=petalColor;distance=-root.z;gl_Position=projection*vec4(p,1.);gl_Position.y-=reveal*gl_Position.w;}`}
 fragmentShader={`uniform float night;uniform vec3 haze;varying vec3 color;varying float distance;void main(){vec3 c=mix(color,color*vec3(.4,.5,.66),night*.8);c=mix(c,haze,smoothstep(20.,70.,distance));gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>}`}/></mesh>;
}
