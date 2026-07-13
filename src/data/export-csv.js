import { generateCSV } from '../csv.js'
import {
  RAW_DATA_FIELDS, PRETEST_ALPHA_SUMMARY_FIELDS,
  CALIBRATION_SUMMARY_FIELDS, BLOCK_DISTRIBUTION_FIELDS
} from './schemas.js'

export function downloadCSV(data, fields, filename) {
  const csv = generateCSV(data, fields)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function buildAllDataZip(subjectId, rawData, summaries, config) {
  const zip = new JSZip()

  const dateStr = config.dateStr || 'unknown'

  zip.file(`${subjectId}_raw_data.csv`, '\uFEFF' + generateCSV(rawData, RAW_DATA_FIELDS))

  if (summaries.pretestAlphaSummary) {
    zip.file(`${subjectId}_pretest_alpha_summary.csv`, '\uFEFF' + generateCSV(
      summaries.pretestAlphaSummary, PRETEST_ALPHA_SUMMARY_FIELDS
    ))
  }

  if (summaries.calibrationSummary) {
    zip.file(`${subjectId}_calibration_summary.csv`, '\uFEFF' + generateCSV(
      summaries.calibrationSummary, CALIBRATION_SUMMARY_FIELDS
    ))
  }

  if (summaries.blockDistribution) {
    zip.file(`${subjectId}_formal_block_distribution_summary.csv`, '\uFEFF' + generateCSV(
      summaries.blockDistribution, BLOCK_DISTRIBUTION_FIELDS
    ))
  }

  if (summaries.formalBlocks) {
    for (const [blockId, trials] of Object.entries(summaries.formalBlocks)) {
      zip.file(
        `${subjectId}_formal_block_${String(blockId).padStart(2, '0')}.csv`,
        '\uFEFF' + generateCSV(trials, RAW_DATA_FIELDS)
      )
    }
  }

  // Audit provenance
  const provenance = {
    source: summaries.scheduleSource || 'none',
    schema_version: 2,
    subject_id: subjectId,
    start_group: summaries.startGroup || null,
    end_group: summaries.endGroup || null,
    formal_schedule_hash: summaries.formalScheduleHash || null,
    experiment_version: config.experimentVersion || 'unknown',
    completed_blocks: summaries.completedBlocks || [],
    partial_blocks: summaries.partialBlocks || [],
    formal_block_counts: summaries.formalBlockCounts || {},
    generated_at: dateStr
  }
  zip.file(`${subjectId}_formal_schedule_source.json`, JSON.stringify(provenance, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `${subjectId}_experiment_${dateStr}.zip`
  return { blob, filename }
}

export async function downloadAllData(subjectId, rawData, summaries, config) {
  const { blob, filename } = await buildAllDataZip(subjectId, rawData, summaries, config)
  downloadBlob(blob, filename)
}
