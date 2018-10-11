#define DIR false

precision highp float;

uniform vec2 resolution;

uniform sampler2D sampler0;
uniform sampler2D samplerMap;

float fromRgb( vec3 v ) {
  return ( ( v.z * 256.0 + v.y ) * 256.0 + v.x ) * 255.0;
}

vec4 draw( vec2 uv ) {
  vec2 dir = DIR ? vec2( 0.0, 1.0 ) : vec2( 1.0, 0.0 );
  float wid = DIR ? resolution.y : resolution.x;
  float pos = DIR ? floor( uv.y * resolution.y ) : floor( uv.x * resolution.x );
  
  for ( int i = 0; i < 2000; i ++ ) {
    if ( int( wid ) == i ) { break; }

    vec2 p = uv + dir * float( i ) / wid;
    if ( p.x < 1.0 && p.y < 1.0 ) {
      float v = fromRgb( texture2D( samplerMap, p ).xyz );
      if ( abs( v - pos ) < 0.5 ) {
        return texture2D( sampler0, p );
        break;
      }
    }
    
    p = uv - dir * float( i ) / wid;
    if ( 0.0 < p.x && 0.0 < p.y ) {
      float v = fromRgb( texture2D( samplerMap, p ).xyz );
      if ( abs( v - pos ) < 0.5 ) {
        return texture2D( sampler0, p );
        break;
      }
    }
  }
  
  return vec4( 1.0, 0.0, 1.0, 1.0 );
}

void main() {
  gl_FragColor = draw( gl_FragCoord.xy / resolution.xy );
}