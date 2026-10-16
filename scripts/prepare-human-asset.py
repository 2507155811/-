"""Prepare a clothed adult base from the CC0 MakeHuman mesh (no code imported).
Only the rendered body group is retained. Helper meshes are discarded; private
anatomical regions are omitted and torso/legs are assigned permanent clothing.
The upstream OBJ is not distributed by this application.
"""
import hashlib,json,math,pathlib,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
revision='a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
base=f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{revision}'
raw=urllib.request.urlopen(base+'/makehuman/data/3dobjs/base.obj',timeout=60).read()
assert b'explicitly released as CC0' in raw[:500]
vertices=[];faces=[];groups={};group=''
for line in raw.decode().splitlines():
    if line.startswith('v '):vertices.append(list(map(float,line.split()[1:4])))
    elif line.startswith('g '):group=line[2:]
    elif line.startswith('f '):
        ids=[int(x.split('/')[0])-1 for x in line.split()[1:]]
        if group=='body':faces.append(ids)
        elif group.startswith('joint-'):groups.setdefault(group,set()).update(ids)
scale=2.8/(8.4913+8.1676)
def normalize(p):return [round(p[0]*scale,6),round((p[1]+8.1676)*scale,6),round(p[2]*scale,6)]
def smooth(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def pose(p):
    x,y,z=p;s=1 if x>=0 else -1
    w=smooth(1.5,2.5,abs(x))*smooth(-.6,.8,y)
    angle=-s*.55*w;dx=x-s*1.35;dy=y-4.9
    return normalize([s*1.35+dx*math.cos(angle)-dy*math.sin(angle),4.9+dx*math.sin(angle)+dy*math.cos(angle),z])
positions=[pose(v) for v in vertices]
segments={k:[] for k in ['head','hands','top','trousers','shoes']}
for ids in faces:
    cx,cy,cz=[sum(vertices[i][j]for i in ids)/len(ids)for j in range(3)]
    # The final asset has no exposed private anatomical geometry.
    if abs(cx)<.8 and -1.9<cy<.4 and cz>.58:continue
    category='head' if cy>5.35 else 'hands' if abs(cx)>3.65 and cy<3 else 'shoes' if cy<-6.8 else 'trousers' if cy<1.5 else 'top'
    for j in range(1,len(ids)-1):segments[category].extend([ids[0],ids[j],ids[j+1]])
# Retain only referenced vertices and remap indices (all helper geometry is removed).
used=sorted(set(i for indices in segments.values()for i in indices));remap={v:i for i,v in enumerate(used)}
out={'positions':[c for i in used for c in positions[i]],'segments':{k:[remap[i]for i in indices]for k,indices in segments.items()},'landmarks':{k:normalize([sum(vertices[i][j]for i in ids)/len(ids)for j in range(3)])for k,ids in groups.items()if k in ['joint-l-eye','joint-r-eye','joint-mouth','joint-neck','joint-head']},'source':{'repository':'https://github.com/makehumancommunity/makehuman','revision':revision,'sha256':hashlib.sha256(raw).hexdigest(),'license':'CC0-1.0'},'presentation':'Original adult character; permanent opaque clothing; not a scan of a real person.'}
(root/'public/avatars').mkdir(exist_ok=True)
(root/'public/avatars/adult-clothed-base.json').write_text(json.dumps(out,separators=(',',':')))
(root/'licenses/MAKEHUMAN-ASSETS-CC0.md').write_bytes(urllib.request.urlopen(base+'/LICENSE.ASSETS.md',timeout=30).read())
(root/'public/avatars/ATTRIBUTION.txt').write_text('Adult base derived from the MakeHuman hm08 mesh, CC0 1.0.\nSource: '+out['source']['repository']+'\nRevision: '+revision+'\nCopyright holders at CC0 release: Data Collection AB, Joel Palmius, Jonas Hauquier (2020).\nOnly graphical data is used, not MakeHuman program code. Clothes, hair and accessories are original.\n')
print('Clothed adult vertices:',len(used),'bytes:',(root/'public/avatars/adult-clothed-base.json').stat().st_size)
print(out['landmarks'])
