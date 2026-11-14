import * as THREE from 'three';

// One grid shared by every tile. position.x/z hold the tile-local uv in [0,1];
// the vertex shader scales it to metres and lifts it by the sampled height.
// Border vertices are duplicated as a "skirt" hanging below the surface so the
// height mismatch between neighbouring LODs never opens a visible crack.
export function createTileGeometry(n = 48): THREE.BufferGeometry {
  const pos: number[] = [];
  const skirt: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      pos.push(i / n, 0, j / n);
      skirt.push(0);
    }
  }
  const at = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Walk the border once, emitting a skirt vertex under each edge vertex.
  const border: number[] = [];
  for (let i = 0; i < n; i++) border.push(at(i, 0));
  for (let j = 0; j < n; j++) border.push(at(n, j));
  for (let i = n; i > 0; i--) border.push(at(i, n));
  for (let j = n; j > 0; j--) border.push(at(0, j));
  const base = pos.length / 3;
  for (const v of border) {
    pos.push(pos[v * 3], 0, pos[v * 3 + 2]);
    skirt.push(1);
  }
  for (let k = 0; k < border.length; k++) {
    const a = border[k], b = border[(k + 1) % border.length];
    const sa = base + k, sb = base + ((k + 1) % border.length);
    idx.push(a, b, sa, b, sb, sa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skirt', new THREE.Float32BufferAttribute(skirt, 1));
  g.setIndex(idx);
  return g;
}

export type SharedUniforms = {
  uExaggeration: { value: number };
  uSun: { value: THREE.Vector3 };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uLabelsOn: { value: number };
};

export function createSharedUniforms(): SharedUniforms {
  return {
    uExaggeration: { value: 1.6 },
    uSun: { value: new THREE.Vector3(-0.55, 0.75, -0.35).normalize() },
    uFogColor: { value: new THREE.Color('#a9bccc') },
    uFogDensity: { value: 0 },
    uLabelsOn: { value: 1 },
  };
}

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float skirt;
uniform sampler2D uElev;
uniform vec3 uElevT;
uniform float uSize;
uniform float uMercScale;
uniform float uExaggeration;
uniform float uSkirt;
varying vec2 vUv;
varying vec3 vNormal;
varying float vDist;
varying float vHeight;

float heightAt(vec2 uv) {
  return max(texture2D(uElev, uElevT.xy + clamp(uv, 0.0, 1.0) * uElevT.z).r, 0.0);
}

void main() {
  vec2 uv = position.xz;
  float k = uMercScale * uExaggeration;
  float hm = heightAt(uv);
  // Finite differences over one elevation texel, but never coarser than 1/32 of
  // the tile, so a tile drawn from a far ancestor still gets per-vertex relief.
  float e = min(1.0 / (256.0 * uElevT.z), 1.0 / 32.0);
  float dx = (heightAt(uv + vec2(e, 0.0)) - heightAt(uv - vec2(e, 0.0))) * k;
  float dz = (heightAt(uv + vec2(0.0, e)) - heightAt(uv - vec2(0.0, e))) * k;
  float span = 2.0 * e * uSize;
  vNormal = normalize(vec3(-dx / span, 1.0, -dz / span));
  vHeight = hm;
  vUv = uv;
  vec3 p = vec3(uv.x * uSize, hm * k - skirt * uSkirt, uv.y * uSize);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uImg;
uniform vec3 uImgT;
uniform sampler2D uLab;
uniform vec3 uLabT;
uniform float uLabOn;
uniform float uLabelsOn;
uniform sampler2D uOver;
uniform float uOverOn;
uniform vec3 uSun;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec2 vUv;
varying vec3 vNormal;
varying float vDist;
varying float vHeight;

void main() {
  #include <logdepthbuf_fragment>
  vec3 base = texture2D(uImg, uImgT.xy + vUv * uImgT.z).rgb;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uSun), 0.0);
  // Satellite imagery already carries the shadows of the hour it was shot, so
  // our own sun only adds a gentle relief; flat ground lands at ~1.0.
  float flat_ = max(uSun.y, 0.001);
  float shade = clamp(0.35 + 0.65 * diff / flat_, 0.45, 1.25);
  vec3 col = base * shade;

  if (uOverOn > 0.5) {
    vec4 o = texture2D(uOver, vUv);
    col = mix(col, o.rgb, o.a);
  }
  if (uLabOn * uLabelsOn > 0.5) {
    vec4 l = texture2D(uLab, uLabT.xy + vUv * uLabT.z);
    col = mix(col, l.rgb, l.a);
  }

  float f = 1.0 - exp(-pow(vDist * uFogDensity, 2.0));
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createTileMaterial(shared: SharedUniforms, blank: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...shared,
      uElev: { value: blank },
      uElevT: { value: new THREE.Vector3(0, 0, 1) },
      uSize: { value: 1 },
      uMercScale: { value: 1 },
      uSkirt: { value: 1 },
      uImg: { value: blank },
      uImgT: { value: new THREE.Vector3(0, 0, 1) },
      uLab: { value: blank },
      uLabT: { value: new THREE.Vector3(0, 0, 1) },
      uLabOn: { value: 0 },
      uOver: { value: blank },
      uOverOn: { value: 0 },
    },
  });
}
