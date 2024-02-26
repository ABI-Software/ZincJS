const THREE = require('three');

let uniqueiId = 0;

const getUniqueId = function () {
  return "pr" + uniqueiId++;
}

/**
 * Provides the base object for other primitive types.
 * This class contains multiple base methods.
 * 
 * @class
 * @author Alan Wu
 * @return {ZincObject}
 */
const ZincObject = function() {
  this.isZincObject = true;
  this.geometry = undefined;
  // THREE.Mesh
  this.morph = undefined;
  this.group = new THREE.Group();
  this._lod = new (require("./lod").LOD)(this);
  /**
	 * Groupname given to this geometry.
	 */
  this.groupName = undefined;
  this.timeEnabled = false;
  this.morphColour = false;
  this.inbuildTime = 0;
  this.mixer = undefined;
  this.animationGroup = undefined;
	/**
	 * Total duration of the animation, this value interacts with the 
	 * {@link Renderer#playRate} to produce the actual duration of the
	 * animation. Actual time in second = duration / playRate.
	 */
  this.duration = 6000;
  this.clipAction = undefined;
  this.userData = {};
  this.videoHandler = undefined;
  this.marker = undefined;
  this.markerUpdateRequired = true;
  this.closestVertexIndex = -1;
  this.boundingBoxUpdateRequired = true;
  this.cachedBoundingBox = new THREE.Box3();
  this.anatomicalId = undefined;
  this.region = undefined;
  this.animationClip = undefined;
  this.markerMode = "inherited";
  this.uuid = getUniqueId();
  this._v1 = new THREE.Vector3();
  this._v2 = new THREE.Vector3();
  this._b1 = new THREE.Box3();
  this.center = new THREE.Vector3();
  this.radius = 0;
  this.visible = true;
}

/**
 * Set the duration of the animation of this object.
 * 
 * @param {Number} durationIn - Duration of the animation.
 */
ZincObject.prototype.setDuration = function(durationIn) {
  this.duration = durationIn;
  if (this.clipAction) {
    this.clipAction.setDuration(this.duration);
  }
}

/**
 * Get the duration of the animation of this object.
 * 
 * @return {Number}
 */
ZincObject.prototype.getDuration = function() {
  return this.duration;
}

/**
 * Set the region this object belongs to.
 *
 * @param {Region} region
 */
ZincObject.prototype.setRegion = function(region) {
  this.region = region;
}

/**
 * Get the region this object belongs to.
 * 
 * @return {Region}
 */
ZincObject.prototype.getRegion = function() {
  return this.region;
}

/**
 * Get the threejs object3D. 
 * 
 * @return {Object}
 */
 ZincObject.prototype.getMorph = function() {
  const morph =  this._lod.getCurrentMorph();
  return morph ? morph : this.morph;
}

/**
 * Get the threejs object3D. 
 * 
 * @return {Object}
 */
 ZincObject.prototype.getGroup = function() {
  return this.group;
}

/**
 * Set the internal threejs object3D. 
 */
 ZincObject.prototype.setMorph = function(mesh) {
  this.morph = mesh;
  this.group.add(this.morph);
  //this is the base level object
  const distance = this._lod.calculateDistance("far");
  this._lod.addLevel(mesh, distance);
  this._lod.setMaterial(mesh.material);
}

/**
 * Handle transparent mesh, create a clone for backside rendering if it is
 * transparent.
 */
ZincObject.prototype.checkTransparentMesh = function(transparentChanged) {
  return;
}

/**
 * Set the mesh function for zincObject.
 * 
 * @param {THREE.Mesh} mesh - Mesh to be set for this zinc object.
 * @param {Boolean} localTimeEnabled - A flag to indicate either the mesh is
 * time dependent.
 * @param {Boolean} localMorphColour - A flag to indicate either the colour is
 * time dependent.
 */
ZincObject.prototype.setMesh = function(mesh, localTimeEnabled, localMorphColour) {
  //Note: we assume all layers are consistent with time frame
  //Thus adding them to the same animation group should work.
  //This step is only required for the primary (level 0) mesh.
  this.animationGroup = new THREE.AnimationObjectGroup(mesh);
  this.mixer = new THREE.AnimationMixer(this.animationGroup);
  const geometry = mesh.geometry;
  this.geometry = mesh.geometry;
  this.clipAction = undefined;
  if (geometry && geometry.morphAttributes) {
    let morphAttribute = geometry.morphAttributes.position;
    if (!morphAttribute) {
      morphAttribute = geometry.morphAttributes.color ?
        geometry.morphAttributes.color :
        geometry.morphAttributes.normal;
    }
    if (morphAttribute) {
      this.animationClip = THREE.AnimationClip.CreateClipsFromMorphTargetSequences(
        morphAttribute, 10, true);
      if (this.animationClip && (this.animationClip[0] != undefined)) {
        this.clipAction = this.mixer.clipAction(this.animationClip[0]).setDuration(
          this.duration);
        this.clipAction.loop = THREE.loopOnce;
        this.clipAction.clampWhenFinished = true;
        this.clipAction.play();
      }
    }
  }
  this.timeEnabled = localTimeEnabled;
  this.morphColour = localMorphColour;
  mesh.userData = this;
  mesh.matrixAutoUpdate = false;
  this.setMorph(mesh);
  this.checkTransparentMesh(true);
  if (this.timeEnabled) {
    this.setFrustumCulled(false);
  } else {
    if (this.morphColour) {
      geometry.setAttribute('morphTarget0', geometry.getAttribute( 'position' ) );
      geometry.setAttribute('morphTarget1', geometry.getAttribute( 'position' ) );
    }
  }
  this.boundingBoxUpdateRequired = true;
}

/**
 * Set the name for this ZincObject.
 * 
 * @param {String} groupNameIn - Name to be set.
 */
ZincObject.prototype.setName = function(groupNameIn) {
  this.groupName = groupNameIn;
  this._lod.setName(groupNameIn);
}

/**
 * Get the local time of this geometry, it returns a value between 
 * 0 and the duration.
 * 
 * @return {Number}
 */
ZincObject.prototype.getCurrentTime = function() {
  if (this.clipAction) {
    const ratio = this.clipAction.time / this.clipAction._clip.duration;
    return this.duration * ratio;
  } else {
    return this.inbuildTime;
  }
}

/**
 * Set the local time of this geometry.
 * 
 * @param {Number} time - Can be any value between 0 to duration.
 */
ZincObject.prototype.setMorphTime = function(time) {
  let timeChanged = false;
  if (this.clipAction) {
    const ratio = time / this.duration;
    const actualDuration = this.clipAction._clip.duration;
    let newTime = ratio * actualDuration;
    if (newTime != this.clipAction.time) {
      this.clipAction.time = newTime;
      timeChanged = true;
    }
    if (timeChanged && this.isTimeVarying()) {
      this.mixer.update( 0.0 );
    }
  } else {
    let newTime = time; 
    if (time > this.duration)
      newTime = this.duration;
    else if (0 > time)
      newTime = 0;
    else
      newTime = time;
    if (newTime != this.inbuildTime) {
      this.inbuildTime = newTime;
      timeChanged = true;
    }
  }
  if (timeChanged) {
    this.boundingBoxUpdateRequired = true;
    const morph = this._lod.getCurrentMorph();
    this._lod.updateMorphColorAttribute(true);
    if (this.timeEnabled)
      this.markerUpdateRequired = true;
  }
}

/**
 * Check if the geometry is time varying.
 * 
 * @return {Boolean}
 */
ZincObject.prototype.isTimeVarying = function() {
  if (this.timeEnabled || this.morphColour)
    return true;
  return false;
}

/**
 * Get the visibility of this Geometry.
 * 
 */
ZincObject.prototype.getVisibility = function() {
  return this.visible;
}

/**
 * Set the visibility of this Geometry.
 * 
 * @param {Boolean} visible - a boolean flag indicate the visibility to be set 
 */
ZincObject.prototype.setVisibility = function(visible) {
  this.visible = visible;
  this.group.visible = visible;
  /*
  const morph = this.getMorph();
  if (morph.visible !== visible) {
    morph.visible = visible;
    if (this.region) this.region.pickableUpdateRequired = true;
  }
  */
}

/**
 * Set the opacity of this Geometry. This function will also set the isTransparent
 * flag according to the provided alpha value.
 * 
 * @param {Number} alpah - Alpha value to set for this geometry, 
 * can be any value between from 0 to 1.0.
 */
ZincObject.prototype.setAlpha = function(alpha) {
  const material = this._lod._material;
  let isTransparent = false;
  if (alpha  < 1.0)
    isTransparent = true;
  let transparentChanged = material.transparent == isTransparent ? false : true;
  material.opacity = alpha;
  material.transparent = isTransparent;
  this.checkTransparentMesh(transparentChanged);
}

/**
 * The rendering will be culled if it is outside of the frustrum
 * when this flag is set to true, it should be set to false if
 * morphing is enabled.
 * 
 * @param {Boolean} flag - Set frustrum culling on/off based on this flag.
 */
ZincObject.prototype.setFrustumCulled = function(flag) {
  //multilayers - set for all layers
  this._lod.setFrustumCulled(flag);
}

/**
 * Set rather a zinc object should be displayed using per vertex colour or
 * not.
 * 
 * @param {Boolean} vertexColors - Set display with vertex color on/off.
 */
ZincObject.prototype.setVertexColors = function(vertexColors) {
  //multilayers - set for all
  this._lod.setVertexColors(vertexColors);

}

/**
 * Get the colour of the mesh.
 * 
 * @return {THREE.Color}
 */
ZincObject.prototype.getColour = function() {
  if (this._lod._material)
    return this._lod._material.color;
	return undefined;
}
  
/**
 * Set the colour of the mesh.
 * 
 * @param {THREE.Color} colour - Colour to be set for this geometry.
 */
ZincObject.prototype.setColour = function(colour) {
  this._lod.setColour(colour);
}

/**
 * Get the colour of the mesh in hex string form.
 * 
 * @return {String}
 */
ZincObject.prototype.getColourHex = function() {
  if (!this.morphColour) {
    if (this._lod._material && this._lod._material.color)
      return this._lod._material.color.getHexString();
  }
  return undefined;
}

/**
 * Set the colour of the mesh using hex in string form.
 * 
 * @param {String} hex - The colour value in hex form.
 */
ZincObject.prototype.setColourHex = function(hex) {
  this._lod._material.color.setHex(hex);
  if (this._lod._secondaryMaterial) {
    this._lod._secondaryMaterial.color.setHex(hex);
  }
}

/**
 * Set the material of the geometry.
 * 
 * @param {THREE.Material} material - Material to be set for this geometry.
 */
ZincObject.prototype.setMaterial = function(material) {
  this._lod.setMaterial(material);
}

/**
 * Get the index of the closest vertex to centroid.
 * 
 * @return {Number} - integer index in the array
 */
ZincObject.prototype.getClosestVertexIndex = function() {
  let closestIndex = -1;
  const morph = this.getMorph();
  if (morph) {
    let position = morph.geometry.attributes.position;
    this._b1.setFromBufferAttribute(position);
    this._b1.getCenter(this._v1);
    if (position) {
      let distance = -1;
      let currentDistance = 0;
      for (let i = 0; i < position.count; i++) {
        this._v2.fromArray(position.array, i * 3);
        currentDistance = this._v2.distanceTo(this._v1);
        if (distance == -1)
          distance = currentDistance;
        else if (distance > (currentDistance)) {
          distance = currentDistance;
          closestIndex = i;
        }
      }
    }
  }
  return closestIndex;
}

/**
 * Get the  closest vertex to centroid.
 * 
 * @return {THREE.Vector3}
 */
ZincObject.prototype.getClosestVertex = function(applyMatrixWorld) {
  let position = new THREE.Vector3();
  if (this.closestVertexIndex == -1) {
    this.closestVertexIndex = this.getClosestVertexIndex();
  }
  if (this.closestVertexIndex >= 0) {
    let influences = this.morph.morphTargetInfluences;
    let attributes = this.morph.geometry.morphAttributes;
    if (influences && attributes && attributes.position) {
      let found = false;
      for (let i = 0; i < influences.length; i++) {
        if (influences[i] > 0) {
          found = true;
          this._v1.fromArray(
            attributes.position[i].array, this.closestVertexIndex * 3);
          position.add(this._v1.multiplyScalar(influences[i]));
        }
      }
      if (found) {
        return applyMatrixWorld ? position.applyMatrix4(this.morph.matrixWorld) : position;
      }
    } else {
      position.fromArray(this.morph.geometry.attributes.position.array,
        this.closestVertexIndex * 3);
      return applyMatrixWorld ? position.applyMatrix4(this.morph.matrixWorld) : position;
    }
  }
  this.getBoundingBox();
  position.copy(this.center);
  return applyMatrixWorld ? position.applyMatrix4(this.morph.matrixWorld) : position;
}

/**
 * Get the bounding box of this geometry.
 * 
 * @return {THREE.Box3}.
 */
ZincObject.prototype.getBoundingBox = function() {
  let morph = this._lod.getCurrentMorph();
  if (morph && morph.visible) {
    console.log(this.groupName)
    if (this.boundingBoxUpdateRequired) {
      require("../utilities").getBoundingBox(morph, this.cachedBoundingBox,
        this._b1, this._v1, this._v2);
      this.cachedBoundingBox.getCenter(this.center);
      this.radius = this.center.distanceTo(this.cachedBoundingBox.max);
      this.boundingBoxUpdateRequired = false;
    }
    return this.cachedBoundingBox;
  }
  return undefined;
}

/**
 * Clear this geometry and free the memory.
 */
ZincObject.prototype.dispose = function() {
  //multilayyers
  this._lod.dispose();
  this.animationGroup = undefined;
  this.mixer = undefined;
  this.morph = undefined;
  this.group = undefined;
  this.clipAction = undefined;
  this.groupName = undefined;
}

/**
 * Check if marker is enabled based on the objects settings with 
 * the provided scene options.
 * 
 * @return {Boolean} 
 */
ZincObject.prototype.markerIsEnabled = function(options) {
  if (this.markerMode === "on" || (options && options.displayMarkers &&
    (this.markerMode === "inherited"))) {
      
      return true;
  }
  return false;
}

/**
 * Update the marker's position and size based on current viewport. 
 */
ZincObject.prototype.updateMarker = function(playAnimation, options) {
  if ((playAnimation == false) &&
    (this.markerIsEnabled(options)))
  {
    if (this.groupName) {
      if (!this.marker) {
        this.marker = new (require("./marker").Marker)(this);
        this.markerUpdateRequired = true;
      }
      if (this.markerUpdateRequired) {
        let position = this.getClosestVertex(false);
        if (position) {
          this.marker.setPosition(position.x, position.y, position.z);
          this.markerUpdateRequired = false;
        }
      }
      if (options && options.camera && options.markerDepths) {
        options.markerDepths.push(
          this.marker.updateNDC(options.camera.cameraObject));
      }
      if (!this.marker.isEnabled()) {
        this.marker.enable();
        this.group.add(this.marker.morph);
        //this._lod.toggleMarker(this.marker.morph, true);
      }
    }
  } else {
    if (this.marker && this.marker.isEnabled()) {
      this.marker.disable();
      this.group.remove(this.marker.morph);
      //this._lod.toggleMarker(this.marker.morph, false);
    }
    this.markerUpdateRequired = true;
  }
}

ZincObject.prototype.processMarkerVisual = function(min, max) {
  if (this.marker && this.marker.isEnabled()) {
    this.marker.updateVisual(min, max);
  }
}

ZincObject.prototype.initiateMorphColor = function() {
  //Multilayers - set all
  if (this.morphColour == 1) {
    this._lod.updateMorphColorAttribute(false);
  }
}

ZincObject.prototype.setRenderOrder = function(renderOrder) {
  //multiilayers
  this._lod.setRenderOrder(renderOrder);
}

/**
 * Get the windows coordinates.
 * 
 * @return {Object} - position and rather the closest vertex is on screen.
 */
ZincObject.prototype.getClosestVertexDOMElementCoords = function(scene) {
  if (scene && scene.camera) {
    let inView = true;
    const position = this.getClosestVertex(true);
    position.project(scene.camera);
    position.z = Math.min(Math.max(position.z, 0), 1);
    if (position.x > 1 || position.x < -1 || position.y > 1 || position.y < -1) {
      inView = false;
    }
    scene.getZincCameraControls().getRelativeCoordsFromNDC(position.x, position.y, position);
    return {position, inView};
  } else {
    return undefined;
  }
}

/**
 * Set marker mode for this zinc object which determine rather the
 * markers should be displayed or not.
 *
 * @param {string} mode - There are three options:
 * "on" - marker is enabled regardless of settings of scene
 * "off" - marker is disabled regardless of settings of scene
 * "inherited" - Marker settings on scene will determine the visibility
 *  of the marker.
 * 
 * @return {Boolean} 
 */
 ZincObject.prototype.setMarkerMode = function(mode) {
  if (mode !== this.markerMode) {
    if (mode === "on" || mode === "off") {
      this.markerMode = mode;
    } else {
      this.markerMode = "inherited";
    }
    if (this.region) {
      this.region.pickableUpdateRequired = true;
    }
  }
}

//Update the geometry and colours depending on the morph.
ZincObject.prototype.render = function(delta, playAnimation,
  cameraControls, options) {
  if (this.visible && !(this.timeEnabled && playAnimation)) {
    this._lod.update(cameraControls, this.center);
  }
  if (playAnimation == true)
  {
    if ((this.clipAction) && this.isTimeVarying()) {
      this.mixer.update( delta );
    }
    else {
      let targetTime = this.inbuildTime + delta;
      if (targetTime > this.duration)
        targetTime = targetTime - this.duration;
      this.inbuildTime = targetTime;
    }
    //multilayers
    if (this.visible && delta != 0) {
      this.boundingBoxUpdateRequired = true;
      if (this.morphColour == 1) {
        this._lod.updateMorphColorAttribute(true);
      }
    }
  }
  this.updateMarker(playAnimation, options);
}


/**
 * Add lod from an url into the lod object.
 */
ZincObject.prototype.addLOD = function(loader, level, url, preload) {
  this._lod.addLevelFromURL(loader, level, url, preload);
}



exports.ZincObject = ZincObject;
