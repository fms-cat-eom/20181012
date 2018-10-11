const JSZip = require( 'jszip' );

const CanvasSaver = class {
  constructor( canvas ) {
    this.canvas = canvas;

    this.queueSave = false;
    this.zip = new JSZip();
    this.anchor = document.createElement( 'a' );

    this.frameCount = 0;
    this.inProgress = 0;
  }

  capture() {
    if ( this.queueSave ) {
      console.error( 'You already queued save command! Further captures are ignored.' );
      return;
    }

    const filename = ( '0000' + this.frameCount ).slice( -5 ) + '.png';

    this.frameCount ++;
    this.inProgress ++;

    this.canvas.toBlob( ( blob ) => {
      this.zip.file( filename, blob );
      this.inProgress --;
      this.__done();
    } );
  }

  save() {
    this.queueSave = true;
    this.__done();
  }

  __done() {
    if ( this.queueSave && this.inProgress === 0 ) {
      this.zip.generateAsync( { type: 'blob' } ).then( ( blob ) => {
        this.anchor.href = window.URL.createObjectURL( blob );
        this.anchor.download = 'canvasSaver-' + Date.now();
        this.anchor.click();

        this.frameCount = 0;
        this.queueSave = false;
      } );
    }
  }
};

module.exports = CanvasSaver;