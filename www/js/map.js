/*
 Copyright (c) 2012 Climate Code Foundation (climatecode.org)
 Licensed under the MIT License (LICENSE.txt)
*/

// Euclidean distance
function eucldist(p1, p2) {
    return Math.sqrt(Math.pow((p1[0]-p2[0]), 2) + Math.pow((p1[1]-p2[1]), 2));
}

var BOUNDS = [-90, -180, 90, 180]; // (s, w, n, e)

// Returns a boolean - if the bounding box falls completely outside the current viewing window on the map
function outOfBounds(bbox, map) {
    // bbox = [w, s, e, n]
    return (bbox[0] > map.e || bbox[1] > map.n || bbox[2] < map.w || bbox[3] < map.s)
}

// Makes and handles a JSON request
// - this outsources the actual AJAX call but is necessary to properly close the layer callback
function loadData(src, layer, index, res, subid) {
    var handle = {
        'callback': attacher(this, function(data) {
            $('#numBytes').text(parseInt($('#numBytes').text()) + (''+data).length);
            layer.load(data, index, res, subid);
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    JSON(src, handle, {});
}

/*
    The basic navigable map - made up of a set of stacked layers
*/
function CanvasMap(container, zoom) {
    this.zoom = zoom;
    this.layers = [];
    var layer_map = {};
    this.drawCoords = false;
    this.points = [];
    
    // Add a control layer to handle mouse interaction including:
    // 1. Detecting the cursor position
    // 2. Dragging to pan
    // 3. Scrolling to zoom
    // Data layers will be stuck in under this layer
    this.control_layer = new ControlLayer(this, container);
    this.control_layer.$canvas.mousedown(attacher(this, function(e) {
        this.drag_x = e.pageX;
        this.drag_y = e.pageY;
        this.drag_s = this.s;
        this.drag_w = this.w;
        this.drag_n = this.n;
        this.drag_e = this.e;
        this.dragging = true;
    }));
    this.control_layer.$canvas.mousemove(attacher(this, function(e) {
        var lon_offset = (e.pageX - this.drag_x) / this.zoom;
        var lat_offset = (e.pageY - this.drag_y) / this.zoom;
        if(this.dragging) {
            this.update(this.zoom, this.drag_s+lat_offset, this.drag_w-lon_offset, this.drag_n+lat_offset, this.drag_e-lon_offset);
        }
        // manually propogate click events down through layers
        for(l in this.layers) {
            if(this.layers[l].mousemove)
                this.layers[l].mousemove(e);
        }
    }));
    this.control_layer.$canvas.mouseup(attacher(this, function(e) {
        this.dragging = false;
        makeREST(false);
    }));
    this.control_layer.$canvas.mousewheel(attacher(this, function(e, delta, deltaX, deltaY) {
        var mouse_coord = [this.n-e.pageY/this.zoom, e.pageX/this.zoom+this.w]; // [s,w] of the mouse
        this.zoom *= Math.pow(1.1, delta); // zoom in
        if(this.zoom < 2)
            this.zoom = 2;
        var new_center = [mouse_coord[0] + (e.pageY - $(window).height()/2) / this.zoom, mouse_coord[1] + ($(window).width()/2 - e.pageX) / this.zoom];
        this.resize(null, new_center); // on the mouse position
        $('#zoom').text(this.zoom.toFixed(0));
        makeREST(false);
    }));
    this.control_layer.$canvas.click(attacher(this, function(e) {
        // make sure the layer wasn't just dragged, it should be in the same place
        if(e.pageX == this.drag_x && e.pageY == this.drag_y) {
            // manually propogate click events down through layers
            for(l in this.layers) {
                if(this.layers[l].click)
                    this.layers[l].click(e);
            }
        }
    }));
    // zoom on doubleclick
    this.control_layer.$canvas.dblclick(attacher(this, function(e) {
        var mouse_coord = [this.n-e.pageY/this.zoom, e.pageX/this.zoom+this.w]; // [s,w] of the mouse
        this.zoom *= 2; // zoom in
        var new_center = [mouse_coord[0] + (e.pageY - $(window).height()/2) / this.zoom, mouse_coord[1] + ($(window).width()/2 - e.pageX) / this.zoom];
        this.resize(null, new_center); // on the mouse position
        $('#zoom').text(this.zoom.toFixed(0));
        makeREST(false);
    }));
    
    // pan and changeZoom are updater functions triggered globally by buttons to
    // adjust the viewing window
    // x and y are a fraction of the viewing window
    this.pan = function(x, y) {
        var degreesWide = this.width / this.zoom;
        var degreesHigh = this.height / this.zoom;
        var xchange = x * degreesWide;
        var ychange = y * degreesHigh;
        
        var s = this.s + ychange;
        var w = this.w + xchange;
        var n = this.n + ychange;
        var e = this.e + xchange;
     
        this.update(null, s, w, n, e);
    }
    
    this.panTo = function(x, y) {
        this.update(null, y + (this.height / this.zoom / 2), x - (this.width / this.zoom / 2), y - (this.height / this.zoom / 2), x + (this.width / this.zoom / 2));
    }
    
    this.changeZoom = function(mult) {
        this.zoom *= mult;
        if(this.zoom < 2)
            this.zoom = 2;
        this.resize();
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
        
        // clamp N-S
        var offset = 0;
        if(this.n > 90 && this.s > -1 * this.n) {
            offset = Math.max(90 - this.n, (this.n - this.s)/2 - this.n);
        }
        if(this.s < -90 && this.n < -1 * this.s) {
            offset = Math.min(-90 - this.s, (this.s - this.n)/2 - this.s);
        }
        this.n += offset;
        this.s += offset;
        
        for(var l in this.layers) {
            this.redoLayer(l);
        }
        if(this.drawCoords)
            this.drawDegrees(10, this.layers.length-1); // uppermost layer
        for(var p in this.points) {
            this.point(this.points[p], this.layers.length-1); // uppermost layer
        }
    }
    
    this.redoLayer = function(l) {
        this.layers[l].render();
    }
    
    this.hide = function(id) {
        if(id in layer_map) {
            var l = layer_map[id];
            this.layers[l].hide();
            this.redoLayer(l);
            return true;
        }
        return false;
    }
    
    this.show = function(id) {
        if(id in layer_map) {
            var l = layer_map[id];
            this.layers[l].show();
            this.redoLayer(l);
            return true;
        }
        return false;
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
    
    this.addLayer = function(id, info, callback) {
        this.layers.push(new Layer(this, container));
        var i = this.layers.length - 1;
        layer_map[id] = i;
        this.layers[i].id = id;
        for(a in info) { // for each data set (only bathymetry has more than one)
            var multi = (info[a][0] == 'timeseries');
            var type = info[a][1];
            var resolutions = info[a][2];
            var style = info[a][3];
            this.layers[i].addData(multi, type, resolutions, style);
            if(multi) {
                for(var lastkey in resolutions[0][1]); // get the last key
                this.layers[i].change(lastkey); // set the default subid to the last in the list (2010)
            }
        }
    }
    
    // attaches an event to the layer specified by [id]
    // to call [callback] on a mouse click
    this.onclick = function(id, callback) {
        this.layers[layer_map[id]].onevent('click', function(lon, lat, objs){
            if(objs.length > 0 && objs[0] != null) {
                if(callback)
                    callback.apply(this, objs); // make a callback with the list of objects, usually indices into a list of features
            }
        });
    }
    
    // attaches an event to the layer specified by [id]
    // to call [callback] on a mouse click
    this.onmousemove = function(id, callback) {
        this.layers[layer_map[id]].onevent('mousemove', function(lon, lat, objs){
            if(objs.length > 0 && objs[0] != null) {
                if(callback) {
                    callback.apply(this, objs); // make a callback with the list of objects, usually indices into a list of features
                }
            }
        });
    }
    
    this.changeLayer = function(id, subid) {
        var layer = this.layers[layer_map[id]];
        return layer.change(subid);
    }
    
    this.resize = function(event, center) {
        this.width = $(window).width();
        this.height = $(window).height();
        
        this.control_layer.$canvas.attr('width', this.width);
        this.control_layer.$canvas.attr('height', this.height);

        for(var l in this.layers) {
            this.layers[l].$canvas.attr('width', this.width);
            this.layers[l].$canvas.attr('height', this.height);
        }
        var degreesWide = this.width / this.zoom;
        var degreesHigh = this.height / this.zoom;
        if(center == null)
            center = [this.s + (this.n - this.s)/2, this.w + (this.e - this.w)/2];
        var s = center[0] - degreesHigh / 2;
        var n = center[0] + degreesHigh / 2;
        var w = center[1] - degreesWide / 2;
        var e = center[1] + degreesWide / 2;
        this.update(null, s, w, n, e);
    }
    
    // all we have to do here is make sure the center is at (0,0) and it will adjust the window based on the size and zoom
    this.s = BOUNDS[0];
    this.w = BOUNDS[1];
    this.n = BOUNDS[2];
    this.e = BOUNDS[3];
    this.resize(); // adjust for window size at startup
 
    $(window).resize(attacher(this, this.resize));
    
    // load 8k grid data when the map is created (now)
    var handle = {
        'callback': attacher(this, function(data) {
            this.grid = [];
            for(var d in data) {
                // coords come in the form [s, n, w, e]
                this.grid.push([data[d][0]/10, data[d][2]/10, data[d][1]/10, data[d][3]/10]);
                // convert to [s, w, n, e]
            }
        }),
        'error': function(msg) {
            console.log(msg);
        }
    };
    JSON('data/gz/static/grid.jgz', handle, {});
    
    this.toggle8kGrid = function() {
        if(!this.gridDrawn) {
            this.gridDrawn = true;
            this.addLayer('8kgrid', [['single','grid',[[FAR, 'data/gz/static/landmask.grid.jgz']],{ lineWidth: 0.5, strokeStyle: '#FFFFFF' }]]); // [type, resolutions, style]
            this.show('8kgrid');
        }
        else if(this.layers[layer_map['8kgrid']].visible()) {
            this.layers[layer_map['8kgrid']].hide();
        }
        else {
            this.layers[layer_map['8kgrid']].show();
        }
        this.redoLayer(layer_map['8kgrid']);
    }
    
    this.getLayer = function(nm) {
        return this.layers[layer_map[nm]];
    }
}

/*
    This layer sits at the top of the stack, captures events,
    passes them to the correct owner, and shows the mouse coordinates
*/
function ControlLayer(map, container) {
    this.$canvas = $('<canvas>');
    this.$canvas.addClass('layer');
    $(container).append(this.$canvas);
    this.$canvas.attr('width', this.$canvas.width());
    this.$canvas.attr('height', this.$canvas.height());
    this.ctx = this.$canvas.get(0).getContext('2d');
    
    this.map = map;
    
    // attach the mouse listener to the topmost layer
    this.$canvas.mousemove(attacher(this, function(e) {
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

/*
    A generic data layer, one for each data set (land, lakes, temperature grid, etc)
*/
function Layer(map, container) {
    this.$canvas = $('<canvas>');
    this.$canvas.addClass('layer');
    this.$canvas.insertBefore(map.control_layer.$canvas);
    this.$canvas.attr('width', this.$canvas.width());
    this.$canvas.attr('height', this.$canvas.height());
    this.ctx = this.$canvas.get(0).getContext('2d');
    
    this.map = map;
    this.id = null;
    this.sets = []; // list of separately rendering data sets, in the order they should be rendered [[resolutions, meta], [resolutions, meta], ...]
    this.data = []; // [this will be a sparse array with only indices with known resolutions filled (probably 0, 8, and 40)] for each vector set
    this.loading = []; // list of boolean values indicating if each data set has an outstanding request pending
    var multi = false;
    var subid = null; // id of the subset of the timeseries to display
    
    // annotation/highlighting which can be triggered from outside
    var text = null; // text to show at a point
    var hObj = []; // list of highlighted data objects
    
    var hidden = true;
    this.hide = function() {
        hidden = true;
        this.clear();
    }
    this.show = function() {
        hidden = false;
    }
    this.visible = function() {
        return !hidden;
    }
    
    this.addData = function(m, type, resolutions, style) {
        multi = m;
        // sort available resolutions from highest to lowest
        resolutions.sort(function(a,b){return b[0]-a[0]});
        
        this.sets.push([type, resolutions, style]);
        this.data.push([]); // not loaded yet
        this.loading.push(false);
    }
    
    this.change = function(sid) {
        if(!multi)
            return false;
        subid = sid;
        this.render();
        return true;
    }
    
    this.clear = function() {
        this.ctx.clearRect(0, 0, this.$canvas.width(), this.$canvas.height());
    }
    
    this.load = function(data, index, res, subid) {
        var datatype = this.sets[index][0];
        var style = this.sets[index][2];
        if(subid) {
            // initialize empty set
            if(this.data[index][res] == null)
                this.data[index][res] = {};
            if(datatype == 'vector')
                this.data[index][res][subid] = new VectorData(res, data, style);
            else if(datatype == 'uniform')
                this.data[index][res][subid] = new UniformData(res, data, style);
            else if(datatype == 'grid')
                this.data[index][res][subid] = new GridData(res, data, style, this.map.grid);
        }
        else {
            if(datatype == 'vector')
                this.data[index][res] = new VectorData(res, data, style);
            else if(datatype == 'uniform')
                this.data[index][res] = new UniformData(res, data, style);
            else if(datatype == 'grid')
                this.data[index][res] = new GridData(res, data, style, this.map.grid);
            else if(datatype == 'point')
                this.data[index][res] = new PointData(res, data, style);
        }
        this.loading[index] = false;
        this.render();
    }
    
    this.render = function() {
        if(hidden) {
            return;
        }
        for(var i in this.sets) {
            // search from most to least detailed, drawing the highest resolution available
            var datatype = this.sets[i][0]
            for(var r in this.sets[i][1]) { // resolutions are sorted highest to lowest
                var res = this.sets[i][1][r][0];
                if(multi) {
                    var filepath = this.sets[i][1][r][1][subid];
                    if(res <= this.map.zoom) {
                        if(this.data[i][res] && this.data[i][res][subid]) { //loaded
                            this.clear(); // clearing here makes the animation more fluid by not clearing until the data is ready, but it also hides multiple data sets on one layer (bathymetry)
                            this.data[i][res][subid].render(this.map, this.ctx, hObj);
                            this.renderText();
                            break;
                        }
                        else if(!this.loading[i]) {
                            $('#dataLoaded').append('<br/> &gt; loading ' + this.id + ' ' + i + '[' + subid + '] (' + res + 'x)');
                            $("#loadingBox").animate({ scrollTop: $("#dataLoaded").height() }, 'slow');
                            loadData(filepath, this, i, res, subid)
                            this.loading[i] = true;
                            // notice that we don't break here, so it will keep going while we fetch data and render the next best resolution
                        }
                    }
                }
                else {
                    var filepath = this.sets[i][1][r][1];
                    if(res <= this.map.zoom) {
                        if(this.data[i][res]) { //loaded
                            this.clear();
                            this.data[i][res].render(this.map, this.ctx, hObj);
                            this.renderText();
                            break;
                        }
                        else if(!this.loading[i]) {
                            $('#dataLoaded').append('<br/> &gt; loading ' + this.id + ' ' + i + ' (' + res + 'x)');
                            $("#loadingBox").animate({ scrollTop: $("#dataLoaded").height() }, 'slow');
                            loadData(filepath, this, i, res)
                            this.loading[i] = true;
                            // notice that we don't break here, so it will keep going while we fetch data and render the next best resolution
                        }
                    }
                }
            }
        }
    }
    
    // pseudo-event registration
    this.onevent = function(evt, callback) {
        this[evt] = (function() {
            return function(event) {
                var lon = this.map.w + (event.clientX / this.map.zoom);
                var lat = this.map.n - (event.clientY / this.map.zoom);

                // collect a list of objects at this position on this layer
                var objs = [];
                if(!hidden) {
                    for(var i in this.sets) {
                        for(var r in this.sets[i][1]) {
                            var res = this.sets[i][1][r][0];
                            if(res <= this.map.zoom && this.data[i][res]) {
                                if(multi && this.data[i][res][subid]) {
                                    objs.push(this.data[i][res][subid].atCoord(event.clientX, event.clientY, lon, lat));
                                }
                                else {
                                    objs.push(this.data[i][res].atCoord(event.clientX, event.clientY, lon, lat));
                                }
                            }
                        }
                    }
                }
                    
                callback.apply(this, [lon, lat, objs]);
            };
        })();
    }
    
    this.renderText = function() {
        if(text) {
            var coords = this.map.coord(text[0][0], text[0][1]);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(text[1], coords[0], this.map.height-coords[1]);
        }
    }
    
    this.showText = function(pt, txt, style) {
        if(text != [pt, txt]) {
            text = [pt, txt];
            if(style) {
                this.ctx.save();
                for(var s in style) {
                    this.ctx[s] = style[s];
                }
            }
            this.render()
            if(style) {
                this.ctx.restore();
            }
        }
    }
    
    this.clearText = function() {
        text = null;
    }
    
    this.highlight = function(obj) {
        hObj.push(obj);
        this.render();
    }
    
    this.highlightAll = function(objs) {
        for(var o in objs) {
            hObj.push(objs[o]);
        }
        this.render();
    }
    
    this.clearHighlight = function() {
        hObj = [];
        this.render();
    }
}


/*
    Draws point data with labels, being careful not to overlap labels
    - derived almost entirely from layer rendering code in github.com/RandomEtc/shapefile-js, under some open source license
    - data in the form: [[lon, lat], name, color_class, id]
*/
function PointData(res, data, style) {
    // data = [[[x, y], text],
    //         [[x, y], text],
    //         ...
    //        ]
    var RADIUS = 3;
    
    // get the index of the point at the given pixel coordinates (x,y)
    this.atCoord = function(x, y) {
        for(var d in data) {
            coords = map.coord(data[d][0][0]/100, data[d][0][1]/100);
            if(eucldist(coords, [x, map.height-y]) < RADIUS+1) {
                return data[d];
            }
        }
        return null;
    }
    
    this.render = function(map, ctx, hObj) { //hObj: objects to highlight
        if (style.fillStyle) ctx.fillStyle = style.fillStyle;
        if (style.strokeStyle) ctx.strokeStyle = style.strokeStyle;
        if (style.lineWidth) ctx.lineWidth = style.lineWidth;

        for (var d in data) {
            pt = [data[d][0][0]/100, data[d][0][1]/100];
            if(pt[0] < map.w || pt[0] > map.e || pt[1] < map.s || pt[1] > map.n) {
                continue
            }
            
            if(hObj.indexOf(data[d]) != -1) {
                var r = RADIUS * 2;
                var cls = 'highlight'; // replace the normal class
            }
            else {
                var r = RADIUS;
                var cls = data[d][2]; // normal class
            }
            
            // set classMap styles, if available
            var subStyle = {};
            if (style.classMap && style.classMap[cls]) { // third value in the data is the class (for stations, C, B, or A, urban, suburb, or rural, respectively)
                for(var s in style.classMap[cls]) {
                    ctx[s] = style.classMap[cls][s];
                    subStyle[s] = ctx[s];
                }
            }
            
            var coords = map.coord(pt[0], pt[1]);
            if (style.fillStyle || subStyle.fillStyle) {
                /* draw a circle
                ctx.beginPath();
                ctx.arc(coords[0], map.height - coords[1], RADIUS, 0, Math.PI*2, true); // (x, y, radius, start_radian, end_radian, connect?)
                ctx.closePath();
                ctx.fill();
                */
                // draw rectangle
                ctx.fillRect(coords[0] - r, map.height - coords[1] - r, r*2, r*2);
            }
            if (style.strokeStyle || subStyle.strokeStyle) {
                /* draw a circle
                ctx.beginPath();
                ctx.arc(coords[0], map.height - coords[1], RADIUS, 0, Math.PI*2, true); // (x, y, radius, start_radian, end_radian, connect?)
                ctx.closePath();
                ctx.stroke();
                */
                // draw rectangle
                ctx.strokeRect(coords[0] - r, map.height - coords[1] - r, r*2, r*2);
            }
        }
        
        if (style.textFill || style.textStroke) {
            if (!style.helper) {
                style.helper = document.createElement('canvas');
                //$('#map').append($(style.helper)); // show it --------------- for debug
                //$(style.helper).addClass('layer');
            }
            
            // do this every time in case the window was resized
            style.helper.width = map.width;
            style.helper.height = map.height;

            var helper = style.helper.getContext('2d');
            helper.clearRect(0,0,style.helper.width,style.helper.height);
            helper.fillStyle = 'black';
            
            if (style.font) ctx.font = style.font;
            if (style.textFill) ctx.fillStyle = style.textFill;
            if (style.textStroke) {
                ctx.strokeStyle = style.textStroke;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.lineWidth = style.textHalo || 1;
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            for (var d in data) {
                pt = [data[d][0][0]/100, data[d][0][1]/100];
                if(pt[0] < map.w || pt[0] > map.e || pt[1] < map.s || pt[1] > map.n) {
                    continue
                }
                
                var coords = map.coord(pt[0], pt[1]);
                var text = data[d][1];
                var tx = Math.round(3 + coords[0]);
                var ty = Math.round(map.height - coords[1]);
                var tw = Math.round(ctx.measureText(text).width);
                var th = 12;

                if (tx < 0 || tx+tw >= map.width || ty-th/2 < 0 || ty+th/2 >= map.height) continue;
                
                // these check for overlap with previously drawn text
                var img = helper.getImageData(tx+tw/2,ty,1,1);
                if (img.data[3]) continue;
                var img = helper.getImageData(tx,ty-th/2,1,1);
                if (img.data[3]) continue;
                img = helper.getImageData(tx+tw,ty-th/2,1,1);
                if (img.data[3]) continue;
                img = helper.getImageData(tx+tw,ty+th/2,1,1);
                if (img.data[3]) continue;
                img = helper.getImageData(tx,ty+th/2,1,1);
                if (img.data[3]) continue;
                
                helper.fillRect(tx, ty-th/2, tw, th);
                if (style.textStroke) ctx.strokeText(text, tx, ty);
                if (style.textFill) ctx.fillText(text, tx, ty);
            }
        }
    }
}

/*
    Holds a set of vector data and draws on command to the
    containing layer/map
*/
function VectorData(res, data, style) {
    var resolutions = res;
    
    // fix bounding box coordinates
    for(var d in data) {
        for(var b in data[d][0]) {
            data[d][0][b] /= 100;
        }
    }
    
    // get the index of the polygon at the given pixel coordinates (x,y)
    this.atCoord = function(x, y) {
        return null;
    }
    
    this.render = function(map, ctx, hObj) {//hObj: objects to highlight
        //var m = 0;
        //var colors = ['#FF0000', '#FF7700', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF'];
        for(var s in style) {
            ctx[s] = style[s];
        }
        for(var d in data) {
            var bbox = data[d][0];
            if(bbox[1] > map.n || bbox[3] < map.s)
                continue
            for(var offset = Math.floor((map.w+180) / 360)*360; offset <= Math.floor((map.e+180) / 360)*360; offset+=360) {
                if(bbox[0] + offset > map.e || bbox[2] + offset < map.w) {
                    continue
                }
                ctx.beginPath();
                for(var p in data[d][1]) { // parts of the polygon
                    var polygon = data[d][1][p];
                    var coords = map.coord(polygon[0][0]/100+offset, polygon[0][1]/100);
                    ctx.moveTo(coords[0], map.height - coords[1]);
                    for(var p = 1; p < polygon.length; p++) {
                        coords = map.coord(polygon[p][0]/100+offset, polygon[p][1]/100);
                        ctx.lineTo(coords[0], map.height - coords[1]);
                    }
                }
                if(style.fillStyle) {
                    ctx.fill();
                }
                if(style.strokeStyle) {
                    ctx.stroke();
                }
            }
        }
    }
}


// drawn on 8k grid
// grid is [[s,w,n,e], [s,w,n,e], ...]
function GridData(res, data, style, grid) {
    var range = computeRange(data);
    
    // get the index of the cell at the given pixel coordinates (x,y)
    this.atCoord = function(x, y) {
        y = map.height - y;
        for(var g in grid) {
            var c1 = map.coord(grid[g][1], grid[g][0]);
            var c2 = map.coord(grid[g][3], grid[g][2]);
            if(x >= c1[0] && x <= c2[0] && y >= c1[1] && y <= c2[1]) {
                return [g, grid[g], data[g]];
            }
        }
        return null;
    }
    
    this.render = function(map, ctx, hObj) { //hObj: objects to highlight
        for(var s in style) {
            ctx[s] = style[s];
        }
        for(var i = 0; i < data.length; i++) {
            if(data[i] == NODATA || grid[i][0] > map.n || grid[i][2] < map.s)
                continue
            if(hObj.indexOf(i) != -1) {
                for(var s in style['highlight']) {
                    ctx[s] = style['highlight'][s];
                }
                var highlit = true;
            }
            else
                var highlit = false;
            for(var offset = Math.floor((map.w+180) / 360)*360; offset <= Math.floor((map.e+180) / 360)*360; offset+=360) {
                if(grid[i][1] + offset > map.e || grid[i][3] + offset < map.w)
                    continue
                var start = map.coord(grid[i][1]+offset, grid[i][2]);
                var end = map.coord(grid[i][3]+offset, grid[i][0]);
                if(style.colorMap) {
                    var c = mapColor(data[i], range[0], range[1], style.colorMap);
                    if(c != null) {
                        ctx.fillStyle = c;
                        ctx.fillRect(start[0], map.height- start[1], end[0] - start[0], start[1] - end[1]);
                    }
                    if(highlit) {
                        ctx.strokeRect(start[0], map.height- start[1], end[0] - start[0], start[1] - end[1]);
                    }

                }
                else if(style.fillStyle)
                    ctx.fillRect(start[0], map.height- start[1], end[0] - start[0], start[1] - end[1]);
                if(style.strokeStyle)
                    ctx.strokeRect(start[0], map.height- start[1], end[0] - start[0], start[1] - end[1]);
            }
        }
    }
}


// drawn in a perfect uniform grid
function UniformData(res, data, style) {
    var rows = data.length;
    var cols = data[0].length;
    var degperblock = 360 / cols; // unit box w/h in degrees
    var root = [-180, 90];
    
    // get the index of the cell at the given pixel coordinates (x,y)
    this.atCoord = function(x, y, lon, lat) {
        var col = Math.floor((lon + 180) / degperblock);
        var row = Math.floor((lat + 90) / degperblock);
        if(col >= 0 && row >= 0)
            return row * cols + col;
        return null;
    }
    
    var range = computeRange(data);
    this.render = function(map, ctx, hObj) { //hObj: objects to highlight
        var block_width = map.zoom * degperblock;
        for(var i = 0; i < data.length; i++) {
            for(var j = 0; j < data[i].length; j++) {
                var x = root[0] + j * degperblock;
                var y = root[1] - i * degperblock; // subtract here because we start in the NW corner moving down
                if(outOfBounds([x, y-degperblock, x+degperblock, y], map))
                    continue;
                var pos = map.coord(x, y);
                var c = mapColor(data[i][j], range[0], range[1], style.colorMap);
                if(c != null) {
                    ctx.fillStyle = c;
                    ctx.fillRect(pos[0], map.height - pos[1], block_width, block_width);
                }
            }
        }
    }
}
