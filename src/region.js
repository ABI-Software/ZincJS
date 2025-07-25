const { Group, Matrix4 } = require('three');
const Pointset = require('./primitives/pointset').Pointset;
const Lines = require('./primitives/lines').Lines;
const Lines2 = require('./primitives/lines2').Lines2;
const Geometry = require('./primitives/geometry').Geometry;
const THREE = require('three');
let uniqueiId = 0;

const getUniqueId = function () {
  return "re" + uniqueiId++;
}

/**
 * Provides a hierachical structure to objects, Each region
 * may contain multiple child regions and {@link ZincObject}.
 * 
 * @class
 * @author Alan Wu
 * @return {Region}
 */
let Region = function (parentIn, sceneIn) {
  let parent = parentIn;
  let group = new Group();
  group.matrixAutoUpdate = false;
  group.userData = this;
  let children = [];
  let name = "";
  let zincObjects = [];
  let scene = sceneIn;
  const tMatrix = new Matrix4();
  let duration = 3000;
  tMatrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  this.pickableUpdateRequired = true;
  this.isRegion = true;
  this.uuid = getUniqueId();
  

  /**
   * Hide all primitives belong to this region.
   */
  this.hideAllPrimitives = () => {
    children.forEach(child => child.hideAllPrimitives());
    zincObjects.forEach(zincObject => zincObject.setVisibility(false));
  }

  /**
   * Show all primitives belong to this region.
   */
  this.showAllPrimitives = () => {
    children.forEach(child => child.showAllPrimitives());
    zincObjects.forEach(zincObject => zincObject.setVisibility(true));
  }

  /**
   * Set the visibility and propagate it down the hierarchies
   * depending on the flag.
   * 
   * @param {Boolean} flag - A flag indicating either the visibilty to be on/off.
   */
  this.setVisibility = (flag) => {
    if (flag != group.visible) {
      group.visible = flag;
      this.pickableUpdateRequired = true;
    }
  }

  /**
   * Get the visibility of the region and its children.
   * 
   * @return {Boolean}
   */
  this.getVisibility = () => {
    return group.visible;
  }

  /**
   * Get the {THREE.Group} containing all child regions and their
   * primitives.
   * 
   * @return {THREE.Group}
   */
  this.getGroup = () => {
    return group;
  }

  /**
   * Set the transformation with a {THREE.Matrix4} matrix, this will affect
   * all primitives in this and its child regions
   * 
   * @param {THREE.Matrix4} transformation - The transformation matrix
   * used for the transformation.
   */
  this.setTransformation = transformation => {
    tMatrix.set(...transformation);
    group.matrix.copy(tMatrix);
    group.updateMatrixWorld();
  }

  /**
   * Set the name of this region.
   * 
   * @param {String} nameIn - Name to be set for this region. It must be defined
   * and non-empty.
   */
  this.setName = (nameIn) => {
    if (nameIn && nameIn !== "") {
      name = nameIn;
    }
  }

  /**
   * Get the name of this region.
   * 
   * @return {String}
   */
  this.getName = () => {
    return name;
  }

  /**
   * Get the parent region.
   * 
   * @return {Region}
   */
  this.getParent = () => {
    return parent;
  }

  /**
   * Get the array of each hierarachy from the root region to this region.
   * 
   * @return {Array}
   */
  this.getFullSeparatedPath = () => {
    const paths = [];
    if (name !== "") {
      paths.push(name);
      for (let p = parent; p !== undefined;) {
        const parentName = p.getName();
        if (parentName !== "") {
          paths.unshift(parentName);
        }
        p = p.getParent();
      }
    }
    return paths;
  }

  /**
   * Get the full paths from the root region to this region.
   * 
   * @return {String}
   */
  this.getFullPath = () => {
    const paths = this.getFullSeparatedPath();
    if (paths.length > 0) {
      let fullPath = paths.shift();
      paths.forEach(path => {
        fullPath = fullPath.concat("/", path);
      });
      return fullPath;
    }
    return "";
  }

  /**
   * Create a new child region with the provided name.
   * @param {String} nameIn - Name to be set for the new child region.
   * 
   * @return {Region}
   */
  this.createChild = (nameIn) => {
    let childRegion = new Region(this, scene);
    childRegion.setName(nameIn);
    children.push(childRegion);
    group.add(childRegion.getGroup());
    return childRegion;
  }

  /**
   * Get the child region with matching childName.
   * @param {String} childName - Name to be matched.
   * 
   * @return {Region}
   */
  this.getChildWithName = childName => {
    if (childName) {
      const lowerChildName = childName.toLowerCase();
      for (let i = 0; i < children.length; i++) {
        if (children[i].getName().toLowerCase() === lowerChildName)
          return children[i];
      }
    }
    return undefined;
  }

  /**
   * Find a child region using the path array.
   * @param {Array} pathArray - Array containing regions' name at each
   * hierarchy to match.
   * 
   * @return {Region}
   */
  this.findChildFromSeparatedPath = pathArray => {
    if (pathArray && pathArray.length > 0) {
      if (pathArray[0] === "") {
        pathArray.shift();
      }
    }
    if (pathArray && pathArray.length > 0) {
      const childRegion = this.getChildWithName(pathArray[0]);
      if (childRegion) {
        pathArray.shift();
        return childRegion.findChildFromSeparatedPath(pathArray);
      } else {
        return undefined;
      }
    }
    return this;
  }

  /**
   * Find the region using the provided relative path.
   * 
   * @param {String} path - Relative paths from this region
   * to the child region.
   * 
   * @return {Region}
   */
  this.findChildFromPath = (path) => {
    const pathArray = path.split("/");
    return this.findChildFromSeparatedPath(pathArray);
  }

  /**
   * Create a new child using the path array. All required new regions
   * down the path will be created.
   * 
   * @param {Array} pathArray - Array containing regions' name, new regions
   * will be created along the path if not found.
   * 
   * @return {Region}
   */
  this.createChildFromSeparatedPath = pathArray => {
    if (pathArray.length > 0) {
      if (pathArray[0] === "") {
        pathArray.shift();
      }
    }
    if (pathArray.length > 0) {
      let childRegion = this.getChildWithName(pathArray[0]);
      if (!childRegion) {
        childRegion = this.createChild(pathArray[0]);
      }
      pathArray.shift();
      return childRegion.createChildFromSeparatedPath(pathArray);
    }
    return this;
  }

  /**
   * Create a new child using the path. All required new regions
   * down the path will be created.
   * 
   * @param {String} path - Relative paths from the region
   * to the child region.
   * 
   * @return {Region}
   */
  this.createChildFromPath = (path) => {
    const pathArray = path.split("/");
    return this.createChildFromSeparatedPath(pathArray);
  }


  /**
   * Return existing region if it exists, otherwise, create a new
   * region with the provided path.
   * 
   * @param {String} path - Relative paths from the region
   * to the child region.
   * 
   * @return {Region}
   */
  this.findOrCreateChildFromPath = (path) => {
    let childRegion = this.findChildFromPath(path);
    if (!childRegion) {
      childRegion = this.createChildFromPath(path);
    }
    return childRegion;
  }

  /**
   * Add a zinc object into this region, the morph will be added
   * to the group.
   * 
   * @param {ZincObject} zincObject - Zinc object to be added into
   * this region.
   */
  this.addZincObject = zincObject => {
    if (zincObject) {
      zincObject.setRegion(this);
      group.add(zincObject.getGroup());
      zincObjects.push(zincObject);
      this.pickableUpdateRequired = true;
      if (scene) {
        scene.triggerObjectAddedCallback(zincObject);
      }
    }
  }


  /**
   * Remove a ZincObject from this region if it presents. This will eventually
   * destroy the object and free up the memory.
   * 
   * @param {ZincObject} zincObject - object to be removed from this region.
   */
  this.removeZincObject = zincObject => {
    for (let i = 0; i < zincObjects.length; i++) {
      if (zincObject === zincObjects[i]) {
        group.remove(zincObject.getGroup());
        zincObjects.splice(i, 1);
        if (scene) {
          scene.triggerObjectRemovedCallback(zincObject);
        }
        zincObject.dispose();
        this.pickableUpdateRequired = true;
        return;
      }
    }
  }

  /**
   * Return true if pickable objects require an update.
   * 
   * @param {Boolean} transverse - Check child regions as well
   * if this is set to true.
   * 
   * @return {Boolean}
   */
  this.checkPickableUpdateRequred = (transverse) => {
    if (this.pickableUpdateRequired) return true;
    if (transverse) {
      let flag = false;
      for (let i = 0; i < children.length; i++) {
         flag = children[i].checkPickableUpdateRequred(transverse);
         if (flag) return true;
      }
    }
    return false;
  }

  /**
   * Get all pickable objects.
   */
  this.getPickableThreeJSObjects = (objectsList,  transverse) => {
    if (group.visible) {
      zincObjects.forEach(zincObject => {
        if (zincObject.isPickable && zincObject.getGroup() && zincObject.getGroup().visible) {
          let marker = zincObject.marker;
          if (marker && marker.isEnabled()) {
            objectsList.push(marker.getMorph());
          }
          objectsList.push(zincObject.getGroup());
        }
      });
      if (transverse) {
        children.forEach(childRegion => {
          childRegion.getPickableThreeJSObjects(objectsList, transverse);
        });
      }
      this.pickableUpdateRequired = false;
    }
    return objectsList;
  }

  /**
   * Set the default duration value for all zinc objects
   * that are to be loaded into this region.
   * 
   * @param {Number} durationIn - duration of the scene.
   */
  this.setDuration = durationIn => {
    duration = durationIn;
    zincObjects.forEach(zincObject => zincObject.setDuration(durationIn));
    children.forEach(childRegion => childRegion.setDuration(durationIn));
  }

  /**
   * Get the default duration value.
   * returns {Number}
   */
  this.getDuration = () => {
    return duration;
  }

  /**
   * Get the bounding box of all the object in this and child regions only.
   * Do not include the matrix transformation here, it is done at the primitives
   * level.
   * 
   * @returns {THREE.Box3} 
   */
  this.getBoundingBox = transverse => {
    let boundingBox1 = undefined, boundingBox2 = undefined;
    zincObjects.forEach(zincObject => {
      boundingBox2 = zincObject.getBoundingBox();
      if (boundingBox2) {
        if (boundingBox1 == undefined) {
          boundingBox1 = boundingBox2.clone();
        } else {
          boundingBox1.union(boundingBox2);
        }
      }
    });
    if (transverse) {
      children.forEach(childRegion => {
        boundingBox2 = childRegion.getBoundingBox(transverse);
        if (boundingBox2) {
          if (boundingBox1 == undefined) {
            boundingBox1 = boundingBox2.clone();
          } else {
            boundingBox1.union(boundingBox2);
          }
        }
      });
    }
    return boundingBox1;
  }

  /**
   * Clear and dispose all objects belong to this region.
   * 
   * @param {Boolean} transverse - Clear and dispose child regions as well
   * if this is set to true.
   */
  this.clear = transverse => {
    if (transverse) {
      children.forEach(childRegion => childRegion.clear(transverse));
    }
    zincObjects.forEach(zincObject => {
      group.remove(zincObject.getGroup());
      zincObject.dispose();
    });
    children = [];
    zincObjects = [];
  }

  /**
   * Check if a zincObject is a member of this region.
   * 
   * @param {ZincObject} zincObject - The ZincObject to be checked.
   * @param {Boolean} transverse - Also check the child regions.
   * 
   * @return {Boolean}
   */
  this.objectIsInRegion = (zincObject, transverse) => {
    for (let i = 0; i < zincObjects.length; i++) {
      if (zincObject === zincObjects[i]) {
        return true;
      }
    }
    if (transverse) {
      for (let i = 0; i < children.length; i++) {
        if (children[i].objectIsInRegion(zincObject, transverse))
          return true;
      }
    }

    return false;
  }

  /**
   * A function which iterates through the list of geometries and call the callback
   * function with the geometries as the argument.
   * 
   * @param {Function} callbackFunction - Callback function with the geometry
   * as an argument.
   * @param {Boolean} transverse - Also perform the same callback function for
   * all child regions if this is set to be true.
   */
  this.forEachGeometry = (callbackFunction, transverse) => {
    zincObjects.forEach(zincObject => {
      if (zincObject.isGeometry)
        callbackFunction(zincObject);
    });
    if (transverse)
      children.forEach(childRegion => childRegion.forEachGeometry(
        callbackFunction, transverse));
  }

  /**
   * A function which iterates through the list of glyphsets and call the callback
   * function with the glyphset as the argument.
   * 
   * @param {Function} callbackFunction - Callback function with the glyphset
   * as an argument.
   * @param {Boolean} transverse - Also perform the same callback function for
   * all child regions if this is set to be true.
   */
  this.forEachGlyphset = (callbackFunction, transverse) => {
    zincObjects.forEach(zincObject => {
      if (zincObject.isGlyphset)
        callbackFunction(zincObject);
    });
    if (transverse)
      children.forEach(childRegion => childRegion.forEachGlyphset(
        callbackFunction, transverse));
  }

  /**
   * A function which iterates through the list of pointsets and call the callback
   * function with the pointset as the argument.
   * 
   * @param {Function} callbackFunction - Callback function with the pointset
   * as an argument.
   * @param {Boolean} transverse - Also perform the same callback function for
   * all child regions if this is set to be true.
   */
  this.forEachPointset = (callbackFunction, transverse) => {
    zincObjects.forEach(zincObject => {
      if (zincObject.isPointset)
        callbackFunction(zincObject);
    });
    if (transverse)
      children.forEach(childRegion => childRegion.forEachPointset(
        callbackFunction, transverse));
  }

  /**
  * A function which iterates through the list of lines and call the callback
  * function with the lines as the argument.
  * 
  * @param {Function} callbackFunction - Callback function with the lines
  * as an argument.
   * @param {Boolean} transverse - Also perform the same callback function for
   * all child regions if this is set to be true.
  */
  this.forEachLine = (callbackFunction, transverse) => {
    zincObjects.forEach(zincObject => {
      if (zincObject.isLines)
        callbackFunction(zincObject);
    });
    if (transverse)
      children.forEach(childRegion => childRegion.forEachLine(
        callbackFunction, transverse));
  }

  this.findObjectsWithAnatomicalId = (anatomicalId, transverse) => {
    const objectsArray = [];
    zincObjects.forEach(zincObject => {
      if (zincObject.anatomicalId === anatomicalId)
        objectsArray.push(zincObject);
    });
    if (transverse) {
      children.forEach(childRegion => {
        let childObjects = childRegion.findObjectsWithAnatomicalId(anatomicalId, transverse);
        objectsArray.push(...childObjects);
      });
    }

    return objectsArray;
  }

  /** 
   * Find and return all zinc objects in this and child regions with 
   * the matching GroupName.
   * 
   * @param {String} groupName - Groupname to match with.
   * @param {Boolean} transverse - Also look for the object with groupName
   * in child regions if set to true.
   * @returns {Array}
   */
  this.findObjectsWithGroupName = (groupName, transverse) => {
    const objectsArray = [];
    zincObjects.forEach(zincObject => {
      const lowerObjectName = zincObject.groupName ? zincObject.groupName.toLowerCase() : zincObject.groupName;
      const lowerGroupName = groupName ? groupName.toLowerCase() : groupName;
      if (lowerObjectName === lowerGroupName)
        objectsArray.push(zincObject);
    });
    if (transverse) {
      children.forEach(childRegion => {
        let childObjects = childRegion.findObjectsWithGroupName(groupName, transverse);
        objectsArray.push(...childObjects);
      });
    }
    return objectsArray;
  }

  /** 
   * Find and return all geometries in this and child regions with 
   * the matching GroupName.
   * 
   * @param {String} groupName - Groupname to match with.
   * @param {Boolean} transverse - Also look for the object with groupName
   * in child regions if set to true.
   * @returns {Array}
   */
  this.findGeometriesWithGroupName = (groupName, transverse) => {
    const primitivesArray = this.findObjectsWithGroupName(groupName, transverse);
    const geometriesArray = primitivesArray.filter(primitive => primitive.isGeometry);
    return geometriesArray;
  }

  /** 
   * Find and return all pointsets in this and child regions with
   * the matching groupName.
   * 
   * @param {String} groupName - Groupname to match with.
   * @param {Boolean} transverse - Also look for the object with groupName
   * in child regions if set to true.
   * @returns {Array}
   */
  this.findPointsetsWithGroupName = (groupName, transverse) => {
    const primitivesArray = this.findObjectsWithGroupName(groupName, transverse);
    const pointsetsArray = primitivesArray.filter(primitive => primitive.isPointset);
    return pointsetsArray;
  }

  /** 
   * Find and return all glyphsets in this and child regions with
   * the matching groupName.
   * 
   * @param {String} groupName - Groupname to match with.
   * @param {Boolean} transverse - Also look for the object with groupName
   * in child regions if set to true.
   * @returns {Array}
   */
  this.findGlyphsetsWithGroupName = (groupName, transverse) => {
    const primitivesArray = this.findObjectsWithGroupName(groupName, transverse);
    const glyphsetsArray = primitivesArray.filter(primitive => primitive.isGlyphset);
    return glyphsetsArray;
  }

  /** 
   * Find and return all lines in this and child regions with
   * the matching groupName.
   * 
   * @param {String} groupName - Groupname to match with.
   * @param {Boolean} transverse - Also look for the object with groupName
   * in child regions if set to true.
   * @returns {Array}
   */
  this.findLinesWithGroupName = (groupName, transverse) => {
    const primitivesArray = this.findObjectsWithGroupName(groupName, transverse);
    const linesArray = primitivesArray.filter(primitive => primitive.isLines);
    return linesArray;
  }

  /** 
   * Get all zinc objects in this region.
   * 
   * @param {Boolean} transverse - Include zinc objects in child regions if this is
   * set to true.
   * @returns {Array}
   */
  this.getAllObjects = transverse => {
    const objectsArray = [...zincObjects];
    if (transverse) {
      children.forEach(childRegion => {
        let childObjects = childRegion.getAllObjects(transverse);
        objectsArray.push(...childObjects);
      });
    }
    return objectsArray;
  }

  /** 
   * Get all child regions.
   * 
   * @param {Boolean} transverse - Include all regions which are descendants of 
   * this reigon when this is set to true.
   * @returns {Array}
   */
   this.getChildRegions = transverse => {
    const objectsArray = [...children];
    if (transverse) {
      children.forEach(childRegion => {
        const childObjects = childRegion.getChildRegions(transverse);
        objectsArray.push(...childObjects);
      });
    }
    return objectsArray;
  }

  /**
   * Get the current time of the region.
   * Return -1 if no graphics in the region.
   * 
   * @return {Number}
   */
  this.getCurrentTime = () => {
    if (zincObjects[0] != undefined) {
      return zincObjects[0].getCurrentTime();
    } else {
      for (let i = 0; i < children.length; i++) {
        const time = children[i].getCurrentTime();
        if (time !== -1)
          return time;
      }
    }
    return -1;
  }

  /**
   * Set the current time of all the objects of this region.
   * 
   * @param {Number} time  - Value to set the time to.
   * @param {Boolean} transverse - Set the time for chidl regions if
   * this is set to true.
   */
  this.setMorphTime = (time, transverse) => {
    zincObjects.forEach(zincObject => {
      zincObject.setMorphTime(time);
    });
    if (transverse) {
      children.forEach(childRegion => {
        childRegion.setMorphTime(time);
      });
    }
  }

  /**
   * Check if any object in this region is time varying.
   * 
   * @return {Boolean}
   */
  this.isTimeVarying = () => {
    for (let i = 0; i < zincObjects.length; i++) {
      if (zincObjects[i].isTimeVarying()) {
        return true;
      }
    }
    for (let i = 0; i < children.length; i++) {
      if (children[i].isTimeVarying()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update geometries and glyphsets based on the calculated time.
   * @private
   */
  this.renderGeometries = (playRate, delta, playAnimation, cameraControls, options, transverse) => {
    // Let video dictates the progress if one is present
    const allObjects = this.getAllObjects(transverse);
    allObjects.forEach(zincObject => {
      zincObject.render(playRate * delta, playAnimation, cameraControls, options);
    });
    //process markers visibility and size, as long as there are more than
    //one entry in markersList is greater than 1, markers have been enabled.
    if (options && (playAnimation === false) &&
      options.markerCluster?.markerUpdateRequired) {
      /** 
        const markerDepths = Object.values(options.markersList)
          .map((marker) => marker.ndc.z);
        if (markerDepths.length > 1) {
          const min = Math.min(...markerDepths);
          const max = Math.max(...markerDepths);
          allObjects.forEach(zincObject => {
            zincObject.processMarkerVisual(min, max);
          });
        }
      */
      options.markerCluster.calculate();
    }
  }

  /**
   * Update geometries and glyphsets based on the calculated time.
   */
  this.createPoints = ( groupName, coords, labels, colour ) => {
    let isNew = false;
    const zincObjects = this.findObjectsWithGroupName(groupName, false);
    const index = zincObjects.findIndex((zincObject) => zincObject.isPointset);
    const pointset = index > -1 ? zincObjects[index] : new Pointset();
    pointset.addPoints(coords, labels, colour);
    if (index === -1) {
      pointset.setName(groupName);
      this.addZincObject(pointset);
      isNew = true;
    } else {
      this.pickableUpdateRequired = true;
    }
    return { zincObject: pointset, isNew };
  }

  /**
   * Update geometries and glyphsets based on the calculated time.
   */
  this.createLines = ( groupName, coords, colour ) => {
    let isNew = false;
    const zincObjects = this.findObjectsWithGroupName(groupName, false);
    const index = zincObjects.findIndex((zincObject) => zincObject.isLines);
    const lines = index > -1 ? zincObjects[index] : new Lines2();
    lines.addLines(coords, colour);
    if (index === -1) {
      lines.setName(groupName);
      this.addZincObject(lines);
      isNew = true;
    } else {
      this.pickableUpdateRequired = true;
    }
    return { zincObject: lines, isNew };
  }

  /**
   * Add a new geometry
   */
  this.createGeometryFromThreeJSGeometry = (
    groupName, geometry, colour, opacity, visibility, renderOrder) => {
    const zincGeometry = new Geometry();
    const material = new THREE.MeshPhongMaterial({
      color : colour,
      morphTargets : false,
      morphNormals : false,
      transparent : true,
      opacity : opacity,
      side : THREE.DoubleSide
    });
    zincGeometry.createMesh(
      geometry,
      material,
      {localTimeEnabled: false, localMorphColour: false,},
    );
    if (zincGeometry.getMorph()) {
      zincGeometry.setVisibility(false);
      zincGeometry.setName(groupName);
      zincGeometry.setRenderOrder(renderOrder);
      this.addZincObject(zincGeometry);
      return zincGeometry;
    }
    return undefined;
  }
}

exports.Region = Region;
