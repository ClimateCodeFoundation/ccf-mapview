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

For the included simple web server:
 Python 2.6.*, 2.7.* (not tested on previous versions or 3.*)
 Tested on Ubuntu 10.04, but it should work pretty much anywhere with
  the included Python web server.
Client:
 Tested:
    Ubuntu / Google Chrome
    Ubuntu / Firefox
 Most any modern web browser should be fine, mozilla and webkit for
  sure. IE pre-8 or 9 are unlikely to perform favorably.


==Installation==

1. Extract the archive anywhere
2. Run "python PythonCGIServer.py PORT"
3. Try it at http://localhost:PORT/

-or-

1. Extract to any directory under a web server (Apache is known to work)
2. Try it at http://foo/bar/ or whatever the case may be
