CREATE TABLE IF NOT EXISTS asi_memory (
 id TEXT PRIMARY KEY,
 namespace TEXT NOT NULL,
 content TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asi_memory_namespace ON asi_memory(namespace,updated_at);
CREATE TABLE IF NOT EXISTS asi_agents (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 public_key TEXT,
 suite TEXT NOT NULL DEFAULT 'LHX-1',
 status TEXT NOT NULL DEFAULT 'active',
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS asi_tasks (
 id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL,
 task TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued',
 result TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
