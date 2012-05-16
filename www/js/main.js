function attacher() {
    var o = arguments[0];
    var f = arguments[1];
    var params = [];
    for(var i = 2; i < arguments.length; i++)
        params.push(arguments[i]);
    return function(event) {
        return f.call(o, event, params);
    }
}

// 0-255 only
function toHex(v) {
    var hex = ['0', '1', '2', '3', '4', '5', ,'6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    return hex[Math.floor(v / 16)] + hex[Math.floor(v % 16)];
}

var map;

function init() {
    console.log('making map...');
    map = new Map(1000, 500);
}

function Map(width, height) {
    var $canvas = $('#main_canvas');
    var canvas = $canvas.get(0);
    var ctx = canvas.getContext('2d');
    
    $canvas.mousemove(attacher(this, function(e) {
        var x = e.pageX - $(e.currentTarget).offset().left;
        var y = e.pageY - $(e.currentTarget).offset().top;
        var lon = x/this.width * (this.right-this.left) + this.left;
        var lat = (1 - y/this.height) * (this.top-this.bottom) + this.bottom;
        if(lon < 0)
            lon = (lon * -1).toFixed(2) + ' W';
        else
            lon = lon.toFixed(2) + ' E';
        if(lat < 0)
            lat = (lat * -1).toFixed(2) + ' S';
        else
            lat = lat.toFixed(2) + ' N';
        $('#coords').text(lon + ', ' + lat);
    }));
    
    this.width = width;
    this.height = height;
    
    this.update = function(left, right, top, bottom) {
        /*
          these indicate coordinates, by degree (or fraction thereof), of the
          west, east, north, and south boundaries, respectively, of the viewing
          window
        */
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
    }
    
    this.drawCoords = function() {
        ctx.lineWidth = 1;
        // by default, draw every 10 degrees
        var start = Math.floor(this.left / 10) * 10 + 10;
        var deg_width = this.width / (this.right - this.left);
        for(var deg = start; deg < this.right; deg+=10) {
            var x = deg - this.left;
            if(deg == 0)
                ctx.strokeStyle = 'rgba(255,0,0,0.3)';
            else
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(x * deg_width, 0);
            ctx.lineTo(x * deg_width, this.height);
            ctx.stroke();
        }
        var start = Math.floor(this.bottom / 10) * 10 + 10;
        var deg_height = this.height / (this.top - this.bottom);
        for(var deg = start; deg < this.top; deg+=10) {
            var y = deg - this.bottom;
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
    this.point = function(x, y) {
        var deg_width = this.width / (this.right - this.left);
        var deg_height = this.height / (this.top - this.bottom);
        var x = (x - this.left) * deg_width;
        var y = (y - this.bottom) * deg_height;
        ctx.fillStyle = '#0000FF';
        ctx.beginPath();
        ctx.arc(x,this.height-y,3,0,Math.PI*2,true);  // (x,y,radius,radian_start,radian_end,fill)
        ctx.fill();
    }
    
    $canvas.resize(function() {
        this.width = $canvas.width();
        this.height = $canvas.height();
        $canvas.attr('width', this.width);
        $canvas.attr('height', this.height);
    });
    
    this.drawImage = function(src, x, y) {
        if(x == null)
            x = 0;
        if(y == null)
            y = 0;
        var im = new Image();
        im.src = src;
        im.onload = function() {
            ctx.drawImage(im, x, y);
        }
    }
    
    this.loadData = function(dataset, resolution) {
        RPC('services/data.py', this, {'data':dataset, 'left':this.left, 'right':this.right, 'top':this.top, 'bottom':this.bottom, 'xres':resolution});
    }
    
    this.callback = function(data) {
        var left = data[0];
        var right = data[1];
        var top = data[2];
        var bottom = data[3];
        var xres = data[4];
        var datatype = data[5];
        var block_width = this.width / xres; // fix this to incorporate left, right, etc
        data = data[6]; // the bulk of it
        
        // compute range
        var maximum = null;
        var minimum = null;
        for(var i = 0; i < data.length; i++) {
            for(var j = 0; j < data[i].length; j++) {
                if(maximum == null || data[i][j] > maximum)
                    maximum = data[i][j];
                if(minimum == null || data[i][j] < minimum)
                    minimum = data[i][j];
            }
        }
        
        for(var i = 0; i < data.length; i++) {
            for(var j = 0; j < data[i].length; j++) {
                var x = j * block_width;
                var y = i * block_width;
                
                if(datatype == 'land') {
                    if(data[i][j] == 1) {
                        ctx.fillStyle = '#A0A0A0';
                        ctx.fillRect(x, y, block_width, block_width);
                    }
                }
                
                else if(datatype == 'topo') {
                    if(data[i][j] >= 0) {
                        var c = 0.3 + 0.7 * (data[i][j] - 0) / (maximum - 0); // baseline of 30% opacity
                        ctx.fillStyle = 'rgba(0,190,0,' + c + ')' //'#' + h + h + h;
                        ctx.fillRect(x, y, block_width, block_width);
                    }
                    else { // water
                        var c = 0.5 + 0.5 * (0 - data[i][j]) / (0 - minimum); // higher is closer to the bottom of the ocean
                        ctx.fillStyle = 'rgba(0,0,190,' + c + ')' //'#' + h + h + h;
                        ctx.fillRect(x, y, block_width, block_width);
                    }
                }
                
                else if(datatype == 'radiance') {
                    if(data[i][j] > 0) {
                        var c = 0.3 + 0.7 * (data[i][j] - minimum) / (maximum - minimum); // darker black means more radiance (weird, right?)
                        //var h = toHex(Math.floor(c*255));
                        ctx.fillStyle = 'rgba(255,0,0,' + c + ')' //'#' + h + h + h;
                        ctx.fillRect(x, y, block_width, block_width);
                    }
                }
            }
        }
    }
    
    this.error = function(msg) {
        console.log(msg);
    }
    
    this.update(-180, 180, 90, -90);
}
