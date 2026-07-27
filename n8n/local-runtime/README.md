# Entropi local n8n blueprint

This folder is the secret-free source blueprint for the local Entropi n8n
runtime. It pins n8n Community Edition and contains the Windows launch and
recovery scripts. The launcher retries a failed n8n child process after one
minute; Task Scheduler remains the outer startup boundary. A separate daily
task creates a consistent local SQLite snapshot plus the encryption config and
retains the newest 14 backups. The blueprint itself never contains workflow
credentials or runtime state.

For a fresh installation only:

1. Copy the contents of this folder to
   `%USERPROFILE%\Documents\Entropicoaching\n8n-local`.
2. Run `npm ci` inside that destination. The committed lockfile recreates the
   dependency tree that was tested with n8n 2.31.6.
3. Start `start-n8n.ps1`, open `http://127.0.0.1:5678`, and configure workflows
   and credentials through n8n.
4. Run `install-autostart.ps1` after the runtime has been tested.
5. Run `install-backup-autostart.ps1` after one manual `backup-n8n.ps1` succeeds.

Never replace an existing runtime folder with this blueprint. Its `data/`
folder contains the encrypted credential store and workflow database. Use the
tracked scripts as reviewed references and update an existing installation one
file at a time, preserving `data/` and `package-lock.json`.

Backups default to `%USERPROFILE%\Documents\Entropicoaching\n8n-backups`, outside
the runtime and repository. Each completed folder contains `database.sqlite`,
the secret n8n `config` needed to decrypt credentials, and a hash manifest. Never
commit, upload or share this backup folder. To restore, stop n8n first and copy a
verified backup's database and config into `data\.n8n`, removing the old
`database.sqlite-wal` and `database.sqlite-shm` only after n8n has stopped;
restoration is deliberately manual so an automated task can never overwrite live
credential state. Filesystem execution payloads are not included because the
current workflows deliberately process metadata only.
