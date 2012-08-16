This is a web-based visualization of ccc-gistemp
(http://code.google.com/p/ccc-gistemp/), the Climate Code Foundation's
(climatecode.org) implementation of the NASA Goddard Institute for
Space Studies (GISS) Surface Temperature Analysis (GISTEMP,
data.giss.nasa.gov/gistemp/). Climate data is visualized using a map-
based interface similar to Google Maps, built on an HTML5/Javascript
framework.

This project is open source under the MIT License (LICENSE.txt) and
available at code.google.com/p/ccf-mapview. We use Natural Earth Data
(www.naturalearthdata.com), which is a great resource and in the public
domain. Parts of the rendering were inspired by shapefile-js
(github.com/RandomEtc/shapefile-js).

Concieved and executed as a part of the Google Summer of Code 2012.


==System Requirements==

Client:
 Tested:
    Ubuntu / Google Chrome
    Ubuntu / Firefox
 Most any modern web browser should be fine, mozilla and webkit for
 sure. IE pre-8 or 9 are unlikely to perform favorably.

Server:
 Almost any server should work. The only tricky part is setting the
 encoding on the compressed data files (see Installation).
 
 The modified ccc-gistemp files and various build dependencies are only
 guaranteed to work with ccc-gistemp revision 1011 (Jun 15, 2012).


==Installation==

 To build data dependencies, including running ccc-gistemp, run "build":
 
 ./build
 
 This should take 30 minutes to an hour
 

 Move www/ to any directory under a web server (Apache is known to work)

 Modify the configuration to set the content-type and content-encoding
 of our data files.
 
 Content-type header for .jgz files should be "text/json"
 Content-encoding should be "gzip"
 
 
 The following works for Apache:

 Set these directives in your configuration file where they will take
 effect on the www/data/gz directory.
 
    AddEncoding gzip .jgz
    AddType text/json .jgz
