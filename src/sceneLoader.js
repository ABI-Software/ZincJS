const THREE = require('three');
const resolveURL = require('./utilities').resolveURL;
const STLLoader = require('./loaders/STLLoader').STLLoader;
const OBJLoader = require('./loaders/OBJLoader').OBJLoader;
const PrimitivesLoader = require('./loaders/primitivesLoader').PrimitivesLoader;

const createNewURL = (target, reference) => {
  let newURL = (new URL(target, reference)).href;
  //Make sure the target url does not contain parameters
  if (target && target.split("?").length < 2) {
    const paramsStrings = reference.split("?");
    //There are parameters, add them to the target
    if (paramsStrings.length === 2) {
      newURL = newURL + "?" + paramsStrings[1];
    }
  }
  return newURL;
}


exports.SceneLoader = function (sceneIn) {
  const scene = sceneIn;
  this.toBeDownloaded = 0;
  this.progressMap = [];
  let viewLoaded = false;
  let errorDownload = false;
  const primitivesLoader = new PrimitivesLoader();
  /**
   * This function returns a three component array, which contains
   * [totalsize, totalLoaded and errorDownload] of all the downloads happening
   * in this scene.
   * @returns {Array} 
   */
  this.getDownloadProgress = () => {
    let totalSize = 0;
    let totalLoaded = 0;
    let unknownFound = false;

    for (const key in this.progressMap) {
      const progress = this.progressMap[key];

      totalSize += progress[1];
      totalLoaded += progress[0];

      if (progress[1] == 0)
        unknownFound = true;
    }
    if (unknownFound) {
      totalSize = 0;
    }
    return [ totalSize, totalLoaded, errorDownload ];
  }

  //Stores the current progress of downloads
  this.onProgress = id => {
    return xhr => {
      this.progressMap[id] = [ xhr.loaded, xhr.total ];
    };
  }

  this.onError = finishCallback => {
    return xhr => {
      this.toBeDownloaded = this.toBeDownloaded - 1;
      errorDownload = true;
      if (finishCallback) {
        finishCallback();
      }
    }
  };

  let loadMultipleViews = (referenceURL, views) => {
    const defaultView = views.Default;
    if (views.Inline) {
       scene.setupMultipleViews(defaultView, views.Entries);
    } else {
      const promises = [];
      for (const [key, value] of Object.entries(views.Entries)) {
        if (referenceURL) {
          newURL = createNewURL(value, referenceURL);
          promises.push(new Promise((resolve, reject) => {
            // Add parameters if we are sent them
            fetch(newURL)
              .then(response => response.json())
              .then(data => resolve({key: key, data: data}))
              .catch(data => reject(data));
          }));
        }
      }
      Promise.all(promises)
      .then(values => {
        const entries = {};
        values.forEach(entry => {
          entries[entry.key] = entry.data;
        });
        scene.setupMultipleViews(defaultView, entries);
        let zincCameraControls = scene.getZincCameraControls();
        if (zincCameraControls)
          zincCameraControls.setCurrentViewport(defaultView);
        viewLoaded = true;
      });
    }
  }

  /**
   * Load the viewport from an external location provided by the url.
   * @param {String} URL - address to the file containing viewport information.
   */
  this.loadViewURL = (url, finishCallback) => {
    this.toBeDownloaded += 1;
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState == 4) {
        if(xmlhttp.status == 200) {
          const viewData = JSON.parse(xmlhttp.responseText);
          scene.setupMultipleViews("default", { "default" : viewData });
          scene.resetView();
          viewLoaded = true;
          --this.toBeDownloaded;
          if (finishCallback != undefined && (typeof finishCallback == 'function'))
            finishCallback();
        } else {
          this.onError();
        }
      }
    }
    requestURL = resolveURL(url);
    xmlhttp.open("GET", requestURL, true);
    xmlhttp.send();
  }

/**
   * Load a legacy model(s) format with the provided URLs and parameters. This only loads the geometry
   * without any of the metadata. Therefore, extra parameters should be provided.
   * 
   * @deprecated
   */
  this.loadModelsURL = (region, urls, colours, opacities, timeEnabled, morphColour, finishCallback) => {
    const number = urls.length;
    this.toBeDownloaded += number;
    for (let i = 0; i < number; i++) {
      const filename = urls[i];
      let colour = require('./zinc').defaultMaterialColor;
      let opacity = require('./zinc').defaultOpacity;
      if (colours != undefined && colours[i] != undefined)
        colour = colours[i] ? true : false;
      if (opacities != undefined && opacities[i] != undefined)
        opacity = opacities[i];
      let localTimeEnabled = 0;
      if (timeEnabled != undefined && timeEnabled[i] != undefined)
        localTimeEnabled = timeEnabled[i] ? true : false;
      let localMorphColour = 0;
      if (morphColour != undefined && morphColour[i] != undefined)
        localMorphColour = morphColour[i] ? true : false;
      primitivesLoader.load(resolveURL(filename), meshloader(region, colour, opacity, localTimeEnabled, localMorphColour, undefined, undefined,
        undefined, finishCallback), this.onProgress(i), this.onError(finishCallback));
    }
  }

   /**
   * Load a legacy file format containing the viewport and its meta file from an external 
   * location provided by the url. Use the new metadata format with
   * {@link Zinc.SceneLoader.#loadMetadataURL} instead.
   * 
   * @param {String} URL - address to the file containing viewport and model information.
   * @deprecated
   */
  this.loadFromViewURL = (targetRegion, jsonFilePrefix, finishCallback) => {
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        const viewData = JSON.parse(xmlhttp.responseText);
        scene.loadView(viewData);
        const urls = [];
        const filename_prefix = jsonFilePrefix + "_";
        for (let i = 0; i < viewData.numberOfResources; i++) {
          const filename = filename_prefix + (i + 1) + ".json";
          urls.push(filename);
        }
        this.loadModelsURL(targetRegion, urls, viewData.colour, viewData.opacity, viewData.timeEnabled, viewData.morphColour, finishCallback);
      }
    }
    requestURL = resolveURL(jsonFilePrefix + "_view.json");
    xmlhttp.open("GET", requestURL, true);
    xmlhttp.send();
  }

  //Internal loader for a regular zinc geometry.
  const linesloader = (region, localTimeEnabled, localMorphColour, groupName, anatomicalId, renderOrder, finishCallback) => {
    return (geometry, materials) => {
      const newLines = new (require('./primitives/lines').Lines)();
      let material = undefined;
      if (materials && materials[0]) {
        material = new THREE.LineBasicMaterial({color:materials[0].color.clone()});
        if (1.0 > materials[0].opacity) {
          material.transparent = true;
        }
        material.opacity = materials[0].opacity;
        material.morphTargets = localTimeEnabled;
        material.vertexColors = materials[0].vertexColors;
      }
      let options = {};
      options.localTimeEnabled = localTimeEnabled;
      options.localMorphColour = localMorphColour;

      if (newLines) {
        newLines.createLineSegment(geometry, material, options);
        newLines.setName(groupName);
        newLines.anatomicalId = anatomicalId;
        newLines.setRenderOrder = renderOrder;
        region.addZincObject(newLines);
        newLines.setDuration(scene.getDuration());
      }
      --this.toBeDownloaded;
      geometry.dispose();
      if (finishCallback != undefined && (typeof finishCallback == 'function'))
        finishCallback(newLines);
    };
  } 

  /**
   * Load lines into this scene object.
   * 
   * @param {String} metaurl - Provide informations such as transformations, colours 
   * and others for each of the glyph in the glyphsset.
   * @param {Boolean} timeEnabled - Indicate if  morphing is enabled.
   * @param {Boolean} morphColour - Indicate if color morphing is enabled.
   * @param {STRING} groupName - name to assign the pointset's groupname to.
   * @param {Function} finishCallback - Callback function which will be called
   * once the glyphset is succssfully load in.
   */
  this.loadLinesURL = (region, url, timeEnabled, morphColour, groupName, finishCallback, options) => {
	  let localTimeEnabled = 0;
    this.toBeDownloaded += 1;
    let isInline = (options && options.isInline) ? options.isInline : false;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    let renderOrder = (options && options.renderOrder) ? options.renderOrder : undefined;
	  if (timeEnabled != undefined)
		  localTimeEnabled = timeEnabled ? true : false;
	  let localMorphColour = 0;
	  if (morphColour != undefined)
		  localMorphColour = morphColour ? true : false;
    if (isInline) {
      var object = primitivesLoader.parse( url );
      (linesloader(region, localTimeEnabled, localMorphColour, groupName, anatomicalId,
        renderOrder, finishCallback))( object.geometry, object.materials );
    } else {
      primitivesLoader.load(url, linesloader(region, localTimeEnabled, localMorphColour, groupName, 
        anatomicalId, renderOrder, finishCallback), this.onProgress(i), this.onError(finishCallback));
    }
  }

  const loadGlyphset = (region, glyphsetData, glyphurl, groupName, finishCallback, options) => {
    let isInline  = (options && options.isInline) ? options.isInline : undefined;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    let displayLabels = (options && options.displayLabels) ? options.displayLabels : undefined;
    let renderOrder = (options && options.renderOrder) ? options.renderOrder : undefined;
    const newGlyphset = new (require('./primitives/glyphset').Glyphset)();
    newGlyphset.setDuration(scene.getDuration());
    newGlyphset.groupName = groupName;
    let myCallback = () => {
      --this.toBeDownloaded;
      if (finishCallback != undefined && (typeof finishCallback == 'function'))
        finishCallback(newGlyphset);
    }
    ++this.toBeDownloaded;
    if (isInline) {
      newGlyphset.load(glyphsetData, glyphurl, myCallback, isInline, displayLabels);
    }
    else {
      newGlyphset.load(glyphsetData, resolveURL(glyphurl), myCallback, isInline, displayLabels);
    }
    newGlyphset.anatomicalId = anatomicalId;
    newGlyphset.setRenderOrder(renderOrder);
    region.addZincObject(newGlyphset);
  };

  //Load a glyphset into this scene.
  const onLoadGlyphsetReady = (region, xmlhttp, glyphurl, groupName, finishCallback, options) => {
    return () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        const glyphsetData = JSON.parse(xmlhttp.responseText);
        loadGlyphset(region, glyphsetData, glyphurl, groupName, finishCallback, options);
      }
    };
  };

  //Internal loader for a regular zinc geometry.
  const pointsetloader = (region, localTimeEnabled, localMorphColour, groupName, anatomicalId, renderOrder, finishCallback) => {
    return (geometry, materials) => {
      const newPointset = new (require('./primitives/pointset').Pointset)();
      let material = new THREE.PointsMaterial({ alphaTest: 0.5, size: 10, sizeAttenuation: false });
      if (materials && materials[0]) {
        if (1.0 > materials[0].opacity) {
          material.transparent = true;
        }
        material.opacity = materials[0].opacity;
        material.color = materials[0].color;
        material.morphTargets = localTimeEnabled;
        material.vertexColors = materials[0].vertexColors;
      }
      let options = {};
      options.localTimeEnabled = localTimeEnabled;
      options.localMorphColour = localMorphColour;
      if (newPointset) {
        newPointset.createMesh(geometry, material, options);
        newPointset.setName(groupName);
        region.addZincObject(newPointset);
        newPointset.setDuration(scene.getDuration());
        newPointset.setRenderOrder(renderOrder);
      }
      geometry.dispose();
      --this.toBeDownloaded;
      if (finishCallback != undefined && (typeof finishCallback == 'function'))
        finishCallback(newPointset);
    };
  }


   /**
   * Read a STL file into this scene, the geometry will be presented as
   * {@link Zinc.Geometry}. 
   * 
   * @param {STRING} url - location to the STL file.
   * @param {STRING} groupName - name to assign the geometry's groupname to.
   * @param {Function} finishCallback - Callback function which will be called
   * once the STL geometry is succssfully loaded.
   */
  this.loadSTL = (region, url, groupName, finishCallback) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    const loader = new STLLoader();
    loader.crossOrigin = "Anonymous";
    loader.load(resolveURL(url), meshloader(region, colour, opacity, false,
      false, groupName, undefined, undefined, finishCallback));
  }

  /**
   * Read a OBJ file into this scene, the geometry will be presented as
   * {@link Zinc.Geometry}. 
   * 
   * @param {STRING} url - location to the STL file.
   * @param {STRING} groupName - name to assign the geometry's groupname to.
   * @param {Function} finishCallback - Callback function which will be called
   * once the OBJ geometry is succssfully loaded.
   */
  this.loadOBJ = (region, url, groupName, finishCallback) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    const loader = new OBJLoader();
    loader.crossOrigin = "Anonymous";
    loader.load(resolveURL(url), meshloader(region, colour, opacity, false,
      false, groupName, undefined, undefined,finishCallback));
  }

  //Loader for the OBJ format, 
  const objloader = (
    region,
    colour,
    opacity,
    localTimeEnabled,
    localMorphColour,
    groupName,
    finishCallback
  ) => {
    return object => {
      this.toBeDownloaded--;
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const zincGeometry = addMeshToZincGeometry(child, localTimeEnabled, localMorphColour);
          region.addZincObject(zincGeometry);
          if (zincGeometry.morph)
            zincGeometry.morph.name = groupName;
          zincGeometry.groupName = groupName;
          if (finishCallback != undefined && (typeof finishCallback == 'function'))
            finishCallback(zincGeometry);
        }
      });
    };
  }

  /**
   * Load a geometry into this scene, this is a subsequent called from 
   * {@link Zinc.Scene#loadMetadataURL}, although it can be used to read
   * in geometry into the scene externally.
   * 
   * @param {String} url - regular json model file providing geometry.
   * @param {Boolean} timeEnabled - Indicate if geometry morphing is enabled.
   * @param {Boolean} morphColour - Indicate if color morphing is enabled.
   * @param {STRING} groupName - name to assign the geometry's groupname to.
   * @param {STRING} fileFormat - name supported formats are STL, OBJ and JSON.
   * @param {Function} finishCallback - Callback function which will be called
   * once the geometry is succssfully loaded in.
   */
  const loadSurfaceURL = (region ,url, timeEnabled, morphColour, groupName, finishCallback, options) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    let localTimeEnabled = 0;
    let isInline = (options && options.isInline) ? options.isInline : false;
    let fileFormat = (options && options.fileFormat) ? options.fileFormat : undefined;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    let renderOrder = (options && options.renderOrder) ? options.renderOrder : undefined;
    if (timeEnabled != undefined)
      localTimeEnabled = timeEnabled ? true : false;
    let localMorphColour = 0;
    if (morphColour != undefined)
      localMorphColour = morphColour ? true : false;
    let loader = primitivesLoader;
    if (fileFormat !== undefined) {
      if (fileFormat == "STL") {
        loader = new STLLoader();
      } else if (fileFormat == "OBJ") {
        loader = new OBJLoader();
        loader.crossOrigin = "Anonymous";
        loader.load(url, objloader(region, colour, opacity, localTimeEnabled,
          localMorphColour, groupName, anatomicalId, finishCallback), this.onProgress(i), this.onError);
        return;
      }
    }
    if (isInline) {
      const object = primitivesLoader.parse( url );
			(meshloader(region, colour, opacity, localTimeEnabled,
        localMorphColour, groupName, anatomicalId, renderOrder, finishCallback))( object.geometry, object.materials );
    } else {
      loader.crossOrigin = "Anonymous";
      primitivesLoader.load(url, meshloader(region, colour, opacity, localTimeEnabled,
        localMorphColour, groupName, anatomicalId, renderOrder, finishCallback), this.onProgress(i), this.onError(finishCallback));
    }
  };

  //Object to keep track of number of items downloaded and when all items are downloaded
  //allCompletedCallback is called
  const metaFinishCallback = function (numberOfDownloaded, finishCallback, allCompletedCallback) {
    let downloadedItem = 0;
    return zincObject => {
      downloadedItem = downloadedItem + 1;
      if (zincObject && (finishCallback != undefined) && (typeof finishCallback == 'function')) {
        finishCallback(zincObject);
        let zincCameraControls = scene.getZincCameraControls();
        if (zincCameraControls)
          zincCameraControls.calculateMaxAllowedDistance(scene);
      }
      if (downloadedItem == numberOfDownloaded) {
        if (viewLoaded === false)
          scene.viewAll();
        if (allCompletedCallback != undefined && (typeof allCompletedCallback == 'function'))
          allCompletedCallback();
      }
    };
  };

  /**
   * Load a pointset into this scene object.
   * 
   * @param {String} metaurl - Provide informations such as transformations, colours 
   * and others for each of the glyph in the glyphsset.
   * @param {Boolean} timeEnabled - Indicate if  morphing is enabled.
   * @param {Boolean} morphColour - Indicate if color morphing is enabled.
   * @param {STRING} groupName - name to assign the pointset's groupname to.
   * @param {Function} finishCallback - Callback function which will be called
   * once the glyphset is succssfully load in.
   */
  this.loadPointsetURL = (region, url, timeEnabled, morphColour, groupName, finishCallback, options) => {
    let localTimeEnabled = 0;
    this.toBeDownloaded += 1;
    if (timeEnabled != undefined)
      localTimeEnabled = timeEnabled ? true : false;
    let localMorphColour = 0;
    if (morphColour != undefined)
      localMorphColour = morphColour ? true : false;
    let isInline = (options && options.isInline) ? options.isInline : false;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    let renderOrder = (options && options.renderOrder) ? options.renderOrder : undefined;
    if (isInline) {
      const object = primitivesLoader.parse( url );
      (pointsetloader(region, localTimeEnabled, localMorphColour, groupName,
        anatomicalId, renderOrder, finishCallback))(object.geometry, object.materials );
    } else {
      primitivesLoader.load(url, pointsetloader(region, localTimeEnabled, localMorphColour,
        groupName, anatomicalId, renderOrder, finishCallback),
        this.onProgress(i), this.onError(finishCallback));
    }
  }

  /**
   * Load a glyphset into this scene object.
   * 
   * @param {String} metaurl - Provide informations such as transformations, colours 
   * and others for each of the glyph in the glyphsset.
   * @param {String} glyphurl - regular json model file providing geometry of the glyph.
   * @param {String} groupName - name to assign the glyphset's groupname to.
   * @param {Function} finishCallback - Callback function which will be called
   * once the glyphset is succssfully load in.
   */
  this.loadGlyphsetURL = (region, metaurl, glyphurl, groupName, finishCallback, options) => {
    const isInline = (options && options.isInline) ? options.isInline : false;
    if (isInline) {
      loadGlyphset(region, metaurl, glyphurl, groupName, finishCallback, options);
    } else {
      const xmlhttp = new XMLHttpRequest();
      xmlhttp.onreadystatechange = onLoadGlyphsetReady(region, xmlhttp, glyphurl,
        groupName, finishCallback, options);
      xmlhttp.open("GET", resolveURL(metaurl), true);
      xmlhttp.send();
    }
  }

 /**
   * Add a user provided {THREE.Geometry} into  the scene as zinc geometry.
   * 
   * @param {Three.Geometry} geometry - The threejs geometry to be added as {@link Zinc.Geometry}.
   * @param {THREE.Color} color - Colour to be assigned to this geometry, overrided if materialIn is provided.
   * @param {Number} opacity - Opacity to be set for this geometry, overrided if materialIn is provided.
   * @param {Boolean} localTimeEnabled - Set this to true if morph geometry is present, overrided if materialIn is provided.
   * @param {Boolean} localMorphColour - Set this to true if morph colour is present, overrided if materialIn is provided.
   * @param {Boolean} external - Set this to true if morph geometry is present, overrided if materialIn is provided.
   * @param {Function} finishCallback - Callback once the geometry has been added succssfully.
   * @param {THREE.Material} materialIn - Material to be set for this geometry if it is present.
   * 
   * @returns {Zinc.Geometry}
   */
  addZincGeometry = (
    region,
    geometryIn,
    colour,
    opacity,
    localTimeEnabled,
    localMorphColour,
    finishCallback,
    materialIn,
    groupName
  ) => {
    let options = {};
    options.colour = colour;
    options.opacity = opacity;
    options.localTimeEnabled = localTimeEnabled;
    options.localMorphColour = localMorphColour
    const newGeometry = new (require('./primitives/geometry').Geometry)();
    newGeometry.createMesh(geometryIn, materialIn, options);
    if (newGeometry.morph) {
      newGeometry.setName(groupName);
      if (region) region.addZincObject(newGeometry);
      newGeometry.setDuration(scene.getDuration());
      if (finishCallback != undefined && (typeof finishCallback == 'function'))
        finishCallback(newGeometry);
      if (newGeometry.videoHandler)
        scene.setVideoHandler(newGeometry.videoHandler);
      return newGeometry;
    }
    return undefined;
  }

  //Internal loader for a regular zinc geometry.
  const meshloader = (
    region,
    colour,
    opacity,
    localTimeEnabled,
    localMorphColour,
    groupName,
    anatomicalId,
    renderOrder,
    finishCallback
  ) => {
    return (geometry, materials) => {
      let material = undefined;
      if (materials && materials[0]) {
        material = materials[0];
      }
      const zincGeometry = addZincGeometry(region, geometry, colour, opacity, 
        localTimeEnabled, localMorphColour, undefined, material, groupName, renderOrder);
      zincGeometry.anatomicalId = anatomicalId;
      zincGeometry.setRenderOrder(renderOrder);
      --this.toBeDownloaded;
      geometry.dispose();
      if (finishCallback != undefined && (typeof finishCallback == 'function'))
        finishCallback(zincGeometry);
    };
  }

  //Turn ISO 8601 duration string into an array.
  const parseDuration = (durationString) => {
    const regex = /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
    const [, years, months, weeks, days, hours, mins, secs] = 
      durationString.match(regex);
    return {years: years,months: months, weeks: weeks, days: days,
            hours: hours, mins: mins, secs: secs };
  }

  //Load settings from metadata item.
  this.loadSettings = (item) => {
    if (item) {
      //duration uses the ISO 8601 standard - PnYnMnDTnHnMnS
      if (item.Duration) {
        const duration = parseDuration(item.Duration);
        scene.setDurationFromObject(duration);
      }
      if (item.OriginalDuration) {
        const duration = parseDuration(item.OriginalDuration);
        scene.setOriginalDurationFromObject(duration);
      }
      if (item.TimeStamps) {
        for (const key in item.TimeStamps) {
          const time = parseDuration(item.TimeStamps[key]);
          scene.addMetadataTimeStamp(key, time);
        }
      }
    }
  }

  //Function to process each of the graphical metadata item except for view and
  //settings.
  const readPrimitivesItem = (region, referenceURL, item, order, finishCallback) => {
    if (item) {
      let newURL = undefined;
      let isInline = false;
      if (item.URL) {
        newURL = item.URL;
        if (referenceURL)
          newURL = createNewURL(item.URL, referenceURL);
      } else if (item.Inline) {
        newURL = item.Inline.URL;
        isInline = true;
      }
      let groupName = item.GroupName;
      if (groupName === undefined || groupName === "") {
        groupName = "_Unnamed";
      }

      let options = {
        isInline: isInline,
        fileFormat: item.FileFormat,
        anatomicalId: item.AnatomicalId,
        compression: item.compression,
        renderOrder: order
      };
      
      switch (item.Type) {
        case "Surfaces":
          loadSurfaceURL(region, newURL, item.MorphVertices, item.MorphColours, groupName, finishCallback, options);
          break;
        case "Glyph":
          let newGeometryURL = undefined;
          if (!isInline) {
            newGeometryURL = item.GlyphGeometriesURL;
            newGeometryURL = createNewURL(item.GlyphGeometriesURL, referenceURL);
          } else {
            newGeometryURL = item.Inline.GlyphGeometriesURL;
          }
          if (item.DisplayLabels) {
            options.displayLabels = true;
          }
          this.loadGlyphsetURL(region, newURL, newGeometryURL, groupName, finishCallback, options);
          break;
        case "Points":
          this.loadPointsetURL(region, newURL, item.MorphVertices, item.MorphColours, groupName, finishCallback, options);
          break;
        case "Lines":
          this.loadLinesURL(region, newURL, item.MorphVertices, item.MorphColours, groupName, finishCallback, options);
          break;
        default:
          break;
      }
    }
  };

  //Function to read the view item first
  const readViewAndSettingsItem = (referenceURL, item, finishCallback) => {
    if (item) {
      let newURL = undefined;
      let isInline = false;
      if (item.URL) {
        newURL = item.URL;
        if (referenceURL)
          newURL = createNewURL(item.URL, referenceURL);
      } else if (item.Inline) {
        newURL = item.Inline.URL;
        isInline = true;
      }
      switch (item.Type) {
        case "View":
          if (isInline) {
            scene.setupMultipleViews("default", { "default" : newURL});
            viewLoaded = true;
            if (finishCallback != undefined && (typeof finishCallback == 'function'))
              finishCallback();
          }
          else
            this.loadViewURL(newURL, finishCallback);
          break;
        case "Settings":
          this.loadSettings(item);
          break;
        default:
          break;
      }
    }
  };

  /**
   * Load GLTF into this scene object.
   * 
   * @param {String} url - URL to the GLTF file
   * @param {Function} finishCallback - Callback function which will be called
   * once the glyphset is succssfully load in.
   */
  this.loadGLTF = (region, url, finishCallback, options) => {
    const GLTFToZincJSLoader = new (require('./loaders/GLTFToZincJSLoader').GLTFToZincJSLoader)();
    GLTFToZincJSLoader.load(scene, region, url, finishCallback, options);
  }

  let loadRegions = (currentRegion, referenceURL, regions, callback) => {
    if (regions.Primitives) {
      regions.Primitives.forEach(primitive => {
        let order = 1;
        if (primitive.Order)
          order = primitive.Order;
        readPrimitivesItem(currentRegion, referenceURL, primitive, order, callback);
      });
    }
    if (regions.Transformation) {
      currentRegion.setTransformation(regions.Transformation);
    }
    if (regions.Children) {
      for (const [regionName, value] of Object.entries(regions.Children)) {
        const childRegion = currentRegion.findOrCreateChildFromPath(regionName);
        if (childRegion) {
          loadRegions(childRegion, referenceURL, value, callback);
        }
      }
    }
  }

  let getNumberOfDownloadsInArray = (array, includeViews) => {
    if (Array.isArray(array)) {
      let count = 0;
      for (let i = 0; i < array.length; i++) {
        if (array[i].Type && (
          (includeViews && array[i].Type === "View") ||
          array[i].Type === "Surfaces" ||
          array[i].Type === "Glyph" ||
          array[i].Type === "Points" ||
          array[i].Type === "Lines"))
        {
          count++;
        }
      }
      return count;
    }
    return 0;
  }

  let getNumberOfObjectsInRegions = (regionJson) => {
    let counts = regionJson.Primitives ? 
      getNumberOfDownloadsInArray(regionJson.Primitives, false) : 0;
    if (regionJson.Children) {
      Object.values(regionJson.Children).forEach(childRegion => {
        counts += getNumberOfObjectsInRegions(childRegion);
      });
    }
    return counts;
  }

  let getNumberOfObjects = (metadata) => {
    if (Array.isArray(metadata)) {
      return getNumberOfDownloadsInArray(metadata, true);
    } else if ((typeof metadata) === "object" && metadata !== null) {
      if (metadata.Version === "2.0") {
        return getNumberOfObjectsInRegions(metadata.Regions);
      }
    }
  }

  let readVersionOneRegionPath = (region, referenceURL, item, order, callback) => {
    let targetRegion = region;
    if (item.RegionPath && item.RegionPath !== "") {
      targetRegion = region.findOrCreateChildFromPath(item.RegionPath);
    }
    //Render order is set to i * 2 to account for front and back rendering
    readPrimitivesItem(targetRegion, referenceURL, item, order * 2, callback);
  }

  let loadVersionOne = (targetRegion, metadata, referenceURL, finishCallback, allCompletedCallback) => {
    let numberOfObjects = getNumberOfObjects(metadata);
    // view file does not receive callback
    let callback = new metaFinishCallback(numberOfObjects, finishCallback, allCompletedCallback);
    // Prioritise the view file and settings before loading anything else
    for (let i = 0; i < metadata.length; i++)
      readViewAndSettingsItem(referenceURL, metadata[i], callback);
    for (let i = 0; i < metadata.length; i++) {
      readVersionOneRegionPath(targetRegion, referenceURL, metadata[i], i, callback);
    }
  }

  let loadVersionTwo = (targetRegion, metadata, referenceURL, finishCallback, allCompletedCallback) => {
    let numberOfObjects = getNumberOfObjects(metadata);
    // view file does not receive callback
    let callback = new metaFinishCallback(numberOfObjects, finishCallback, allCompletedCallback);
    if (metadata.Settings)
      this.loadSettings(metadata.Settings);
    if (metadata.Views)
      loadMultipleViews(referenceURL, metadata.Views, referenceURL);
    if (metadata.Regions)
      loadRegions(targetRegion, referenceURL, metadata.Regions, callback);
  }

  /**
    * Load a metadata file from the provided URL into this scene. Once
    * succssful scene proceeds to read each items into scene for visualisations.
    * 
    * @param {String} url - Location of the metafile
    * @param {Function} finishCallback - Callback function which will be called
    * for each glyphset and geometry that has been written in.
    */
  this.loadMetadataURL = (targetRegion, url, finishCallback, allCompletedCallback) => {
    const xmlhttp = new XMLHttpRequest();
    var requestURL = resolveURL(url);
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        scene.resetMetadata();
        scene.resetDuration();
        viewLoaded = false;
        let referenceURL = xmlhttp.responseURL;
        if (referenceURL === undefined)
          referenceURL = (new URL(requestURL)).href;
        const metadata = JSON.parse(xmlhttp.responseText);
        if (Array.isArray(metadata)) {
          loadVersionOne(targetRegion, metadata, referenceURL, finishCallback, allCompletedCallback);
        } else if (typeof metadata === "object" && metadata !== null) {
          if (metadata.Version == "2.0") {
            loadVersionTwo(targetRegion, metadata, referenceURL, finishCallback, allCompletedCallback);
          }
        }
      }
    }

    xmlhttp.open("GET", requestURL, true);
    xmlhttp.send();
  }
}
