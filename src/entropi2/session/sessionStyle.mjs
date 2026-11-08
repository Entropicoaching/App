export const sessionStyle = `
.e2-session {background:#141410;color-scheme:dark;color:#edeae2;font:16px/1.5 'IBM Plex Sans',Arial,sans-serif}
.e2-session button,.e2-session input,.e2-session textarea,.e2-session select,.e2-session summary {font:inherit;min-height:44px;box-sizing:border-box}
.e2-session button {min-width:44px;padding:12px 16px;border:1px solid #77776b;border-radius:12px;background:#1c1c18;color:inherit;cursor:pointer}
.e2-session :focus-visible {outline:3px solid #c8923a;outline-offset:3px}
.e2-session dialog {position:fixed;inset:0;margin:0;width:100%;height:100dvh;max-width:none;max-height:none;border:0;padding:0;background:#141410;color:inherit;overflow:auto}
.e2-session dialog::backdrop {background:#141410}
.e2-session .frame {max-width:480px;box-sizing:border-box;margin:auto;padding:0 20px 32px;overflow-wrap:anywhere}
.e2-session .handle {min-height:44px;text-align:center;touch-action:none;user-select:none}
.e2-session h1 {font:36px/1.12 'Playfair Display',Georgia,serif;margin:20px 0 12px}
.e2-session h2 {font-size:24px;line-height:1.2}
.e2-session .card {background:#1c1c18;border:1px solid #414139;border-radius:16px;padding:20px;margin:20px 0}
.e2-session .plan-card {padding:16px;margin:12px 0}
.e2-session .plan-card > p {margin:8px 0}
.e2-session .plan-card > p:first-child {margin-top:0}
.e2-session .plan-card > p:last-child {margin-bottom:0}
.e2-session .registration-card {margin-top:12px}
.e2-session .fields {display:grid;grid-template-columns:1fr;gap:10px}
.e2-session [data-e2-session-feeling] {min-width:0;max-width:100%;box-sizing:border-box}
.e2-session [data-e2-session-feeling] legend {font-size:18px}
.e2-session .stepper-line {display:grid;grid-template-columns:64px minmax(0,1fr) 64px;gap:8px;align-items:end}
.e2-session .stepper-line > button {min-height:56px;font-size:20px;font-weight:600;padding:4px}
.e2-session .stepper-line label {display:flex;flex-direction:column;gap:4px;text-align:center}
.e2-session .stepper-line input {text-align:center;font-size:22px;min-height:56px}
.e2-session .plate-tool > summary {display:inline-flex;align-items:center;border:1px solid #77776b;border-radius:10px;padding:4px 12px}
.e2-session .note-choices {display:flex;flex-wrap:wrap;gap:8px}
.e2-session [data-set-note] {min-width:0;border:1px solid #77776b;border-radius:12px;padding:12px;margin-top:16px}
.e2-session .note-choices button[aria-pressed="true"] {background:#c8923a;color:#141410}
.e2-session textarea {resize:vertical}
.e2-session [data-e2-tempo] h3 {font-size:16px;margin-bottom:4px}
.e2-session .hint {font-size:13px;opacity:.75;margin:6px 0}
.e2-session label {display:block;min-width:0}
.e2-session input,.e2-session textarea,.e2-session select {display:block;width:100%;min-width:0;margin-top:8px;padding:12px;background:#141410;color:#edeae2;border:1px solid #77776b;border-radius:8px}
.e2-session .steppers {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.e2-session .steppers button {min-height:56px;font-size:20px;font-weight:600;padding:8px}
.e2-session .rpe-row {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}
.e2-session .rpe-row button {min-height:48px;padding:6px}
.e2-session .rpe-row button[aria-pressed="true"] {background:#c8923a;color:#141410;border-color:#c8923a}
.e2-session .approve {width:100%;min-height:52px;background:#c8923a;color:#141410;font-weight:600;margin-top:20px}
.e2-session .record-receipt {border-left:2px solid #c8923a;padding:8px 12px;margin:12px 0;overflow-wrap:anywhere}
.e2-session .muted {color:#b8b4a8}
.e2-session .session-overview {min-width:0;max-width:100%;box-sizing:border-box;border:1px solid #77776b;border-radius:12px;padding:8px 12px;margin:12px 0;overflow-wrap:anywhere}
.e2-session .session-overview summary {min-height:44px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere}
.e2-session .session-overview h2 {font-size:20px;margin:12px 0}
.e2-session .overview-exercises {padding-left:24px;margin:12px 0}
.e2-session .overview-exercises > li {min-width:0;padding:8px 0;border-top:1px solid #414139}
.e2-session .overview-exercises p {margin:6px 0;font-size:14px}
.e2-session .overview-progress {color:#b8b4a8}
.e2-session .overview-dosage {display:block;font-size:14px;color:#b8b4a8}
.e2-session .overview-sets {padding-left:20px;font-size:14px}
.e2-session .session-overview [aria-current="step"],.e2-session .overview-sets [data-overview-current] {border-left:3px solid #c8923a;padding-left:8px;font-weight:600}
.e2-session .session-overview button {min-height:44px;max-width:100%;white-space:normal;overflow-wrap:anywhere}
.e2-session .plan {font-size:22px;line-height:1.4;overflow-wrap:anywhere}
.e2-session summary {cursor:pointer;padding:8px 0}
.e2-session [role=alert] {border-left:3px solid #c8923a;padding-left:12px}
.e2-session button:disabled,.e2-session button[aria-pressed="true"]:disabled {background:#30302a;color:#b8b4a8;border-color:#858578;border-style:dashed;opacity:1;cursor:not-allowed}
`
