export const sessionStyle = `
.e2-session {background:#141410;color-scheme:dark;color:#edeae2;font:16px/1.5 'IBM Plex Sans',Arial,sans-serif}
.e2-session button,.e2-session input,.e2-session summary {font:inherit;min-height:44px;box-sizing:border-box}
.e2-session button {min-width:44px;padding:12px 16px;border:1px solid #77776b;border-radius:12px;background:#1c1c18;color:inherit;cursor:pointer}
.e2-session button:disabled {opacity:1;cursor:default}
.e2-session :focus-visible {outline:3px solid #c8923a;outline-offset:3px}
.e2-session dialog {position:fixed;inset:0;margin:0;width:100%;height:100dvh;max-width:none;max-height:none;border:0;padding:0;background:#141410;color:inherit;overflow:auto}
.e2-session dialog::backdrop {background:#141410}
.e2-session .frame {max-width:480px;box-sizing:border-box;margin:auto;padding:0 20px 32px;overflow-wrap:anywhere}
.e2-session .handle {min-height:44px;text-align:center;touch-action:none;user-select:none}
.e2-session h1 {font:36px/1.12 'Playfair Display',Georgia,serif;margin:20px 0 12px}
.e2-session h2 {font-size:24px;line-height:1.2}
.e2-session .card {background:#1c1c18;border:1px solid #414139;border-radius:16px;padding:20px;margin:20px 0}
.e2-session .fields {display:grid;grid-template-columns:1fr;gap:10px}
.e2-session .stepper-line {display:grid;grid-template-columns:64px minmax(0,1fr) 64px;gap:8px;align-items:end}
.e2-session .stepper-line > button {min-height:56px;font-size:20px;font-weight:600;padding:4px}
.e2-session .stepper-line label {display:flex;flex-direction:column;gap:4px;text-align:center}
.e2-session .stepper-line input {text-align:center;font-size:22px;min-height:56px}
.e2-session .hint {font-size:13px;opacity:.75;margin:6px 0}
.e2-session label {display:block;min-width:0}
.e2-session input {display:block;width:100%;min-width:0;margin-top:8px;padding:12px;background:#141410;color:#edeae2;border:1px solid #77776b;border-radius:8px}
.e2-session .steppers {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.e2-session .steppers button {min-height:56px;font-size:20px;font-weight:600;padding:8px}
.e2-session .rpe-row {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}
.e2-session .rpe-row button {min-height:48px;padding:6px}
.e2-session .rpe-row button[aria-pressed="true"] {background:#c8923a;color:#141410;border-color:#c8923a}
.e2-session .approve {width:100%;min-height:52px;background:#c8923a;color:#141410;font-weight:600;margin-top:20px}
.e2-session .muted {color:#b8b4a8}
.e2-session .plan {font-size:26px;margin:8px 0}
.e2-session summary {cursor:pointer;padding:8px 0}
.e2-session [role=alert] {border-left:3px solid #c8923a;padding-left:12px}
`
