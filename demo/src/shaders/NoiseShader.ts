export const NoiseShader = {
  uniforms: {
    tDiffuse: { value: null },
    opacity: { value: 0.15 },
    time: { value: 0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float opacity;
    uniform float time;
    varying vec2 vUv;

    // Simple noise function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);

      // Generate noise based on UV and time
      float noise = random(vUv * time);

      // Mix noise with original color
      vec3 color = mix(texel.rgb, vec3(noise), opacity);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};
