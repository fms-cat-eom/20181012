#define TAU 6.283185307

precision highp float;

varying vec3 vPos;

uniform float time;

void main() {
  float h = vPos.x + vPos.y + vPos.z; // h
  float wave = sin( 20.0 * h + 4.0 * TAU * time );
  float slash = step( -0.3, wave );
  gl_FragColor = vec4( vec3( slash * 0.8 ), 1.0 );
}