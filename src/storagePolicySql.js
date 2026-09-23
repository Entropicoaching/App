// ORDRE 333 · commit 1: fanger den fejl der holdt "upload og gå" nede fra 5. sep.
// En storage-policy der skriver `storage.foldername(name)` inde i en
// underforespørgsel (`exists (select ... from public.athletes a ...)`) binder
// `name` til underforespørgslens tabel, hvis den har en kolonne med det navn
// (athletes.name), i stedet for storage.objects.name. Policyen kan så aldrig
// blive sand. Kolonnen skal kvalificeres: objects.name.
//
// Ren tekstanalyse (ingen database). Bruges af storagePolicySql.test.js mod
// alle SQL-filer i supabase/ og mod den policy-tekst der faktisk kørte i
// produktion.

function statements(sql) {
  return String(sql || '')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
}

// Returnerer én post pr. ukvalificeret foldername(name) i en policy på
// storage.objects, der også indeholder en underforespørgsel.
export function findShadowedFolderNameArgs(sql) {
  const found = []
  for (const stmt of statements(sql)) {
    const head = stmt.match(/^(?:create|alter)\s+policy\s+("?)([^"\s]+)\1\s+on\s+storage\.objects\b/i)
    if (!head) continue
    if (!/\bselect\b[\s\S]*\bfrom\b/i.test(stmt)) continue
    for (const m of stmt.matchAll(/storage\.foldername\s*\(\s*([^)]+?)\s*\)/gi)) {
      if (/^name$/i.test(m[1])) found.push({ policy: head[2], arg: m[1] })
    }
  }
  return found
}
