function eucldist(p1, p2) {
    return Math.sqrt(Math.pow((p1[0]-p2[0]), 2) + Math.pow((p1[1]-p2[1]), 2));
}

var BOUNDS = [-90, -180, 90, 180]; // (s, w, n, e)
var GRIDCELLS = 8000;
var NODATA = 9999;

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

function outofrange(bounds, map) { // bounds are [s,n,w,e]
    if(bounds[0] > map.n || bounds[1] < map.s || bounds[2] > map.e || bounds[3] < map.w)
        return true;
    return false;
}

// drawn on 8k grid
function GridData(id, data, meta) {
    this.id = id;
    var hidden = false;
    var data = data;
    var grid = meta[0];
    var colormap = meta[1];
    var range = computeRange(data);
    this.hide = function() {
        this.hidden = true;
    }
    this.show = function() {
        this.hidden = false;
    }
    this.render = function(map, ctx) {
        for(var i = 0; i < data.length; i++) {
            if(data[i] == NODATA || outofrange(grid[i], map))
                continue; // no data
            var c = mapColor(data[i], range[0], range[1], colormap);
            if(c != null)
                this.drawRect(grid[i], c, map, ctx);
        }
    }
    this.drawRect = function(coords, color, map, ctx) { // coords = [s, n, w, e]
        ctx.fillStyle = color;
        var start = map.coord(coords[2]/10, coords[1]/10);
        var end = map.coord(coords[3]/10, coords[0]/10);
        ctx.fillRect(start[0], map.height- start[1], end[0] - start[0], start[1] - end[1]);
    }
}

function ImageData(id, src, meta) {
    this.id = id;
    var hidden = false;
    var src = src;
    var lon = meta[0];
    var lat = meta[1];
    this.hide = function() {
        this.hidden = true;
    }
    this.show = function() {
        this.hidden = false;
    }
    this.render = function(map, ctx) {
        // top left by default
        if(lon == null)
            lon = -180;
        if(lat == null)
            lat = 90;
        var coords = map.coord(lon, lat);
        var im = new Image();
        im.src = src;
        im.onload = function() {
            ctx.drawImage(im, coords[0], map.height - coords[1]);
        }
    }
}

function VectorData(id, data) { // no metadata
    this.id = id;
    var hidden = false;
    var data = data;
    this.hide = function() {
        this.hidden = true;
    }
    this.show = function() {
        this.hidden = false;
    }
    this.render = function(map, ctx) {
        for(var d in data) {
            var polygon = data[d];
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            var start = 0;
            var coords = map.coord(polygon[start][0]/100, polygon[start][1]/100);
            ctx.moveTo(coords[0], map.height - coords[1]);
            for(var p = 1; p < polygon.length; p++) {
                if(p-1 != start && polygon[p-1][0] == polygon[start][0] && polygon[p-1][1] == polygon[start][1]) {
                    ctx.closePath();
                    ctx.stroke();
                    start = p;
                    var coords = map.coord(polygon[start][0]/100, polygon[start][1]/100);
                    ctx.moveTo(coords[0], map.height - coords[1]);
                    ctx.beginPath();
                    continue;
                }
                coords = map.coord(polygon[p][0]/100, polygon[p][1]/100);
                ctx.lineTo(coords[0], map.height - coords[1]);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
}

// drawn in a perfect uniform grid
function UniformData(id, data, meta) {
    this.id = id;
    var hidden = false;
    var data = data;
    var cols = meta[0];
    var coords = meta[1];
    var block_size = meta[2]; // in degrees
    var colormap = meta[3];
    var range = computeRange(data);
    this.hide = function() {
        this.hidden = true;
    }
    this.show = function() {
        this.hidden = false;
    }
    this.render = function(map, ctx) {
        for(var i = 0; i < data.length; i++) {
            for(var j = 0; j < data[i].length; j++) {
                var x = coords[0] + j * block_size;
                var y = coords[1] - i * block_size; // subtract here because we start in the NW corner moving down
                if(outofrange([y-block_size, y, x, x+block_size], map))
                    continue;
                var block_width = map.zoom * block_size;
                var pos = map.coord(x, y);
                var c = mapColor(data[i][j], range[0], range[1], colormap);
                if(c != null) {
                    ctx.fillStyle = c;
                    ctx.fillRect(pos[0], map.height - pos[1], block_width, block_width);
                }
            }
        }
    }
}

function Layer(map, container, showCoord) {
    this.$canvas = $('<canvas>');
    this.$canvas.addClass('layer');
    $(container).append(this.$canvas);
    this.$canvas.attr('width', this.$canvas.width());
    this.$canvas.attr('height', this.$canvas.height());
    this.ctx = this.$canvas.get(0).getContext('2d');
    
    this.map = map;
    this.data = [];
    
    if(showCoord) {
        // attach the mouse listener to the topmost layer
        this.$canvas.mousemove(event_attacher(this, function(e) {
            var x = e.pageX - $(e.currentTarget).offset().left;
            var y = e.pageY - $(e.currentTarget).offset().top;
            var lon = x/this.map.width * (this.map.e-this.map.w) + this.map.w;
            var lat = (1 - y/this.map.height) * (this.map.n-this.map.s) + this.map.s;
            if(lon < 0)
                lon = (lon * -1).toFixed(2) + ' W';
            else
                lon = lon.toFixed(2) + ' E';
            if(lat < 0)
                lat = (lat * -1).toFixed(2) + ' S';
            else
                lat = lat.toFixed(2) + ' N';
            this.ctx.clearRect(0,0,100,20);
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            this.ctx.fillRect(0,0,100,20);
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(lon + ', ' + lat, 5, 10);
        }));
    }
    
    this.clear = function() {
        this.ctx.clearRect(0, 0, this.$canvas.width(), this.$canvas.height());
    }
    
    this.load = function(data, id, disptype, meta) {
        console.log('loading data into layer...');
        if(disptype == 'grid')
            this.data.push(new GridData(id, data, meta));
        else if(disptype == 'uniform')
            this.data.push(new UniformData(id, data, meta));
        else if(disptype == 'img')
            this.data.push(new ImageData(id, data, meta));
        else if(disptype == 'vector')
            this.data.push(new VectorData(id, data, meta));
    }
    
    this.hide = function(id) {
        for(var d in this.data) {
            if(this.data[d].id == id) {
                this.data[d].hide();
                break;
            }
        }
    }
    
    this.show = function(id) {
        var loaded = false;
        for(var d in this.data) {
            if(this.data[d].id == id) {
                this.data[d].show();
                loaded = true;
                break;
            }
        }
        if(!loaded)
            console.log('error: cannot show data that is not loaded');
    }
    
    this.render = function(map) {
        for(var d in this.data) {
            if(!this.data[d].hidden) {
                this.data[d].render(map, this.ctx);
            }
        }
    }
}

function CanvasMap(container, numLayers, zoom) {
    this.zoom = zoom;
    this.layers = [];
    var layer_map = {};

    for(var i = 0; i < numLayers; i++) {
        if(i < numLayers-1)
            this.layers.push(new Layer(this, container));
        else
            this.layers.push(new Layer(this, container, true));
    }
    
    var toplayer = this.layers[numLayers-1];
    toplayer.$canvas.mousedown(event_attacher(this, function(e) {
        this.drag_x = e.pageX;
        this.drag_y = e.pageY;
        this.drag_s = this.s;
        this.drag_w = this.w;
        this.drag_n = this.n;
        this.drag_e = this.e;
        this.dragging = true;
    }));
    toplayer.$canvas.mousemove(event_attacher(this, function(e) {
        var lon_offset = (e.pageX - this.drag_x) / this.zoom;
        var lat_offset = (e.pageY - this.drag_y) / this.zoom;
        if(this.dragging) {
            console.log(lon_offset + ', ' + lat_offset);
            this.update(this.zoom, this.drag_s+lat_offset, this.drag_w-lon_offset, this.drag_n+lat_offset, this.drag_e-lon_offset);
        }
    }));
    toplayer.$canvas.mouseup(event_attacher(this, function(e) {
        this.dragging = false;
    }));
    
    // lock in the size when the CanvasMap is loaded
    this.width = $(document).width();
    this.height = $(document).height();
    // center at (0,0)
    var degreesWide = this.width / this.zoom;
    var degreesHigh = this.height / this.zoom;
    this.s = -1 * degreesHigh / 2;
    this.n = degreesHigh / 2;
    this.w = -1 * degreesWide / 2;
    this.e = degreesWide / 2;
    
    this.pan = function(x, y) {
        var degreesWide = this.width / this.zoom;
        var degreesHigh = this.height / this.zoom;
        var xchange = x * degreesWide;
        var ychange = y * degreesHigh;
        /*
        // fix horizontal overrun
        if(this.e + xchange > BOUNDS[3])
            xchange = BOUNDS[3] - this.e;
        else if(this.w + xchange < BOUNDS[1])
            xchange = BOUNDS[1] - this.w;
            
        // fix vertical overrun
        if(this.n + ychange > BOUNDS[2])
            ychange = BOUNDS[2] - this.n;
        else if(this.s + ychange < BOUNDS[0])
            ychange = BOUNDS[0] - this.s;
        */
        var s = this.s + ychange;
        var w = this.w + xchange;
        var n = this.n + ychange;
        var e = this.e + xchange;
     
        this.update(this.zoom, s, w, n, e);
    }
    
    this.changeZoom = function(mult) {
        var z = this.zoom * mult;
        var degreesWide = this.width / z;
        var degreesHigh = this.height / z;
        var center = [this.s + (this.n - this.s)/2, this.w + (this.e - this.w)/2];
        var s = center[0] - degreesHigh / 2;
        var n = center[0] + degreesHigh / 2;
        var w = center[1] - degreesWide / 2;
        var e = center[1] + degreesWide / 2;
        this.update(z, s, w, n, e);
    }

    this.update = function(z, s, w, n, e) {
        if(z != null)
            this.zoom = z;
        if(s != null)
            this.s = s;
        if(w != null)
            this.w = w;
        if(n != null)
            this.n = n;
        if(e != null)
            this.e = e;
        for(var l in this.layers) {
            this.layers[l].clear()
            this.layers[l].render(this);
        }
    }
    
    this.load = function(data, id, disptype, meta, l) {
        if(l == null)
            l = 0;
        this.layers[l].load(data, id, disptype, meta);
    }
    
    this.hide = function(id) {
        if(id in layer_map) {
            var l = layer_map[id];
            this.layers[l].hide(id);
        }
    }
    
    this.coord = function(x, y) {
        var x = (x - this.w) * this.zoom;
        var y = (y - this.s) * this.zoom;
        return [x,y];
    }
    
    this.clear = function() {
        for(l in this.layers) {
            this.layers[l].clear();
        }
    }
    
    // draw coordinate lines originating at (0,0)
    // spacing: float, degrees between marks
    this.drawDegrees = function(spacing, l) {
        if(l == null)
            l = 0;
        var ctx = this.layers[l].ctx;
        ctx.lineWidth = 1;
        var start = Math.floor(this.w / spacing) * spacing + spacing;
        var deg_width = this.width / (this.e - this.w);
        for(var deg = start; deg < this.e; deg+=spacing) {
            var x = deg - this.w;
            if(deg == 0)
                ctx.strokeStyle = 'rgba(255,0,0,0.3)';
            else
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(x * deg_width, 0);
            ctx.lineTo(x * deg_width, this.height);
            ctx.stroke();
        }
        var start = Math.floor(this.s / spacing) * spacing + spacing;
        var deg_height = this.height / (this.n - this.s);
        for(var deg = start; deg < this.n; deg+=spacing) {
            var y = deg - this.s;
            if(deg == 0)
                ctx.strokeStyle = 'rgba(255,0,0,0.3)';
            else
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(0, this.height - y*deg_height);
            ctx.lineTo(this.width, this.height - y*deg_height);
            ctx.stroke();
        }
    }
    
    // just draws a point at the specified longitude/latitude with W and S being negative
    this.point = function(x, y, l) {
        if(l == null)
            l = 0;
        var ctx = this.layers[l].ctx;
        var coords = this.coord(x, y);
        ctx.fillStyle = '#0000FF';
        ctx.beginPath();
        ctx.arc(coords[0],this.height-coords[1],3,0,Math.PI*2,true);  // (x,y,radius,radian_start,radian_end,fill)
        ctx.fill();
    }
    
    this.resize = function() {
        var canvasWidth = this.$canvas.width();
        var canvasHeight = this.$canvas.height();
        for(var l in this.layers) {
            this.layers[l].$canvas.attr('width', canvasWidth);
            this.layers[l].$canvas.attr('height', canvasHeight);
        }
    }
    //$(window).resize(attacher(this, this.resize));
}

