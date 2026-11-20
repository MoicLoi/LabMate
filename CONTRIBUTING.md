# 参与贡献

感谢你愿意改进实验智记 LabMate。这是一个刻意保持"小"的项目：无框架、无运行时依赖、单 APK 可离线使用。提交前请确认改动符合这个方向。

## 环境

- Node.js 18+（跑测试与构建）
- JDK 8+（`javac` / `jar` / `keytool` 在 PATH）
- Android SDK：`build-tools` + 任一 `platforms/android-XX/android.jar`
  - `ANDROID_HOME` 或 `ANDROID_SDK_ROOT` 指向 SDK
  - 默认位置：Windows `%LOCALAPPDATA%\Android\Sdk`，macOS `~/Library/Android/sdk`

## 常用命令

```bash
node --test tests/*.test.mjs      # 单元测试（12 项）
node tools/build.mjs              # 构建 APK → dist/LabMate-<version>.apk
node tools/package-release.mjs    # 生成发布 zip + SHA256SUMS
```

Windows 也可以直接用 `powershell -ExecutionPolicy Bypass -File android\build.ps1`。

## 代码约定

- 前端是**纯 ES5 风格**（`var` + `function`），因为目标设备上有 Chrome 83 级别的旧 WebView；不要引入构建步骤或 npm 运行时依赖。
- 布局避免依赖 flex `gap`（旧 WebView 不支持，已有 `no-flexgap` 兜底）；新增样式请优先用 margin/padding。
- 所有用户可见文案用中文；代码注释可中英混用。
- 数据只存 `localStorage`，键名 `labmate.v1`；新增字段要能容忍旧数据（缺字段走默认值）。
- 修改 `web/` 后必须重新构建 APK，`web/` 同时是 App 的资产源。

## 提 PR 前

1. `node --test tests/*.test.mjs` 全绿；
2. `for f in web/js/*.js; do node --check "$f"; done` 无语法错误；
3. 在真机或模拟器上手动过一遍受影响页面（可用 `tools/cdp.mjs` 截图验证）；
4. 在 `CHANGELOG.md` 的 `Unreleased` 下补一条。

## 报告问题

请附上：Android 版本、WebView 版本（`chrome://version` 或应用内「更多 → 关于」）、复现步骤、截图。涉及识别不准时，请说明用的模型与图片质量。

## 分支

- `main`：可发布状态
- 功能分支：`feat/<short-name>`，修复：`fix/<short-name>`
