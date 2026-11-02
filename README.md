# Echo 考研政治 AI 学习平台

打开网址就能学的考研政治学习网站：**不需要登录、注册、手机号、邮箱、验证码、会员或安装 App**。手机浏览器、电脑浏览器、微信内置浏览器均可直接使用，学习记录保存在你自己的浏览器里。

题库沿用原项目的 **2007—2026 年 760 道真题**（单选 320 / 多选 340 / 分析 100），覆盖 7 个学科、53 个专题；知识点库由题库中的真实「专题 + 知识点 + 解析」派生，共 **663 个知识点**，不编造题目和答案。

## 功能

| 模块 | 说明 |
| --- | --- |
| 首页 | 今日学习、7 个学科入口、历年真题、选择题练习、模拟考试、AI 答疑、错题本、收藏夹、学习统计等 16 个入口 |
| 政治知识点 | 按学科 / 章节 / 知识点浏览，关键词搜索，收藏、重点标记、最近学习，关联知识点推荐，直接跳转相关真题 |
| 刷题 | 单选、多选、分析题；按学科 / 题型 / 年份 / 专题 / 关键词筛选；随机、顺序、每日、专项练习；自动判分与原题库解析 |
| AI 智能答疑 | 输入问题，服务端检索真实知识库后调用 DeepSeek，中文分点回答；未配置 API Key 时给出明确提示，不影响其他功能 |
| AI 题目解析 | 每道题的解析区都有「让 AI 讲讲」，结合原题库解析逐项辨析选项、串联考点、给出记忆提示 |
| 错题本 | 答错自动收录，按学科 / 题型筛选，连续答对两次进入「已掌握」，支持重练 |
| 收藏夹 | 收藏题目与知识点，分类查看、搜索、取消收藏 |
| 模拟考试 | 选择范围与题型、自动组卷、倒计时、答题卡、暂存答案、自动评分、逐题报告、AI 解析入口 |
| 我的 | 本机学习统计、存储状态检测、学习记录导出 / 导入 / 清空、最近知识点与模考记录 |
| PWA | 可添加到手机桌面（Android / iOS Safari），不强制安装 |

## 本地运行

要求 Node.js **20.19+**（推荐 22 LTS）。

```bash
npm install
npm run dev        # 开发模式：http://localhost:5173
```

生产模式：

```bash
npm run build      # 类型检查 + 构建前端 + 复制 Node 服务到 dist/
npm start          # http://localhost:8000
```

`npm run build` 会同时产出：

- `dist/`：前端静态文件（`index.html`、`assets/`、`data/questions.json`、图标、manifest、Service Worker）
- `dist/server.mjs` + `dist/api.mjs`：无第三方依赖的 Node 20 服务器，同时提供静态页面和 `/api` 接口

## 配置 DeepSeek API Key

AI 功能需要服务端环境变量 `DEEPSEEK_API_KEY`。**密钥只在服务端读取，前端代码和浏览器里都拿不到。**

Windows PowerShell（临时生效，关闭窗口即失效）：

```powershell
$env:DEEPSEEK_API_KEY = "sk-你的DeepSeek密钥"
npm run dev        # 或 npm run build; npm start
```

可选环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/chat/completions` | 接口地址 |
| `AI_RATE_WINDOW_MIN` | `10` | 限流窗口（分钟） |
| `AI_RATE_MAX` | `8` | 单 IP 每窗口次数 |
| `AI_DAILY_MAX` | `60` | 单 IP 每日次数 |
| `AI_GLOBAL_DAILY_MAX` | `400` | 全站每日总次数 |

没有配置 Key 时，首页、知识点、题库、刷题、错题本、收藏夹、模拟考试都能正常使用；AI 页面显示「AI 功能尚未启用」，不会报错或白屏。

健康检查：`GET /api/health` 返回 `{ "ok": true, "ai": true/false }`。

## 部署到公网

推荐使用 Trae 的「一键部署」插件（FunctionWeb / Node.js 20）：

| 配置项 | 值 |
| --- | --- |
| 运行时 | FunctionWeb，nodejs20 |
| build.sh | `build.sh` |
| output_dir | `dist` |
| start_script | `dist/run.sh` |
| 端口 | `8000` |
| 可见性 | public |
| 环境变量 | `DEEPSEEK_API_KEY`（可选；不配置则 AI 暂不可用，其他功能正常） |

`build.sh` 会执行 `npm ci`、`npm run build`，并把 `run.sh` 复制进 `dist/`；`run.sh` 会切到自身目录后执行 `node server.mjs`，所以无论部署平台在哪个目录启动都能找到服务。

服务器只依赖 Node 标准库，不需要数据库、Redis 或额外进程。部署后必须用手机浏览器和微信打开正式 HTTPS 网址复测。

## 学习记录与隐私

- 记录存在 **IndexedDB**（库名 `echo-politics`），并在 `localStorage` 保留同步缓存。
- 保存内容：答题记录、错题、收藏（题目 / 知识点）、知识点重点标记与最近学习、模拟考试记录、练习统计。
- 刷新、关闭浏览器再打开，记录仍在；换手机或换浏览器不会自动同步。
- 「我的 → 导出学习记录」生成 JSON 备份；「导入」可恢复；「清空」需二次确认。
- 清理浏览器站点数据会删除记录，清理前请先导出。

## 目录结构

```
temp_20261102_02/
├── index.html                 # 标题、PWA manifest、首屏主题脚本
├── package.json
├── vite.config.ts             # 构建配置 + 开发环境 /api 中间件
├── tsconfig.json
├── build.sh                  # 一键部署构建脚本（npm ci + build + 复制 run.sh）
├── run.sh                    # 线上启动脚本（node server.mjs）
├── public/
│   ├── data/questions.json    # 760 道真题（原项目数据）
│   ├── assets/                # 原卷配图
│   ├── favicon.svg
│   ├── icon-192.png           # PWA 图标
│   ├── icon-512.png
│   ├── manifest.webmanifest
│   └── sw.js                  # Service Worker（不缓存 API 与题库）
├── scripts/
│   └── copy-server.mjs        # 把 Node 服务复制进 dist/
├── server/
│   ├── api.mjs                # DeepSeek 代理、限流、输入限制、错误映射
│   └── index.mjs              # 生产静态服务器 + /api + SPA 回退
├── src/
│   ├── main.tsx               # 入口、样式、Service Worker 注册
│   ├── App.tsx                # 路由（hash 路由）
│   ├── components/
│   │   ├── shell/             # 侧栏、顶栏、手机底部导航
│   │   ├── question/          # 题目卡、判分、解析、AI 入口
│   │   └── ui/                # 基础组件
│   ├── lib/
│   │   ├── data.ts            # 题库加载与学科元数据
│   │   ├── idb.ts             # IndexedDB 封装
│   │   ├── knowledge.ts       # 知识点索引
│   │   ├── ai.ts              # AI 请求、知识库检索与上下文拼装
│   │   ├── storage.ts         # 本地存储、导入导出
│   │   ├── stats.ts / utils.ts
│   │   └── types.ts
│   ├── pages/                 # 首页 / 知识点 / 刷题 / 整卷 / 模拟考试 / AI / 错题 / 收藏 / 分析 / 我的 / 设置
│   ├── store/StudyProvider.tsx
│   └── styles/                # tokens.css（白蓝主题）、global.css、echo.css
└── dist/                      # 构建产物（不提交）
```

## 题库与内容边界

题库来自 [Nishino0525Nanase/kaoyan-politics](https://github.com/Nishino0525Nanase/kaoyan-politics)，题干与选项依公开试卷转录；解析与学习提示为整理内容，并非官方评分细则。历史真题保留考试当年的时政与表述语境，复习时请结合现行考纲。

分析题不计入客观题正确率，未作答的分析题不自动判分。AI 回答基于题库材料与通行教材表述，材料未覆盖时会明确提示核对教材，不编造真题、答案或文件原文。

## 已验证

- `npx tsc --noEmit`、`npm run build` 通过
- 生产服务器 `/`、`/api/health`、manifest、Service Worker、图标、题库 JSON 均返回 200
- 首页、知识点、刷题、AI（无 Key 降级）、模拟考试、错题本、收藏夹、我的（刷新后记录保留）均已在浏览器实测
