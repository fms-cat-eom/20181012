#define HUGE 9E16
#define PI 3.141592654
#define TAU 6.283185307
#define V vec3(0.,1.,-1.)
#define saturate(i) clamp(i,0.,1.)
#define lofi(i,m) (floor((i)/(m))*(m))
#define lofir(i,m) (floor((i+0.5)/(m))*(m))

// ------

attribute vec2 computeUV;
attribute vec3 geomPos;
attribute vec3 geomNor;

varying vec3 vPos;
varying vec3 vNor;
varying vec3 vCol;
varying float vLife;

uniform vec2 resolution;
uniform vec2 resolutionPcompute;

uniform mat4 matP;
uniform mat4 matV;
uniform mat4 matVL;
uniform mat4 matPL;

uniform bool isShadow;

uniform float colorVar;
uniform float colorOffset;

uniform sampler2D samplerPcompute;
uniform sampler2D samplerRandomStatic;

// ------

vec3 catColor( float _p ) {
  return 0.5 + 0.5 * vec3(
    cos( _p ),
    cos( _p + PI / 3.0 * 4.0 ),
    cos( _p + PI / 3.0 * 2.0 )
  );
}

vec4 random( vec2 _uv ) {
  return texture2D( samplerRandomStatic, _uv );
}

mat2 rotate2D( float _t ) {
  return mat2( cos( _t ), sin( _t ), -sin( _t ), cos( _t ) );
}

// ------

vec3 rotateGeometry( vec3 _p, vec3 _v ) {
  vec3 v = _v;
  v.yz = rotate2D( 4.0 * _p.x ) * v.yz;
  v.zx = rotate2D( 4.0 * _p.y ) * v.zx;
  v.xy = rotate2D( 4.0 * _p.z ) * v.xy;
  return v;
}

void main() {
  // == fetch compute texture ==================================================
  vec2 puv = computeUV;
  vec2 dppix = vec2( 1.0 ) / resolutionPcompute;

  vec4 pos = texture2D( samplerPcompute, puv );
  vec4 vel = texture2D( samplerPcompute, puv + dppix * vec2( 1.0, 0.0 ) );

  // == ???????? ===============================================================
  vec4 dice = random( puv.yy * 182.92 );

  // == assign varying variables ===============================================
  vLife = pos.w;

  // vCol = (
  //   dice.y < 0.8
  //   ? pow( catColor( TAU * ( ( dice.x * 2.0 - 1.0 ) * colorVar + colorOffset ) ), vec3( 2.0 ) )
  //   : vec3( 0.4 )
  // );
  // vCol = abs( vel.xyz );
  vCol = catColor( 4.5 - length( vel ) * 0.3 );
  vCol *= 0.5 + 0.4 * length( vel );
  vCol *= vLife;
  // vCol = vec3( 5.0 );

  // == geometry ===============================================================
  float size = ( 0.01 + 0.01 * pow( dice.w, 2.0 ) );
  size *= min( length( vCol ), 1.0 );

  vNor = rotateGeometry( pos.xyz, geomNor );
  pos.xyz += size * rotateGeometry( pos.xyz, geomPos );

  // == finalize ===============================================================
  vPos = pos.xyz;

  vec4 outPos;
  if ( isShadow ) {
    outPos = matPL * matVL * vec4( pos.xyz, 1.0 );
  } else {
    outPos = matP * matV * vec4( pos.xyz, 1.0 );
    outPos.x /= resolution.x / resolution.y;
  }
  gl_Position = outPos;
  // gl_PointSize = resolution.y * size / outPos.z;
}