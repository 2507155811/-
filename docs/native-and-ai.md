# 原生运行与轻量 AI

## 模型选择

电脑和安卓共用 **Qwen2.5-0.5B-Instruct / Q4_K_M GGUF**，推理由 llama.cpp 执行。

- 官方模型：https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
- 许可：Apache-2.0，已获取官方 LICENSE，保存在 `ai/QWEN-MODEL-LICENSE`。
- 权重大小：491,400,032 字节（约 469 MiB）。
- 固定版本：`9217f5db79a29953eb74d5343926648285ec7e67`。
- SHA-256：`74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`。
- llama.cpp 源码版本见 `ai/runtime-lock.json`，MIT 许可见 `ai/LLAMA-LICENSE`。

这是轻量中文对话模型，不是照片重建模型。输出不会自动执行应用操作。聊天记录和手动记忆独立保存；推理仅选取有限近期上下文与记事，不删除完整历史。

## 当前验证边界

已在 Linux 构建电脑 CPU 推理引擎，以及 Android arm64 JNI 引擎，并构建调试 APK。电脑原生冒烟检查和网页测试通过。没有取得模型权重，未执行真实模型推理，也未测量手机推理速度、功耗或温升。

Hugging Face 官方元数据和许可证已可访问，但二进制重定向目标 `us.aws.cdn.hf.co` 的 CONNECT 请求仍返回 403。网络草稿已经加入所需域名；保存草稿不代表运行时网络已更新。需要在环境设置审阅、保存并发布后，再重试 `npm run ai:model`。

## 准备与打包

使用 Node.js 24+、Python 3、Git、CMake 和 C++ 编译器。

```sh
npm ci
npm run ai:source
npm run ai:engine
npm run ai:model
```

模型下载脚本固定上游版本并校验 SHA-256，保留许可证；不关闭 TLS 或校验。权重保存在被 Git 忽略的 `ai-assets/`，引擎在 `ai-runtime/<platform>-<arch>/`。

### 电脑

```sh
npm run desktop
npm run desktop:package
```

`desktop` 启动 Electron 控制面板，可在偏好设置显示透明宠物窗口、置顶、鼠标穿透和托盘入口。面板和宠物使用同一来源、同一用户存储；跨窗口更新不会通过重载清除正在输入的内容。

打包命令生成当前操作系统的应用目录；Windows/macOS 应在对应系统构建引擎和应用。本次只验证 Linux 的 Electron 内容与 IPC；无桌面合成器的测试不能验证 Windows/macOS 的透明、置顶和托盘外观。未制作已签名的 Windows/macOS 安装程序。

没有权重时，可以显式构建 UI 验证版本：

```sh
npm run desktop:package:ui
```

此版本包含引擎接口，不包含模型；可以从控制面板手动选择已有 GGUF。`desktop:package` 默认要求权重存在且通过校验，避免误发“内置 AI”空壳。

### 安卓

要求 JDK 21（包含 javac）、Android SDK 35、Build Tools 35.0.0、NDK 27.2.12479018、CMake 3.22.1，最低 Android 8，arm64。

```sh
export ANDROID_HOME=/path/to/android-sdk
npm run android:build
```

模型随 APK 资源打包，首次点击“准备 / 选择模型”时校验并复制到私有存储；首次安装准备需要额外约 469 MiB，安装包和私有权重合计约 1 GiB。准备后不需要网络，空闲不推理。正式发布仍需自己的签名和目标设备测试。

UI 验证包（明确不含权重）：

```sh
npm run android:build:ui
```

输出在 `android/app/build/outputs/apk/debug/app-debug.apk`。本次环境工具路径：JDK `/workspace/toolchains/jdk21`，SDK `/workspace/toolchains/android`。机器上的 Gradle 缓存可通过 `GRADLE_USER_HOME=/workspace/.gradle` 指定。

安卓实现了用户授权后的悬浮服务、拖动、通知栏收起和息屏暂停。应用不申请唤醒锁，不添加开机启动。未在小米真机上确认后台策略、授权和实际悬浮显示；无障碍自动化尚未实现。

## 节能设计

- 自定义模型限制 10 万顶点与约 96 MiB 贴图内存，避免导入高负载外观；自带动画每次只播放一组，可手动切换或停止。
- 新用户默认 15 FPS。渲染使用低频定时调度；息屏、不可见、切换页面、AI 忙碌时停止调度。
- 关闭动态后仅交互或相机变化时重绘，不维持动画循环。
- 没有专注或待办截止时间时没有每秒任务轮询；隐藏的计时界面只安排截止时间唤醒。
- 悬浮宠物不初始化完整待办调度器或 AI 状态面板。
- 推理仅手动触发；CPU 至多 2 线程、上下文 2048、至多 128 输出 token、生成超时 60 秒，空闲 30 秒卸载模型。
- 安卓省电模式降到 1 线程、64 token；中度及以上发热时拒绝/中止推理。进入后台取消本次推理。
- 电脑锁屏或休眠时取消推理并通知窗口暂停渲染。
- 安卓 C++ 引擎即使在调试 APK 内也以 Release/O3 编译，避免调试内核造成额外 CPU 消耗。

这些是实现与自动化检查，不是电池续航数据。不要承诺未经真机测量的耗电百分比。

## 真机验收

在目标小米手机上分别测：关闭宠物的基线、15 FPS 悬浮待机、息屏、单轮对话和连续对话。使用相同亮度、网络和环境温度，重复对照。

```sh
adb shell dumpsys meminfo com.momo.companion
adb shell dumpsys gfxinfo com.momo.companion
adb shell dumpsys batterystats com.momo.companion
adb shell dumpsys thermalservice
```

核对息屏没有持续绘制、没有唤醒锁、空闲后模型内存下降、连续请求可停止、热保护生效，并记录实际耗电/温升。真实模型下载完成后，必须补上中文响应、停止、连续对话和双端结果验证。

## 照片与任务范围

按用户最新选择，暂不实现照片生成 3D，保留本地参考预览与已有 GLB/GLTF 导入，不加入额外生成模型。淘宝/京东任务仍待实际活动页适配与真机授权验证。
