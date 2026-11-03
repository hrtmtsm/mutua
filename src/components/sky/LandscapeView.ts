import * as THREE from 'three';
export function landscapeProjection(width:number,height:number) {
 const camera=new THREE.PerspectiveCamera(44,width/height,.1,260);
 camera.position.set(0,6,12);camera.lookAt(0,2.7,-35);camera.updateMatrixWorld();
 return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
}
export const landscapeReveal=(progress:number)=>(1-Math.max(0,Math.min(1,(progress-.12)/.88)))*1.55;
