# BUILD.md

项目构建与打包参考文档。

## 项目基本信息

| 字段 | 值 |
|------|-----|
| 应用名称 | PDF Reader |
| 应用标识 | `com.yangguanlin.pdf-reader` |
| 版本 | `0.1.0` |
| 技术栈 | Tauri 2 + React 19 + Rust |
| 平台 | macOS (Apple Silicon / Intel) |

## 开发命令

```bash
# Vite 开发服务器（仅前端，端口 1420）
pnpm dev

# 完整开发模式：Vite HMR + Tauri Rust 热重载
pnpm tauri dev

# 前端生产构建（TypeScript 检查 + Vite 打包）
pnpm build

# 完整打包：生成 .app 和 .dmg 安装包
pnpm tauri build
```

## 打包产物目录

| 阶段 | 输出路径 |
|------|---------|
| 前端构建 | `dist/` |
| Rust 二进制 | `src-tauri/target/release/pdf-reader` |
| App Bundle | `src-tauri/target/release/bundle/macos/PDF Reader.app/` |
| DMG 安装包 | `src-tauri/target/release/bundle/dmg/PDF Reader_0.1.0_aarch64.dmg` |

> Intel 架构的 DMG 文件名中 `aarch64` 会替换为 `x64`。

## 构建流程

执行 `pnpm tauri build` 时，完整流程如下：

```
1. pnpm build（由 tauri.conf.json 的 beforeBuildCommand 触发）
   ├── tsc          — TypeScript 类型检查
   └── vite build   — 前端打包，输出到 dist/
       ├── library 入口: src/windows/library/index.html
       └── reader 入口:  src/windows/reader/index.html

2. cargo build --release
   └── 编译 Rust 后端，输出二进制到 src-tauri/target/release/

3. Tauri Bundler
   ├── 生成 PDF Reader.app（macOS App Bundle）
   └── 生成 PDF Reader_0.1.0_{arch}.dmg（磁盘映像安装包）
```

## 关键配置文件

| 文件 | 作用 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 核心配置：应用标识、窗口定义、构建命令、bundle 设置、安全策略 |
| `src-tauri/Cargo.toml` | Rust 依赖管理：Tauri 插件、PDF 解析（lopdf）、文件监听（notify）等 |
| `vite.config.ts` | Vite 构建配置：多入口打包（library/reader）、路径别名、开发服务器设置 |
| `package.json` | Node 依赖与脚本：React、pdfjs-dist、Tailwind CSS、shadcn/ui 相关依赖 |
