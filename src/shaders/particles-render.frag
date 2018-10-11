#define PI 3.14159265
#define TAU 6.28318531
#define saturate(i) clamp(i,0.,1.)

// ------

#extension GL_EXT_draw_buffers : require
precision highp float;

varying vec3 vPos;
varying vec3 vNor;
varying vec3 vCol;
varying float vLife;

uniform mat4 matPL;
uniform mat4 matVL;

uniform vec3 cameraPos;
uniform float perspFar;
uniform vec3 lightPos;

uniform bool isShadow;

uniform sampler2D samplerShadow;

// == rotate ===================================================================
mat2 rotate2D( float _t ) {
  return mat2( cos( _t ), sin( _t ), -sin( _t ), cos( _t ) );
}

// == uh =======================================================================
float shadow( float d ) {
  vec4 pl = matPL * matVL * vec4( vPos, 1.0 );
  vec2 uv = pl.xy / pl.w * 0.5 + 0.5;

  float dc = length( vPos - lightPos );
  float ret = 0.0;
  for ( int iy = -1; iy <= 1; iy ++ ) {
    for ( int ix = -1; ix <= 1; ix ++ ) {
      vec2 uv = uv + vec2( float( ix ), float ( iy ) ) * 1E-3;
      float proj = texture2D( samplerShadow, uv ).x;
      float bias = 0.1 + ( 1.0 - d ) * 0.3;

      float dif = smoothstep( bias * 2.0, bias, ( dc - proj ) );
      ret += dif / 9.0;
    }
  }
  return ret;
}

// == main procedure ===========================================================
void main() {
  if ( vLife <= 0.0 ) { discard; }

  if ( isShadow ) {
    float depth = length( vPos - lightPos );
    gl_FragData[ 0 ] = vec4( depth, 0.0, 0.0, 1.0 );
    return;
  }

  vec3 lightDir = normalize( vPos - lightPos );
  vec3 rayDir = normalize( vPos - cameraPos );
  float d = dot( -vNor, lightDir );
  float dif = mix( 1.0, d, 0.5 );
  vec3 col = dif * vCol;

  float shadowFactor = shadow( d );
  col *= mix( 0.5, 1.0, shadowFactor );
  col = max( vec3( 0.0 ), col );

  gl_FragData[ 0 ] = vec4( col, 1.0 );
  gl_FragData[ 1 ] = vec4( length( cameraPos - vPos ), 0.0, 0.0, 1.0 );
}