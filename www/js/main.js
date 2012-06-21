/*
 Copyright (c) 2012 Climate Code Foundation (climatecode.org)
 Licensed under the MIT License (LICENSE.txt)
 
 Version 0.1.0
*/

NODATA = 9999;

// this is the order the layers will be shown, from bottom to top
LAYERS = ['land', 'glaciers', 'topo', 'rivers', 'lakes', 'countries', 'radiance', 'coordinates', 'landmask', 'ost2010', 'lt2010', 'mixed2010', 'oceanTemp', 'landTemp', 'mixedTemp'];// 'climate'];

FAR = 0
MEDIUM = 16
CLOSE = 80

// construct timeseries data
ocean_years = {}
land_years = {}
mixed_years = {}
for(var i = 1880; i < 2011; i++) {
    i = ''+i;
    ocean_years[i] = 'data/ocean.' + i + '.grid.json';
    land_years[i] = 'data/land.' + i + '.grid.json';
    mixed_years[i] = 'data/mixed.' + i + '.grid.json';
}

TEMPCOLOR = [[null, 0, [0, 0, 180, 0.7], [100, 100, 255, 0.7]], [0, null, [255, 100, 100, 0.7], [180, 0, 0, 0.7]]];

DATA = { // id: [[[resolution, filepath], [resolution, filepath], ...], fillcolor, outlinecolor, outlineonly, dontclose] - ...false, false is a normal filled polygon
    'land':     [
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/land.110.json'],
                            [MEDIUM, 'data/land.50.json'],
                            [CLOSE, 'data/land.10.json']
                        ],
                        { fillStyle: '#99AA77' }
                    ]
                ], // #202020 light greenish
    'rivers':   [
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/rivers.110.json'],
                            [MEDIUM, 'data/rivers.50.json'],
                            [CLOSE, 'data/rivers.10.json']
                        ],
                        { strokeStyle: '#0000FF', lineWidth: 0.5 }
                    ]
                ], // #9DC3E0 blue
    'lakes':    [
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/lakes.110.json'],
                            [MEDIUM, 'data/lakes.50.json'],
                            [CLOSE, 'data/lakes.10.json']
                        ],
                        { fillStyle: '#0000FF', strokeStyle: '#AAAAFF', lineWidth: 0.5 }
                    ]
                ], // #9DC3E0 blue
    'glaciers': [
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/glaciers.110.json'],
                            [MEDIUM, 'data/glaciers.50.json'],
                            [CLOSE, 'data/glaciers.10.json']
                        ],
                        { fillStyle: '#DDDDFF' }
                    ]
                ], // very light blue (blue-white, ice)
    'countries':[
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/countries.110.json'],
                            [MEDIUM, 'data/countries.50.json'],
                            [CLOSE, 'data/countries.10.json']
                        ],
                        { strokeStyle: '#FFFFFF', lineWidth: 1.0 }
                    ]
                ], //#000000
    
    'topo':     [
                    [
                        'single',
                        'uniform',
                        [
                            [FAR, 'data/topo.144.json'],
                            [MEDIUM, 'data/topo.288.json'],
                            [CLOSE, 'data/topo.1440.json']
                        ],
                        { colorMap: [[null, 0, [0,0,150,1], [100,100,255,1]], [0, null, [140,200,100,1], [100,50,0,1]]] }
                    ]
                ],
    'radiance': [
                    [
                        'single',
                        'uniform',
                        [
                            [FAR, 'data/radiance.144.json'],
                            [MEDIUM, 'data/radiance.288.json'],
                            [CLOSE, 'data/radiance.1440.json']
                        ],
                        { colorMap: [[0, null, [255,0,0,0.3], [255,0,0,1]]] }
                    ]
                ],
    
    'ost2010':  [
                    [
                        'single',
                        'grid',
                        [
                            [FAR, 'data/ost2010.grid.json']
                        ],
                        { colorMap: TEMPCOLOR }
                    ]
                ],
    'lt2010':   [
                    [
                        'single',
                        'grid',
                        [
                            [FAR, 'data/lt2010.grid.json']
                        ],
                        { colorMap: TEMPCOLOR }
                    ]
                ],
    'landmask': [
                    [
                        'single',
                        'grid',
                        [
                            [FAR, 'data/landmask.grid.json']
                        ],
                        { colorMap: [[0, null, [0,0,0,0.0], [0,0,0,0.3]]] }
                    ]
                ],
    /*
    // this one is a set of time-series grid data - something different must be done
    '1880-2010':[
                    [
                        'grid',
                        [
                            [FAR, 'data/mixed.1880.2010.grid.json']
                        ],
                        { colorMap: [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]] }
                    ]
                ],
    */
    'coordinates': [
                    [
                        'single',
                        'vector',
                        [
                            [FAR, 'data/latlon.10.json']
                        ],
                        { strokeStyle: '#000000', lineWidth: 0.5 }
                    ]
                ],
    
    'oceanTemp':  [
                    [
                        'timeseries',
                        'grid',
                        [
                            [FAR, ocean_years]
                        ],
                        { colorMap: TEMPCOLOR }
                    ],
                ],
    
    'landTemp':  [
                    [
                        'timeseries',
                        'grid',
                        [
                            [FAR, land_years]
                        ],
                        { colorMap: TEMPCOLOR }
                    ]
                ],
    
    'mixedTemp':  [
                    [
                        'timeseries',
                        'grid',
                        [
                            [FAR, mixed_years]
                        ],
                        { colorMap: TEMPCOLOR }
                    ]
                ]
}

function updateYear() {
    var year = $('#year').val();
    $('#oceanBtn').text(year);
    $('#landBtn').text(year);
    $('#mixedBtn').text(year);
    map.changeLayer('oceanTemp', year);
    map.changeLayer('landTemp', year);
    map.changeLayer('mixedTemp', year);
}

function toggle_box(btn, id) {
    var a = $('#' + id);
    var $btn = $(btn);
    if(!a.is(':visible')) {
        a.show('slow');
        if($btn.text() == '< More')
            $btn.text('> Less');
    }
    else {
        a.hide('slow');
        if($btn.text() == '> Less')
            $btn.text('< More');
    }
}

// a not-so-elegant but critical piece of scoping and closure
function attacher() {
    var o = arguments[0];
    var f = arguments[1];
    var params = [];
    for(var i = 2; i < arguments.length; i++)
        params.push(arguments[i]);
    return function() {
        var newparams = [];
        for(var i in arguments)
            newparams.push(arguments[i]);
        return f.apply(o, params.concat(newparams));
    }
}

var map;

function init() {
    // start with 3 layers, zoom 4x (4 pixels per degree)
    map = new CanvasMap(document.getElementById('map'), 4); //(container, numLayers, zoom) where zoom indicates pixels per degree
    for(var i in LAYERS) {
        var l = LAYERS[i];
        map.addLayer(l, DATA[l]);
    }
    map.show('land');
    map.show('rivers');
    map.show('lakes');
    map.show('glaciers');
    map.show('countries');
    map.update();
}

// toggle data sets on and off
function toggle(btn, datum) {
    $btn = $(btn);
    if($btn.hasClass('btn-selected')) {
        if(map.hide(datum)) {
            $btn.removeClass('btn-selected');
        }
    }
    else {
        if(map.show(datum)) {
            $btn.addClass('btn-selected');
        }
    }
}

function zoom(z) {
    map.changeZoom(z);
    $('#zoom').text(map.zoom.toFixed(0));
}

function pan(x, y) {
    map.pan(x, y);
}

// this is a supporting method to map values within a range
// to a fixed set of colors
function mapColor(d, minimum, maximum, cmap) {
    var c = null;
    for(var j in cmap) {
        var mn = cmap[j][0];
        var mx = cmap[j][1];
        if(mn != null && d <= mn) // color map is in order, this value must not be color mapped
            break;
        if(mx == null || d <= mx) {
            if(mn == null)
                mn = minimum;
            if(mx == null)
                mx = maximum;
            var range = mx - mn;
            var fraction = (d - mn)/range;
            var red = (cmap[j][3][0] - cmap[j][2][0]) * fraction + cmap[j][2][0];
            var green = (cmap[j][3][1] - cmap[j][2][1]) * fraction + cmap[j][2][1];
            var blue = (cmap[j][3][2] - cmap[j][2][2]) * fraction + cmap[j][2][2];
            var alpha = (cmap[j][3][3] - cmap[j][2][3]) * fraction + cmap[j][2][3];
            c = 'rgba(' + red.toFixed(0) + ',' + green.toFixed(0) + ',' + blue.toFixed(0) + ',' + alpha.toFixed(2) + ')';
            break;
        }
    }
    return c;
}

// another supporting method
// computes range (maximum and minimum) of data
// returns [minimum, maximum]
// given data as a 1D or 2D array (of numbers)
function computeRange(data) {
    var maximum = null;
    var minimum = null;
    for(var i = 0; i < data.length; i++) {
        if(data[i] instanceof Array) {
            for(var j = 0; j < data[i].length; j++) {
                if(data[i][j] != NODATA && (maximum == null || data[i][j] > maximum))
                    maximum = data[i][j];
                if(minimum == null || data[i][j] < minimum)
                    minimum = data[i][j];
            }
        }
        else {
            if(data[i] != NODATA && (maximum == null || data[i] > maximum))
                maximum = data[i];
            if(minimum == null || data[i] < minimum)
                minimum = data[i];
        }
    }
    return [minimum, maximum];
}
