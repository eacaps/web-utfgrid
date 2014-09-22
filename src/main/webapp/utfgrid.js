
var layer = new OpenLayers.Layer.WMS( "OpenLayers WMS",
                    "http://localhost:8080/geoserver2.5/topp/wms",
                    {layers: 'states'},{singleTile: true} );

var utfgrid = new OpenLayers.Layer.UTFGridWMS(
"UTFGRID",
"http://localhost:8080/geoserver2.5/topp/wms",
{
	layers: 'states',
	FORMAT:'application/json',
    
},
{
	singleTile: true,
	tileOptions: {crossOriginKeyword: 'anonymous'},
	//utfgridResolution: 2, // default is 2
    displayInLayerSwitcher: false
});

var bounds = new OpenLayers.Bounds(
                    -124.73142200000001, 24.955967,
                    -66.969849, 49.371735
                );

var map = new OpenLayers.Map({
    div: "map", 
    projection: "EPSG:4326",
    controls: [],
    layers: [layer, utfgrid],
    center: [-95.8506355, 37.163851],
    zoom: 4
});

//map.zoomToExtent(bounds);

var callback = function(infoLookup) {
    var msg = "";
    if (infoLookup) {
        var info;
        for (var idx in infoLookup) {
            // idx can be used to retrieve layer from map.layers[idx]
            info = infoLookup[idx];
            if (info && info.data) {
                msg += "[" + info.id + "] <strong>In 2005, " + 
                    info.data.STATE_NAME + " had a population of " +
                    info.data.PERSONS + " people.</strong> ";
            }
        }
    }
    document.getElementById("attrs").innerHTML = msg;
};
    
var controls = {
    move: new OpenLayers.Control.UTFGridWMS({
        callback: callback,
        handlerMode: "move"
    }),
    hover: new OpenLayers.Control.UTFGridWMS({
        callback: callback,
        handlerMode: "hover"
    }),
    click: new OpenLayers.Control.UTFGridWMS({
        callback: callback,
        handlerMode: "click"
    })
};
for (var key in controls) {
    map.addControl(controls[key]);
}

function toggleControl(el) {
    for (var c in controls) {
        controls[c].deactivate();
    }
    controls[el.value].activate();
}

// activate the control that responds to mousemove
toggleControl({value: "move"});