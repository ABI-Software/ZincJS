const THREE = require('three');
const resolveURL = require('./utilities').resolveURL;
const JSONLoader = require('./loader').JSONLoader;
const STLLoader = require('./STLLoader').STLLoader;
const OBJLoader = require('./OBJLoader').OBJLoader;


exports.SceneLoader = function (sceneIn) {
  const scene = sceneIn;
  this.toBeDownloaded = 0;
  this.progressMap = [];
  let viewLoaded = false;
  let errorDownload = false;

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

  this.onError = xhr => {
    this.toBeDownloaded = this.toBeDownloaded - 1;
    errorDownload = true;
  };

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
          if (scene.loadView(viewData)) {
            viewLoaded = true;
          }
          if (finishCallback != undefined && (typeof finishCallback == 'function'))
            finishCallback();
        }
        --this.toBeDownloaded;
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
  this.loadModelsURL = (urls, colours, opacities, timeEnabled, morphColour, finishCallback) => {
    const number = urls.length;
    this.toBeDownloaded += number;
    for (let i = 0; i < number; i++) {
      const filename = urls[i];
      const loader = new JSONLoader();
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
      loader.crossOrigin = "Anonymous";
      loader.load(resolveURL(filename), meshloader(colour, opacity, localTimeEnabled, localMorphColour, undefined, undefined,
        finishCallback), this.onProgress(i), this.onError);
    }
  }

   /**
   * Load a legacy file format containing the viewport and its meta file from an external 
   * location provided by the url. Use the new metadata format with
   * {@link Zinc.Scene#loadMetadataURL} instead.
   * 
   * @param {String} URL - address to the file containing viewport and model information.
   * @deprecated
   */
  this.loadFromViewURL = (jsonFilePrefix, finishCallback) => {
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
        this.loadModelsURL(urls, viewData.colour, viewData.opacity, viewData.timeEnabled, viewData.morphColour, finishCallback);
      }
    }
    requestURL = resolveURL(jsonFilePrefix + "_view.json");
    xmlhttp.open("GET", requestURL, true);
    xmlhttp.send();
  }

  //Internal loader for a regular zinc geometry.
  const linesloader = (localTimeEnabled, localMorphColour, groupName, anatomicalId, finishCallback) => {
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
        scene.addZincObject(newLines);
        newLines.setDuration(scene.getDuration());
      }
      --this.toBeDownloaded;
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
  this.loadLinesURL = (url, timeEnabled, morphColour, groupName, finishCallback, options) => {
	  let localTimeEnabled = 0;
    this.toBeDownloaded += 1;
    let isInline = (options && options.isInline) ? options.isInline : false;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
	  if (timeEnabled != undefined)
		  localTimeEnabled = timeEnabled ? true : false;
	  let localMorphColour = 0;
	  if (morphColour != undefined)
		  localMorphColour = morphColour ? true : false;
    let loader = new JSONLoader();
    if (isInline) {
      var object = loader.parse( url );
      (linesloader(localTimeEnabled, localMorphColour, groupName, anatomicalId, 
        finishCallback))( object.geometry, object.materials );
    } else {
      loader.crossOrigin = "Anonymous";
      loader.load(url, linesloader(localTimeEnabled, localMorphColour, groupName, 
        anatomicalId, finishCallback), this.onProgress(i), this.onError);
    }
  }

  const loadGlyphset = (glyphsetData, glyphurl, groupName, finishCallback, options) => {
    let isInline  = (options && options.isInline) ? options.isInline : undefined;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    let displayLabels = (options && options.displayLabels) ? options.displayLabels : undefined;
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
    else{
      newGlyphset.load(glyphsetData, resolveURL(glyphurl), myCallback, isInline, displayLabels);
    }
    newGlyphset.anatomicalId = anatomicalId;
    scene.addZincObject(newGlyphset);
  };

  //Load a glyphset into this scene.
  const onLoadGlyphsetReady = (xmlhttp, glyphurl, groupName, finishCallback, options) => {
    return () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        const glyphsetData = JSON.parse(xmlhttp.responseText);
        loadGlyphset(glyphsetData, glyphurl, groupName, finishCallback, options);
      }
    };
  };

  //Internal loader for a regular zinc geometry.
  const pointsetloader = (localTimeEnabled, localMorphColour, groupName, anatomicalId, finishCallback) => {
    return (geometry, materials) => {
      const newPointset = new (require('./primitives/pointset').Pointset)();
      let material = new THREE.PointsMaterial({ alphaTest: 0.5, size: 5, sizeAttenuation: false });
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
        newPointset.anatomicalId = anatomicalId;
        scene.addZincObject(newPointset);
        newPointset.setDuration(scene.getDuration());
      }
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
  this.loadSTL = (url, groupName, finishCallback) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    const loader = new STLLoader();
    loader.crossOrigin = "Anonymous";
    loader.load(resolveURL(url), meshloader(colour, opacity, false,
      false, groupName, undefined, finishCallback));
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
  this.loadOBJ = (url, groupName, finishCallback) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    const loader = new OBJLoader();
    loader.crossOrigin = "Anonymous";
    loader.load(resolveURL(url), meshloader(colour, opacity, false,
      false, groupName, undefined, finishCallback));
  }

  //Loader for the OBJ format, 
  const objloader = (
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
          scene.addZincObject(zincGeometry);
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
  const loadSurfaceURL = (url, timeEnabled, morphColour, groupName, finishCallback, options) => {
    this.toBeDownloaded += 1;
    const colour = require('./zinc').defaultMaterialColor;
    const opacity = require('./zinc').defaultOpacity;
    let localTimeEnabled = 0;
    let isInline = (options && options.isInline) ? options.isInline : false;
    let fileFormat = (options && options.fileFormat) ? options.fileFormat : undefined;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    if (timeEnabled != undefined)
      localTimeEnabled = timeEnabled ? true : false;
    let localMorphColour = 0;
    if (morphColour != undefined)
      localMorphColour = morphColour ? true : false;
    let loader = new JSONLoader();
    if (fileFormat !== undefined) {
      if (fileFormat == "STL") {
        loader = new STLLoader();
      } else if (fileFormat == "OBJ") {
        loader = new OBJLoader();
        loader.crossOrigin = "Anonymous";
        loader.load(url, objloader(colour, opacity, localTimeEnabled,
          localMorphColour, groupName, anatomicalId, finishCallback), this.onProgress(i), this.onError);
        return;
      }
    }
    if (isInline) {
      var object = loader.parse( url );
			(meshloader(colour, opacity, localTimeEnabled,
        localMorphColour, groupName, anatomicalId, finishCallback))( object.geometry, object.materials );
    } else {
      loader.crossOrigin = "Anonymous";
      loader.load(url, meshloader(colour, opacity, localTimeEnabled,
        localMorphColour, groupName, anatomicalId, finishCallback), this.onProgress(i), this.onError);
    }
  };

  //Object to keep track of number of items downloaded and when all items are downloaded
  //allCompletedCallback is called
  const metaFinishCallback = function (numberOfDownloaded, finishCallback, allCompletedCallback) {
    let downloadedItem = 0;
    return zincGeometry => {
      downloadedItem = downloadedItem + 1;
      if (zincGeometry && (finishCallback != undefined) && (typeof finishCallback == 'function')) {
        finishCallback(zincGeometry);
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
  this.loadPointsetURL = (url, timeEnabled, morphColour, groupName, finishCallback, options) => {
    let localTimeEnabled = 0;
    this.toBeDownloaded += 1;
    if (timeEnabled != undefined)
      localTimeEnabled = timeEnabled ? true : false;
    let localMorphColour = 0;
    if (morphColour != undefined)
      localMorphColour = morphColour ? true : false;
    let loader = new JSONLoader();
    let isInline = (options && options.isInline) ? options.isInline : false;
    let anatomicalId = (options && options.anatomicalId) ? options.anatomicalId : undefined;
    if (isInline) {
      var object = loader.parse( url );
      (pointsetloader(localTimeEnabled, localMorphColour, groupName,
        anatomicalId, finishCallback))(object.geometry, object.materials );
    } else {
      loader.crossOrigin = "Anonymous";
      loader.load(url, pointsetloader(localTimeEnabled, localMorphColour,
        groupName, anatomicalId, finishCallback),
        this.onProgress(i), this.onError);
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
  this.loadGlyphsetURL = (metaurl, glyphurl, groupName, finishCallback, options) => {
    let isInline = (options && options.isInline) ? options.isInline : false;
    if (isInline) {
      loadGlyphset(metaurl, glyphurl, groupName, finishCallback, options);
    } else {
      const xmlhttp = new XMLHttpRequest();
      xmlhttp.onreadystatechange = onLoadGlyphsetReady(xmlhttp, glyphurl,
        groupName, finishCallback, options);
      xmlhttp.open("GET", resolveURL(metaurl), true);
      xmlhttp.send();
    }
  }

  //Internal loader for a regular zinc geometry.
  const meshloader = (
    colour,
    opacity,
    localTimeEnabled,
    localMorphColour,
    groupName,
    anatomicalId,
    finishCallback
  ) => {
    return (geometry, materials) => {
      let material = undefined;
      if (materials && materials[0]) {
        material = materials[0];
      }
      const zincGeometry = scene.addZincGeometry(geometry, colour, opacity, 
        localTimeEnabled, localMorphColour, undefined, material, groupName);
      zincGeometry.anatomicalId = anatomicalId;
      --this.toBeDownloaded;
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
  const readPrimitivesItem = (referenceURL, item, finishCallback) => {
    if (item) {
      let newURL = undefined;
      let isInline = false;
      if (item.URL) {
        newURL = item.URL;
        if (referenceURL)
          newURL = (new URL(item.URL, referenceURL)).href;
      } else if (item.Inline) {
        newURL = item.Inline.URL;
        isInline = true;
      }
      let options = {
        isInline: isInline,
        fileFormat: item.FileFormat,
        anatomicalId: item.AnatomicalId,
      };
      switch (item.Type) {
        case "Surfaces":
          loadSurfaceURL(newURL, item.MorphVertices, item.MorphColours, item.GroupName, finishCallback, options);
          break;
        case "Glyph":
          let newGeometryURL = undefined;
          if (!isInline) {
            newGeometryURL = item.GlyphGeometriesURL;
            newGeometryURL = (new URL(item.GlyphGeometriesURL, referenceURL)).href;
          } else {
            newGeometryURL = item.Inline.GlyphGeometriesURL;
          }
          if (item.DisplayLabels) {
            options.displayLabels = true;
          }
          this.loadGlyphsetURL(newURL, newGeometryURL, item.GroupName, finishCallback, options);
          break;
        case "Points":
          this.loadPointsetURL(newURL, item.MorphVertices, item.MorphColours, item.GroupName, finishCallback, options);
          break;
        case "Lines":
          this.loadLinesURL(newURL, item.MorphVertices, item.MorphColours, item.GroupName, finishCallback, options);
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
          newURL = (new URL(item.URL, referenceURL)).href;
      } else if (item.Inline) {
        newURL = item.Inline.URL;
        isInline = true;
      }
      switch (item.Type) {
        case "View":
          if (isInline) {
            if (scene.loadView(newURL)) {
              viewLoaded = true;
            }
            if (finishCallback != undefined && (typeof finishCallback == 'function'))
              finishCallback();
          }
          else
            this.loadViewURL(newURL, finishCallback);
          break;
        case "Settings":
          this.loadSettings(item);
          if (finishCallback != undefined && (typeof finishCallback == 'function'))
            finishCallback();
          break;
        default:
          break;
      }
    }
  };

  /**
    * Load a metadata file from the provided URL into this scene. Once
    * succssful scene proceeds to read each items into scene for visualisations.
    * 
    * @param {String} url - Location of the metafile
    * @param {Function} finishCallback - Callback function which will be called
    * for each glyphset and geometry that has been written in.
    */
  this.loadMetadataURL = (url, finishCallback, allCompletedCallback) => {
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
        let numberOfObjects = metadata.length;
        // view file does not receive callback
        var callback = new metaFinishCallback(numberOfObjects, finishCallback, allCompletedCallback);
        // Prioritise the view file and settings before loading anything else
        for (var i = 0; i < metadata.length; i++)
          readViewAndSettingsItem(referenceURL, metadata[i], callback);
        for (var i = 0; i < metadata.length; i++)
          readPrimitivesItem(referenceURL, metadata[i], callback);
      }
    }

    xmlhttp.open("GET", requestURL, true);
    xmlhttp.send();
  }
}
