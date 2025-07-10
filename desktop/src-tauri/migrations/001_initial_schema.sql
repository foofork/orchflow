-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tmux_session TEXT,
    created_at DATETIME NOT NULL,
    last_active DATETIME NOT NULL,
    metadata TEXT -- JSON
);

CREATE INDEX idx_sessions_last_active ON sessions(last_active);

-- Panes table
CREATE TABLE IF NOT EXISTS panes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tmux_pane TEXT,
    pane_type TEXT NOT NULL, -- 'editor', 'terminal', 'repl'
    content TEXT, -- scrollback cache
    metadata TEXT, -- JSON
    created_at DATETIME NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_panes_session_id ON panes(session_id);

-- Layouts table
CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    layout_data TEXT NOT NULL, -- JSON of GridLayout
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_layouts_session_id ON layouts(session_id);
CREATE INDEX idx_layouts_active ON layouts(session_id, is_active);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    name TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    manifest TEXT NOT NULL, -- JSON
    installed_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Activity log table (for analytics)
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT, -- JSON
    created_at DATETIME NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_log_session_id ON activity_log(session_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);