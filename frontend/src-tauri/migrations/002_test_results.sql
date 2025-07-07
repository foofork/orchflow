-- Test suites table
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    project_path TEXT NOT NULL,
    test_framework TEXT NOT NULL, -- 'jest', 'vitest', 'pytest', 'cargo', etc.
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_suites_session_id ON test_suites(session_id);
CREATE INDEX idx_test_suites_project ON test_suites(project_path);

-- Test runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    command TEXT NOT NULL, -- Command used to run tests
    status TEXT NOT NULL, -- 'running', 'passed', 'failed', 'cancelled'
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    coverage_percent REAL,
    error_output TEXT,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    metadata TEXT, -- JSON for framework-specific data
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_runs_suite_id ON test_runs(suite_id);
CREATE INDEX idx_test_runs_session_id ON test_runs(session_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_started_at ON test_runs(started_at);

-- Individual test results
CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    suite_id TEXT NOT NULL,
    test_file TEXT NOT NULL,
    test_name TEXT NOT NULL,
    test_path TEXT NOT NULL, -- Full path like 'describe > it > test'
    status TEXT NOT NULL, -- 'passed', 'failed', 'skipped', 'pending'
    duration_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    assertion_results TEXT, -- JSON array of assertions
    retry_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON for framework-specific data
    FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_results_run_id ON test_results(run_id);
CREATE INDEX idx_test_results_suite_id ON test_results(suite_id);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_file ON test_results(test_file);

-- Test coverage table
CREATE TABLE IF NOT EXISTS test_coverage (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    lines_total INTEGER NOT NULL,
    lines_covered INTEGER NOT NULL,
    branches_total INTEGER NOT NULL,
    branches_covered INTEGER NOT NULL,
    functions_total INTEGER NOT NULL,
    functions_covered INTEGER NOT NULL,
    statements_total INTEGER NOT NULL,
    statements_covered INTEGER NOT NULL,
    uncovered_lines TEXT, -- JSON array of line numbers
    FOREIGN KEY (run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_coverage_run_id ON test_coverage(run_id);
CREATE INDEX idx_test_coverage_file ON test_coverage(file_path);

-- Test history view for quick access to recent results
CREATE VIEW IF NOT EXISTS test_history AS
SELECT 
    tr.id,
    tr.suite_id,
    ts.name as suite_name,
    ts.project_path,
    tr.status,
    tr.total_tests,
    tr.passed_tests,
    tr.failed_tests,
    tr.duration_ms,
    tr.coverage_percent,
    tr.started_at,
    tr.completed_at
FROM test_runs tr
JOIN test_suites ts ON tr.suite_id = ts.id
ORDER BY tr.started_at DESC;

-- Test failure trends view
CREATE VIEW IF NOT EXISTS test_failure_trends AS
SELECT 
    DATE(tr.started_at) as test_date,
    ts.name as suite_name,
    COUNT(DISTINCT tr.id) as total_runs,
    SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
    AVG(tr.failed_tests) as avg_failed_tests,
    AVG(tr.duration_ms) as avg_duration_ms
FROM test_runs tr
JOIN test_suites ts ON tr.suite_id = ts.id
WHERE tr.completed_at IS NOT NULL
GROUP BY DATE(tr.started_at), ts.name
ORDER BY test_date DESC;