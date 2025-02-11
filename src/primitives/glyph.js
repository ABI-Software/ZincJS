const THREE = require('three');

/**
 * Zinc representation of glyph graphic, it contains the colours, 
 * geometry and transformation of the glyph.
 * 
 * @param {THREE.Geometry} geometry - Geometry of the glyph .
 * @param {THREE.Material} materialIn - Material of the glyph.
 * @param {Number} idIn - Id of the glyph.
 * 
 * @class
 * @author Alan Wu
 * @return {Glyph}
 */
const Glyph = function (geometry, materialIn, idIn, glyphsetIn) {
  (require('./zincObject').ZincObject).call(this);
  let material = undefined;
  if (materialIn) {
    material = materialIn.clone();
    material.vertexColors = THREE.FaceColors;
  }
  const parent = glyphsetIn;
  this.id = idIn;
  let label = undefined;
  let labelString = undefined;
  this.isGlyph = true;
  let _position = [0, 0, 0];

  /**
   * Create a glyph using mesh
   * @param   {THREE.Mesh} meshIn - Mesh to create the glyph from
   *
   * @returns {Boolean} true if successful
   */
  this.fromMesh = meshIn => {
    if (meshIn && meshIn.isMesh) {
      this.morph = meshIn.clone();
      this.morph.userData = this;
      this.group.add(this.morph);
      return true;
    }
    return false;
  }

  if (geometry && material) {
    this.fromMesh(new THREE.Mesh(geometry, material));
  }

  /**
   * Get the {Glyphset} containing this glyph.
   *
   * @returns {Boolean} true if successful
   */
  this.getGlyphset = function () {
    return parent;
  }

  /**
   * Set and update the text containing this glyph.
   * @param   {String} text - Label to be set for this instance
   */
  this.setLabel = text => {
    if (text && (typeof text === 'string' || text instanceof String)) {
      labelString = text;
      if (this.morph)
        this.morph.name = text;
    }
  }

  /**
   * Display label with the choosen colour. It will replace the current
   * label.
   * @param   {THREE.Color} colour - Colour for the label.
   */
  this.showLabel = (colour) => {
    if (label) {
      _position = label.getPosition();
      this.group.remove(label.getSprite());
      label.dispose();
      label = undefined;
    }
    if (labelString && (typeof labelString === 'string' || labelString instanceof String)) {
      label = new (require('./label').Label)(labelString, colour);
      label.setPosition(_position[0], _position[1], _position[2]);
      this.group.add(label.getSprite());
    }
  }

  /**
   * Hide label with the choosen colour.
   */
  this.hideLabel = () => {
    if (label) {
      _position = label.getPosition();
      this.group.remove(label.getSprite());
      label.dispose();
      label = undefined;
    }
  }

  /**
   * Get the label of this glyph
   * @return {Label}
   */
  this.getLabel = () => {
    return labelString;
  }

  /**
   * Get the mesh of this glyph.
   * @return {THREE.Mesh}
   */
  this.getMesh = () => {
    return this.morph;
  }

  /**
   * Set the transformation of this glyph.
   * @param {Array} position - Three components vectors containing position of the
   * transformation.
   * @param {Array} axis1 - Three components vectors containing axis1 rotation of the
   * transformation.
   * @param {Array} axis2 - Three components vectors containing axis2 rotation of the
   * transformation.
   * @param {Array} position - Three components vectors containing axis3 rotation of the
   * transformation.
   */
  this.setTransformation = (position, axis1, axis2, axis3) => {
    if (this.morph) {
      this.morph.matrix.elements[0] = axis1[0];
      this.morph.matrix.elements[1] = axis1[1];
      this.morph.matrix.elements[2] = axis1[2];
      this.morph.matrix.elements[3] = 0.0;
      this.morph.matrix.elements[4] = axis2[0];
      this.morph.matrix.elements[5] = axis2[1];
      this.morph.matrix.elements[6] = axis2[2];
      this.morph.matrix.elements[7] = 0.0;
      this.morph.matrix.elements[8] = axis3[0];
      this.morph.matrix.elements[9] = axis3[1];
      this.morph.matrix.elements[10] = axis3[2];
      this.morph.matrix.elements[11] = 0.0;
      this.morph.matrix.elements[12] = position[0];
      this.morph.matrix.elements[13] = position[1];
      this.morph.matrix.elements[14] = position[2];
      this.morph.matrix.elements[15] = 1.0;
      this.morph.matrixAutoUpdate = false;
    }
    _position = [...position];
    if (label) {
      label.setPosition(position[0], position[1], position[2]);
    }
  }

  /**
   * Set the color of the glyph and its label.
   * 
   * @param {THREE.Color} color - Colour to be set.
   */
  this.setColour = (color) => {
    if (label)
      label.setColour(color);
    if (this.secondaryMesh && this.secondaryMesh.material)
      this.secondaryMesh.material.color = colour;
    if (this.geometry) {
      this.geometry.colorsNeedUpdate = true;
    }
  }

  /**
   * Clear and free its memory.
   */
  this.dispose = () => {
    if (this.material)
      this.material.dispose();
    this.morph = undefined;
  }
}

Glyph.prototype = Object.create((require('./zincObject').ZincObject).prototype);
exports.Glyph = Glyph;
