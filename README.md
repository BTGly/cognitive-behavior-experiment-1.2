# jsPsych 认知行为实验 1.2

这是从 PsychoPy 本地实验迁移到 jsPsych 8 的网页版认知行为实验（1.2 版）。当前版本可在 GitHub Pages 或本地静态服务器运行，核心流程、预实验校准、正式实验生成和数据导出均在浏览器端完成。

[English](README.en.md)

- 在线实验：https://btgly.github.io/jsPsych-blur-experiment/
- 算法验证页：https://btgly.github.io/jsPsych-blur-experiment/golden-test.html

## 实验流程

```text
参数页 → 欢迎页 → 练习 → 预实验 → 个体化校准
→ 生成正式实验 block → 正式实验 → 数据 ZIP 下载
```

- 练习：F/K 判断，按住时长表示信心，逐题显示完整反馈。
- 预实验：3 组，每组 60 个 trial，用于估计被试个人难度水平。
- 校准：浏览器端执行 logistic 拟合、PAVA 单调校正和 D1-D6 alpha 选择。
- 正式实验：11 轮，每轮 100 个 trial，总计 1100 个 trial。
- 全屏：点击“开始实验”后自动请求浏览器全屏。
- 提前结束：按 `Esc` 会结束实验，并下载已有数据。

## 本地运行

仓库是纯静态网页，不需要构建。

```powershell
python -m http.server 8000 --directory .
```

然后用 Chrome 或 Edge 打开：

```text
http://localhost:8000/
```

算法相关改动后，打开：

```text
http://localhost:8000/golden-test.html
```

## 项目结构

```text
index.html                  实验入口
golden-test.html            校准算法验证页
conditions/                 条件 CSV
assets/                     刺激图片、练习/预实验数据集、manifest
styles/task.css             实验界面样式
src/main.js                 主流程编排、全屏、提前结束、数据导出
src/timeline/               欢迎、练习、预实验、正式实验 timeline
src/task/                   hold-response trial、反馈和指导语
src/calibration/            logistic、PAVA、alpha 选择、正式 trial 生成
src/data/                   数据 schema、summary、CSV/ZIP 导出
```

## 启动参数

参数页包含：

- `participant`：被试编号，例如 `S001`（必填）。
- `upload_code`：服务器上传授权码（必填）。不填无法开始实验。
- `practice_count`：练习 trial 数，默认 24，可设为 0 跳过练习。
- `start_group` / `end_group`：正式实验运行轮次，范围 1-11，支持分段实验。

注意：预实验固定运行，不可跳过。upload_code 必须填写，否则实验会阻断并提示。

如果一个被试分多次完成正式实验，可固定同一个被试编号，并设置不同轮次范围，例如 `1-2`、`3-5`、`6-8`、`9-11`。

也可以用 URL 参数预填，例如：

```text
https://btgly.github.io/jsPsych-blur-experiment/?participant=S001&start_group=1&end_group=2
```

> 注意：`upload_code` 请勿写入 URL，由被试在页面中手动输入。

## 当前数据保存方式

当前版本在实验结束或按 `Esc` 提前结束时，自动在被试电脑下载一个 ZIP。GitHub Pages 只托管静态文件，不能把数据直接写回 GitHub 仓库。

ZIP 内包含：

```text
{subject}_raw_data.csv
{subject}_pretest_alpha_summary.csv
{subject}_calibration_summary.csv
{subject}_formal_block_distribution_summary.csv
{subject}_formal_block_01.csv ... {subject}_formal_block_11.csv
{subject}_formal_schedule_source.json
```

说明：

- `raw_data.csv` 保存实际作答数据，包含练习、预实验、正式实验和提前结束标记。
- `formal_block_*.csv` 保存正式实验生成出来的 block/trial 计划和抽图结果。
- `calibration_summary.csv` 和 `pretest_alpha_summary.csv` 保存预实验校准结果。
- `formal_schedule_source.json` 审计记录，标注正式排程来源（首次生成/服务器缓存）、`formal_schedule_hash` 等。

正式被试的完整正式排程（formalBlocks）会保存到服务器。再次实验时直接读取服务器缓存，不重新抽图或分块。

## 自动上传后端

当前仓库包含一个最小 FastAPI 上传后端，位于 `server/upload-api/`。设计原则是“ZIP 文件落盘 + SQLite 索引”：浏览器结束实验后先下载本地 ZIP，再在填写 `upload_code` 时把同一个 ZIP 上传到服务器。

已部署结构建议：

```text
/opt/blur-exp/
  app/                    FastAPI 代码
  data/experiment.sqlite3 SQLite 索引
  storage/subjects/       每个被试的 ZIP 和 manifest
  docker-compose.yml
  .env                    UPLOAD_TOKEN，不能提交到 GitHub
```

服务器保存结构：

```text
subjects/
  S001/
    sessions/
      S001_2026-06-27_15h30m20s_start1_end2/
        raw/
          S001_2026-06-27_15h30m20s_start1_end2.zip
        manifest.json
```

上传接口：

```http
POST https://exp-api.cognitive-testing.cn/api/upload-session
```

前端默认 API 基础地址：

```text
https://exp-api.cognitive-testing.cn
```

注意：GitHub Pages 页面是 HTTPS，上传 API 也必须使用 HTTPS，否则浏览器会拦截 mixed content。

## 备用方案

如果网页版无法运行，可下载 Windows 本地版：

> **下载**：[认知行为实验 1.2 本地版](https://github.com/BTGly/jsPsych-blur-experiment/releases/tag/v1.2-fallback)（283 MB，解压后运行 `双击开始实验.exe`）
>
> 仅 Windows 系统可用，不需要安装 Python，解压即用。

## 部署

推送到 GitHub 后，在仓库 Settings → Pages 中启用 GitHub Pages，来源选择 `master` 分支根目录。

当前代码依赖 CDN 加载 jsPsych、PapaParse 和 JSZip，因此实验电脑需要能访问对应 CDN。
