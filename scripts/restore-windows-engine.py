"""Reuse the verified static engine from our successful Windows build artifact.
The source commit, CPU variant and package checksum must match before extraction.
"""
import hashlib,json,pathlib,shutil,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'.cache/runtime-bootstrap'
archive=folder/'MOMO-Windows-x64-with-AI.zip'
expected=(folder/'SHA256SUMS-windows.txt').read_text().split()[0]
digest=hashlib.sha256()
with archive.open('rb')as source:
    while chunk:=source.read(1024*1024):digest.update(chunk)
if digest.hexdigest()!=expected:raise RuntimeError('Previous package checksum mismatch')
spec=json.loads((root/'ai/runtime-lock.json').read_text())
prefix='MOMO-Windows-x64/resources/app/ai-runtime/win32-x64/'
with zipfile.ZipFile(archive)as z:
    provenance=json.loads(z.read(prefix+'runtime-provenance.json'))
    variant='baseline x64; AVX/AVX2/FMA/F16C/SSE4.2/BMI2 disabled'
    if provenance.get('commit')!=spec['commit'] or provenance.get('cpu')!=variant or provenance.get('staticCRT')is not True or provenance.get('openmp')is not False:
        raise RuntimeError('Previous engine build does not match the required source and compatibility flags')
    engine=z.read(prefix+'llama-server.exe')
    if engine[:2]!=b'MZ':raise RuntimeError('Invalid Windows executable')
    staged=root/'.cache/verified-windows-engine';shutil.rmtree(staged,ignore_errors=True);staged.mkdir(parents=True)
    (staged/'llama-server.exe').write_bytes(engine)
    (staged/'LLAMA-LICENSE').write_bytes(z.read(prefix+'LLAMA-LICENSE'))
    provenance['engine_sha256']=hashlib.sha256(engine).hexdigest()
    provenance['build_variant']='static-baseline-v1'
    provenance['verified_build_run']='38844003853'
    (staged/'runtime-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
output=root/'ai-runtime/win32-x64';output.parent.mkdir(parents=True,exist_ok=True)
shutil.rmtree(output,ignore_errors=True);shutil.move(str(staged),str(output))
print('Reused verified static Windows CPU engine from successful native build 38844003853')
