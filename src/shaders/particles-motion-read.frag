precision highp float;

// == variables ================================================================
varying vec3 vCol;
varying float vValid;

void main() {
  // == if it is invalid then just discard =====================================
  if ( vValid == 0.0 ) { discard; }

  // == just shot a dot ========================================================
  gl_FragColor = vec4( vCol, 1.0 );
}