import os
import sys

if __name__ == "__main__":
    if not os.path.exists('edited'):
        os.mkdir('edited')
    files = os.listdir('.')
    for f in files:
        if os.path.isdir(f) or f == sys.argv[0]: # not a folder and not itself
            continue
        data = open(f, 'r').read()
        data = data.replace(' ', '').replace('\n', '').replace('\t', '')
        fout = open('edited/' + f, 'w')
        fout.write(data)
        fout.close()
