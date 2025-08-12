const THREE = require('three');
const toBufferGeometry = require('../utilities').toBufferGeometry;
const mergeGeometries = require('../utilities').mergeGeometries;

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
      const settings = { radius: 1, radialSegments: 8, smooth: true };
      const geometry = getTubeLinesGeometry(geometryIn.vertices, settings);
      const material = new THREE.MeshBasicMaterial({ color: materialIn.color });
      const mesh = new THREE.Mesh( geometry, material );
      this.setMesh(mesh, options.localTimeEnabled, options.localMorphColour);
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
    mesh.material.depthWrite = alpha > 0.5;
  }

  /**
   * Get merged geometry from list of geometry vertices
   * 
   * @param {Array} vertices 
   * @param {Object} settings - radius, radialSegments, smooth
   * @returns {Object}
   */
  const getTubeLinesGeometry = (vertices, settings) => {
    const { radius, radialSegments, smooth } = settings
    let finalGeometry;
    if (smooth) {
      const curve = new THREE.CatmullRomCurve3(vertices);
      finalGeometry = new THREE.TubeGeometry(curve, vertices.length, radius, radialSegments, false);
    } else {
      const geometries = vertices.slice(0, -1).map((start, i) => {
        const end = vertices[i + 1];
        const curve = new THREE.LineCurve3(start, end);
        const tubeGeometry = new THREE.TubeGeometry(curve, 1, radius, radialSegments, false);
        return tubeGeometry;
      });
      finalGeometry = mergeGeometries(geometries, true);
      geometries.forEach(g => g.dispose());
    }
    return finalGeometry;
  }

  this.useWireframe = (wireframe) => {
    let mesh = this.getMorph();
    mesh.material.wireframe = wireframe;
  }

  /**
   * Update tube radius/radialSegments value
   * 
   * @param {Float} radius The radius of the tube.
   * @param {Integer} radialSegments The number of segments that make up the cross-section.
   * @param {Boolean} smooth false if pure line, true if shape made by line.
   */
  this.setTubeLines = (radius, radialSegments, smooth = false) => {
    if (radius && radialSegments) {
      const { geometryIn } = dataIn;
      let mesh = this.getMorph();
      mesh.geometry.dispose();
      const settings = { radius, radialSegments, smooth };
      mesh.geometry = getTubeLinesGeometry(geometryIn.vertices, settings);
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
