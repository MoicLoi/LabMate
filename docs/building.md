# 构建说明

本项目**不使用 Gradle**，直接用 Android SDK 自带的命令行工具构建 APK。原因是：整个应用只有一个 Activity、没有第三方依赖，Gradle 的下载与配置成本远大于构建本身；而且这样能保证任何一台装了 JDK + SDK 的机器（包括 CI）都能在 30 秒内出包。

## 依赖

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18 | 运行构建/测试/打包脚本 |
| JDK | ≥ 8（推荐 21） | `javac` `jar` `keytool` |
| Android SDK | build-tools ≥ 35，platforms 任意 | `aapt2` `d8` `zipalign` `apksigner` |

SDK 定位顺序：`ANDROID_HOME` → `ANDROID_SDK_ROOT` → Windows `%LOCALAPPDATA%\Android\Sdk` → macOS `~/Library/Android/sdk`。
未安装 SDK 时可用命令行工具安装：

```bash
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "platforms;android-35"
```

## 构建

```bash
node tools/build.mjs                              # 默认 1.1.0 (code 2)
node tools/build.mjs --version-name 1.2.0 --version-code 3
```

产物：`dist/LabMate-<version>.apk`。

Windows 也可以用包装脚本：

```powershell
powershell -ExecutionPolicy Bypass -File android\build.ps1
```

## 脚本做了什么

| 步骤 | 命令 | 说明 |
| --- | --- | --- |
| 1 | `aapt2 compile --dir res -o res.zip` | 编译资源 |
| 2 | `aapt2 link ...` | 生成 base.apk（清单 + resources.arsc） |
| 3 | `javac -source 1.8 -target 1.8 -bootclasspath android.jar` | 编译 Java 与 R.java |
| 4 | `d8 --min-api 26` | 生成 classes.dex |
| 5 | `jar --update ... -C assets` | 把 `assets/www` 与 `classes.dex` 写入 APK |
| 6 | `zipalign -f 4` | 4 字节对齐 |
| 7 | `keytool` + `apksigner` | 签名并校验（v2/v3） |

### 两个 Windows 特有的坑（脚本已处理）

1. **aapt2 打不开含中文的路径**：所有构建在 `%TEMP%/labmate-android-build` 的纯 ASCII 暂存目录进行。
2. **`aapt2 -A` 写出反斜杠资源名**（`assets/www\index.html`），`AssetManager` 无法打开：因此不用 `-A`，改为用 `jar` 以正斜杠写入 assets。`jar` 在 Windows / macOS / Linux 上行为一致，因此构建脚本天然跨平台。

## 签名

默认使用 `android/labmate-debug.jks`（首次构建自动生成，口令 `android`），**仅供本地安装与测试**，不要用于正式分发。

正式分发请自备 keystore，并通过环境变量传入：

```bash
export LABMATE_KEYSTORE=/secure/release.jks
export LABMATE_KEYSTORE_PASS=******
export LABMATE_KEY_ALIAS=labmate
export LABMATE_KEY_PASS=******
node tools/build.mjs --version-name 1.1.0 --version-code 20
```

`*.jks` / `*.keystore` 已在 `.gitignore` 中忽略。

## 发布包

```bash
node tools/package-release.mjs
```

会依次：构建 APK → 组装 `dist/labmate-<version>/`（源码 + 文档 + 截图 + APK）→ 生成 `dist/labmate-<version>.zip` 与 `dist/SHA256SUMS.txt`。

`tools/zip.mjs` 是内置的极简 ZIP 写入器（deflate + CRC32），不依赖系统 `zip` 命令，Windows/Linux 行为一致。

## 测试

```bash
node tools/check.mjs          # 语法 + index.html 资源引用
node --test tests/*.test.mjs  # 12 项单元测试（LaTeX 渲染、派生列、统计、报告）
```

## CI

- `.github/workflows/ci.yml`：push/PR 时跑静态检查与单元测试（ubuntu + Node 20）。
- `.github/workflows/release.yml`：推送 `v*` 标签时，在 ubuntu 上安装 Android SDK、构建 APK、打包 zip，并创建 GitHub Release。

## 常见问题

**`aapt2: failed to open directory`（Windows）**
路径含中文。脚本已把工作目录放到 `%TEMP%`，若你自行调用 aapt2，请注意同样问题。

**`javac: 源值 8 已过时`**
只是警告。目标 API 26 的设备仍适合 Java 8 字节码；d8 会进行脱糖。

**安装时提示"应用未安装 / 签名不一致"**
手机上装过用其他证书签名的同名包。先卸载旧版，或统一使用同一 keystore。

**WebView 版本很老（Chrome < 84）**
项目已做兜底：运行时不支持 flex `gap` 时会追加 `html.no-flexgap`，用 margin 实现间距；`inset` / `dvh` 均有回退。新增样式请勿依赖这些新特性。
