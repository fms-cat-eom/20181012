#define DIR false
#define REVERSE false

precision highp float;

uniform vec2 resolution;

uniform float threshold;
uniform bool shadow;
uniform sampler2D sampler0;

float gray( vec3 c ) {
  return dot( c, vec3( 0.299, 0.587, 0.114 ) );
}

vec3 toRgb( float i ) {
  return vec3(
    mod( i, 256.0 ),
    mod( floor( i / 256.0 ), 256.0 ),
    floor( i / 65536.0 )
  ) / 255.0;
}

bool thr( float v ) {
  return shadow ? ( threshold < v ) : ( v < 1.0 - threshold );
}

vec4 draw( vec2 uv ) {
  vec2 dir = DIR ? vec2( 0.0, 1.0 ) : vec2( 1.0, 0.0 );
  float wid = DIR ? resolution.y : resolution.x;
  float pos = DIR ? floor( uv.y * resolution.y ) : floor( uv.x * resolution.x );
  
  float val = gray( texture2D( sampler0, uv ).xyz );
  
  if ( !thr( val ) ) {
    float post = pos;
    float rank = 0.0;
    float head = 0.0;
    float tail = 0.0;
    
    for ( int i = 0; i < 2000; i ++ ) {
      if ( int( wid ) == i ) { break; }
      post -= 1.0;
      if ( post == -1.0 ) { head = post + 1.0; break; }
      vec2 p = dir * ( post + 0.5 ) / wid + dir.yx * uv;
      float v = gray( texture2D( sampler0, p ).xyz );
      if ( thr( v ) ) { head = post + 1.0; break; }
      if ( v <= val ) { rank += 1.0; }
    }
    
    post = pos;
    for ( int i = 0; i < 2000; i ++ ) {
      if ( int( wid ) == i ) { break; }
      post += 1.0;
      if ( wid == post ) { tail = post - 1.0; break; }
      vec2 p = dir * ( post + 0.5 ) / wid + dir.yx * uv;
      float v = gray( texture2D( sampler0, p ).xyz );
      if ( thr( v ) ) { tail = post - 1.0; break; }
      if ( v < val ) { rank += 1.0; }
    }
    
    pos = REVERSE ? ( tail - rank ) : ( head + rank );
  }
  
  return vec4( toRgb( pos ), 1.0 );
}

void main() {
  gl_FragColor = draw( gl_FragCoord.xy / resolution.xy );
}