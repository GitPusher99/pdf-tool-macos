# Linkly AI Desktop v3 架构分析

这是一个基于 **Tauri 2 + React 19 + Rust** 的桌面文档搜索应用，类似 macOS Spotlight，但专注于文档内容的全文搜索和语义搜索。

---

## 技术栈总览

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · TypeScript 5.8 · Tailwind CSS v4 · shadcn/ui |
| **桌面框架** | Tauri 2（跨平台） |
| **后端** | Rust（Edition 2021） |
| **全文搜索** | Tantivy（BM25 + CJK 分词） |
| **向量搜索** | llama.cpp + Qwen3-Embedding-0.6B |
| **数据库** | LibSQL |
| **AI 协议** | MCP（Streamable HTTP） |
| **国际化** | i18next（en / zh） |

---

## 多窗口架构

项目采用 **3 个独立 WebView 窗口**，各自有独立的 Vite 入口：

1. **Launcher**（780x500）— 全局搜索弹窗，Spotlight 风格
2. **Settings**（800x600）— 设置面板，7 个标签页
3. **Onboarding**（600x480）— 首次运行向导

三个窗口通过 `@shared/` 共享 UI 组件、Hooks、类型定义和 i18n。

---

## 目录结构

```
linkly-ai-desktop-v3/
├── src/                              # 前端源代码（React）
│   ├── windows/                      # 三个独立窗口
│   │   ├── launcher/                 # 全局搜索弹窗（always-on-top）
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── index.html
│   │   │   ├── components/           # DragHeader, SearchResults, PreviewView 等
│   │   │   └── hooks/                # use-search, use-search-history
│   │   │
│   │   ├── settings/                 # 设置面板
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── index.html
│   │   │   └── components/           # GeneralSettings, AISettings, McpSettings 等
│   │   │
│   │   └── onboarding/               # 首次运行向导
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── index.html
│   │       └── components/
│   │
│   ├── shared/                       # 跨窗口共享代码（@shared）
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui 组件（21个）
│   │   │   ├── common/               # LinklyAILogo 等
│   │   │   └── icons/                # DocTypeIcon
│   │   ├── hooks/                    # use-config, use-theme, use-mobile, use-dev-menu
│   │   ├── lib/                      # commands, events, types, utils
│   │   ├── i18n/                     # i18next 配置 + en/zh 翻译文件
│   │   └── assets/
│   │
│   └── styles/                       # 全局样式 + 主题 CSS 变量
│
├── src-tauri/                        # Rust 后端源代码
│   ├── src/
│   │   ├── main.rs                   # 程序入口
│   │   ├── lib.rs                    # 核心初始化编排（322行）
│   │   ├── commands.rs               # 22 条 Tauri IPC 命令
│   │   ├── config.rs                 # AppConfig 持久化管理
│   │   ├── scanner.rs                # 文件递归扫描
│   │   ├── watcher.rs                # 文件系统监听（FSEvents/inotify）
│   │   ├── scan_state.rs             # 扫描状态机
│   │   ├── search/                   # 全文搜索模块
│   │   │   ├── mod.rs                # SearchService（BM25）
│   │   │   ├── schema.rs             # Tantivy Schema（CJK 分词）
│   │   │   ├── indexer.rs            # 索引管道
│   │   │   └── hybrid.rs             # 混合搜索（RRF 融合）
│   │   ├── embedding/                # 向量搜索模块
│   │   │   ├── mod.rs                # EmbeddingService（延迟加载模型）
│   │   │   ├── indexer.rs            # 嵌入管道
│   │   │   └── compose.rs            # 向量合成
│   │   ├── extractor/                # 文档解析器
│   │   │   ├── mod.rs                # 分发器
│   │   │   ├── pdf.rs                # PDF（pdfium-render）
│   │   │   ├── docx.rs               # DOCX（quick-xml）
│   │   │   ├── html.rs               # HTML（htmd）
│   │   │   ├── metadata.rs           # 元数据提取
│   │   │   ├── yake.rs               # YAKE 关键词提取
│   │   │   └── outline/              # 文档大纲提取（PDF/MD/TXT）
│   │   ├── mcp/                      # MCP 服务器模块
│   │   │   ├── mod.rs                # McpState、启动/停止
│   │   │   ├── handler.rs            # 请求处理器
│   │   │   ├── tools.rs              # search/outline/read 三个工具
│   │   │   └── templates.rs          # 响应模板
│   │   ├── window.rs                 # 窗口管理
│   │   ├── tray.rs                   # 系统托盘菜单
│   │   ├── updater.rs                # 自动更新
│   │   └── logger.rs                 # 日志系统
│   │
│   ├── resources/                    # PDFium 动态库 + 数据库迁移
│   ├── capabilities/                 # Tauri 安全能力配置
│   ├── icons/                        # 应用图标
│   ├── tauri.conf.json               # Tauri 配置
│   └── Cargo.toml                    # Rust 依赖
│
├── scripts/                          # release.sh, upload-to-r2.sh
├── .github/workflows/                # CI/CD（跨平台构建）
├── vite.config.ts                    # Vite 多入口配置
├── vitest.config.ts                  # 测试配置
├── tsconfig.json                     # TypeScript 严格模式
├── components.json                   # shadcn/ui 配置
└── package.json                      # v0.1.4
```

---

## Rust 后端核心模块

```
src-tauri/src/
├── lib.rs            # 核心初始化编排（依赖注入、事件链、后台任务）
├── commands.rs       # 22 条 Tauri IPC 命令
├── config.rs         # AppConfig 持久化管理
├── scanner.rs        # 文件递归扫描（PDF/DOCX/MD/HTML/TXT）
├── watcher.rs        # 文件系统监听（FSEvents/inotify）
├── search/           # BM25 全文搜索 + 混合排名（RRF 融合）
├── embedding/        # 向量搜索（Qwen3-Embedding，延迟加载）
├── extractor/        # 多格式文档解析 + YAKE 关键词 + 大纲提取
├── mcp/              # MCP 服务器（search/outline/read 三个工具）
├── window.rs         # 窗口管理
├── tray.rs           # 系统托盘
└── updater.rs        # 自动更新
```

---

## 事件驱动数据流

```
启动 → 配置初始化 → 文件扫描
                        ↓
              scan:completed 事件
                        ↓
              Tantivy BM25 索引构建
                        ↓
              index:completed 事件
                        ↓
         向量 Embedding 管道（如果启用）
                        ↓
              搜索就绪 → Launcher 可用
```

### 事件类型

| 事件名 | 说明 |
|--------|------|
| `launcher:shown` / `launcher:hidden` | 搜索弹窗显示/隐藏 |
| `config:changed` | 配置变更 |
| `scan:status-changed` | 扫描状态变化 |
| `index:completed` | 索引构建完成 |
| `mcp:status-changed` | MCP 服务状态变化 |
| `updater:status-changed` | 更新状态变化 |

---

## 搜索架构

### BM25 全文搜索

- **引擎**：Tantivy
- **分词**：tantivy-jieba（支持 CJK）
- **字段加权**：title (3x) > filename (2x) > content (1x) > path (0.5x)
- **索引字段**：title, filename, content, path, doc_id, doc_type, modified_at

### 向量搜索

- **模型**：Qwen3-Embedding-0.6B（Q8_0 量化，~640MB）
- **推理**：llama.cpp
- **维度**：1024
- **加载策略**：延迟加载，首次搜索时初始化

### 混合排名

- **算法**：RRF（Reciprocal Rank Fusion）
- **融合**：BM25 分数 + Vector 分数 → 统一排序

---

## 文档解析支持

| 格式 | 解析库 | 功能 |
|------|--------|------|
| PDF | pdfium-render | 文本提取 + 书签大纲 |
| DOCX | quick-xml | XML 解析提取文本 |
| HTML | htmd | HTML → 纯文本 |
| Markdown | pulldown-cmark | 标题提取为大纲 |
| TXT | 内置 | 直接读取 |

附加功能：
- **YAKE 关键词提取**：无监督关键词提取算法
- **元数据提取**：关键词、摘要、字数、创建时间

---

## MCP 服务器

通过 rmcp crate 实现 Streamable HTTP 协议，提供三个工具：

| 工具 | 功能 |
|------|------|
| `search` | 关键词搜索，返回文档 + 上下文片段 |
| `outline` | 批量获取文档元数据 + 大纲结构 |
| `read` | 分页读取文档完整内容（offset/limit） |

可作为 Claude、ChatGPT 等 AI 工具的本地知识库后端。

---

## 前端共享模块

### UI 组件（shadcn/ui，21个）

button, input, dialog, command, sidebar, scroll-area, sheet, badge, tooltip, sonner 等

### 共享 Hooks

| Hook | 功能 |
|------|------|
| `use-config` | 配置管理（读取/更新 AppConfig） |
| `use-theme` | 主题切换（light/dark/system） |
| `use-mobile` | 响应式布局检测 |
| `use-dev-menu` | 开发菜单控制 |

### IPC 命令（22条）

窗口控制、配置管理、扫描触发、搜索查询、MCP 管理、更新检查、快捷键注册等。

---

## 构建与发布

### 开发

```bash
pnpm tauri dev       # Vite HMR (port 1420) + Tauri 热重载
pnpm dev             # 仅 Vite dev server
pnpm test            # Vitest 单元测试
pnpm typecheck       # tsc --noEmit 类型检查
```

### 构建

```bash
pnpm build           # 类型检查 + 前端构建
pnpm tauri build     # 生成平台安装包（DMG/NSIS/AppImage）
```

### CI/CD

- GitHub Actions 跨平台并行构建（macOS ARM64 / Windows / Linux）
- 产物上传至 Cloudflare R2
- 自动更新服务器：`https://updater.linkly.ai/v3/latest.json`

### Tauri 插件

- tauri-plugin-opener：打开文件
- tauri-plugin-dialog：文件对话框
- tauri-plugin-shell：执行 shell
- tauri-plugin-global-shortcut：全局快捷键
- tauri-plugin-autostart：开机启动
- tauri-plugin-updater：自动更新
- tauri-plugin-process：进程管理
- tauri-plugin-devtools：开发工具（仅 debug）

---

## 路径别名

| 别名 | 路径 |
|------|------|
| `@shared/*` | `src/shared/*` |
| `@launcher/*` | `src/windows/launcher/*` |
| `@settings/*` | `src/windows/settings/*` |
| `@onboarding/*` | `src/windows/onboarding/*` |

---

## 项目规模

| 指标 | 数值 |
|------|------|
| 前端源文件 | ~64 个 (.tsx/.ts) |
| 后端源文件 | ~33 个 (.rs) |
| UI 组件 | 21 个 (shadcn/ui) |
| 独立窗口 | 3 个 |
| IPC 命令 | 22 条 |
| 事件类型 | 8 个 |
| 文档格式 | 5 种 |
| 国际化语言 | 2 种 (en/zh) |
| 当前版本 | 0.1.4 |

---

## 架构亮点

1. **双引擎搜索**：BM25 + 向量 → 混合排名（RRF），兼顾精确匹配和语义理解
2. **MCP 支持**：可作为 Claude/ChatGPT 的本地知识库后端
3. **多格式解析**：PDF、DOCX、Markdown、HTML、TXT 一站式支持
4. **完全本地化**：所有数据和模型在本地运行，无需云服务
5. **事件驱动**：扫描 → 索引 → 嵌入，链式异步处理
6. **多窗口隔离**：三个独立 WebView，共享代码通过别名引用
7. **生产就绪**：自动更新、系统托盘、全局快捷键、macOS 原生集成
