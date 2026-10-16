"""Prepare official Windows llama.cpp CPU binaries using the published release digest."""
import hashlib
import json
import pathlib
import urllib.request
import zipfile
root=pathlib.Path(__file__).resolve().parents[1]
lock=json.loads((root/'ai/windows-runtime-lock.json').read_text())
cache=root/'.cache/windows-runtime.zip';cache.parent.mkdir(parents=True,exist_ok=True)
def sha(file):
    h=hashlib.sha256()
    with file.open('rb')as source:
        while chunk:=source.read(1024*1024):h.update(chunk)
    return h.hexdigest()
if not cache.exists()or sha(cache)!=lock['archive_sha256']:
    urllib.request.urlretrieve(lock['source'],cache)
if sha(cache)!=lock['archive_sha256']:raise RuntimeError('Official Windows runtime checksum mismatch')
output=root/'ai-runtime/win32-x64';output.mkdir(parents=True,exist_ok=True)
required={'llama-server.exe','llama-server-impl.dll','llama-common.dll','llama.dll','mtmd.dll','ggml.dll','ggml-base.dll','ggml-rpc.dll','libomp.dll'}
with zipfile.ZipFile(cache)as archive:
    found=set()
    for name in archive.namelist():
        file=pathlib.PurePosixPath(name).name
        if file in required or(file.startswith('ggml-cpu-')and file.endswith('.dll')):
            (output/file).write_bytes(archive.read(name));found.add(file)
    if not required.issubset(found):raise RuntimeError('Required runtime components missing')
for file in output.iterdir():
    if file.suffix.lower()in('.exe','.dll')and file.name not in found:file.unlink()
urllib.request.urlretrieve(f'https://raw.githubusercontent.com/ggml-org/llama.cpp/{lock["release"]}/LICENSE',output/'LLAMA-LICENSE')
(output/'runtime-provenance.json').write_text(json.dumps(lock,indent=2)+'\n')
print('Windows x64 CPU runtime verified and prepared:',lock['release'])
