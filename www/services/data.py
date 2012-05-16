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
    xres = int(form.getvalue('xres'))
    
    if os.path.exists(datadir + '%s.%i' % (datatype, xres)):
        if datatype == 'topo':
            dt = numpy.int16
        else:
            dt = numpy.uint8
        grid = numpy.fromfile(datadir + '%s.%i' % (datatype, xres), dtype=dt)
    else:
        output('no such data type')
        return
    length = grid.shape[0]
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
