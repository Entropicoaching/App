# Entropi local n8n blueprint

This folder is the secret-free source blueprint for the local Entropi n8n
runtime. It pins n8n Community Edition and contains the Windows launch and
recovery scripts. It never contains workflow credentials or runtime state.

For a fresh installation only:

1. Copy the contents of this folder to
   `%USERPROFILE%\Documents\Entropicoaching\n8n-local`.
2. Run `npm ci` inside that destination. The committed lockfile recreates the
   dependency tree that was tested with n8n 2.31.6.
3. Start `start-n8n.ps1`, open `http://127.0.0.1:5678`, and configure workflows
   and credentials through n8n.
4. Run `install-autostart.ps1` after the runtime has been tested.

Never replace an existing runtime folder with this blueprint. Its `data/`
folder contains the encrypted credential store and workflow database. Use the
tracked scripts as reviewed references and update an existing installation one
file at a time, preserving `data/` and `package-lock.json`.
