// == load some modules ========================================================
import Xorshift from '../libs/xorshift';
import UltraCat from '../libs/ultracat';

// == roll the dice ============================================================
const seed = 15882356;
let xorshift = new Xorshift( seed );

// == very basic constants =====================================================
const ppp = 2;
const nParticleSqrt = 512;
const nParticle = nParticleSqrt * nParticleSqrt;

const jacobiIter = 50;

const motionFieldVoxelUnit = 0.2;
const motionFieldResolutionXY = 256;
const motionFieldResolution = [ motionFieldResolutionXY * 4, motionFieldResolutionXY * 8 ];

export default ( context ) => {
  // == prepare context ========================================================
  const glCatPath = context.glCatPath;
  const glCat = glCatPath.glCat;
  const gl = glCat.gl;

  const auto = context.automaton.auto;

  // == prepare vbos ===========================================================
  const vboQuad = glCat.createVertexbuffer( new Float32Array( UltraCat.triangleStripQuad ) );

  const vboComputeUV = glCat.createVertexbuffer( new Float32Array(
    UltraCat.matrix2d( nParticleSqrt, nParticleSqrt ).map( ( v, i ) => (
      i % 2 === 0
        ? ( v * ppp + 0.5 ) / nParticleSqrt / ppp
        : ( v + 0.5 ) / nParticleSqrt
    ) )
  ) );

  const oct = require( '../geoms/octahedron' )( { div: 1.0 } );

  const vboOctPos = glCat.createVertexbuffer( new Float32Array( oct.position ) );
  const vboOctNor = glCat.createVertexbuffer( new Float32Array( oct.normal ) );
  const iboOct = glCat.createIndexbuffer( new Uint16Array( oct.index ) );

  // == prepare random texture =================================================
  const textureRandomSize = 32;
  const textureRandomUpdate = ( _tex ) => {
    glCat.setTextureFromArray( _tex, textureRandomSize, textureRandomSize, ( () => {
      let len = textureRandomSize * textureRandomSize * 4;
      let ret = new Uint8Array( len );
      for ( let i = 0; i < len; i ++ ) {
        ret[ i ] = Math.floor( xorshift.gen() * 256.0 );
      }
      return ret;
    } )() );
  };

  const textureRandomStatic = glCat.createTexture();
  glCat.textureWrap( textureRandomStatic, gl.REPEAT );
  textureRandomUpdate( textureRandomStatic );

  const textureRandom = glCat.createTexture();
  glCat.textureWrap( textureRandom, gl.REPEAT );

  // == Toby Fox - Dummy! ======================================================
  const textureDummy = glCat.createTexture();
  glCat.setTextureFromArray( textureDummy, 1, 1, new Uint8Array( [ 0, 0, 0, 0 ] ) );

  // == let's create paths =====================================================
  glCatPath.add( {
    // == framebuffer sucks ====================================================
    particlesComputeReturn: {
      width: nParticleSqrt * ppp,
      height: nParticleSqrt,
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/return.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      filter: gl.NEAREST,
      func: ( path, params ) => {
        if ( context.automaton.time === 0.0 ) {
          xorshift.set( seed );
        }

        glCat.attribute( 'p', vboQuad, 2 );
        glCat.uniformTexture( 'sampler0', glCatPath.fb( 'particlesCompute' ).texture, 0 );
        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    },

    // == generate motion field by particles ===================================
    particlesMotionRead: {
      width: motionFieldResolution[ 0 ],
      height: motionFieldResolution[ 1 ],
      vert: require( '../shaders/particles-motion-read.vert' ),
      frag: require( '../shaders/particles-motion-read.frag' ),
      blend: [ gl.ONE, gl.ONE ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      func: ( path, params ) => {
        glCat.attribute( 'computeUV', vboComputeUV, 2 );

        glCat.uniform2fv( 'resolutionPcompute', [ nParticleSqrt * ppp, nParticleSqrt ] );
        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        glCat.uniformTexture( 'samplerPcompute', glCatPath.fb( 'particlesComputeReturn' ).texture, 0 );

        gl.drawArrays( gl.POINTS, 0, nParticle );
      }
    },

    // == enforce ==============================================================
    particlesEnforce: {
      width: motionFieldResolution[ 0 ],
      height: motionFieldResolution[ 1 ],
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/particles-enforce.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      func: ( path, params ) => {
        glCat.attribute( 'p', vboQuad, 2 );

        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        glCat.uniformTexture( 'samplerMotion', glCatPath.fb( 'particlesMotionRead' ).texture, 0 );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    },

    // == generate divergence field by motion field ============================
    particlesDivergence: {
      width: motionFieldResolution[ 0 ],
      height: motionFieldResolution[ 1 ],
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/particles-divergence.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      func: ( path, params ) => {
        glCat.attribute( 'p', vboQuad, 2 );

        glCat.uniform1f( 'nParticle', nParticle );
        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        glCat.uniformTexture( 'samplerMotion', glCatPath.fb( 'particlesEnforce' ).texture, 0 );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    },

    // == let's calculate pressure =============================================
    particlesPressure: {
      width: motionFieldResolution[ 0 ],
      height: motionFieldResolution[ 1 ],
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/particles-pressure.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      tempFb: [
        glCat.createFramebuffer( ...motionFieldResolution ),
        glCat.createFramebuffer( ...motionFieldResolution )
      ],
      func: ( path, params ) => {
        glCat.attribute( 'p', vboQuad, 2 );

        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        for ( let i = 0; i < jacobiIter; i ++ ) {
          gl.bindFramebuffer(
            gl.FRAMEBUFFER,
            i === ( jacobiIter - 1 ) ? params.framebuffer : path.tempFb[ i % 2 ].framebuffer
          );

          glCat.uniformTexture( 'samplerDivergence', glCatPath.fb( 'particlesDivergence' ).texture, 0 );
          glCat.uniformTexture(
            'samplerPressure',
            path.tempFb[ ( i + 1 ) % 2 ].texture,
            1
          );

          gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
        }
      }
    },

    // == write back the velocity ==============================================
    particlesMotionWrite: {
      width: motionFieldResolution[ 0 ],
      height: motionFieldResolution[ 1 ],
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/particles-motion-write.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      func: ( path, params ) => {
        glCat.attribute( 'p', vboQuad, 2 );

        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        glCat.uniformTexture( 'samplerMotion', glCatPath.fb( 'particlesMotionRead' ).texture, 0 );
        glCat.uniformTexture( 'samplerPressure', glCatPath.fb( 'particlesPressure' ).texture, 1 );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    },

    // == compute particles =======================================================
    particlesCompute: {
      width: nParticleSqrt * ppp,
      height: nParticleSqrt,
      vert: require( '../shaders/quad.vert' ),
      frag: require( '../shaders/particles-compute.frag' ),
      blend: [ gl.ONE, gl.ZERO ],
      clear: [ 0.0, 0.0, 0.0, 0.0 ],
      framebuffer: true,
      float: true,
      filter: gl.NEAREST,
      func: ( path, params ) => {
        textureRandomUpdate( textureRandom );

        glCat.attribute( 'p', vboQuad, 2 );

        glCat.uniform1f( 'nParticle', nParticle );
        glCat.uniform1f( 'nParticleSqrt', nParticleSqrt );
        glCat.uniform1f( 'ppp', ppp );

        glCat.uniform1i( 'isInitFrame', context.automaton.time === 0.0 ? true : false );

        glCat.uniform2fv( 'resolutionMotion', motionFieldResolution );
        glCat.uniform2fv( 'planeResolution', [ motionFieldResolutionXY, motionFieldResolutionXY ] );
        glCat.uniform1f( 'voxelUnit', motionFieldVoxelUnit );

        glCat.uniformTexture( 'samplerPcompute', glCatPath.fb( 'particlesComputeReturn' ).texture, 0 );
        glCat.uniformTexture( 'samplerRandom', textureRandom, 1 );
        glCat.uniformTexture( 'samplerRandomStatic', textureRandomStatic, 2 );
        glCat.uniformTexture( 'samplerMotionWrite', glCatPath.fb( 'particlesMotionWrite' ).texture, 3 );

        glCat.uniform1f( 'noisePhase', auto( 'particles-noisePhase' ) );
        glCat.uniform1f( 'noiseAmp', auto( 'particles-noiseAmp' ) );
        glCat.uniform1f( 'fluidAmp', auto( 'particles-fluidAmp' ) );
        glCat.uniform1f( 'genRate', auto( 'particles-genRate' ) );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
      }
    },

    // == render particles =====================================================
    particlesRender: {
      vert: require( '../shaders/particles-render.vert' ),
      frag: require( '../shaders/particles-render.frag' ),
      blend: [ gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA ],
      drawbuffers: 2,
      func: ( path, params ) => {
        glCat.attributeDivisor( 'computeUV', vboComputeUV, 2, 1 );
        glCat.attribute( 'geomPos', vboOctPos, 3 );
        glCat.attribute( 'geomNor', vboOctNor, 3 );

        glCat.uniform1f( 'nParticle', nParticle );
        glCat.uniform1f( 'nParticleSqrt', nParticleSqrt );
        glCat.uniform1f( 'ppp', ppp );

        glCat.uniform2fv( 'resolutionPcompute', [ nParticleSqrt * ppp, nParticleSqrt ] );

        glCat.uniform1i( 'isShadow', params.isShadow ? 1 : 0 );

        glCat.uniform1f( 'colorVar', auto( 'particles-colorVar' ) );
        glCat.uniform1f( 'colorOffset', auto( 'particles-colorOffset' ) );

        glCat.uniformTexture( 'samplerPcompute', glCatPath.fb( 'particlesCompute' ).texture, 0 );
        glCat.uniformTexture( 'samplerRandom', textureRandom, 1 );
        glCat.uniformTexture( 'samplerRandomStatic', textureRandomStatic, 2 );
        glCat.uniformTexture( 'samplerShadow', params.textureShadow || textureDummy, 3 );

        let ext = glCat.getExtension( 'ANGLE_instanced_arrays' );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, iboOct );
        ext.drawElementsInstancedANGLE( gl.TRIANGLES, oct.index.length, gl.UNSIGNED_SHORT, 0, nParticle );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
      }
    },
  } );

  if ( module.hot ) {
    module.hot.accept(
      [
        '../shaders/particles-motion-read.vert',
        '../shaders/particles-motion-read.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesMotionRead',
          require( '../shaders/particles-motion-read.vert' ),
          require( '../shaders/particles-motion-read.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/quad.vert',
        '../shaders/particles-enforce.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesEnforce',
          require( '../shaders/quad.vert' ),
          require( '../shaders/particles-enforce.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/quad.vert',
        '../shaders/particles-divergence.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesDivergence',
          require( '../shaders/quad.vert' ),
          require( '../shaders/particles-divergence.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/quad.vert',
        '../shaders/particles-pressure.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesPressure',
          require( '../shaders/quad.vert' ),
          require( '../shaders/particles-pressure.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/quad.vert',
        '../shaders/particles-motion-write.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesMotionWrite',
          require( '../shaders/quad.vert' ),
          require( '../shaders/particles-motion-write.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/quad.vert',
        '../shaders/particles-compute.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesCompute',
          require( '../shaders/quad.vert' ),
          require( '../shaders/particles-compute.frag' )
        );
      }
    );

    module.hot.accept(
      [
        '../shaders/particles-render.vert',
        '../shaders/particles-render.frag'
      ],
      () => {
        glCatPath.replaceProgram(
          'particlesRender',
          require( '../shaders/particles-render.vert' ),
          require( '../shaders/particles-render.frag' )
        );
      }
    );
  }
};