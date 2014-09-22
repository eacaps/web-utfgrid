
/* ======================================================================
    OpenLayers/Tile/UTFGrid.js
   ====================================================================== */

/* Copyright (c) 2006-2013 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */


/**
 * @requires OpenLayers/Tile.js
 * @requires OpenLayers/Format/JSON.js
 * @requires OpenLayers/Request.js
 */

/**
 * Class: OpenLayers.Tile.UTFGridWMS
 * Instances of OpenLayers.Tile.UTFGridWMS are used to manage 
 * UTFGrids. This is an unusual tile type in that it doesn't have a
 * rendered image; only a 'hit grid' that can be used to 
 * look up feature attributes.
 *
 * See the <OpenLayers.Tile.UTFGridWMS> constructor for details on constructing a
 * new instance.
 *
 * Inherits from:
 *  - <OpenLayers.Tile>
 */
OpenLayers.Tile.UTFGridWMS = OpenLayers.Class(OpenLayers.Tile, {

    /** 
     * Property: url
     * {String}
     * The URL of the UTFGrid file being requested. Provided by the <getURL>
     *     method. 
     */
    url: null,
    
    /**
     * Property: utfgridResolution
     * {Number}
     * Ratio of the pixel width to the width of a UTFGrid data point.  If an 
     *     entry in the grid represents a 4x4 block of pixels, the 
     *     utfgridResolution would be 4.  Default is 2.
     */
    utfgridResolution: 2,
    
    /** 
     * Property: json
     * {Object}
     * Stores the parsed JSON tile data structure. 
     */
    json: null,
    
    /** 
     * Property: format
     * {OpenLayers.Format.JSON}
     * Parser instance used to parse JSON for cross browser support.  The native
     *     JSON.parse method will be used where available (all except IE<8).
     */
    format: null,

    /** 
     * Constructor: OpenLayers.Tile.UTFGridWMS
     * Constructor for a new <OpenLayers.Tile.UTFGridWMS> instance.
     * 
     * Parameters:
     * layer - {<OpenLayers.Layer>} layer that the tile will go in.
     * position - {<OpenLayers.Pixel>}
     * bounds - {<OpenLayers.Bounds>}
     * url - {<String>} Deprecated. Remove me in 3.0.
     * size - {<OpenLayers.Size>}
     * options - {Object}
     */

    /** 
     * APIMethod: destroy
     * Clean up.
     */
    destroy: function() {
        this.clear();
        OpenLayers.Tile.prototype.destroy.apply(this, arguments);
    },
    
    /**
     * Method: draw
     * Check that a tile should be drawn, and draw it.
     * In the case of UTFGrids, "drawing" it means fetching and
     * parsing the json. 
     * 
     * Returns:
     * {Boolean} Was a tile drawn?
     */
    draw: function() {
        var drawn = OpenLayers.Tile.prototype.draw.apply(this, arguments);
        if (drawn) {
            if (this.isLoading) {
                this.abortLoading();
                //if we're already loading, send 'reload' instead of 'loadstart'.
                this.events.triggerEvent("reload"); 
            } else {
                this.isLoading = true;
                this.events.triggerEvent("loadstart");
            }
            this.url = this.layer.getURL(this.bounds);

            if (this.layer.useJSONP) {
                // Use JSONP method to avoid xbrowser policy
                var ols = new OpenLayers.Protocol.Script({
                    url: this.url,
                    callback: function(response) {
                        this.isLoading = false;
                        this.events.triggerEvent("loadend");
                        this.json = response.data;
                    },
                    scope: this
                });
                ols.read();
                this.request = ols;
            } else {
                // Use standard XHR
                this.request = OpenLayers.Request.GET({
                    url: this.url,
                    callback: function(response) {
                        this.isLoading = false;
                        this.events.triggerEvent("loadend");
                        if (response.status === 200) {
                            this.parseData(response.responseText);
                        }
                    },
                    scope: this
                });
            }
        } else {
            this.unload();
        }
        return drawn;
    },
    
    /**
     * Method: abortLoading
     * Cancel a pending request.
     */
    abortLoading: function() {
        if (this.request) {
            this.request.abort();
            delete this.request;
        }
        this.isLoading = false;
    },
    
    /**
     * Method: getFeatureInfo
     * Get feature information associated with a pixel offset.  If the pixel
     *     offset corresponds to a feature, the returned object will have id
     *     and data properties.  Otherwise, null will be returned.
     *     
     *
     * Parameters:
     * i - {Number} X-axis pixel offset (from top left of tile)
     * j - {Number} Y-axis pixel offset (from top left of tile)
     *
     * Returns:
     * {Object} Object with feature id and data properties corresponding to the 
     *     given pixel offset.
     */
    getFeatureInfo: function(i, j) {
        var info = null;
        if (this.json) {
            var id = this.getFeatureId(i, j);
            if (id !== null) {
                info = {id: id, data: this.json.data[id]};
            }
        }
        return info;
    },
    
    /**
     * Method: getFeatureId
     * Get the identifier for the feature associated with a pixel offset.
     *
     * Parameters:
     * i - {Number} X-axis pixel offset (from top left of tile)
     * j - {Number} Y-axis pixel offset (from top left of tile)
     *
     * Returns:
     * {Object} The feature identifier corresponding to the given pixel offset.
     *     Returns null if pixel doesn't correspond to a feature.
     */
    getFeatureId: function(i, j) {
        var id = null;
        if (this.json) {
            var resolution = this.utfgridResolution;
            var row = Math.floor(j / resolution);
            var col = Math.floor(i / resolution);
            var charCode = this.json.grid[row].charCodeAt(col);
            var index = this.indexFromCharCode(charCode);
            var keys = this.json.keys;
            if (!isNaN(index) && (index in keys)) {
                id = keys[index];
            }
        }
        return id;
    },
    
    /**
     * Method: indexFromCharCode
     * Given a character code for one of the UTFGrid "grid" characters, 
     *     resolve the integer index for the feature id in the UTFGrid "keys"
     *     array.
     *
     * Parameters:
     * charCode - {Integer}
     *
     * Returns:
     * {Integer} Index for the feature id from the keys array.
     */
    indexFromCharCode: function(charCode) {
        if (charCode >= 93) {
            charCode--;
        }
        if (charCode >= 35) {
            charCode --;
        }
        return charCode - 32;
    },
    
    /**
     * Method: parseData
     * Parse the JSON from a request
     *
     * Parameters:
     * str - {String} UTFGrid as a JSON string. 
     * 
     * Returns:
     * {Object} parsed javascript data
     */
    parseData: function(str) {
        if (!this.format) {
            this.format = new OpenLayers.Format.JSON();
        }
        this.json = this.format.read(str);
    },
    
    /** 
     * Method: clear
     * Delete data stored with this tile.
     */
    clear: function() {
        this.json = null;
    },
    
    CLASS_NAME: "OpenLayers.Tile.UTFGridWMS"

});


/** 
 * Class: OpenLayers.Layer.UTFGridWMS
 * This Layer reads from UTFGrid tiled data sources.  Since UTFGrids are 
 * essentially JSON-based ASCII art with attached attributes, they are not 
 * visibly rendered.  In order to use them in the map, you must add a 
 * <OpenLayers.Control.UTFGridWMS> control as well.
 *
 * Example:
 *
 * (start code)
 * var world_utfgrid = new OpenLayers.Layer.UTFGridWMS({
 *     url: "/tiles/world_utfgrid/${z}/${x}/${y}.json",
 *     utfgridResolution: 4,
 *     displayInLayerSwitcher: false
 * );
 * map.addLayer(world_utfgrid);
 * 
 * var control = new OpenLayers.Control.UTFGridWMS({
 *     layers: [world_utfgrid],
 *     handlerMode: 'move',
 *     callback: function(dataLookup) {
 *         // do something with returned data
 *     }
 * })
 * (end code)
 *
 * 
 * Inherits from:
 *  - <OpenLayers.Layer.XYZ>
 */
OpenLayers.Layer.UTFGridWMS = OpenLayers.Class(OpenLayers.Layer.WMS, {
    
    /**
     * APIProperty: isBaseLayer
     * Default is false, as UTFGrids are designed to be a transparent overlay layer. 
     */
    isBaseLayer: false,
    
    /**
     * APIProperty: projection
     * {<OpenLayers.Projection>}
     * Source projection for the UTFGrids.  Default is "EPSG:900913".
     */
    projection: new OpenLayers.Projection("EPSG:900913"),

    /**
     * Property: useJSONP
     * {Boolean}
     * Should we use a JSONP script approach instead of a standard AJAX call?
     *
     * Set to true for using utfgrids from another server. 
     * Avoids same-domain policy restrictions. 
     * Note that this only works if the server accepts 
     * the callback GET parameter and dynamically 
     * wraps the returned json in a function call.
     * 
     * Default is false
     */
    useJSONP: false,
    
    /**
     * APIProperty: url
     * {String}
     * URL tempate for UTFGrid tiles.  Include x, y, and z parameters.
     * E.g. "/tiles/${z}/${x}/${y}.json"
     */

    /**
     * APIProperty: utfgridResolution
     * {Number}
     * Ratio of the pixel width to the width of a UTFGrid data point.  If an 
     *     entry in the grid represents a 4x4 block of pixels, the 
     *     utfgridResolution would be 4.  Default is 2 (specified in 
     *     <OpenLayers.Tile.UTFGridWMS>).
     */

    /**
     * Property: tileClass
     * {<OpenLayers.Tile>} The tile class to use for this layer.
     *     Defaults is <OpenLayers.Tile.UTFGridWMS>.
     */
    tileClass: OpenLayers.Tile.UTFGridWMS,

    /**
     * Constructor: OpenLayers.Layer.UTFGridWMS
     * Create a new UTFGrid layer.
     *
     * Parameters:
     * config - {Object} Configuration properties for the layer.
     *
     * Required configuration properties:
     * url - {String} The url template for UTFGrid tiles.  See the <url> property.
     */
    initialize: function(name, url, params, options) {
       /* OpenLayers.Layer.Grid.prototype.initialize.apply(
            this, [options.name, options.url, {}, options]
        );*/
        
        var newArguments = [];
        //uppercase params
        params = OpenLayers.Util.upperCaseObject(params);
        if (parseFloat(params.VERSION) >= 1.3 && !params.EXCEPTIONS) {
            params.EXCEPTIONS = "INIMAGE";
        } 
        newArguments.push(name, url, params, options);
        OpenLayers.Layer.Grid.prototype.initialize.apply(this, newArguments);
        OpenLayers.Util.applyDefaults(
                       this.params, 
                       OpenLayers.Util.upperCaseObject(this.DEFAULT_PARAMS)
                       );


        //layer is transparent        
        if (!this.noMagic && this.params.TRANSPARENT && 
            this.params.TRANSPARENT.toString().toLowerCase() == "true") {
            
            // unless explicitly set in options, make layer an overlay
            if ( (options == null) || (!options.isBaseLayer) ) {
                this.isBaseLayer = false;
            } 
            
            // jpegs can never be transparent, so intelligently switch the 
            //  format, depending on the browser's capabilities
            if (this.params.FORMAT == "image/jpeg") {
                this.params.FORMAT = OpenLayers.Util.alphaHack() ? "image/gif"
                                                                 : "image/png";
            }
        }
        
        this.tileOptions = OpenLayers.Util.extend({
            utfgridResolution: this.utfgridResolution
        }, this.tileOptions);
    },

    /**
     * Method: createBackBuffer
     * The UTFGrid cannot create a back buffer, so this method is overriden.
     */
    createBackBuffer: function() {},
    
    /**
     * APIMethod: clone
     * Create a clone of this layer
     *
     * Parameters:
     * obj - {Object} Only used by a subclass of this layer.
     * 
     * Returns:
     * {<OpenLayers.Layer.UTFGridWMS>} An exact clone of this OpenLayers.Layer.UTFGridWMS
     */
    clone: function (obj) {
        if (obj == null) {
            obj = new OpenLayers.Layer.UTFGridWMS(this.getOptions());
        }

        // get all additions from superclasses
        obj = OpenLayers.Layer.Grid.prototype.clone.apply(this, [obj]);

        return obj;
    },

    /**
     * APIProperty: getFeatureInfo
     * Get details about a feature associated with a map location.  The object
     *     returned will have id and data properties.  If the given location
     *     doesn't correspond to a feature, null will be returned.
     *
     * Parameters:
     * location - {<OpenLayers.LonLat>} map location
     *
     * Returns:
     * {Object} Object representing the feature id and UTFGrid data 
     *     corresponding to the given map location.  Returns null if the given
     *     location doesn't hit a feature.
     */
    getFeatureInfo: function(location) {
        var info = null;
        var tileInfo = this.getTileData(location);
        if (tileInfo && tileInfo.tile) {
            info = tileInfo.tile.getFeatureInfo(tileInfo.i, tileInfo.j);
        }
        return info;
    },

    /**
     * APIMethod: getFeatureId
     * Get the identifier for the feature associated with a map location.
     *
     * Parameters:
     * location - {<OpenLayers.LonLat>} map location
     *
     * Returns:
     * {String} The feature identifier corresponding to the given map location.
     *     Returns null if the location doesn't hit a feature.
     */
    getFeatureId: function(location) {
        var id = null;
        var info = this.getTileData(location);
        if (info.tile) {
            id = info.tile.getFeatureId(info.i, info.j);
        }
        return id;
    },

    CLASS_NAME: "OpenLayers.Layer.UTFGridWMS"
});

/* ======================================================================
    OpenLayers/Control/UTFGrid.js
   ====================================================================== */

/* Copyright (c) 2006-2013 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Handler/Hover.js
 * @requires OpenLayers/Handler/Click.js
 */

/**
 * Class: OpenLayers.Control.UTFGridWMS
 *
 * This Control provides behavior associated with UTFGrid Layers.
 * These 'hit grids' provide underlying feature attributes without
 * calling the server (again). This control allows Mousemove, Hovering 
 * and Click events to trigger callbacks that use the attributes in 
 * whatever way you need. 
 *
 * The most common example may be a UTFGrid layer containing feature
 * attributes that are displayed in a div as you mouseover.
 *
 * Example Code:
 *
 * (start code)
 * var world_utfgrid = new OpenLayers.Layer.UTFGrid( 
 *     'UTFGrid Layer', 
 *     "http://tiles/world_utfgrid/${z}/${x}/${y}.json"
 * );
 * map.addLayer(world_utfgrid);
 * 
 * var control = new OpenLayers.Control.UTFGridWMS({
 *     layers: [world_utfgrid],
 *     handlerMode: 'move',
 *     callback: function(infoLookup) {
 *         // do something with returned data
 *
 *     }
 * })
 * (end code)
 *
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.UTFGridWMS = OpenLayers.Class(OpenLayers.Control, {
    
    /**
     * APIProperty: autoActivate
     * {Boolean} Activate the control when it is added to a map.  Default is
     *     true.
     */
    autoActivate: true,

    /** 
     * APIProperty: Layers
     * List of layers to consider. Must be Layer.UTFGrids
     * `null` is the default indicating all UTFGrid Layers are queried.
     * {Array} <OpenLayers.Layer.UTFGrid> 
     */
    layers: null,

    /* Property: defaultHandlerOptions
     * The default opts passed to the handler constructors
     */
    defaultHandlerOptions: {
        'delay': 300,
        'pixelTolerance': 4,
        'stopMove': false,
        'single': true,
        'double': false,
        'stopSingle': false,
        'stopDouble': false
    },

    /* APIProperty: handlerMode
     * Defaults to 'click'. Can be 'hover' or 'move'.
     */
    handlerMode: 'click',

    /**
     * APIMethod: setHandler
     * sets this.handlerMode and calls resetHandler()
     *
     * Parameters:
     * hm - {String} Handler Mode string; 'click', 'hover' or 'move'.
     */
    setHandler: function(hm) {
        this.handlerMode = hm;
        this.resetHandler();
    },

    /**
     * Method: resetHandler
     * Deactivates the old hanlder and creates a new
     * <OpenLayers.Handler> based on the mode specified in
     * this.handlerMode
     *
     */
    resetHandler: function() {
        if (this.handler) {
            this.handler.deactivate();
            this.handler.destroy();
            this.handler = null;
        }
   
        if (this.handlerMode == 'hover') {
            // Handle this event on hover
            this.handler = new OpenLayers.Handler.Hover(
                this,
                {'pause': this.handleEvent, 'move': this.reset},
                this.handlerOptions
            );
        } else if (this.handlerMode == 'click') {
            // Handle this event on click
            this.handler = new OpenLayers.Handler.Click(
                this, {
                    'click': this.handleEvent
                }, this.handlerOptions
            );
        } else if (this.handlerMode == 'move') {
            this.handler = new OpenLayers.Handler.Hover(
                this,
                // Handle this event while hovering OR moving
                {'pause': this.handleEvent, 'move': this.handleEvent},
                this.handlerOptions
            );
        }
        if (this.handler) {
            return true;
        } else {
            return false;
        }
    },

    /**
     * Constructor: <OpenLayers.Control.UTFGridWMS>
     *
     * Parameters:
     * options - {Object} 
     */
    initialize: function(options) {
        options = options || {};
        options.handlerOptions = options.handlerOptions || this.defaultHandlerOptions;
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        this.resetHandler();
    }, 

    /**
     * Method: handleEvent
     * Internal method called when specified event is triggered.
     * 
     * This method does several things:
     *
     * Gets the lonLat of the event.
     *
     * Loops through the appropriate hit grid layers and gathers the attributes.
     *
     * Passes the attributes to the callback
     *
     * Parameters:
     * evt - {<OpenLayers.Event>} 
     */
    handleEvent: function(evt) {
        if (evt == null) {
            this.reset();
            return;
        }

        var lonLat = this.map.getLonLatFromPixel(evt.xy);
        if (!lonLat) { 
            return;
        }    
        
        var layers = this.findLayers();
        if (layers.length > 0) {
            var infoLookup = {};
            var layer, idx;
            for (var i=0, len=layers.length; i<len; i++) {
                layer = layers[i];
                idx = OpenLayers.Util.indexOf(this.map.layers, layer);
                infoLookup[idx] = layer.getFeatureInfo(lonLat);
            }
            this.callback(infoLookup, lonLat, evt.xy);
        }
    },

    /**
     * APIMethod: callback
     * Function to be called when a mouse event corresponds with a location that
     *     includes data in one of the configured UTFGrid layers.
     *
     * Parameters:
     * infoLookup - {Object} Keys of this object are layer indexes and can be
     *     used to resolve a layer in the map.layers array.  The structure of
     *     the property values depend on the data included in the underlying
     *     UTFGrid and may be any valid JSON type.  
     */
    callback: function(infoLookup) {
        // to be provided in the constructor
    },

    /**
     * Method: reset
     * Calls the callback with null.
     */
    reset: function(evt) {
        this.callback(null);
    },

    /**
     * Method: findLayers
     * Internal method to get the layers, independent of whether we are
     *     inspecting the map or using a client-provided array
     *
     * The default value of this.layers is null; this causes the 
     * findLayers method to return ALL UTFGrid layers encountered.
     *
     * Parameters:
     * None
     *
     * Returns:
     * {Array} Layers to handle on each event
     */
    findLayers: function() {
        var candidates = this.layers || this.map.layers;
        var layers = [];
        var layer;
        for (var i=candidates.length-1; i>=0; --i) {
            layer = candidates[i];
            if (layer instanceof OpenLayers.Layer.UTFGridWMS ) { 
                layers.push(layer);
            }
        }
        return layers;
    },

    CLASS_NAME: "OpenLayers.Control.UTFGridWMS"
});
