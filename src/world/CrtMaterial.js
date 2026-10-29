/* Pantalla CRT: curvatura, scanlines, máscara de fósforo, viñeta y brillo, sobre la textura del canvas 224×288. */
import { ShaderMaterial } from 'three';

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform float enabled;
  uniform float time;
  uniform float power;      // 0 = apagada, 1 = encendida (fundido al encender)
  varying vec2 vUv;

  vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
    uv = uv + uv * off * off;
    return uv * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = mix(vUv, curve(vUv), enabled);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 col = texture2D(map, uv).rgb;
    // Halo suave: mezcla con muestras vecinas para simular el brillo del fósforo.
    vec2 px = vec2(1.0 / 224.0, 1.0 / 288.0);
    vec3 glow = texture2D(map, uv + vec2(px.x, 0.0)).rgb + texture2D(map, uv - vec2(px.x, 0.0)).rgb
              + texture2D(map, uv + vec2(0.0, px.y)).rgb + texture2D(map, uv - vec2(0.0, px.y)).rgb;
    col += glow * 0.06 * enabled;
    // Scanlines (una por línea del juego) y máscara RGB vertical.
    float scan = 0.78 + 0.22 * sin((uv.y * 288.0) * 6.28318 + 1.57);
    float mask = 0.9 + 0.1 * sin(uv.x * 224.0 * 3.0 * 6.28318 / 3.0);
    col *= mix(1.0, scan * mask, enabled);
    // Viñeta y leve parpadeo.
    vec2 d = uv - 0.5;
    float vig = 1.0 - dot(d, d) * 1.4;
    col *= mix(1.0, vig * (0.985 + 0.015 * sin(time * 50.0)), enabled);
    col *= 1.15 * power;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createCrtMaterial(texture) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: texture },
      enabled: { value: 1 },
      time: { value: 0 },
      power: { value: 1 }
    },
    vertexShader,
    fragmentShader,
    toneMapped: false
  });
}
