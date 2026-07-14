export const RAW_DATA_FIELDS = [
  'participant', 'date', 'phase', 'trial_index', 'block_id', 'trial_in_block',
  'session_started_at', 'session_ended_at', 'session_elapsed_ms', 'session_elapsed_minutes',
  'block_started_at', 'block_ended_at', 'block_elapsed_ms', 'block_elapsed_minutes',
  'formal_block_score', 'formal_block_total_trials', 'formal_block_valid_trials', 'formal_block_accuracy',
  'trial_started_at', 'stimulus_started_at', 'trial_ended_at', 'trial_elapsed_ms',
  'difficulty_id', 'difficulty_rank', 'alpha', 'label_digit', 'label_type',
  'sample_type', 'show_time', 'fixation_ms', 'stimulus_ms', 'image_path',
  'choice_key', 'choice_digit', 'manual_accuracy', 'decision_rt',
  'hold_duration', 'confidence_hold_s', 'confidence_rating_formal',
  'confidence_bin_3level', 'valid_response', 'response_timeout',
  'early_key_down_at_start', 'image_load_status', 'image_load_error',
  'image_load_timeout', 'experiment_version', 'fullscreen_active',
  'screen_width_px', 'screen_height_px', 'viewport_width_px', 'viewport_height_px',
  'device_pixel_ratio', 'browser_user_agent',
  'stimulus_rendered_width_px', 'stimulus_rendered_height_px',
  'abort_reason', 'abort_time'
]

export const PRETEST_ALPHA_SUMMARY_FIELDS = [
  'alpha', 'n_valid', 'n_choose8', 'p8_observed'
]

export const CALIBRATION_SUMMARY_FIELDS = [
  'difficulty_id', 'selection_mode', 'selected_alpha', 'target_p8',
  'fitted_p8_at_selected_alpha', 'fitted_p8_logistic', 'fitted_p8_mono',
  'expected_correct_at_selected_alpha', 'target_gap', 'label_digit', 'n_trials',
  'candidate_count', 'feasible_p8_min', 'feasible_p8_max',
  'target_reachable_by_side', 'target_feasible',
  'anchor_fixed_used', 'anchor_candidates', 'anchor_fallback_used',
  'duplicate_fallback_used', 'reserved_anchor_fallback_used',
  'p8_window_low', 'p8_window_high', 'p8_window_ok', 'warning_msg',
  'mu', 'sigma', 'nll',
  'expected_accuracy_overall', 'expected_fpr', 'expected_tpr',
  'expected_auc_binary', 'expected_balanced_accuracy', 'expected_mcc',
  'auc_qc_status', 'mcc_qc_status',
  'auc_target', 'auc_soft_floor', 'auc_hard_floor',
  'mcc_target', 'mcc_soft_floor', 'mcc_hard_floor'
]

export const BLOCK_DISTRIBUTION_FIELDS = [
  'block_id', 'normal_n', 'defect_n', 'defect_rate',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6'
]
