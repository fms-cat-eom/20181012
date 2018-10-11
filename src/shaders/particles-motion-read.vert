#define HUGE 9E16
#define PI 3.141592654
#define TAU 6.283185307
#define V vec3(0.,1.,-1.)
#define saturate(i) clamp(i,0.,1.)
#define lofi(i,m) (floor((i)/(m))*(m))
#define lofir(i,m) (floor((i+0.5)/(m))*(m))

// == variables ================================================================
attribute vec2 computeUV;

varying vec3 vCol;
varying float vValid;

uniform vec2 resolutionPcompute;

uniform vec2 resolutionMotion;
uniform vec2 planeResolution;
uniform float voxelUnit;

uniform sampler2D samplerPcompute;

// == deal with motion field ===================================================
vec2 motionCoord( vec3 _v ) {
  vec3 v = floor( _v / voxelUnit ) + 0.5;
  vec2 planeSize = planeResolution / resolutionMotion;

  // == where are the plane origin? ============================================
  float zRange = floor( 1.0 / planeSize.x ) * floor( 1.0 / planeSize.y ) / 2.0;
  if ( v.z < -zRange || zRange < v.z ) {
    return vec2( 0.0, 0.0 );
  }
  float planeIndex = floor( v.z + zRange );
  vec2 planeOrigin = vec2( fract( planeIndex * planeSize.x ), floor( planeIndex * planeSize.x ) * planeSize.y );

  // == place a dot on the plane ===============================================
  vec2 xyRange = planeResolution / 2.0;
  if ( v.x < -xyRange.x || xyRange.x < v.x || v.y < -xyRange.y || xyRange.y < v.y ) {
    return vec2( 0.0, 0.0 );
  }
  return planeOrigin + ( v.xy + xyRange ) / planeResolution * planeSize;
}

// == main =====================================================================
void main() {
  // == fetch compute texture ==================================================
  vec2 puv = computeUV;
  vec2 dppix = vec2( 1.0 ) / resolutionPcompute;

  vec4 pos = texture2D( samplerPcompute, puv );
  vec4 vel = texture2D( samplerPcompute, puv + dppix * vec2( 1.0, 0.0 ) );

  // == place a dot ============================================================
  vec2 coord = motionCoord( pos.xyz );
  vValid = coord != vec2( 0.0, 0.0 ) ? 1.0 : 0.0; // out of compute cells
  vValid = 0.0 < pos.w ? 1.0 : 0.0; // life is depleted
  gl_Position = vec4( coord * 2.0 - 1.0, 0.0, 1.0 );
  gl_PointSize = 1.0;

  // == set a color ============================================================
  vCol = vel.xyz;
}