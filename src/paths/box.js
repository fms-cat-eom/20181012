import MathCat from '../libs/mathcat';
import UltraCat from '../libs/ultracat';
import genCube from '../geoms/cube';

// ------

export default ( context ) => {
  // == hi context =============================================================
  const glCatPath = context.glCatPath;
  const glCat = glCatPath.glCat;
  const gl = glCat.gl;

  const auto = context.automaton.auto;

  // == hi vbo =================================================================
  const box = genCube();
  const vboBoxPos = glCat.createVertexbuffer( new Float32Array( [
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
    1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
    -1.0, 1.0, -1.0, -1.0, -1.0, -1.0,
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    1.0, -1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0, -1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, -1.0, 1.0,
    1.0, 1.0, -1.0, 1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0,
  ] ) );

  // == path definition begin ==================================================
  glCatPath.add( {
    box: {
      vert: require( '../shaders/box.vert' ),
      frag: require( '../shaders/box.frag' ),
      blend: [ gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA ],
      func: ( path, params ) => {
        glCat.attribute( 'pos', vboBoxPos, 3 );

        let matM = MathCat.mat4Identity();
        matM = MathCat.mat4Apply( MathCat.mat4Scale( [ 2.1, 2.1 * auto( 'box-phase' ), 2.1 ] ), matM );
        matM = MathCat.mat4Apply( MathCat.mat4Translate( [ 0.0, -2.1 + 2.1 * auto( 'box-phase' ), 0.0 ] ), matM );
        glCat.uniformMatrix4fv( 'matM', matM );

        gl.drawArrays( gl.LINES, 0, 24 );
      }
    }
  } );

  if ( module.hot ) {
    module.hot.accept(
      [
        '../shaders/box.vert',
        '../shaders/box.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'box',
          require( '../shaders/box.vert' ),
          require( '../shaders/box.frag' )
        );
      }
    );
  }
};