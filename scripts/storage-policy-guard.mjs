// Vagt mod navnefejlen fra 5. sep (ordre 57, rettet i ordre 333):
// en policy paa storage.objects skrev `name` inde i
// `exists (select ... from public.athletes a ...)`. athletes har selv en kolonne
// `name`, saa Postgres bandt `name` til atletens navn i stedet for objektets sti.
//
// Reglen: inde i en `exists (...)` i en create/alter policy paa storage.objects
// maa `name` ikke staa ukvalificeret, hvis en tabel i underforespoergslen har
// en kolonne der hedder `name`. Skriv `objects.name` (eller `<alias>.name`).

// Tabeller med en `name`-kolonne som er oprettet uden for repoets migrationer.
export const KNOWN_TABLES_WITH_NAME = ['public.athletes'];

// Erstat kommentarer og strenge med mellemrum, saa offsets (og linjenumre) bevares.
export function maskSql(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const n = sql[i + 1];
    if (c === '-' && n === '-') {
      while (i < sql.length && sql[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && n === '*') {
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { out += sql[i] === '\n' ? '\n' : ' '; i++; }
      if (i < sql.length) { out += '  '; i += 2; }
    } else if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (!m) { out += c; i++; continue; }
      // Dollar-quotede funktionskroppe beholdes som kode (de kan indeholde SQL),
      // kun selve afgraenserne blankes.
      out += ' '.repeat(m[0].length); i += m[0].length;
    } else if (c === "'") {
      out += "'"; i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { out += '  '; i += 2; continue; }
        if (sql[i] === "'") { out += "'"; i++; break; }
        out += sql[i] === '\n' ? '\n' : ' '; i++;
      }
    } else { out += c; i++; }
  }
  return out;
}

function closingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === sep && depth === 0) { parts.push({ text: text.slice(start, i), start }); start = i + 1; }
  }
  parts.push({ text: text.slice(start), start });
  return parts;
}

const unquote = (id) => id.replace(/"/g, '').toLowerCase();
const qualify = (t) => (t.includes('.') ? t : `public.${t}`);
const IDENT = '(?:"[^"]+"|[A-Za-z_][\\w$]*)';
const TABLE = `${IDENT}(?:\\s*\\.\\s*${IDENT})?`;
const CONSTRAINT_WORDS = new Set(['constraint', 'primary', 'unique', 'foreign', 'check', 'exclude', 'like']);

// Kolonnenavne pr. tabel fra `create table` og `alter table ... add column`.
export function collectTableColumns(masked, tables = new Map()) {
  const add = (table, col) => {
    const key = qualify(unquote(table).replace(/\s+/g, ''));
    if (!tables.has(key)) tables.set(key, new Set());
    tables.get(key).add(unquote(col));
  };
  const createRe = new RegExp(`create\\s+(?:(?:global\\s+|local\\s+)?(?:temp|temporary|unlogged)\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?(${TABLE})\\s*\\(`, 'gi');
  for (let m; (m = createRe.exec(masked));) {
    const open = m.index + m[0].length - 1;
    const close = closingParen(masked, open);
    if (close < 0) continue;
    for (const part of splitTopLevel(masked.slice(open + 1, close), ',')) {
      const first = new RegExp(`^\\s*(${IDENT})`).exec(part.text);
      if (first && !CONSTRAINT_WORDS.has(first[1].toLowerCase())) add(m[1], first[1]);
    }
  }
  const alterRe = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?(${TABLE})([^;]*)`, 'gi');
  for (let m; (m = alterRe.exec(masked));) {
    const colRe = new RegExp(`add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENT})`, 'gi');
    for (let c; (c = colRe.exec(m[2]));) add(m[1], c[1]);
  }
  return tables;
}

// Alle `create policy` / `alter policy` paa storage.objects som {name, start, end}.
export function findStoragePolicies(masked) {
  const out = [];
  for (const stmt of splitTopLevel(masked, ';')) {
    const m = new RegExp(`^\\s*(?:create|alter)\\s+policy\\s+(${IDENT})\\s+on\\s+(?:only\\s+)?storage\\s*\\.\\s*objects\\b`, 'i').exec(stmt.text);
    if (m) out.push({ name: unquote(m[1]), start: stmt.start, end: stmt.start + stmt.text.length });
  }
  return out;
}

const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

const tableKey = (t) => qualify(unquote(t).replace(/\s+/g, ''));

// Fund i een policy-saetning (offsets i den maskerede tekst).
function checkPolicy(masked, policy, tables, file) {
  const withName = (t) => tables.get(tableKey(t))?.has('name') || KNOWN_TABLES_WITH_NAME.includes(tableKey(t));
  const findings = [];
  const body = masked.slice(policy.start, policy.end);
  const existsRe = /\bexists\s*\(/gi;
  for (let e; (e = existsRe.exec(body));) {
    const open = e.index + e[0].length - 1;
    const close = closingParen(body, open);
    if (close < 0) continue;
    const sub = body.slice(open + 1, close);
    const fromRe = new RegExp(`\\b(?:from|join)\\s+(${TABLE})`, 'gi');
    const clashing = new Set();
    for (let f; (f = fromRe.exec(sub));) if (withName(f[1])) clashing.add(tableKey(f[1]));
    if (!clashing.size) continue;
    const nameRe = /(^|[^\w$."])(name)(?![\w$"])/gi;
    for (let n; (n = nameRe.exec(sub));) {
      const at = policy.start + open + 1 + n.index + n[1].length;
      findings.push({
        file,
        policy: policy.name,
        line: lineAt(masked, at),
        tables: [...clashing],
        message: `ukvalificeret \`name\` inde i exists (...) mod ${[...clashing].join(', ')}, som selv har en kolonne \`name\`; skriv objects.name`,
      });
    }
  }
  return findings;
}

// Tjek et saet filer [{file, sql}] i den givne raekkefoelge (migrationsorden).
// Kolonner hentes fra dem alle. For hver policy taeller kun den SENESTE
// create/alter, for det er den der gaelder i databasen efter migrationerne.
export function checkFiles(files) {
  const tables = new Map();
  const masked = files.map((f) => maskSql(f.sql));
  masked.forEach((m) => collectTableColumns(m, tables));
  const latest = new Map();
  files.forEach((f, i) => {
    for (const p of findStoragePolicies(masked[i])) latest.set(p.name, { ...p, fileIndex: i });
  });
  const findings = [];
  for (const p of latest.values()) findings.push(...checkPolicy(masked[p.fileIndex], p, tables, files[p.fileIndex].file));
  return { policies: latest.size, findings, tables };
}
