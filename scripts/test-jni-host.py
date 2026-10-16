"""Run the exact Android inference C++ source with real GGUF on a Linux JVM."""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

if sys.platform != "linux":
    raise SystemExit("This host JNI test currently requires Linux, JDK, CMake and g++.")
root = pathlib.Path(__file__).resolve().parents[1]
source = root / "vendor/llama.cpp"
if not source.exists():
    raise SystemExit("Run npm run ai:source first.")
jdk = pathlib.Path(os.environ["JAVA_HOME"]) if os.environ.get("JAVA_HOME") else pathlib.Path(shutil.which("javac") or "/missing-javac").resolve().parents[1]
if not (jdk / "include/jni.h").exists():
    raise SystemExit("Set JAVA_HOME to a full JDK with JNI headers.")
build = pathlib.Path(os.environ.get("MOMO_LLAMA_HOST_BUILD", root / "vendor/llama-jni-host"))
cmake = os.environ.get("CMAKE", "cmake")

def run(args):
    subprocess.run([str(a) for a in args], cwd=root, check=True)

run([cmake,"-S",source,"-B",build,"-DCMAKE_BUILD_TYPE=Release","-DCMAKE_POSITION_INDEPENDENT_CODE=ON","-DBUILD_SHARED_LIBS=OFF","-DGGML_NATIVE=OFF","-DGGML_OPENMP=OFF","-DLLAMA_BUILD_TESTS=OFF","-DLLAMA_BUILD_EXAMPLES=OFF","-DLLAMA_BUILD_SERVER=OFF","-DLLAMA_BUILD_TOOLS=OFF","-DLLAMA_BUILD_COMMON=OFF"])
run([cmake,"--build",build,"--target","llama","-j","2"])
with tempfile.TemporaryDirectory(prefix="momo-jni-") as temp:
    output=pathlib.Path(temp)
    run([os.environ.get("CXX","g++"),"-O3","-std=c++17","-shared","-fPIC",f"-I{jdk}/include",f"-I{jdk}/include/linux",f"-I{source}/include",f"-I{source}/ggml/include",root/"android/app/src/main/cpp/momo_ai.cpp","-Wl,--start-group",build/"src/libllama.a",build/"ggml/src/libggml.a",build/"ggml/src/libggml-cpu.a",build/"ggml/src/libggml-base.a","-Wl,--end-group","-pthread","-ldl","-lm","-o",output/"libmomo_ai.so"])
    run([jdk/"bin/javac","-d",output,root/"tests/native/MomoNativePlugin.java"])
    run([jdk/"bin/java",f"-Djava.library.path={output}","-cp",output,"com.momo.companion.MomoNativePlugin",root/"ai-assets/qwen2.5-0.5b-instruct-q4_k_m.gguf"])
