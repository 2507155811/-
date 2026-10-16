"""Fetch a pinned official GGUF and verify its LFS SHA-256 before use."""
import json, pathlib, urllib.request, hashlib, os
root=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((root/'ai/runtime-lock.json').read_text())['model']
repo=spec['repository'];name=spec['file'];dest=root/'ai-assets';dest.mkdir(exist_ok=True)
def get_json(url):
    with urllib.request.urlopen(url,timeout=60) as response:return json.load(response)
meta=get_json(f'https://huggingface.co/api/models/{repo}/revision/{spec["revision"]}?blobs=true')
revision=meta['sha'];entry=next(f for f in meta['siblings'] if f['rfilename']==name)
expected=spec['sha256']
if entry['lfs']['sha256']!=expected:raise RuntimeError('Official metadata changed; review pinned model before updating')
revision=spec['revision']
if len(expected)!=64:raise RuntimeError('Invalid pinned checksum')
url=f'https://huggingface.co/{repo}/resolve/{revision}/{name}'
target=dest/name;partial=target.with_suffix('.partial')
try:
    digest=hashlib.sha256()
    with urllib.request.urlopen(url,timeout=120) as response,partial.open('wb') as output:
        while chunk:=response.read(1024*1024):digest.update(chunk);output.write(chunk)
    if digest.hexdigest()!=expected:raise RuntimeError('Model checksum mismatch')
    if partial.open('rb').read(4)!=b'GGUF':raise RuntimeError('Not a GGUF model')
    # Retain the exact upstream license with any redistributable model asset.
    urllib.request.urlretrieve(f'https://huggingface.co/{repo}/resolve/{revision}/LICENSE',dest/'MODEL-LICENSE')
    os.replace(partial,target)
    (dest/'manifest.json').write_text(json.dumps({'repository':repo,'revision':revision,'file':name,'sha256':expected,'license':spec['license']},indent=2)+'\n')
    print('Verified model prepared:',name)
finally:
    if partial.exists():partial.unlink()
