/*
 Copyright (c) 2012 Climate Code Foundation (climatecode.org)
 Licensed under the MIT License (LICENSE.txt)
 
 Version 0.1.0
*/

/*
 Encapsulates a single Google Chart API object, holding the
 charted data and allowing the chart to be redrawn in different
 ways and edited at will without having to go back to the Map
 object for data
 
 input:
    root (HTML element) - object to attach chart
*/
function Chart(root) {

    this.chartType = 'year';

    this.setData = function(data) {
        this.data = data;
    };
    
    this.clear = function() {
        $(root).empty();
    }
    
    this.render = function(cht) {
    
        if(cht) {
            this.chartType = cht;
        }
    
        var data = this.data; // just bring it local
    
        if(this.chartType == 'year') {
            var array = [['x']];
            if(data['step0'])
                array[0].push('Step 0');
            if(data['step1'])
                array[0].push('Step 1');
            if(data['step2'])
                array[0].push('Step 2');
            for(var y = 1880; y <= 2010; y++) {
                var stry = ''+y;
                var point = [stry];
                if(data['step0']) {
                    if(data['step0'][stry]) {
                        point.push(parseFloat(data['step0'][stry])/100);
                    }
                    else
                        point.push(null);
                }
                if(data['step1']) {
                    if(data['step1'][stry]) {
                        point.push(parseFloat(data['step1'][stry])/100);
                    }
                    else
                        point.push(null);
                }
                if(data['step2']) {
                    if(data['step2'][stry]) {
                        point.push(parseFloat(data['step2'][stry])/100);
                    }
                    else
                        point.push(null);
                }
                array.push(point);
            }
        }
        
        else if(this.chartType == 'month') {
            var array = [['x']];
            if(data['step0'] && data['step0']['months'])
                array[0].push('Step 0');
            if(data['step1'] && data['step1']['months'])
                array[0].push('Step 1');
            if(data['step2'] && data['step2']['months'])
                array[0].push('Step 2');
            if(array[0].length < 2) {
                $(root).empty();
                return;
            }
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; //[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            for(var m in months) {
                var strm = months[m]
                var point = [strm];
                if(data['step0']) {
                    if(data['step0']['months']) {
                        point.push(parseFloat(data['step0']['months'][m])/100);
                    }
                    else
                        point.push(null);
                }
                if(data['step1']) {
                    if(data['step1']['months']) {
                        point.push(parseFloat(data['step1']['months'][m])/100);
                    }
                    else
                        point.push(null);
                }
                if(data['step2']) {
                    if(data['step2']['months']) {
                        point.push(parseFloat(data['step2']['months'][m])/100);
                    }
                    else
                        point.push(null);
                }
                array.push(point);
            }
        }        
        // Create and populate the data table.
        var table = google.visualization.arrayToDataTable(array);
        
        var title = '';
        if(this.chartType == 'year') {
            title = 'Temperature delta from baseline (1950 - 1980)';
        }
        else if(this.chartType == 'month') {
            title = 'Average monthly temperature from 1880 - 2010';
        }

        // Create and draw the visualization.
        new google.visualization.LineChart(root).draw(table, {curveType: "function", width: 500, height: 400, backgroundColor:{fill:'transparent'}, hAxis:{title:this.chartType}, vAxis:{title:'Degrees Celsius'}, title:title} );
    };
}
