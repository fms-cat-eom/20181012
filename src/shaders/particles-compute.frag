#define PARTICLE_LIFE_LENGTH 1.0

#define HUGE 9E16
#define PI 3.14159265
#define TAU 6.283185307
#define V vec3(0.,1.,-1.)
#define saturate(i) clamp(i,0.,1.)
#define lofi(i,m) (floor((i)/(m))*(m))
#define lofir(i,m) (floor((i)/(m)+.5)*(m))

// ------

precision highp float;

uniform float time;

uniform float nParticleSqrt;
uniform float nParticle;
uniform float ppp;

uniform float totalFrame;
uniform bool init;
uniform float deltaTime;
uniform vec2 resolution;

uniform bool isInitFrame;

uniform vec2 resolutionMotion;
uniform vec2 planeResolution;
uniform float voxelUnit;

uniform sampler2D samplerPcompute;
uniform sampler2D samplerMotionWrite;
uniform sampler2D samplerRandom;

uniform float noisePhase;
uniform float noiseAmp;
uniform float fluidAmp;
uniform float velScale;
uniform float genRate;

// ------

vec2 vInvert( vec2 _uv ) {
  return vec2( 0.0, 1.0 ) + vec2( 1.0, -1.0 ) * _uv;
}

// ------

mat2 rotate2D( float _t ) {
  return mat2( cos( _t ), sin( _t ), -sin( _t ), cos( _t ) );
}

float fractSin( float i ) {
  return fract( sin( i ) * 1846.42 );
}

vec4 sampleRandom( vec2 _uv ) {
  return texture2D( samplerRandom, _uv );
}

#pragma glslify: prng = require( ./-prng );
#pragma glslify: noise = require( ./-simplex4d );

vec3 randomSphere( inout vec4 seed ) {
  vec3 v;
  for ( int i = 0; i < 10; i ++ ) {
    v = vec3(
      prng( seed ),
      prng( seed ),
      prng( seed )
    ) * 2.0 - 1.0;
    if ( length( v ) < 1.0 ) { break; }
  }
  return v;
}

vec2 randomCircle( inout vec4 seed ) {
  vec2 v;
  for ( int i = 0; i < 10; i ++ ) {
    v = vec2(
      prng( seed ),
      prng( seed )
    ) * 2.0 - 1.0;
    if ( length( v ) < 1.0 ) { break; }
  }
  return v;
}

vec3 randomBox( inout vec4 seed ) {
  vec3 v;
  v = vec3(
    prng( seed ),
    prng( seed ),
    prng( seed )
  ) * 2.0 - 1.0;
  return v;
}

// == deal with motion field ===================================================
vec3 fetchMotionLinear( vec3 _v ) {
  vec3 v = floor( _v / voxelUnit ) + 0.5;
  vec3 vf = ( _v / voxelUnit );
  vec2 planeSize = planeResolution / resolutionMotion;

  // == where are the plane origin? ============================================
  float zRange = floor( 1.0 / planeSize.x ) * floor( 1.0 / planeSize.y ) / 2.0;
  if ( v.z < -zRange || zRange < v.z ) {
    return vec3( 0.0 );
  }
  float planeIndex = floor( v.z + zRange ) + ( fract( vf.z ) < 0.5 ? -1.0 : 0.0 );
  vec2 planeOrigin0 = vec2( fract( planeIndex * planeSize.x ), floor( planeIndex * planeSize.x ) * planeSize.y );
  planeIndex += 1.0;
  vec2 planeOrigin1 = vec2( fract( planeIndex * planeSize.x ), floor( planeIndex * planeSize.x ) * planeSize.y );

  // == place a dot on the plane ===============================================
  vec2 xyRange = planeResolution / 2.0;
  if ( v.x < -xyRange.x || xyRange.x < v.x || v.y < -xyRange.y || xyRange.y < v.y ) {
    return vec3( 0.0 );
  }

  vec2 uv0 = planeOrigin0 + ( vf.xy + xyRange ) / planeResolution * planeSize;
  vec2 uv1 = planeOrigin1 + ( vf.xy + xyRange ) / planeResolution * planeSize;
  return mix(
    texture2D( samplerMotionWrite, uv0 ).xyz,
    texture2D( samplerMotionWrite, uv1 ).xyz,
    fract( vf.z + 0.5 )
  );
}

// ------

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 puv = vec2( ( floor( gl_FragCoord.x / ppp ) * ppp + 0.5 ) / resolution.x, uv.y );
  float mode = mod( gl_FragCoord.x, ppp );
  vec2 dpix = vec2( 1.0 ) / resolution;

  float dt = deltaTime;

  // == prepare some vars ======================================================
  vec4 seed = texture2D( samplerRandom, puv );
  prng( seed );

  vec4 pos = texture2D( samplerPcompute, puv );
  vec4 vel = texture2D( samplerPcompute, puv + dpix * vec2( 1.0, 0.0 ) );

  float timing = mix(
    0.0,
    PARTICLE_LIFE_LENGTH,
    lofi( floor( puv.y * nParticleSqrt ) / nParticleSqrt, 1.0 / 4.0 )
  );
  timing += lofi( time, PARTICLE_LIFE_LENGTH );

  if ( time - deltaTime + PARTICLE_LIFE_LENGTH < timing ) {
    timing -= PARTICLE_LIFE_LENGTH;
  }

  // == initialize particles ===================================================
  // if ( isInitFrame ) {
  //   pos.w = 0.0;
  // }

  // == generate particles =====================================================
  if (
    time - deltaTime < timing && timing <= time &&
    prng( seed ) < genRate
  ) {
    dt = time - timing;

    vec4 thisIsVeryTemporaryVariable = vec4( time );
    pos.xyz = 0.1 * randomSphere( seed ) + randomSphere( thisIsVeryTemporaryVariable );
    pos.xyz += 0.6 * vec3(
      -noise( vec4( 1.8 * pos.xyz, 1.8112 + noisePhase ) ),
      noise( vec4( 1.8 * pos.xyz, 3.8112 + noisePhase ) ),
      -noise( vec4( 1.8 * pos.xyz, 5.8112 + noisePhase ) )
    );

    vel.xyz = 0.1 * randomSphere( seed );
    vel.w = 0.0;

    pos.w = 1.0; // life
  }
  
  if ( pos.w <= 0.0 ) {
    pos = vec4( 0.0 );
    vel = vec4( 0.0 );
  } else {
    // == update particles =====================================================
    // fluid
    {
      vec3 motion = fetchMotionLinear( pos.xyz );
      vec3 tmp = pos.xyz + dt * 0.5 * ( vel.xyz + motion );
      motion = fetchMotionLinear( pos.xyz );
      vel.xyz += fluidAmp * motion;
    }

    // wall
    float border = 2.0;
    for ( int i = 0; i < 3; i ++ ) {
      if ( border < abs( pos[ i ] ) ) {
        float s = sign( pos[ i ] );
        pos[ i ] = s * border;
      }
    }

    // voltex
    // vel.zx -= dt * 10.0 * vec2( -1.0, 1.0 ) * normalize( pos.xz );

    // noise
    // vel.xyz += dt * noiseAmp * 20.0 * vec3(
    //   -noise( vec4( 1.8 * pos.xyz, 1.485 + noisePhase ) ),
    //   noise( vec4( 1.8 * pos.xyz, 3.485 + noisePhase ) ),
    //   -noise( vec4( 1.8 * pos.xyz, 5.485 + noisePhase ) )
    // );

    // gravity
    // vel.y -= dt * 10.8;

    pos.xyz += vel.xyz * dt;
    pos.xyz += 0.01 * dt * ( vec3(
      prng( seed ),
      prng( seed ),
      prng( seed )
    ) - 0.5 );
    pos.w -= dt / PARTICLE_LIFE_LENGTH;
  }

  gl_FragColor = (
    mode < 1.0 ? pos :
    vel
  );
}