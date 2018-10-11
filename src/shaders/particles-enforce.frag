precision highp float;

// == variables ================================================================
uniform vec2 resolutionMotion;
uniform vec2 planeResolution;
uniform float voxelUnit;

uniform float deltaTime;
uniform sampler2D samplerMotion;

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

vec3 motionCoordInv( vec2 _coord ) {
  vec2 planeSize = planeResolution / resolutionMotion;
  vec3 ret = vec3( 0.0 );

  // == x and y ================================================================
  ret.xy = ( ( fract( _coord / planeSize ) - 0.5 ) * planeResolution ) * voxelUnit;

  // == z ======================================================================
  float zRange = floor( 1.0 / planeSize.x ) * floor( 1.0 / planeSize.y ) / 2.0;
  vec2 planePlace = floor( _coord / planeSize );
  ret.z = ( planePlace.x + floor( planePlace.y / planeSize.x ) - zRange + 0.5 ) * voxelUnit;

  return ret;
}

// == um =======================================================================
vec3 extractVelocity( vec4 tex ) {
  return tex.w == 0.0 ? vec3( 0.0 ) : tex.xyz / tex.w;
}

// == main =====================================================================
void main() {
  vec2 uv = gl_FragCoord.xy / resolutionMotion;
  vec3 v = motionCoordInv( uv );
  vec3 mul = vec3( 1.0 );

  for ( int i = 0; i < 3; i ++ ) {
    float border = 2.0;
    if ( border < abs( v[ i ] ) ) {
      v[ i ] = border;
      mul[ i ] *= -1.0;
    }
  }

  vec3 vel = vec3( 0.0 );

  for ( int iz = -1; iz <= 1; iz ++ ) {
    for ( int iy = -1; iy <= 1; iy ++ ) {
      for ( int ix = -1; ix <= 1; ix ++ ) {
        vec4 tex = texture2D( samplerMotion, motionCoord( v + vec3( ix, iy, iz ) * voxelUnit ) );
        vel += extractVelocity( tex ) / 27.0;
      }
    }
  }

  vec4 tex = texture2D( samplerMotion, uv );
  vel += deltaTime * ( tex.w == 0.0 ? vec3( 0.0 ) : vec3( 0.0, -10.0, 0.0 ) );

  gl_FragColor = vec4( mul * vel, tex.w );
}