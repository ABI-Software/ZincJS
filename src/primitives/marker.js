var THREE = require('three');
const markerImage = new Image(128, 128);
markerImage.src = require("../assets/mapMarker.svg");
const texture = new THREE.Texture();
texture.image = markerImage;
texture.needsUpdate = true;
const size = [0.015, 0.02, 1];

//Marker - used to indicate there is a 
const Marker = function(zincObject) {
  (require('./zincObject').ZincObject).call(this);
  this.texture = texture;
  let spriteMaterial = undefined;
  let sprite = undefined;
  this.morph = new THREE.Group();
  this.parent = zincObject;
  this.isMarker = true;
  let enabled = false;
  let vector = new THREE.Vector3();

	let initialise = () => {
    spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      alphaTest: 0.5,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false
    });              
    sprite = new THREE.Sprite(spriteMaterial);
    sprite.center.set(0.5, 0);
    this.morph.add(sprite);
    this.morph.position.set(0, 0, 0);
    this.morph.renderOrder = 3;
    sprite.scale.set(size[0], size[1], size[2]);
    sprite.userData = this;
  }

  this.updateVisual = (min, max) => {
    let scale = 1;
    let opacity = 1;
    let porportion = 0;
    if (min !== max) {
      porportion = (1 - (vector.z - min) / (max - min));
      scale = 0.5 +  porportion * 0.5;
      opacity = 0.6 +  porportion * 0.4;
    }
    sprite.material.opacity = opacity;
    this.setSpriteSize(scale);
  }

  this.updateNDC = camera => {
    vector.copy(this.morph.position);
    vector.project(camera);
    vector.z = Math.min(Math.max(vector.z, 0), 1);
    return vector.z;
  }

  this.setPosition = (x, y, z) => {
    this.morph.position.set(x, y, z);
  }

  this.setSpriteSize = size => {
    sprite.scale.set(0.015, 0.02, 1);
    sprite.scale.multiplyScalar(size);
  }

  this.isEnabled = () => {
    return enabled;
  }

  this.enable = () => {
    enabled = true;
    this.morph.visible = true;
  }
  
  this.disable = () => {
    enabled = false;
    this.morph.visible = false;
  }

	//this should be handle by scene... check the sync at 
	initialise();

}

Marker.prototype = Object.create((require('./zincObject').ZincObject).prototype);
exports.Marker = Marker;
