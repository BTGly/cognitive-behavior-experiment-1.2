import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request as _Request


DATA_DIR = Path('/opt/blur-exp/data')
STORAGE_DIR = Path('/opt/blur-exp/storage')
DB_PATH = DATA_DIR / 'experiment.sqlite3'
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_RAW_CSV_BYTES = 20 * 1024 * 1024
PRETEST_BLOCKS = 3
PRETEST_TRIALS_PER_BLOCK = 60

PRETEST_RESUME_FIELDS = [
    'participant', 'date', 'phase', 'trial_index', 'block_id', 'trial_in_block',
    'difficulty_id', 'difficulty_rank', 'alpha', 'label_digit', 'label_type',
    'sample_type', 'show_time', 'fixation_ms', 'stimulus_ms', 'image_path',
    'choice_key', 'choice_digit', 'manual_accuracy', 'decision_rt',
    'hold_duration', 'confidence_hold_s', 'confidence_rating_formal',
    'confidence_bin_3level', 'valid_response', 'response_timeout',
    'early_key_down_at_start', 'image_load_status', 'image_load_error',
    'image_load_timeout', 'experiment_version', 'fullscreen_active',
    'screen_width_px', 'screen_height_px', 'viewport_width_px',
    'viewport_height_px', 'device_pixel_ratio', 'browser_user_agent',
    'stimulus_rendered_width_px', 'stimulus_rendered_height_px',
]

ALLOWED_ORIGINS = [
    'https://btgly.github.io',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]

UPLOAD_TOKEN = os.environ.get('UPLOAD_TOKEN', '')

app = FastAPI(title="Blur Experiment Upload API", docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?',
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'PUT', 'OPTIONS'],
    allow_headers=['*'],
)


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_id(value: str, default: str = 'UNKNOWN') -> str:
    value = (value or '').strip()
    if not value:
        return default
    value = re.sub(r'[^A-Za-z0-9_-]', '_', value)
    return value[:120] or default


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS experiment_sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT NOT NULL UNIQUE,
              subject_id TEXT NOT NULL,
              participant TEXT NOT NULL,
              run_pretest INTEGER,
              start_group INTEGER,
              end_group INTEGER,
              trial_count INTEGER,
              valid_trial_count INTEGER,
              abort_reason TEXT,
              zip_path TEXT NOT NULL,
              zip_size_bytes INTEGER NOT NULL,
              sha256_client TEXT,
              sha256_server TEXT NOT NULL,
              upload_status TEXT NOT NULL,
              client_user_agent TEXT,
              app_version TEXT,
              created_at TEXT NOT NULL,
              session_started_at TEXT,
              session_ended_at TEXT,
              session_elapsed_ms INTEGER,
              uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sessions_subject
            ON experiment_sessions(subject_id)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_sessions_uploaded_at
            ON experiment_sessions(uploaded_at)
            """
        )

        # Migration: add columns if missing (safe to run repeatedly)
        for col, column_type in [
            ('schedule_source', 'TEXT'),
            ('formal_schedule_hash', 'TEXT'),
            ('completed_blocks_json', 'TEXT'),
            ('partial_blocks_json', 'TEXT'),
            ('formal_block_counts_json', 'TEXT'),
            ('session_started_at', 'TEXT'),
            ('session_ended_at', 'TEXT'),
            ('session_elapsed_ms', 'INTEGER'),
        ]:
            try:
                conn.execute(f'ALTER TABLE experiment_sessions ADD COLUMN {col} {column_type}')
            except sqlite3.OperationalError:
                pass  # column already exists

        conn.commit()


@app.on_event('startup')
def startup() -> None:
    init_db()


@app.get('/health')
def health():
    return {'ok': True, 'time': now_utc_iso()}


# ---- Calibration cache (pretest → formal skip) ----

def _calibration_path(subject_id: str) -> Path:
    sid = safe_id(subject_id)
    return STORAGE_DIR / 'subjects' / sid / 'calibration.json'


def _verify_auth(x_upload_token: str | None) -> None:
    if not UPLOAD_TOKEN:
        raise HTTPException(status_code=500, detail='UPLOAD_TOKEN is not configured')
    if x_upload_token != UPLOAD_TOKEN:
        raise HTTPException(status_code=401, detail='Invalid upload token')


def _stable_stringify(value) -> str:
    """Deterministic JSON serialization matching the browser's stableStringify."""
    if isinstance(value, list):
        return '[' + ','.join(_stable_stringify(v) for v in value) + ']'
    if isinstance(value, dict):
        keys = sorted(value.keys())
        pairs = [json.dumps(k, ensure_ascii=False, separators=(',', ':')) + ':' + _stable_stringify(value[k]) for k in keys]
        return '{' + ','.join(pairs) + '}'
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def _compute_blocks_hash(blocks: dict) -> str:
    """Compute SHA-256 of stable-stringified formalBlocks."""
    stable = _stable_stringify(blocks)
    return hashlib.sha256(stable.encode('utf-8')).hexdigest()


def _parse_int(value):
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def _read_pretest_blocks(zip_path: Path, subject_id: str) -> dict:
    """Return complete and partial pretest blocks found in one uploaded ZIP."""
    result = {'complete': {}, 'counts': {}}
    if not zip_path.is_file():
        return result

    try:
        with zipfile.ZipFile(zip_path) as archive:
            raw_entries = [
                info for info in archive.infolist()
                if not info.is_dir() and info.filename.lower().endswith('_raw_data.csv')
            ]
            if len(raw_entries) != 1:
                return result
            raw_entry = raw_entries[0]
            if raw_entry.file_size > MAX_RAW_CSV_BYTES:
                return result

            rows_by_block = {b: {} for b in range(1, PRETEST_BLOCKS + 1)}
            row_counts = {b: 0 for b in range(1, PRETEST_BLOCKS + 1)}
            with archive.open(raw_entry) as raw_file:
                text_file = io.TextIOWrapper(raw_file, encoding='utf-8-sig', newline='')
                for row in csv.DictReader(text_file):
                    if str(row.get('phase', '')).strip().lower() != 'pretest':
                        continue
                    if safe_id(row.get('participant', '')) != subject_id:
                        continue
                    block_id = _parse_int(row.get('block_id'))
                    trial_in_block = _parse_int(row.get('trial_in_block'))
                    if block_id not in rows_by_block:
                        continue
                    if trial_in_block is None or not 1 <= trial_in_block <= PRETEST_TRIALS_PER_BLOCK:
                        continue
                    row_counts[block_id] += 1
                    cleaned = {field: row.get(field, '') for field in PRETEST_RESUME_FIELDS}
                    cleaned['block_id'] = block_id
                    cleaned['trial_in_block'] = trial_in_block
                    rows_by_block[block_id][trial_in_block] = cleaned

            expected_trials = set(range(1, PRETEST_TRIALS_PER_BLOCK + 1))
            for block_id, trials in rows_by_block.items():
                result['counts'][block_id] = len(trials)
                if row_counts[block_id] == PRETEST_TRIALS_PER_BLOCK and set(trials) == expected_trials:
                    result['complete'][block_id] = [trials[t] for t in sorted(trials)]
    except (OSError, UnicodeError, csv.Error, zipfile.BadZipFile, RuntimeError):
        return result

    return result


def _validate_formal_schedule(body: dict) -> None:
    """Validate calibration v2 formal_schedule before storing."""
    if body.get('schema_version') != 2:
        raise HTTPException(status_code=400, detail='schema_version=2 required')

    formal = body.get('formal_schedule') or {}
    blocks = formal.get('formalBlocks') or {}

    if not isinstance(blocks, dict) or len(blocks) != 11:
        raise HTTPException(status_code=400, detail='formalBlocks must contain exactly 11 blocks')

    total = 0
    for b in range(1, 12):
        key = str(b)
        trials = blocks.get(key)
        if not isinstance(trials, list) or len(trials) != 100:
            raise HTTPException(status_code=400, detail=f'block {b} must contain exactly 100 trials')
        total += len(trials)

    if total != 1100:
        raise HTTPException(status_code=400, detail='formal schedule total trials must be 1100')

    # Verify each trial has required fields
    required_fields = ['block_id', 'trial_in_block', 'difficulty_id', 'alpha', 'label_digit', 'image_path']
    for b in range(1, 12):
        key = str(b)
        trials = blocks[key]
        for j, trial in enumerate(trials, start=1):
            for field in required_fields:
                if field not in trial:
                    raise HTTPException(
                        status_code=400,
                        detail=f'missing required field "{field}" in block {b} trial {j}'
                    )
            if int(trial.get('block_id')) != b:
                raise HTTPException(
                    status_code=400,
                    detail=f'block_id mismatch in block {b} trial {j}: expected {b}, got {trial["block_id"]}'
                )
            if int(trial.get('trial_in_block')) != j:
                raise HTTPException(
                    status_code=400,
                    detail=f'trial_in_block mismatch in block {b} trial {j}: expected {j}, got {trial["trial_in_block"]}'
                )

    # Verify formal_schedule_hash matches computed hash of blocks
    client_hash = body.get('formal_schedule_hash')
    if not client_hash:
        raise HTTPException(status_code=400, detail='formal_schedule_hash is required')
    computed_hash = _compute_blocks_hash(blocks)
    if client_hash != computed_hash:
        raise HTTPException(
            status_code=400,
            detail=f'formal_schedule_hash mismatch: client={client_hash}, computed={computed_hash}'
        )


@app.get('/api/subject/{subject_id}/calibration')
def get_calibration(
    subject_id: str,
    x_upload_token: str | None = Header(default=None),
):
    """Return stored calibration for a subject (auth required — v2 exposes full formal schedule)."""
    _verify_auth(x_upload_token)
    path = _calibration_path(subject_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail='No calibration found for this subject')
    return json.loads(path.read_text(encoding='utf-8'))


@app.put('/api/calibration/{subject_id}')
async def store_calibration(
    subject_id: str,
    request: _Request,
    x_upload_token: str | None = Header(default=None),
):
    """Store calibration v2 artifact after pretest completes (auth required)."""
    _verify_auth(x_upload_token)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid JSON body')

    # Validate schema version and formal schedule integrity
    _validate_formal_schedule(body)

    # Prevent overwriting existing calibration for non-TEST subjects
    path = _calibration_path(subject_id)
    sid = safe_id(subject_id)
    is_test = sid.startswith('TEST_')
    if path.exists() and not is_test:
        raise HTTPException(
            status_code=409,
            detail='calibration already exists for this subject, delete manually to reset'
        )

    body['subject_id'] = sid
    body['stored_at'] = now_utc_iso()

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix('.json.tmp')
    tmp_path.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp_path.replace(path)

    return {'ok': True, 'subject_id': body['subject_id'], 'stored_at': body['stored_at']}


@app.get('/api/subject/{subject_id}/progress')
def get_progress(
    subject_id: str,
    x_upload_token: str | None = Header(default=None),
):
    """Return formal block progress for a subject (auth required)."""
    _verify_auth(x_upload_token)
    sid = safe_id(subject_id)

    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT completed_blocks_json, partial_blocks_json, formal_block_counts_json,
                   formal_schedule_hash, start_group, end_group, session_id
            FROM experiment_sessions
            WHERE subject_id = ?
            ORDER BY created_at ASC
            """,
            (sid,),
        ).fetchall()

    all_completed = set()
    all_partial = set()
    all_counts = {}
    hashes = set()
    sessions = []

    for row in rows:
        cb_json, pb_json, fbc_json, fsh, sg, eg, sid_s = row

        completed = json.loads(cb_json) if cb_json else []
        partial = json.loads(pb_json) if pb_json else []
        counts = json.loads(fbc_json) if fbc_json else {}

        all_completed.update(completed)
        all_partial.update(partial)
        for k, v in counts.items():
            all_counts[k] = max(all_counts.get(k, 0), v)
        if fsh:
            hashes.add(fsh)

        sessions.append({
            'session_id': sid_s,
            'start_group': sg,
            'end_group': eg,
            'completed_blocks': completed,
            'partial_blocks': partial,
            'formal_schedule_hash': fsh or '',
        })

    # Partial excludes completed (completed wins)
    all_partial -= all_completed

    # Find next start block
    next_start = None
    for b in range(1, 12):
        if b not in all_completed:
            next_start = b
            break

    progress_conflict = len(hashes) > 1
    is_complete = next_start is None

    return {
        'subject_id': sid,
        'has_calibration': bool(len(hashes) > 0),
        'formal_schedule_hash': list(hashes)[0] if len(hashes) == 1 else None,
        'completed_blocks': sorted(all_completed),
        'partial_blocks': sorted(all_partial),
        'next_start_group': next_start,
        'recommended_end_group': 11 if not is_complete else None,
        'is_complete': is_complete,
        'progress_conflict': progress_conflict,
        'hashes': sorted(hashes),
        'sessions': sessions,
    }


@app.get('/api/subject/{subject_id}/pretest-resume')
def get_pretest_resume(
    subject_id: str,
    x_upload_token: str | None = Header(default=None),
):
    """Recover only complete 60-trial pretest blocks from uploaded sessions."""
    _verify_auth(x_upload_token)
    sid = safe_id(subject_id)

    if _calibration_path(sid).exists():
        return {
            'subject_id': sid,
            'can_resume': False,
            'reason': 'calibration_already_exists',
            'completed_blocks': [],
            'next_block': None,
            'records': [],
            'source_sessions': [],
            'discarded_partial_blocks': {},
        }

    with sqlite3.connect(DB_PATH) as conn:
        sessions = conn.execute(
            """
            SELECT session_id, zip_path, uploaded_at
            FROM experiment_sessions
            WHERE subject_id = ?
            ORDER BY uploaded_at DESC, id DESC
            """,
            (sid,),
        ).fetchall()

    recovered = {}
    source_by_block = {}
    partial_counts = {}

    for session_id, zip_path, _uploaded_at in sessions:
        parsed = _read_pretest_blocks(Path(zip_path), sid)
        for block_id, count in parsed['counts'].items():
            partial_counts[block_id] = max(partial_counts.get(block_id, 0), count)
        for block_id, records in parsed['complete'].items():
            if block_id not in recovered:
                recovered[block_id] = records
                source_by_block[block_id] = session_id

    completed_blocks = sorted(recovered)
    records = [
        record
        for block_id in completed_blocks
        for record in recovered[block_id]
    ]
    missing_blocks = [
        block_id for block_id in range(1, PRETEST_BLOCKS + 1)
        if block_id not in recovered
    ]
    discarded_partial = {
        str(block_id): count
        for block_id, count in sorted(partial_counts.items())
        if block_id not in recovered and count > 0
    }

    return {
        'subject_id': sid,
        'can_resume': bool(completed_blocks),
        'reason': 'complete_blocks_found' if completed_blocks else 'no_complete_blocks',
        'completed_blocks': completed_blocks,
        'next_block': missing_blocks[0] if missing_blocks else None,
        'records': records,
        'source_sessions': sorted(set(source_by_block.values())),
        'source_session_by_block': {
            str(block_id): source_by_block[block_id] for block_id in completed_blocks
        },
        'discarded_partial_blocks': discarded_partial,
    }


@app.post('/api/upload-session')
async def upload_session(
    file: UploadFile = File(...),
    metadata: str = Form(...),
    x_upload_token: str | None = Header(default=None),
    user_agent: str | None = Header(default=None),
):
    _verify_auth(x_upload_token)

    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail='metadata is not valid JSON') from exc

    participant = safe_id(str(meta.get('participant', 'UNKNOWN')))
    subject_id = safe_id(str(meta.get('subject_id', participant)))
    session_id = safe_id(str(meta.get('session_id', '')))

    if not session_id:
        raise HTTPException(status_code=400, detail='session_id is required')

    filename = file.filename or ''
    if not filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail='Only .zip upload is accepted')

    run_pretest = int(meta.get('run_pretest', 0) or 0)
    start_group = int(meta.get('start_group', 0) or 0)
    end_group = int(meta.get('end_group', 0) or 0)
    trial_count = int(meta.get('trial_count', 0) or 0)
    valid_trial_count = int(meta.get('valid_trial_count', 0) or 0)
    abort_reason = str(meta.get('abort_reason', '') or '')
    sha256_client = str(meta.get('sha256', '') or '')
    app_version = str(meta.get('app_version', '') or '')
    schedule_source = str(meta.get('schedule_source', '') or '')
    formal_schedule_hash = str(meta.get('formal_schedule_hash', '') or '')
    session_started_at = str(meta.get('session_started_at', '') or '')
    session_ended_at = str(meta.get('session_ended_at', '') or '')
    session_elapsed_ms = _parse_int(meta.get('session_elapsed_ms'))
    completed_blocks = json.dumps(meta.get('completed_blocks', []) or [], ensure_ascii=False)
    partial_blocks = json.dumps(meta.get('partial_blocks', []) or [], ensure_ascii=False)
    formal_block_counts = json.dumps(meta.get('formal_block_counts', {}) or {}, ensure_ascii=False)

    session_dir = STORAGE_DIR / 'subjects' / subject_id / 'sessions' / session_id
    raw_dir = session_dir / 'raw'
    if session_dir.exists():
        raise HTTPException(status_code=409, detail='session_id already exists')

    raw_dir.mkdir(parents=True, exist_ok=False)

    zip_path = raw_dir / f'{session_id}.zip'
    hasher = hashlib.sha256()
    size = 0

    try:
        with zip_path.open('wb') as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail='file too large')
                hasher.update(chunk)
                out.write(chunk)
    except Exception:
        if zip_path.exists():
            zip_path.unlink()
        try:
            raw_dir.rmdir()
            session_dir.rmdir()
        except OSError:
            pass
        raise

    sha256_server = hasher.hexdigest()
    if sha256_client and sha256_client != sha256_server:
        zip_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail='sha256 mismatch')

    uploaded_at = now_utc_iso()
    created_at = str(meta.get('created_at', '') or uploaded_at)

    manifest = {
        'subject_id': subject_id,
        'participant': participant,
        'session_id': session_id,
        'run_pretest': run_pretest,
        'start_group': start_group,
        'end_group': end_group,
        'trial_count': trial_count,
        'valid_trial_count': valid_trial_count,
        'abort_reason': abort_reason,
        'zip_path': str(zip_path),
        'zip_size_bytes': size,
        'sha256_client': sha256_client,
        'sha256_server': sha256_server,
        'app_version': app_version,
        'schedule_source': schedule_source,
        'formal_schedule_hash': formal_schedule_hash,
        'session_started_at': session_started_at,
        'session_ended_at': session_ended_at,
        'session_elapsed_ms': session_elapsed_ms,
        'completed_blocks': json.loads(completed_blocks) if isinstance(completed_blocks, str) else completed_blocks,
        'partial_blocks': json.loads(partial_blocks) if isinstance(partial_blocks, str) else partial_blocks,
        'formal_block_counts': json.loads(formal_block_counts) if isinstance(formal_block_counts, str) else formal_block_counts,
        'created_at': created_at,
        'uploaded_at': uploaded_at,
    }
    (session_dir / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO experiment_sessions (
                  session_id, subject_id, participant,
                  run_pretest, start_group, end_group,
                  trial_count, valid_trial_count, abort_reason,
                  zip_path, zip_size_bytes,
                  sha256_client, sha256_server,
                  upload_status, client_user_agent, app_version,
                  schedule_source, formal_schedule_hash,
                  completed_blocks_json, partial_blocks_json, formal_block_counts_json,
                  created_at, session_started_at, session_ended_at, session_elapsed_ms, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    subject_id,
                    participant,
                    run_pretest,
                    start_group,
                    end_group,
                    trial_count,
                    valid_trial_count,
                    abort_reason,
                    str(zip_path),
                    size,
                    sha256_client,
                    sha256_server,
                    'uploaded',
                    user_agent,
                    app_version,
                    schedule_source,
                    formal_schedule_hash,
                    completed_blocks,
                    partial_blocks,
                    formal_block_counts,
                    created_at,
                    session_started_at,
                    session_ended_at,
                    session_elapsed_ms,
                    uploaded_at,
                ),
            )
            conn.commit()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail='session_id already exists') from exc

    return {
        'ok': True,
        'session_id': session_id,
        'subject_id': subject_id,
        'zip_size_bytes': size,
        'sha256': sha256_server,
        'uploaded_at': uploaded_at,
    }
