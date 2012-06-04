BLOCKS = { // [displayName, fileName, startYear, endYear, resolution, colorMap]
            "land": ["land", 144, [-180, 90], 2.5, [[0, null, [160,160,160,1], [160,160,160,1]]]], // 144 columns, rooted at 180W, 90N, 2.5 degrees unit squares
            "topo": ["topo", 144, [-180, 90], 2.5, [[null, 0, [0,0,190,1], [0,0,190,0.5]], [0, null, [0,190,0,0.3], [0,190,0,1]]]],
            "radiance": ["radiance", 144, [-180, 90], 2.5, [[0, null, [255,0,0,0.3], [255,0,0,1]]]],
};

GRIDS = {
         "ost2010": ["ocean input", 2010, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]],
         "lt2010": ["land merged", 2010, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]],
         "landmask": ["land mask", 2010, 2010, "grid", [[0, null, [0,0,0,0.3], [0,0,0,0.3]]]],
         "mixed.2010": ["mixed final", 2010, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]]
};

//            "land": ["land", 1880, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]],
//            "ocean": ["ocean", 1880, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]],
//            "mixed": ["mixed", 1880, 2010, "grid", [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]]]

// color map: [start, end, start color, end color] where value are mapped in (start, end] (including the end but not the start)
//            except for null (minimum), which is included

TEMPCOLORMAP = [[null, 0, [0, 0, 255, 1], [0, 0, 255, 0.3]], [0, null, [255, 0, 0, 0.3], [255, 0, 0, 1]]];

IMAGES = {
          "topo": ["img/topo_1000x500.png", [-180, 90]],
          "radiance": ["img/radiance_1000x500.png", [-180, 90]],
          "border": ["img/border2_1000x500.png", [-180, 90]]
};

FIRSTYEAR = 1880;
LASTYEAR = 2010;

function event_attacher() {
    var o = arguments[0];
    var f = arguments[1];
    var params = [];
    for(var i = 2; i < arguments.length; i++)
        params.push(arguments[i]);
    return function(event) {
        return f.call(o, event, params);
    }
}

function attacher() {
    var o = arguments[0];
    var f = arguments[1];
    var params = [];
    for(var i = 2; i < arguments.length; i++)
        params.push(arguments[i]);
    return function() {
        for(var i in arguments)
            params.push(arguments[i]);
        return f.apply(o, params);
    }
}

// 0-255 only
function toHex(v) {
    var hex = ['0', '1', '2', '3', '4', '5', ,'6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    return hex[Math.floor(v / 16)] + hex[Math.floor(v % 16)];
}

var map;
var grid;

function init() {
    console.log('making map...');
    // start with 3 layers, zoom 4x (4 pixels per degree)
    map = new CanvasMap(document.getElementById('map'), 3, 4); //(container, numLayers, zoom) where zoom indicates pixels per degree
    // preload grid data, which will then go on to get more data
    console.log('loading grid...');
    getGrid();
}

function getGrid() {
    var handle = {
        'callback': attacher(this, function(data) {
            grid = data; // we will keep this here (globally), not as a part of the map
            moreData();
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    RPC('services/grid.py', handle, {});
}

function moreData() {
    console.log('loading more data...');
    //getVectorData('static/land.110.json', 2, 'land.110'); // layer 2 (top)
    //getGridData('mixed.2010', 1); // put it on layer 1 (the middle)
    //map.load("img/radiance_1000x500.png", 'radiance_img', 'img', [-180, 90], 1); // middle layer
    map.update();
}

function zoom(z) {
    map.changeZoom(z);
}

function pan(x, y) {
    map.pan(x, y);
}

function getVectorData(src, layer, id) {
    var handle = {
        'callback': attacher(this, function(data) {
            map.load(data, id, 'vector', [], layer); // [] means there is no metadata
            map.update(); // this will cause it to render
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    JSON(src, handle, {});
}
    
function getGridData(id, layer) {
    var colormap = GRIDS[id][4];
    var handle = {
        'callback': attacher(this, function(data) {
            map.load(data[6], id, 'grid', [grid, colormap], layer) // the rest of data is metadata
            map.update();
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    RPC('services/data.py', handle, {'data':id, 'left':map.w, 'right':map.e, 'top':map.n, 'bottom':map.s, 'xres':'grid'});
}

function getUniformData(id, layer) {
    var cols = BLOCKS[id][1];
    var coords = BLOCKS[id][2];
    var block_size = BLOCKS[id][3];
    var colormap = BLOCKS[id][4];
    var handle = {
        'callback': attacher(this, function(data) {
            map.load(data[6], id, 'uniform', [cols, coords, block_size, colormap], layer) // the rest of data is metadata
            map.update();
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    RPC('services/data.py', handle, {'data':id, 'left':map.w, 'right':map.e, 'top':map.n, 'bottom':map.s, 'xres':cols});
}

function getImage(id, layer) {
    var src = IMAGES[id][0];
    var coords = IMAGES[id][1];
    map.load(src, id, 'img', coords, layer);
    map.update();
}
    
function animate(dataset, start_year, end_year, res) {
    loop(start_year - FIRSTYEAR);
}
    
function loop(year) {
    if(year >= map.nyears)
        return;

    $('#yearSlider').val(year+FIRSTYEAR);
    $('#currYear').text(year+FIRSTYEAR);
    
    //var timer = new Date();
    //var t0 = timer.getUTCMilliseconds();
    drawYear(year, map.nyears);
    //timer = new Date();
    //var t1 = timer.getUTCMilliseconds();
    //console.log('drawn ' + (year+1880) + ' in ' + (t1-t0) + 'e-3 s');
    setTimeout(attacher(this, loop, year+1, map.nyears), 1);
}
    
function drawYear(year) {
    var grid = [];
    for(var j = year; j < map.data.length; j+=map.nyears) {
        grid.push(map.data[j]);
    }
    if(grid.length < GRIDCELLS)
        console.log('year ' + (year+FIRSTYEAR) + ' too short');
    else {
        map.clear();
        //console.log('drawing ' + (year+FIRSTYEAR))
        drawLayer(grid, 'mixed', 'grid');
    }
}
    
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
            var red = (cmap[j][3][0] - cmap[j][2][0]) * (d - mn)/range + cmap[j][2][0];
            var green = (cmap[j][3][1] - cmap[j][2][1]) * (d - mn)/range + cmap[j][2][1];
            var blue = (cmap[j][3][2] - cmap[j][2][2]) * (d - mn)/range + cmap[j][2][2];
            var alpha = (cmap[j][3][3] - cmap[j][2][3]) * (d - mn)/range + cmap[j][2][3];
            c = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
            break;
        }
    }
    return c;
}

function callback(data) {
    var left = data[0];
    var right = data[1];
    var top = data[2];
    var bottom = data[3];
    var xres = data[4];
    var datatype = data[5];
    data = data[6]; // the bulk of it
    drawLayer(data, datatype, xres);
}

function error(msg) {
    console.log(msg);
}
