# jsPsych Blur Discrimination Experiment

Web-based blur discrimination experiment migrated from PsychoPy to [jsPsych](https://www.jspsych.org/) 8.0.

中文说明见 [README.zh-CN.md](README.zh-CN.md)。

**Live**: https://btgly.github.io/jsPsych-blur-experiment/  
**Golden Test**: https://btgly.github.io/jsPsych-blur-experiment/golden-test.html

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

Set via the start form:

- `participant`: Subject ID (required)
- `upload_code`: Server upload authorization code (required)
- `practice_count`: Number of practice trials (0-80, default 24)
- `start_group` / `end_group`: Formal block range (1-11)

Note: Pretest is always required. Upload code must be filled — the experiment blocks without it.

## Data Export

At the end of the experiment, a ZIP is automatically downloaded containing:

- `{subject}_raw_data.csv`
- `{subject}_pretest_alpha_summary.csv`
- `{subject}_calibration_summary.csv`
- `{subject}_formal_block_distribution_summary.csv`
- `{subject}_formal_block_*.csv` (per block)
- `{subject}_formal_schedule_source.json` (audit provenance)

The same ZIP is then uploaded to the server if `upload_code` is provided (required for formal subjects).

## Deployment

Push to GitHub and enable Pages (Settings → Pages → deploy from `master` `/`).
