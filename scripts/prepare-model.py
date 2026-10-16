"""Fetch a pinned official GGUF and verify SHA-256 before use; reuse valid files."""
import hashlib
import json
import os
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
spec = json.loads((root / "ai/runtime-lock.json").read_text())["model"]
repo, name, revision = spec["repository"], spec["file"], spec["revision"]
expected = spec["sha256"]
if len(expected) != 64:
    raise RuntimeError("Invalid pinned checksum")
dest = root / "ai-assets"
dest.mkdir(exist_ok=True)
target, partial = dest / name, (dest / name).with_suffix(".partial")


def digest_file(file):
    digest = hashlib.sha256()
    with file.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def finish():
    license_file = dest / "MODEL-LICENSE"
    if not license_file.exists():
        urllib.request.urlretrieve(
            f"https://huggingface.co/{repo}/resolve/{revision}/LICENSE", license_file
        )
    (dest / "manifest.json").write_text(json.dumps({
        "repository": repo, "revision": revision, "file": name,
        "sha256": expected, "license": spec["license"]
    }, indent=2) + "\n")


if target.exists() and target.stat().st_size == spec["bytes"] and digest_file(target) == expected:
    finish()
    print("Reused verified model:", name)
else:
    with urllib.request.urlopen(
        f"https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true", timeout=60
    ) as response:
        meta = json.load(response)
    entry = next(f for f in meta["siblings"] if f["rfilename"] == name)
    if entry["lfs"]["sha256"] != expected:
        raise RuntimeError("Official metadata changed; review pinned model before updating")
    url = f"https://huggingface.co/{repo}/resolve/{revision}/{name}"
    try:
        digest = hashlib.sha256()
        with urllib.request.urlopen(url, timeout=120) as response, partial.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
        if partial.stat().st_size != spec["bytes"] or digest.hexdigest() != expected:
            raise RuntimeError("Model checksum or size mismatch")
        with partial.open("rb") as source:
            if source.read(4) != b"GGUF":
                raise RuntimeError("Not a GGUF model")
        # Keep the official license before making the downloaded model usable.
        urllib.request.urlretrieve(
            f"https://huggingface.co/{repo}/resolve/{revision}/LICENSE", dest / "MODEL-LICENSE"
        )
        os.replace(partial, target)
        finish()
        print("Verified model prepared:", name)
    finally:
        if partial.exists():
            partial.unlink()
