# jsPsych 网页版开发计划

目标：将当前 PsychoPy 本地实验重写为浏览器可运行的 jsPsych 网页实验。当前任务不是把 exe 放到 GitHub 上运行，而是把 `untitled_lastrun.py` 中的实验流程、数据结构和个体化校准逻辑迁移到 JavaScript。

Python 源码参考：

```text
D:\Myself\心理实验test\online\untitled_lastrun.py
```

Web 版执行目录：

```text
D:\Myself\心理实验test\online\jsPsych
```

## 1. 目标形态

被试端流程：

```text
打开 GitHub Pages / 本地网页链接
输入被试编号和运行参数
进入练习
进入预实验
浏览器端完成个体化校准
浏览器端生成正式实验 block
完成正式实验
下载 CSV 或上传到 DataPipe/OSF
```

部署形态：

```text
静态网页托管：GitHub Pages / GitLab Pages / Netlify / Vercel
实验框架：jsPsych
CSV 读取：PapaParse 或 d3-dsv
数据保存：先实现本地 CSV/ZIP 下载，后续再接 DataPipe/OSF
```

## 2. 当前 PsychoPy 实验核心流程

### 2.1 参数入口

当前 Python 入口参数来自 `expInfo`：

```text
participant
practice_count
start_group
end_group
run_pretest
date
```

Web 版对应实现：

```text
启动页表单
participant: 被试编号
practice_count: 默认 24
start_group: 默认 1
end_group: 默认 11
run_pretest: 默认 1；如果为 0，需要已有正式 block 数据或从浏览器缓存恢复
```

### 2.2 资源文件

当前资源：

```text
practice_data.csv
pilot_manifest.csv
pilot_dataset/csv/group_00.csv
pilot_dataset/csv/group_01.csv
pilot_dataset/csv/group_02.csv
practice_dataset/
stimuli_master_pool/
stimuli_master_pool/manifest.csv
```

Web 版要求：

```text
所有路径必须改成相对 URL
不能使用 Windows 绝对路径
不能使用 os.path
不能写本地文件夹
```

### 2.3 实验阶段

当前阶段：

```text
welcome
practice intro
practice trials
practice feedback
pretest intro
pretest 3 groups x 60 trials
pre_sigmoid calibration
formal intro
formal 11 blocks x 100 trials
formal block feedback
over
```

Web 版建议保留同样阶段，但拆成独立模块。

## 3. 建议目录结构

在 `D:\Myself\心理实验test\online\jsPsych` 下创建：

```text
jsPsych/
├── index.html
├── README.md
├── package.json
├── vite.config.js
├── assets/
│   ├── default.png
│   ├── practice_dataset/
│   ├── pilot_dataset/
│   └── stimuli_master_pool/
├── conditions/
│   ├── practice_data.csv
│   ├── pilot_manifest.csv
│   └── pic_test.csv
├── src/
│   ├── main.js
│   ├── config.js
│   ├── paths.js
│   ├── random.js
│   ├── csv.js
│   ├── preload.js
│   ├── timeline/
│   │   ├── welcome.js
│   │   ├── practice.js
│   │   ├── pretest.js
│   │   ├── formal.js
│   │   └── ending.js
│   ├── task/
│   │   ├── hold-response-trial.js
│   │   ├── feedback.js
│   │   └── instructions.js
│   ├── calibration/
│   │   ├── logistic.js
│   │   ├── monotonic.js
│   │   ├── select-alpha.js
│   │   └── formal-generator.js
│   ├── data/
│   │   ├── schemas.js
│   │   ├── summaries.js
│   │   ├── export-csv.js
│   │   └── upload.js
│   └── qc/
│       ├── checks.js
│       └── golden-tests.js
└── styles/
    └── task.css
```

## 4. Python 到 JavaScript 模块映射

| Python 逻辑 | Web 版模块 | 说明 |
|---|---|---|
| `practice_data.csv` 练习条件读取 | `timeline/practice.js` | 读取前 `practice_count` 行 |
| `pilot_manifest.csv` 和 `pilot_dataset/csv/*.csv` | `timeline/pretest.js` | 顺序执行 3 组，每组 60 trial |
| F/K 长按反应检测 | `task/hold-response-trial.js` | 自定义 jsPsych trial，监听 `keydown`/`keyup` |
| `pretest_records` | `data/schemas.js` | 浏览器内数组保存 trial 数据 |
| `fit_logistic_grid` | `calibration/logistic.js` | 精确复刻网格搜索 |
| `build_monotonic_p8_curve` | `calibration/monotonic.js` | 精确复刻 PAVA 单调校准 |
| `choose_fixed_anchor` / `choose_target_p8` | `calibration/select-alpha.js` | 选择 D1-D6 alpha |
| `formal_trials` 生成 | `calibration/formal-generator.js` | 排除预实验图片、抽正式图片 |
| `formal_block_*.csv` | 浏览器内 `formalBlocks` | 最后导出 CSV，不写本地目录 |
| `calibration_summary.csv` | `data/summaries.js` | 浏览器端生成并导出 |
| `formal_block_distribution_summary.csv` | `data/summaries.js` | 作为 QC 表导出 |

## 5. 必须精确迁移的算法

### 5.1 反应规则

当前 Python 规则：

```text
F = 3
K = 8
图片出现前不接受反应
图片出现后才启动 RT 计时
2 秒内没有按下 F/K => timeout
如果图片出现时 F/K 已被按住，要求先松开
F 和 K 同时按下不接受
按下后等待松开
最长按住 1 秒
hold_duration = min(按住时间, 1.0)
confidence_hold_s = hold_duration
confidence_rating_formal = hold_duration
confidence_bin_3level:
  < 0.3 => 1
  < 1.0 => 2
  >= 1.0 => 3
```

Web 实现注意：

```text
keydown 只记录第一次有效 F/K
keyup 确认释放
setTimeout 处理 2 秒反应超时
setTimeout 处理 1 秒最大长按
使用 performance.now() 记录毫秒级时间
RT 单位最终转换为秒，保持和 Python 数据一致
```

### 5.2 trial 时间结构

当前 Python trial：

```text
fixation/show_time: 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 秒
stimulus_ms: 200
图片出现后允许反应
图片 200ms 后消失，但反应检测继续到完成或超时
```

Web 实现：

```text
0 到 show_time: 注视点
show_time 到 show_time + 200ms: 图片 + 反应提示
200ms 后隐藏图片，只保留反应提示或空屏
反应检测从图片 onset 开始
```

### 5.3 预实验汇总

当前 Python 规则：

```text
跳过 response_timeout == 1 的 trial
按 alpha 分组
n_valid = 有效 trial 数
n_choose8 = choice_digit == 8 的数量
p8_observed = n_choose8 / n_valid
至少需要 6 个有效 alpha 点
```

输出字段：

```text
alpha
n_valid
n_choose8
p8_observed
```

### 5.4 logistic 拟合

需要精确迁移：

```text
logistic_p8(alpha, mu, sigma)
fit_logistic_grid(alpha_counts)
inv_logistic_alpha(target_p8, mu, sigma)
```

Python 当前网格：

```text
第一轮：
mu = 0.25 + i * 0.005, i=0..100
sigma = 0.02 + i * 0.002, i=0..140

第二轮：
mu_start = best_mu - 0.03
mu_end = best_mu + 0.03
sigma_start = max(0.005, best_sigma - 0.03)
sigma_end = best_sigma + 0.03
步长 0.001
```

负对数似然：

```text
nll -= k * log(p) + (n - k) * log(1 - p)
p clamp 到 [1e-6, 1 - 1e-6]
```

### 5.5 单调校准

需要迁移：

```text
beta_smooth_p8(k, n) = (k + 1) / (n + 2)
build_monotonic_p8_curve(alpha_counts)
```

算法实质是 PAVA：

```text
按 alpha 从小到大排序
每个点权重 w = n
y = beta_smooth_p8
如果前一个 block value > 后一个 block value，则合并
得到 mono_predict(alpha)
```

选择时使用：

```text
p8_pred = 0.75 * p_logistic + 0.25 * p_mono
```

### 5.6 D1-D6 正式计划

当前 `untitled_lastrun.py` 中的计划：

```text
D1 target_p8=0.05, n=82,  label_digit=3, fixed_anchor=[0.10, 0.00]
D2 target_p8=0.25, n=165, label_digit=3, target_p8
D3 target_p8=0.45, n=578, label_digit=3, target_p8
D4 target_p8=0.60, n=209, label_digit=8, target_p8
D5 target_p8=0.80, n=38,  label_digit=8, target_p8
D6 target_p8=0.95, n=28,  label_digit=8, fixed_anchor=[0.90, 1.00]
```

P8 窗口：

```text
D1: 0.00-0.18
D2: 0.18-0.32
D3: 0.36-0.52
D4: 0.48-0.64
D5: 0.68-0.82
D6: 0.82-1.00
```

选择规则：

```text
label_digit=3 只允许 alpha < 0.5
label_digit=8 只允许 alpha > 0.5
D1/D6 优先使用固定 anchor
D2-D5 选 target_gap 最小的 alpha
不允许不同 difficulty 重复 alpha
固定 anchor alpha 作为 reserved，target_p8 默认避开
如果没有候选，再启用 reserved/duplicate fallback
```

### 5.7 正式 trial 和 block 生成

当前规则：

```text
读取 stimuli_master_pool/manifest.csv
按 alpha 分组，按 rank 排序
排除所有预实验用过的 image_path
按 D1-D6 选择 alpha 和 n_trials 抽图
正式 trial 总数必须为 1100
正式图片必须无重复
正式图片与预实验图片 overlap 必须为 0
全局 shuffle
切成 11 个 block
每个 block 100 trial
每个 block 内再 shuffle
写出 block 分布 summary
```

Web 版不能写出实际文件夹，所以需要在内存中生成：

```text
formalTrials
formalBlocks
formalBlockList
formalBlockDistributionSummary
calibrationSummary
pretestAlphaSummary
```

实验结束时打包导出为 CSV/ZIP，或上传。

## 6. 数据输出设计

### 6.1 raw trial 数据

每个 task trial 至少保存：

```text
participant
date
phase
trial_index
block_id
trial_in_block
difficulty_id
difficulty_rank
alpha
label_digit
label_type
sample_type
show_time
fixation_ms
stimulus_ms
image_path
choice_key
choice_digit
manual_accuracy
decision_rt
hold_duration
confidence_hold_s
confidence_rating_formal
confidence_bin_3level
valid_response
response_timeout
early_key_down_at_start
```

### 6.2 summary 数据

需要导出：

```text
subject_id_raw_data.csv
subject_id_pretest_alpha_summary.csv
subject_id_calibration_summary.csv
subject_id_formal_block_distribution_summary.csv
subject_id_formal_block_list_runtime.csv
subject_id_formal_trials.csv
```

### 6.3 保存策略

第一阶段只做下载：

```text
实验结束自动下载 zip
中途退出前提示用户下载当前数据
定期保存到 localStorage / IndexedDB
```

第二阶段再做上传：

```text
DataPipe / OSF 上传
上传失败时回退到本地下载
每个阶段结束后尝试保存一次
```

## 7. 开发阶段计划

### V0：技术验证版

目标：验证 jsPsych、图片呈现、按键、CSV 下载、GitHub Pages 运行链路。

功能：

```text
固定 10-20 个 trial
显示注视点
显示图片 200ms
F/K 响应
记录 RT
记录 hold_duration
下载 CSV
```

验收：

```text
Chrome / Edge 中能完整跑完
RT 从图片 onset 开始计算
按住 1 秒自动确认
CSV 字段与预期一致
部署到 GitHub Pages 后图片路径正常
```

### V1：练习和预实验基础版

目标：完整读取现有条件表，完成练习和预实验。

功能：

```text
读取 practice_data.csv
读取 pilot_manifest.csv
读取 pilot_dataset/csv/group_*.csv
练习阶段支持 practice_count
预实验按 3 组 x 60 trial 顺序执行
生成 pretest_records
导出 raw_data 和 pretest_alpha_summary
```

验收：

```text
practice_count=24 时练习 24 题
run_pretest=1 时预实验 180 题
每个 alpha 有 10 次预实验
预实验图片无重复
response_timeout trial 不进入 alpha_counts
```

### V2：校准算法迁移版

目标：把 Python 个体化校准完整迁移到 JS。

功能：

```text
logistic_p8
fit_logistic_grid
beta_smooth_p8
PAVA monotonic curve
predict_p8_for_selection
choose_fixed_anchor
choose_target_p8
calibration_summary
QC 指标
```

验收：

```text
用同一份 pretest_records，JS 输出的 mu/sigma/nll 与 Python 接近或一致
JS 输出的 selected_alpha D1-D6 与 Python 一致
warning_msg 与 Python 一致
expected_auc_binary / expected_mcc 与 Python 一致
```

### V3：正式实验生成版

目标：浏览器端生成正式 block。

功能：

```text
读取 stimuli_master_pool/manifest.csv
排除 pretest image_path
按 selected_alpha 抽图
生成 1100 formal trial
全局随机后切 11 个 block
生成 block distribution summary
支持 start_group / end_group
```

验收：

```text
formal trial 总数 = 1100
11 block x 100 trial
D1=82, D2=165, D3=578, D4=209, D5=38, D6=28
正式图片无重复
正式图片与预实验 overlap = 0
block distribution summary 与 formalBlocks 实际一致
```

### V4：完整实验版

目标：完整替代 PsychoPy 本地版核心流程。

功能：

```text
完整 instruction 页面
练习反馈
预实验说明与休息
正式实验说明
正式 block 间反馈
结束页
完整 CSV/ZIP 下载
中途退出保护
localStorage/IndexedDB 恢复
```

验收：

```text
完整跑完一次实验
下载所有 summary 文件
随机抽查 raw_data、calibration、formalBlocks 互相一致
刷新页面后能提示恢复或重新开始
```

### V5：在线收数版

目标：上线给真实被试使用。

功能：

```text
GitHub Pages 部署
DataPipe/OSF 上传
上传失败回退下载
版本号写入每条数据
浏览器兼容性检测
屏幕尺寸提示
实验前资源 preload 完整性检查
```

验收：

```text
远程 URL 打开后能完整跑完
数据能上传到 OSF 或成功下载
不同被试编号不会覆盖
低网速情况下资源 preload 有明确提示
```

## 8. 关键风险和处理策略

### 8.1 浏览器按键和 PsychoPy 按键不完全等价

风险：

```text
浏览器 keydown/keyup 受焦点、输入法、系统快捷键影响
无法像 ctypes 那样持续查询物理按键状态
```

处理：

```text
实验开始后全屏
禁用文本输入焦点
自定义 hold-response trial
只接受 event.code == KeyF / KeyK
trial 开始前清空状态
如果 onset 时发现按键状态未释放，标记 early_key_down_at_start
```

### 8.2 时间精度

风险：

```text
浏览器无法保证和 PsychoPy 完全相同的帧级时序
后台标签页会降频
```

处理：

```text
使用 performance.now()
使用 requestAnimationFrame 控制呈现
要求全屏且页面保持前台
记录 actual_image_onset_ms 和 actual_image_offset_ms
导出 timing diagnostics
```

### 8.3 图片资源体积

风险：

```text
stimuli_master_pool 图片多，GitHub Pages 首次加载慢
一次 preload 全部图片可能占用内存过大
```

处理：

```text
V0/V1 只 preload 当前阶段图片
预实验结束后只 preload formal selected images
block 前 preload 当前 block
显示资源加载进度
```

### 8.4 数据丢失

风险：

```text
浏览器关闭或刷新会丢失内存数据
GitHub Pages 不能接收数据写入
```

处理：

```text
每个 trial 后写入 localStorage/IndexedDB
每个阶段结束自动下载阶段性 CSV
正式上线时使用 DataPipe/OSF
```

### 8.5 随机化复现

风险：

```text
Python random.shuffle 与 JS Math.random 不一致
同一被试无法复现正式 block
```

处理：

```text
实现 seedable RNG
每个被试生成 subject_seed
所有 shuffle 使用同一 RNG
保存 seed 到 summary
```

## 9. 测试计划

### 9.1 单元测试

需要测试：

```text
CSV 读取
path normalization
logistic_p8
fit_logistic_grid
PAVA monotonic curve
choose alpha
formal trial generation
block distribution
CSV export
```

### 9.2 Golden test

使用 Python 版已生成的数据作为对照：

```text
输入同一份 pretest_records
比较 JS 和 Python 的 pretest_alpha_summary
比较 mu/sigma/nll
比较 selected_alpha
比较 calibration_summary
比较 formal block 总数和分布
```

注意：如果 JS 使用 seedable RNG，而 Python 历史数据没有保存 seed，正式 trial 顺序不要求完全一致；但计数、唯一性、overlap 和 difficulty 分布必须一致。

### 9.3 人工浏览器测试

至少测试：

```text
Chrome 最新版
Edge 最新版
Windows 1920x1080
浏览器缩放 100%
全屏模式
中途刷新
中途关闭
网络断开
```

## 10. 开发顺序建议

建议严格按下面顺序推进：

```text
1. 初始化 jsPsych 项目和资源目录
2. 实现 CSV loader 和路径规则
3. 实现 hold-response trial
4. 做 V0 固定 trial demo
5. 接入 practice_data.csv
6. 接入 pilot_manifest.csv 和 pilot_dataset
7. 实现 pretest_alpha_summary
8. 迁移 calibration 算法
9. 迁移 formal trial generator
10. 实现完整 timeline
11. 实现 CSV/ZIP 导出
12. 做 golden tests
13. 部署 GitHub Pages
14. 再考虑 DataPipe/OSF
```

不要一开始就接 DataPipe，也不要一开始就重做完整 UI。先把时序、按键、数据和校准跑通。

## 11. 近期第一周任务

第一周只做可验证基础，不碰正式上线。

任务清单：

```text
Day 1:
  创建 Vite + jsPsych 项目
  搭好 index.html、main.js、task.css
  复制少量测试图片

Day 2:
  实现 hold-response-trial
  跑通 10 个固定 trial
  下载 raw CSV

Day 3:
  接入 practice_data.csv
  跑通 practice_count
  实现练习反馈

Day 4:
  接入 pilot_manifest.csv 和 group_*.csv
  跑通 180 题预实验
  导出 pretest_alpha_summary

Day 5:
  写 calibration 函数单元测试
  先迁移 logistic 和 PAVA

Day 6:
  迁移 D1-D6 alpha 选择
  生成 calibration_summary

Day 7:
  用一份真实/测试 raw 数据做 golden comparison
  修正 JS 与 Python 差异
```

## 12. 第一版完成标准

第一版不是最终上线版。完成标准应为：

```text
可以在浏览器打开
可以完成练习和预实验
可以生成 calibration_summary
可以生成 formal_blocks
可以导出所有 CSV
正式 trial 总数和分布正确
图片无重复
预实验和正式实验图片无 overlap
```

达到这个标准后，再进入正式 UI 打磨、在线上传和部署。

