# jsPsych Cognitive Behavior Experiment 1.2

[中文说明](README.md)

Web-based cognitive behavior experiment migrated from PsychoPy to [jsPsych](https://www.jspsych.org/) 8.0.

**Live**: https://btgly.github.io/cognitive-behavior-experiment-1.2/  
**Golden Test**: https://btgly.github.io/cognitive-behavior-experiment-1.2/golden-test.html  
**Subject Guide (Chinese)**: [被试操作指南](被试操作指南.md)

## Experiment Flow

```
Param Form → Welcome → Practice → Pretest (180 trials)
→ Calibration (Logistic + PAVA) → D1-D6 Alpha Selection
→ Formal Experiment (11 blocks × 100 trials) → CSV/ZIP Download
```

- **Practice**: F/K key response, hold-duration confidence, trial feedback
- **Pretest**: 3 groups × 60 trials, alpha-level response summary
- **Calibration**: Logistic psychometric function + PAVA monotonic fit
- **Formal**: 1100 trials (D1=82, D2=165, D3=578, D4=209, D5=38, D6=28)

## Run Locally

```bash
# Python 3.7+
python -m http.server 8000 --directory .
```

Then open http://localhost:8000 in Chrome/Edge.

No build tools required. The experiment uses CDN-loaded jsPsych + ES modules.

## Project Structure

```
├── index.html                  # Entry point
├── golden-test.html            # Calibration algorithm verification
├── src/
│   ├── main.js                 # Timeline orchestrator
│   ├── calibration/            # Logistic fit, PAVA, alpha selection
│   ├── task/                   # Hold-response plugin, feedback, instructions
│   ├── timeline/               # Experiment phase timelines
│   └── data/                   # Schema, summaries, CSV/ZIP export
├── conditions/                 # Trial condition CSV files
└── assets/                     # Stimulus images + practice/pilot datasets
```

## Algorithm Migration

| Python | JavaScript | Status |
|--------|-----------|--------|
| `logistic_p8` | `src/calibration/logistic.js` | ✓ |
| `fit_logistic_grid` (2-pass) | `src/calibration/logistic.js` | ✓ |
| `beta_smooth_p8` + PAVA | `src/calibration/monotonic.js` | ✓ |
| `choose_fixed_anchor` / `choose_target_p8` | `src/calibration/select-alpha.js` | ✓ |
| Formal trial generation | `src/calibration/formal-generator.js` | ✓ |
| F/K hold-response detection | `src/task/hold-response-trial.js` | ✓ |

## Key Parameters

The start form shows only:

- `participant`: Subject ID, e.g. `S001` (required)
- `upload_code`: Server upload authorization code (required)

Other parameters are available under **Experimenter Advanced Settings**:

- `practice_count`: Number of practice trials (0–80, default 24)
- `start_group` / `end_group`: Formal block range (1–11)

For resumed sessions, keep the default `start_group=1` and `end_group=11`. The system will automatically:

- skip completed blocks
- resume from the next incomplete block
- block repeated completed blocks
- block skipped incomplete blocks
- show "experiment complete" after all 11 blocks are finished

## Data Export

At the end of the experiment, a ZIP is automatically downloaded containing:

- `{subject}_raw_data.csv`
- `{subject}_pretest_alpha_summary.csv`
- `{subject}_calibration_summary.csv`
- `{subject}_formal_block_distribution_summary.csv`
- `{subject}_formal_block_*.csv` (per block)
- `{subject}_formal_schedule_source.json` (audit provenance: schedule source, `formal_schedule_hash`, `completed_blocks`, `partial_blocks`, `formal_block_counts`)

The same ZIP is then uploaded to the server if `upload_code` is provided (required for formal subjects).

## Fallback (Windows only)

If the web version does not work, download the standalone Windows build:

> **Download**: [Cognitive Behavior Experiment 1.2 — Windows](https://github.com/BTGly/cognitive-behavior-experiment-1.2/releases/tag/v1.2-fallback) (283 MB, extract and run `双击开始实验.exe`)
>
> No Python installation required. Windows only.

## Deployment

Push to GitHub and enable Pages (Settings → Pages → deploy from `master` `/`).
