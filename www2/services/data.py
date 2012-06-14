#!/usr/bin/python

import cgi
import numpy
import os
import math
import sys

def main(param=None):
    if os.path.exists('services'):
        datadir = 'services/data/'
    else:
        datadir = 'data/'
    
    fname = param
    
    # parameters
    if not fname:
        form = cgi.FieldStorage()
        var_list = ['data']
        for v in var_list:
            if not form.has_key(v):
                output('missing "%s" parameter' % v)
                return
        fname = form.getvalue('data')
    
    if os.path.exists(datadir + '%s' % (fname)):
        if fname == 'topo.144' or fname == 'ost2010.grid' or fname == 'lt2010.grid' or fname=='mixed.2010.grid' or fname=='mixed.1880.2010.grid' or fname=='land.1880.2010.grid' or fname=='ocean.1880.2010.grid':
            dt = numpy.int16
        else:
            dt = numpy.uint8
        grid = numpy.fromfile(datadir + '%s' % (fname), dtype=dt)
    else:
        output('no such data')
        return

    # here we assume that all data is on the equirectangular earth grid, so it is twice as wide as it is tall
    if fname[-5:] != '.grid':
        length = grid.shape[0]
        xres = math.sqrt(length/2)
        yres = length / xres
        grid = grid.reshape((yres, xres))

    result = grid.tolist()

    if not param:
        print "Content-type: text/html\n"

    print str(result).replace(' ', '')

if __name__ == "__main__":
    if len(sys.argv) > 1:
        main(sys.argv[1])
    else:
        main()
