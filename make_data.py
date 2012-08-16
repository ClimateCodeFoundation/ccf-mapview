import os
import gzip
import cStringIO
import shutil

def main():
    print "Parsing station data..."
    #parse_stations('data')
    print "Combining cell data..."
    #combine_cell_info('data')
    print "Gzipping everything..."
    if not os.path.exists('www/data/gz'):
        os.makedirs('www/data/gz')
    gz_everything('data', 'www/data/gz')

'''
    Parse station information
'''
def parse_stations(path):
    # v3.inv
    # - curated (from normal GHCNM.v3) and used by GISTEMP
    fields = [["ID", 0, 11, 'i'],
              ["NAME", 11, 42, 'c'],
              ["LATITUDE", 42, 49, 'f'],
              ["LONGITUDE", 49, 57, 'f'],
              ["STNELEV", 57, 62, 'f'],
              ["GRELEV", 62, 67, 'i'],
              ["POPCLS", 67, 68, 'c'],
              ["POPSIZ", 68, 73, 'i'],
              ["TOPO", 73, 75, 'c'],
              ["STVEG", 75, 77, 'c'],
              ["STLOC", 77, 79, 'c'],
              ["OCNDIS", 79, 81, 'i'],
              ["AIRSTN", 81, 82, 'c'],
              ["TOWNDIS", 82, 84, 'i'],
              ["GRVEG", 84, 100, 'c'],
              ["POPCSS", 100, 101, 'c'],
              ["USLIGHT", 101, 102, 'i'],
              ["LIGHT", 102, 106, 'i']]

    # INPUT TEMPERATURE VALUES ARE IN 1/10THS OF 1 DEGREE CELSIUS
    # (in the GHCN-M data, values are 1/100 C, this is changed to 1/10 C in work/step0)
    # OUTPUT TEMPERATURE VALUES ARE IN 1/100THS OF 1 DEGREE CELSIUS

    # station annotation
    data = open('ccc-gistemp/input/v3.inv', 'r').read().split('\n')
    data = [[d[f[1]:f[2]].strip() for f in fields] for d in data]
    print "Stations: %i" % len(data)
    stations = {}
    nodata = 0
    for d in data:
        if d[2] and d[3]:
            id = d[0]
            stations[id] = {}
            for j in xrange(len(fields)):
                stations[id][fields[j][0]] = d[j]
            if stations[id]['POPCSS'] not in ['A', 'B', 'C']:
                nodata += 1
    station_list = [[[int(round(float(v['LONGITUDE'])*100)), int(round(float(v['LATITUDE'])*100))], v['NAME'], v['POPCSS'], v['ID']] for k,v in stations.iteritems()]
    fout = open(path + '/stations.json', 'w')
    fout.write(str(station_list))
    fout.close()
    print "No urbanization data: %i" % nodata
    
    # step 0 - merged station data
    # step 1 - adjusted data
    # step 2 - urbanization normalization
    no0 = 0
    no1 = 0
    no2 = 0
    for fname, step in [['ccc-gistemp/work/step0.v2', 'step0'],
                        ['ccc-gistemp/work/step1.v2', 'step1'],
                        ['ccc-gistemp/work/step2.v2', 'step2']]:
        # read monthly data from file
        data = open('./' + fname, 'r').read().strip().split('\n')
        for d in data:
            i = d[:11]
            year = d[12:16]
            months = [(float(d[a:a+5])/10 if d[a:a+5] != '-9999' else None) for a in xrange(16, len(d), 5)]
            if not stations[i].has_key(step):
                stations[i][step] = {}
            stations[i][step][year] = months

        # combine months into yearly and average monthly values
        for i in stations.keys():
            
            if not stations[i].has_key(step):
                #print "no %s data for station %s" % (step, i)
                if '0' in step:
                    no0 += 1
                elif '1' in step:
                    no1 += 1
                elif '2' in step:
                    no2 += 1
                continue

            # compute baseline
            month_baseline = [[] for m in xrange(12)]
            for y in [str(a) for a in xrange(1950, 1980)]:
                if stations[i][step].has_key(y):
                    for m in xrange(12):
                        if stations[i][step][y][m] != None:
                            month_baseline[m].append(stations[i][step][y][m])
            month_baseline = [((sum(m)/len(m)) if len(m) > 0 else None) for m in month_baseline]
            
            # compute monthly averages
            month_avg = [[] for m in xrange(12)]
            for y in [str(a) for a in xrange(1880, 2011)]:
                if stations[i][step].has_key(y):
                    for m in xrange(12):
                        if stations[i][step][y][m] != None:
                            month_avg[m].append(stations[i][step][y][m])
            
            # normalize by baseline and compute yearly average delta
            for y in stations[i][step].keys():
                year = []
                for m in xrange(12):
                    if month_baseline[m] == None:
                        stations[i][step][y][m] = None
                    if stations[i][step][y][m] == None:
                        continue
                    stations[i][step][y][m] -= month_baseline[m]
                    year.append(stations[i][step][y][m])
                stations[i][step][y] = int(round((sum(year) / len(year) * 100) if len(year) > 0 else -9999))
            
            # set monthly averages
            stations[i][step]['months'] = [(int(round(sum(m)/len(m)*100)) if len(m) > 0 else -9999) for m in month_avg]
            
    print "No step0 data: %i" % no0
    print "No step1 data: %i" % no1
    print "No step2 data: %i" % no2
    
    # step 1 - adjustments
    data = open('ccc-gistemp/input/Ts.strange.v3.list.IN_full', 'r').read().strip().split('\n')
    for d in data:
        i = d[:11].strip()
        stations[i]['step1_adjusted'] = 'true';
        
    keys = ['ID', 'NAME', 'LATITUDE', 'LONGITUDE', 'STNELEV', 'GRELEV', 'STVEG', 'GRVEG', 'STLOC', 'TOPO', 'AIRSTN', 'OCNDIS', 'TOWNDIS', 'POPSIZ', 'POPCSS', 'POPCLS', 'USLIGHT', 'LIGHT']
    desc = ['ID', 'name', 'latitude', 'longitude', 'elevation', 'grid elevation', 'vegetation', 'grid vegetation', 'body of water', 'topography', 'at airport', 'distance to ocean', 'distance to town', 'population of town', 'population class (POPCSS)', 'population class (POPCLS)', 'US night light radiance', 'night light radiance']
    
    if not os.path.exists(path + '/stations') or not os.isdir(path + '/stations'):
        os.mkdir(path + '/stations')
    if not os.path.exists(path + '/csv') or not os.isdir(path + '/csv'):
        os.mkdir(path + '/csv')
    
    for i,s in stations.iteritems():
        fout = open(path + '/stations/s%s.json' % i, 'w')
        fout.write(str(s))
        fout.close()
    
        fout = open(path + '/csv/s%s.csv' %i, 'w')
        for key in keys:
            if key != 'ID':
                fout.write('\n')
            fout.write('# %s: %s' % (key, s[key]))
        fout.write('\nstep,' + ','.join(str(y) for y in xrange(1880,2011)))
        for step in xrange(0, 3):
            if s.has_key('step%i'%step):
                fout.write('\n%i,' % step + ','.join(str(s['step%i'%step][str(y)]/100.0 if s['step%i'%step].has_key(str(y)) else 'NA') for y in xrange(1880,2011)))
        fout.close()


'''
    Combine cell info
'''
NUMCELLS = 8000
NUMBOXES = 80

class FixedDec:
    def __init__(self, i, d):
        self.value = i
        self.pts = d
    def __str__(self):
        return ('%%.%if' % self.pts) % self.value
    def __repr__(self):
        return ('%%.%if' % self.pts) % self.value

def getBox(root, i):
    b = eval(open(root + '/sbx/box%i.json' % i).read())
    return b

def getCell(root, i):
    c = eval(open(root + '/sbx/cell%i.json' % i).read())
    return c

def setCell(root, i, content):
    open(root + '/sbx/cell%i.json' % i, 'w').write(str(content))

def getStation(root, i):
    try:
        s = eval(open(root + '/stations/s%s.json' % str(i)).read())
    except:
        return False
    return s

def getYear(root, i):
    y = eval(open(root + '/temp/mixed.%i.grid.json' % i).read())
    return y

def combine_cell_info(path):
    # get yearly temp data
    years = []
    for y in xrange(1880, 2011):
        years.append(getYear(path, y))
    
    stations = {}
    missing = set()
    for c in xrange(NUMCELLS): #cells
        cell = getCell(path, c)
        
        # Contributing stations
        notfound = []
        for i in xrange(len(cell['contributors'])):
            s = cell['contributors'][i]
            sid = s[0] # these somehow are 11 digits now (maybe the latest update)
            if not stations.has_key(sid):
                station = getStation(path, sid)
                if station:
                    stations[sid] = station
                else:
                    notfound.append(i)
                    missing.add(sid)
            else:
                station = stations[sid]
            name = station['NAME'] if station else None
            if station:
                cell['contributors'][i].append(name)
            cell['contributors'][i][0] = s[0] # one station record, includes the 12th digit
            cell['contributors'][i][1] = FixedDec(s[1], 2)
        for n in reversed(notfound):
            cell['contributors'].pop(n)

        # Temperature record            
        temps = {}
        for y in xrange(len(years)):
            t = years[y][c]
            if t != 9999:
                temps[y+1880] = t
        for key in temps.keys():
            cell[key] = temps[key]

        setCell(path, c, cell)
    print "%i stations not found" % len(missing)


'''
    Gzip all of our JSON data and push into www/data/gz
'''
def compressBuf(buf):
    zbuf = cStringIO.StringIO()
    zfile = gzip.GzipFile(mode='wb', fileobj=zbuf, compresslevel=9)
    zfile.write(buf)
    zfile.close()
    return zbuf.getvalue()

def zipcopy(fin, fout):
    f_in = open(fin, 'rb')
    f_out = open(fout, 'wb')
    f_out.write(compressBuf(f_in.read()))
    f_out.close()
    f_in.close()

def recurse_gz(fromhere, tohere):
    count = 0
    for f in os.listdir(fromhere):
        if fromhere + '/' + f == tohere: # don't go there
            continue
        if f == 'csv': # just copy
            shutil.copytree(fromhere + '/' + f, tohere + '/' + f)
            continue
        if os.path.isdir(fromhere + '/' + f):
            if not os.path.exists(tohere + '/' + f):
                os.mkdir(tohere + '/' + f)
            count += recurse_gz(fromhere + '/' + f, tohere + '/' + f)
        else:
            zipcopy(fromhere + '/' + f, tohere + '/' + f[:f.rindex('.')] + '.jgz') # shear off the .json and change it to .jgz (type: text/json, encoding: gzip)
            count += 1
    return count

def gz_everything(fromhere, tohere):
    print '%i files compressed' % recurse_gz(fromhere, tohere)


if __name__ == "__main__":
    main()
