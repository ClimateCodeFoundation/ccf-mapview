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
    #form = cgi.FieldStorage()

    dt = numpy.int16
    grid = numpy.fromfile(datadir + 'grids8k', dtype=dt)
    yres = grid.size / 4 # 4 coordinates define each block
    grid = grid.reshape((yres, 4))
    result = grid.tolist()
    output(result)

def output(result):
    print "Content-type: text/html\n"
    print str(result)

if __name__ == "__main__":
    main()
