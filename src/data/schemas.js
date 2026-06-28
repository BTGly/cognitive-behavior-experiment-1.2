export const RAW_DATA_FIELDS = [
  'participant', 'date', 'phase', 'trial_index', 'block_id', 'trial_in_block',
  'difficulty_id', 'difficulty_rank', 'alpha', 'label_digit', 'label_type',
  'sample_type', 'show_time', 'fixation_ms', 'stimulus_ms', 'image_path',
  'choice_key', 'choice_digit', 'manual_accuracy', 'decision_rt',
  'hold_duration', 'confidence_hold_s', 'confidence_rating_formal',
  'confidence_bin_3level', 'valid_response', 'response_timeout',
  'early_key_down_at_start', 'abort_reason', 'abort_time'
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
