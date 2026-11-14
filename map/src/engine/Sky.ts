import * as THREE from 'three';

// Gradient sky dome that shares its horizon colour with the terrain fog, so a
// pitched view fades into the sky instead of ending at a hard tile edge. From
// orbit it darkens to space, which also frames the flat world square.
export function createSky(fogColor: THREE.Color, opts: { zenith?: string; space?: string } = {}) {
  const uniforms = {
    uHorizon: { value: fogColor },
    uZenith: { value: new THREE.Color(opts.zenith ?? '#2a4a6b') },
    uSpace: { value: new THREE.Color(opts.space ?? '#05090e') },
    uAltitude: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uZenith, uSpace;
      uniform float uAltitude;
      varying vec3 vDir;
      void main() {
        float up = max(vDir.y, 0.0);
        vec3 sky = mix(uHorizon, uZenith, pow(up, 0.5));
        sky = mix(sky, uSpace, uAltitude);
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return {
    mesh,
    update(camera: THREE.PerspectiveCamera, distance: number) {
      mesh.position.copy(camera.position);
      mesh.scale.setScalar(camera.far * 0.5);
      uniforms.uAltitude.value = THREE.MathUtils.smoothstep(Math.log10(distance), 5.4, 6.6);
    },
  };
}
