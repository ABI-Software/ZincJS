const THREE = require('three');
const toBufferGeometry = require('../utilities').toBufferGeometry;

/**
 * Provides an object which stores lines.
 * This is created when a valid json file containing lines is read into a {@link Zinc.Scene}
 * object.
 * 
 * @class
 * @author Alan Wu
 * @return {Lines}
 */
const Lines = function () {
  (require('./zincObject').ZincObject).call(this);
	this.isLines = true;

  /**
   * Create the line segements using geometry and material.
   * 
   * @param {THREE.Geomtry} geometryIn - Geometry of lines to be rendered.
   * @param {THREE.Material} materialIn - Material to be set for the lines.
   * @param {Object} options - Provide various options
   * @param {Boolean} options.localTimeEnabled - A flag to indicate either the lines is
   * time dependent.
   * @param {Boolean} options.localMorphColour - A flag to indicate either the colour is
   * time dependent.
   */
	this.createLineSegment = (geometryIn, materialIn, options) => {
		if (geometryIn && materialIn) {
			let geometry = toBufferGeometry(geometryIn, options);
			if (options.localMorphColour && geometry.morphAttributes[ "color" ])
				materialIn.onBeforeCompile = (require("./augmentShader").augmentMorphColor)();
      let line = new (require("../three/line/LineSegments").LineSegments)(geometry, materialIn);
      this.setMesh(line, options.localTimeEnabled, options.localMorphColour);
		}
	}

  /**
   * Set the width for the lines.
   * 
   * @param {Number} width - Width of the lines.
   */
	this.setWidth = width => {
		if (this.morph && this.morph.material) {
			this.morph.material.linewidth = width;
			this.morph.material.needsUpdate = true;
		}
	}

  /**
   * Add new lines to existing lines if it exists, otherwise
   * create a new one and add to it.
   * @param {Array} coords  -An array of three components coordinates.

   * @param {Number} colour - A hex value of the colour for the points
   */
	this.addLines = (coords, colour)  => {
    if (coords && coords.length > 0) {
      const geometry = this.addVertices(coords);
      let mesh = this.getMorph();
      if (!mesh) {
        let material = new THREE.LineBasicMaterial({color:colour});
        const options = { localTimeEnabled: false, localMorphColour: false};
        geometry.colorsNeedUpdate = true;
        this.createLineSegment(geometry, material, options);
      }
      if (this.region) this.region.pickableUpdateRequired = true;
    }
	}
}

Lines.prototype = Object.create((require('./zincObject').ZincObject).prototype);
exports.Lines = Lines;
