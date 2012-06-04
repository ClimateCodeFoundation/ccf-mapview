#!/usr/bin/python

import cgi
import numpy
import os

def main():
    if os.path.exists('services'):
        datadir = 'services/data/'
    else:
        datadir = 'data/'
    
    # parameters
    form = cgi.FieldStorage()
    var_list = ['data', 'left', 'right', 'top', 'bottom', 'xres']
    for v in var_list:
        if not form.has_key(v):
            output('missing "%s" parameter' % v)
            return
    datatype = form.getvalue('data')
    left = float(form.getvalue('left'))
    right = float(form.getvalue('right'))
    top = float(form.getvalue('top'))
    bottom = float(form.getvalue('bottom'))
    xres = form.getvalue('xres')
    if xres != 'grid': # 'grid' indicates using 8k grid
        xres = int(xres)
    
    if os.path.exists(datadir + '%s.%s' % (datatype, str(xres))):
        if datatype == 'topo' or datatype == 'ost2010' or datatype == 'lt2010' or datatype=='mixed.2010' or datatype=='mixed.1880.2010' or datatype=='land.1880.2010' or datatype=='ocean.1880.2010':
            dt = numpy.int16
        elif datatype == 'urban':
            dt = numpy.dtype(bool)
        else:
            dt = numpy.uint8
        grid = numpy.fromfile(datadir + '%s.%s' % (datatype, str(xres)), dtype=dt)
        if datatype == 'urban':
            grid = grid.astype(numpy.uint8)
    else:
        output('no such data')
        return
    length = grid.shape[0]
    if xres != 'grid':
        yres = length / xres
        grid = grid.reshape((yres, xres))
    #result = "\n".join(["".join([chr(grid[i,j]) for j in xrange(grid.shape[1])]) for i in xrange(grid.shape[0])])
    result = grid.tolist()
    result = [left, right, top, bottom, xres, datatype, result]
    output(result)

def output(result):
    print "Content-type: text/html\n"
    print str(result)

if __name__ == "__main__":
    main()
