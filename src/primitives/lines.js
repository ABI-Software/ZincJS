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
	this.isOptionalLines = true;
	this.isLines = false;
	this.isTubeLines = false;
  let dataIn = {};

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
      dataIn = { geometryIn, materialIn, options };
      let geometry = toBufferGeometry(geometryIn, options);
      if (options.localMorphColour && geometry.morphAttributes[ "color" ])
        materialIn.onBeforeCompile = (require("./augmentShader").augmentMorphColor)();
      let line = new (require("../three/line/LineSegments").LineSegments)(geometry, materialIn);
      this.setMesh(line, options.localTimeEnabled, options.localMorphColour);
      this.isLines = true;
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
   * Set the colour of the mesh using hex in string form.
   * 
   * @param {String} hex - The colour value in hex form.
   */
	this.setColourHex = (hex) => {
    let mesh = this.getMorph();
    mesh.material.color.setHex(hex);
	}

  /**
   * Get the colour of the mesh in hex string form.
   * 
   * @return {String}
   */
	this.getColourHex = () => {
    let mesh = this.getMorph();
    return mesh.material.color.getHexString();
  }

  /**
   * Set the opacity of this Geometry. This function will also set the transparent
   * according to the provided alpha value.
   * 
   * @param {Number} alpah - Alpha value to set for this geometry, 
   * can be any value between from 0 to 1.0.
   */
  this.setAlpha = function (alpha) {
    let mesh = this.getMorph();
    mesh.material.opacity = alpha;
    mesh.material.transparent = alpha < 1.0;
  }

  /**
   * Display in normal line style
   */
  this.useLines = () => {
    this.isLines = true;
    const { geometryIn, materialIn, options } = dataIn;
    let mesh = this.getMorph();
    mesh.geometry.dispose();
    mesh.geometry = toBufferGeometry(geometryIn, options);
    const previousColor = mesh.material.color;
    mesh.material.dispose();
    mesh.material = new THREE.LineBasicMaterial( { color: previousColor } );
    this.isTubeLines = false;
  }

  /**
   * Display in tube line style
   * 
   * @param {Integer} tubularSegments The number of segments that make up the tube.
   * @param {Float} radius The radius of the tube.
   * @param {Integer} radialSegments The number of segments that make up the cross-section.
   * @param {Boolean} closed Is the tube open or closed.
   */
  this.useTubeLines = (tubularSegments, radius, radialSegments, closed = false) => {
    if (tubularSegments && radius && radialSegments) {
      this.isTubeLines = true;
      const { geometryIn, materialIn, options } = dataIn;
      const path = new THREE.CatmullRomCurve3( geometryIn.vertices );
      let mesh = this.getMorph();
      mesh.geometry.dispose();
      mesh.geometry = new (require("../three/line/TubeGeometry").TubeGeometry)( path, tubularSegments, radius, radialSegments, closed );
      const previousColor = mesh.material.color;
      mesh.material.dispose();
      mesh.material = new THREE.MeshBasicMaterial( { color: previousColor } );
      this.isLines = false;
    }
  }

  /**
   * Update tube tubularSegments/radius/radialSegments/closed value
   * 
   * @param {Integer} tubularSegments The number of segments that make up the tube.
   * @param {Float} radius The radius of the tube.
   * @param {Integer} radialSegments The number of segments that make up the cross-section.
   * @param {Boolean} closed Is the tube open or closed.
   */
  this.setTubeLines = (tubularSegments, radius, radialSegments, closed = false) => {
    if (tubularSegments && radius && radialSegments) {
      const { geometryIn, materialIn, options } = dataIn;
      const path = new THREE.CatmullRomCurve3( geometryIn.vertices );
      let mesh = this.getMorph();
      mesh.geometry.dispose();
      mesh.geometry = new (require("../three/line/TubeGeometry").TubeGeometry)( path, tubularSegments, radius, radialSegments, closed );
    }
  }

  /**
   * Add new lines to existing lines if it exists, otherwise
   * create a new one and add to it.
   * 
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
