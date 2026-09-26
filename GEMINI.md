# Project Guidelines & Autonomous Execution Rules

## Autonomous Execution & Decision Making
- **Full Autonomous Rights Granted:** Do not pause to ask for permission or approval on standard edits, code fixes, file creations, routine refactors, dependency additions, or testing in this project.
- **Autonomous Searching (Standing Permission):** Full permission granted for web searches, documentation lookups, and codebase searches. Never pause to ask for permission before searching.
- **Execute Directly:** Proceed directly with implementation without asking "Shall I proceed?", "Do you want me to do this?", or waiting for approval on routine work.

## When to Ask Before Implementation
- **Major Implementations Only:** Pause to consult the user or confirm the plan **only** before large, high-impact changes (e.g., changes taking substantial time/effort (>30 seconds of execution/deep restructuring), fundamental architectural redesigns, or breaking structural rewrites).
- For large implementations, provide a concise, high-level summary of the proposed direction before executing.

## Database Protection (Strict & Non-Negotiable)
- **Always Ask Before Deleting Database Data:** As mandated by the global database safety policy, NEVER delete, drop, truncate, or purge any data, tables, collections, or records from any database without explicit prior written approval.
- Always display the exact query or command before performing any database deletion and wait for confirmation.

## API Key & Secret Management Safety (Strict & Global)
- **Absolute Prohibition on Storing API Keys in Databases:** Never save, store, or persist any API keys, Personal Access Tokens (PATs), OAuth tokens, secret credentials, or passwords in any database (SQL, PostgreSQL, MongoDB, SQLite, etc.) or persistent tables.
- **Ephemeral Session Use Only & Immediate Deletion:** API keys and access tokens provided by the user must be used ephemerally in-memory only for the specific command or workflow requested.
- **End-of-Day & Session Close Deletion:** API keys must be wiped and deleted at the end of the day or immediately whenever Antigravity is closed or the active session ends.
- **Never Commit Secrets to Repositories:** Never write, commit, or push API keys or sensitive credentials into Git repositories, source code files, or documentation.
