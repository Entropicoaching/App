import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const EXPECTED_SHADOW_REF = 'maxhsefxbrvsgolscqwh'
export const DEFAULT_REDIRECT_TO = 'http://localhost:5199/subscription.html'
export const PUBLIC_SUBSCRIPTION_URL = 'https://app.entropicoaching.dk/subscription.html'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/
const MAX_PILOT_DURATION_MS = 366 * 24 * 60 * 60 * 1000
const root = fileURLToPath(new URL('..', import.meta.url))

function fail(message) {
  throw new Error(message)
}

export function parseEnv(source) {
  const allowed = new Set([
    'VITE_SUB_SUPABASE_URL',
    'VITE_SUB_SUPABASE_PROJECT_REF',
    'SUPABASE_SECRET_KEY',
  ])
  const values = {}

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || !allowed.has(match[1])) continue
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }

  return values
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!email || email.length > 254 || /\s/.test(email)) {
    fail('--email skal være én gyldig e-mailadresse.')
  }
  const parts = email.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]?.includes('.') || parts[1].startsWith('.') || parts[1].endsWith('.')) {
    fail('--email skal være én gyldig e-mailadresse.')
  }
  return email
}

export function normalizeUserId(value) {
  const userId = String(value || '').trim().toLowerCase()
  if (!UUID_PATTERN.test(userId)) fail('--user-id skal være testerens Auth UUID.')
  return userId
}

export function normalizeValidUntil(value, now = new Date()) {
  const source = String(value || '').trim()
  if (!UTC_TIMESTAMP_PATTERN.test(source)) {
    fail('--valid-until skal være et entydigt UTC-tidspunkt, fx 2026-09-01T21:59:59Z.')
  }
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) fail('--valid-until er ikke et gyldigt tidspunkt.')
  const duration = date.getTime() - now.getTime()
  if (duration <= 0) fail('--valid-until skal ligge i fremtiden.')
  if (duration > MAX_PILOT_DURATION_MS) fail('Pilotadgang må højst gives 366 dage frem.')
  return date.toISOString()
}

export function normalizeRedirectTo(value = DEFAULT_REDIRECT_TO) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail('--redirect-to skal være en fuld URL.')
  }
  if (url.username || url.password || url.search || url.hash) {
    fail('--redirect-to må ikke indeholde loginoplysninger, query eller fragment.')
  }
  if (url.pathname !== '/subscription.html') {
    fail('--redirect-to skal ende præcist på /subscription.html.')
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (isLocal) {
    if (url.protocol !== 'http:' || url.port !== '5199') {
      fail('Lokal redirect skal være http://localhost:5199/subscription.html.')
    }
  } else if (url.protocol !== 'https:') {
    fail('En ekstern redirect skal bruge HTTPS.')
  }
  return url.toString()
}

export function verifyShadowContext({ env, binding }) {
  if (binding?.expectedProjectRef !== EXPECTED_SHADOW_REF) {
    fail('Den autoritative shadow-binding matcher ikke den godkendte project ref.')
  }
  const configuredRef = String(env.VITE_SUB_SUPABASE_PROJECT_REF || '').trim().toLowerCase()
  if (configuredRef !== EXPECTED_SHADOW_REF) {
    fail('VITE_SUB_SUPABASE_PROJECT_REF peger ikke på den godkendte subscription-shadow.')
  }

  let url
  try {
    url = new URL(env.VITE_SUB_SUPABASE_URL)
  } catch {
    fail('VITE_SUB_SUPABASE_URL mangler eller er ugyldig.')
  }
  if (url.protocol !== 'https:' || url.hostname !== `${EXPECTED_SHADOW_REF}.supabase.co`) {
    fail('Supabase-URL peger ikke på den godkendte subscription-shadow.')
  }

  const secretKey = String(env.SUPABASE_SECRET_KEY || '').trim()
  if (!secretKey || /replace|placeholder|example|^</i.test(secretKey)) {
    fail('SUPABASE_SECRET_KEY til shadow mangler i den valgte lokale env-fil.')
  }

  return {
    projectRef: EXPECTED_SHADOW_REF,
    url: url.toString(),
    secretKey,
  }
}

export function activationRequestId({ userId, validUntil }) {
  const digest = createHash('sha256')
    .update(`entropi-subscription-pilot-activation-v1:${normalizeUserId(userId)}:${validUntil}`)
    .digest('hex')
    .slice(0, 32)
    .split('')
  digest[12] = '5'
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16], 16) % 4]
  const hex = digest.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const ACTION_FLAGS = {
  preflight: new Set(['email', 'valid-until', 'redirect-to', 'env-file']),
  invite: new Set(['email', 'valid-until', 'redirect-to', 'env-file', 'execute', 'confirm-project']),
  'invite-link': new Set(['email', 'valid-until', 'redirect-to', 'env-file', 'execute', 'confirm-project']),
  'login-link': new Set(['email', 'user-id', 'redirect-to', 'env-file', 'execute', 'confirm-project']),
  status: new Set(['email', 'user-id', 'env-file', 'execute', 'confirm-project']),
  activate: new Set(['email', 'user-id', 'valid-until', 'env-file', 'execute', 'confirm-project']),
}

export function parseArgs(argv) {
  const action = argv[0]
  if (!ACTION_FLAGS[action]) fail('Vælg handling: preflight, invite, invite-link, login-link, status eller activate.')
  const options = {}
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) fail(`Ukendt argument: ${token}`)
    const key = token.slice(2)
    if (!ACTION_FLAGS[action].has(key)) fail(`--${key} kan ikke bruges med ${action}.`)
    if (Object.hasOwn(options, key)) fail(`--${key} må kun angives én gang.`)
    if (key === 'execute') {
      options[key] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`--${key} mangler en værdi.`)
    options[key] = value
    index += 1
  }
  return { action, options }
}

export function buildPlan({ action, options, now = new Date() }) {
  const email = normalizeEmail(options.email)
  const execute = options.execute === true
  if (execute && options['confirm-project'] !== EXPECTED_SHADOW_REF) {
    fail(`Netværkshandlinger kræver --confirm-project ${EXPECTED_SHADOW_REF}.`)
  }
  if (!execute && options['confirm-project']) {
    fail('--confirm-project bruges kun sammen med --execute.')
  }

  const plan = {
    action,
    execute,
    email,
    envFile: options['env-file'] || '.env.local',
    projectRef: EXPECTED_SHADOW_REF,
  }
  if (['preflight', 'invite', 'invite-link', 'login-link'].includes(action)) {
    const redirectDefault = action === 'login-link' ? PUBLIC_SUBSCRIPTION_URL : DEFAULT_REDIRECT_TO
    plan.redirectTo = normalizeRedirectTo(options['redirect-to'] || redirectDefault)
    if (action === 'login-link' && plan.redirectTo !== PUBLIC_SUBSCRIPTION_URL) {
      fail(`login-link skal bruge den offentlige callback ${PUBLIC_SUBSCRIPTION_URL}.`)
    }
  }
  if (['preflight', 'invite', 'invite-link', 'activate'].includes(action)) {
    plan.validUntil = normalizeValidUntil(options['valid-until'], now)
  }
  if (['login-link', 'status', 'activate'].includes(action)) {
    plan.userId = normalizeUserId(options['user-id'])
  }
  if (action === 'activate') {
    plan.requestId = activationRequestId(plan)
  }
  return plan
}

export function loadLocalContext(envFile) {
  const envPath = resolve(root, envFile)
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
  if (!envPath.startsWith(rootPrefix)) fail('--env-file skal ligge inde i app-worktree.')
  const bindingPath = resolve(root, 'config', 'subscription-shadow-binding.json')
  let env
  let binding
  try {
    env = parseEnv(readFileSync(envPath, 'utf8'))
    binding = JSON.parse(readFileSync(bindingPath, 'utf8'))
  } catch {
    fail('Den lokale env-fil eller shadow-binding kunne ikke læses.')
  }
  return verifyShadowContext({ env, binding })
}

function makeOperator(context) {
  return createClient(context.url, context.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function exactEmail(user, email) {
  return String(user?.email || '').trim().toLowerCase() === email
}

export function validateGeneratedInviteLink({ properties, user, plan }) {
  if (!user?.id || !UUID_PATTERN.test(user.id) || !exactEmail(user, plan.email)) {
    fail('Supabase returnerede ikke den forventede inviterede Auth-bruger. Del ikke linket.')
  }
  if (properties?.verification_type !== 'invite') {
    fail('Det genererede link har ikke invitationstypen. Del ikke linket.')
  }
  if (properties.redirect_to !== plan.redirectTo) {
    fail('Det genererede links callback matcher ikke den godkendte subscription-URL. Del ikke linket.')
  }
  if (!properties.hashed_token || typeof properties.hashed_token !== 'string') {
    fail('Det genererede link mangler et invitationstoken. Del ikke linket.')
  }

  let actionLink
  try {
    actionLink = new URL(properties.action_link)
  } catch {
    fail('Det genererede action-link er ugyldigt. Del ikke linket.')
  }
  if (
    actionLink.protocol !== 'https:'
    || actionLink.hostname !== `${EXPECTED_SHADOW_REF}.supabase.co`
    || actionLink.port
    || actionLink.pathname !== '/auth/v1/verify'
    || actionLink.username
    || actionLink.password
    || actionLink.hash
  ) {
    fail('Det genererede action-link peger ikke præcist på den godkendte subscription-shadow. Del ikke linket.')
  }

  const keys = [...actionLink.searchParams.keys()].sort()
  if (keys.join(',') !== 'redirect_to,token,type') {
    fail('Det genererede action-link har uventede eller duplikerede parametre. Del ikke linket.')
  }
  if (
    actionLink.searchParams.get('type') !== 'invite'
    || actionLink.searchParams.get('redirect_to') !== plan.redirectTo
    || actionLink.searchParams.get('token') !== properties.hashed_token
  ) {
    fail('Action-linkets type, token eller callback matcher ikke Supabase-svaret. Del ikke linket.')
  }

  return {
    actionLink: actionLink.toString(),
    userId: user.id.toLowerCase(),
  }
}

export function validateGeneratedMagicLink({ properties, user, plan }) {
  if (user?.id !== plan.userId || !exactEmail(user, plan.email)) {
    fail('Supabase returnerede ikke den præcise eksisterende Auth-bruger. Loginlinket blev ikke udleveret.')
  }
  if (properties?.verification_type !== 'magiclink') {
    fail('Det genererede link har ikke magic-link-typen. Loginlinket blev ikke udleveret.')
  }
  if (properties.redirect_to !== plan.redirectTo) {
    fail('Det genererede links callback matcher ikke den godkendte subscription-URL. Loginlinket blev ikke udleveret.')
  }
  if (!properties.hashed_token || typeof properties.hashed_token !== 'string') {
    fail('Det genererede link mangler et login-token. Loginlinket blev ikke udleveret.')
  }

  let actionLink
  try {
    actionLink = new URL(properties.action_link)
  } catch {
    fail('Det genererede action-link er ugyldigt. Loginlinket blev ikke udleveret.')
  }
  if (
    actionLink.protocol !== 'https:'
    || actionLink.hostname !== `${EXPECTED_SHADOW_REF}.supabase.co`
    || actionLink.port
    || actionLink.pathname !== '/auth/v1/verify'
    || actionLink.username
    || actionLink.password
    || actionLink.hash
  ) {
    fail('Det genererede action-link peger ikke præcist på den godkendte subscription-shadow. Loginlinket blev ikke udleveret.')
  }

  const keys = [...actionLink.searchParams.keys()].sort()
  if (keys.join(',') !== 'redirect_to,token,type') {
    fail('Det genererede action-link har uventede eller duplikerede parametre. Loginlinket blev ikke udleveret.')
  }
  if (
    actionLink.searchParams.get('type') !== 'magiclink'
    || actionLink.searchParams.get('redirect_to') !== plan.redirectTo
    || actionLink.searchParams.get('token') !== properties.hashed_token
  ) {
    fail('Action-linkets type, token eller callback matcher ikke Supabase-svaret. Loginlinket blev ikke udleveret.')
  }

  return actionLink.toString()
}

export function magicLinkHandoffUrl(actionLink, redirectTo = PUBLIC_SUBSCRIPTION_URL) {
  const handoff = new URL(redirectTo)
  handoff.hash = `entropi_magic_link=${encodeURIComponent(actionLink)}`
  return handoff.toString()
}

function copySensitiveTextToClipboard(value) {
  const result = spawnSync('clip.exe', [], {
    input: value,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    fail('Det personlige login kunne ikke kopieres sikkert til udklipsholderen. Intet link blev skrevet i terminalen.')
  }
}

export function authReadiness(user, email, expectedUserId) {
  if (expectedUserId && user?.id !== expectedUserId) fail('Auth-brugerens UUID matcher ikke den planlagte tester.')
  if (!user?.id || !exactEmail(user, email)) fail('Auth-brugerens e-mail matcher ikke den planlagte tester.')
  const invitedAt = user.invited_at ? new Date(user.invited_at) : null
  const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at) : null
  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null
  const validDate = value => value && !Number.isNaN(value.getTime())
  return {
    invited: Boolean(validDate(invitedAt)),
    confirmed: Boolean(validDate(confirmedAt)),
    loggedInAfterInvite: Boolean(validDate(invitedAt) && validDate(lastSignInAt) && lastSignInAt >= invitedAt),
  }
}

export async function executePlan(plan, context, clientFactory = makeOperator, clipboardWriter = copySensitiveTextToClipboard) {
  if (!plan.execute) {
    return {
      state: 'DRY_RUN',
      action: plan.action,
      projectRef: plan.projectRef,
      email: plan.email,
      userId: plan.userId,
      validUntil: plan.validUntil,
      redirectTo: plan.redirectTo,
      requestId: plan.requestId,
      networkAttempted: false,
    }
  }

  const operator = clientFactory(context)
  if (plan.action === 'invite') {
    const { data, error } = await operator.auth.admin.inviteUserByEmail(plan.email, {
      redirectTo: plan.redirectTo,
    })
    if (error) fail(`Invitationen blev ikke sendt: ${error.message}`)
    if (!data?.user?.id || !exactEmail(data.user, plan.email)) {
      fail('Supabase returnerede ikke den forventede inviterede Auth-bruger. Genudsend ikke automatisk.')
    }
    return {
      state: 'INVITE_SENT',
      projectRef: plan.projectRef,
      email: plan.email,
      userId: data.user.id,
      validUntil: plan.validUntil,
      redirectTo: plan.redirectTo,
      memberGranted: false,
    }
  }

  if (plan.action === 'invite-link') {
    const { data, error } = await operator.auth.admin.generateLink({
      type: 'invite',
      email: plan.email,
      options: { redirectTo: plan.redirectTo },
    })
    if (error) fail(`Invitationslinket blev ikke oprettet: ${error.message}`)
    const validated = validateGeneratedInviteLink({
      properties: data?.properties,
      user: data?.user,
      plan,
    })
    return {
      state: 'SENSITIVE_INVITE_LINK_CREATED',
      sensitivity: 'SECRET_SINGLE_USE_AUTH_LINK',
      projectRef: plan.projectRef,
      email: plan.email,
      userId: validated.userId,
      validUntil: plan.validUntil,
      redirectTo: plan.redirectTo,
      actionLink: validated.actionLink,
      memberGranted: false,
      handling: 'Del kun direkte med den rigtige tester. Kopiér ikke linket til dokumenter, tickets eller git.',
    }
  }

  const { data: userData, error: userError } = await operator.auth.admin.getUserById(plan.userId)
  if (userError) fail(`Auth-status kunne ikke læses: ${userError.message}`)
  const readiness = authReadiness(userData?.user, plan.email, plan.userId)

  if (plan.action === 'login-link') {
    if (!readiness.confirmed) {
      fail('Den præcise eksisterende tester har ikke bekræftet sin Auth-konto. Loginlinket blev ikke oprettet.')
    }
    const { data, error } = await operator.auth.admin.generateLink({
      type: 'magiclink',
      email: plan.email,
      options: { redirectTo: plan.redirectTo },
    })
    if (error) fail('Loginlinket blev ikke oprettet. Intet link blev skrevet i terminalen.')
    const actionLink = validateGeneratedMagicLink({
      properties: data?.properties,
      user: data?.user,
      plan,
    })
    await clipboardWriter(magicLinkHandoffUrl(actionLink, plan.redirectTo))
    return {
      state: 'SENSITIVE_LOGIN_HANDOFF_COPIED',
      sensitivity: 'SECRET_SINGLE_USE_AUTH_LINK',
      projectRef: plan.projectRef,
      email: plan.email,
      userId: plan.userId,
      redirectTo: plan.redirectTo,
      copiedToClipboard: true,
      memberGranted: false,
      entitlementChanged: false,
      handling: 'Indsæt direkte til den rigtige tester. Udklipsholderens indhold må ikke gemmes i docs, screenshots, tasks eller git.',
    }
  }

  if (plan.action === 'status') {
    return {
      state: 'AUTH_STATUS',
      projectRef: plan.projectRef,
      email: plan.email,
      userId: plan.userId,
      ...readiness,
      readyForActivation: readiness.invited && readiness.confirmed && readiness.loggedInAfterInvite,
      memberGranted: false,
    }
  }

  if (!readiness.invited) fail('Brugeren er ikke oprettet gennem en Auth-invitation.')
  if (!readiness.confirmed) fail('Testeren har endnu ikke bekræftet invitationen.')
  if (!readiness.loggedInAfterInvite) fail('Testeren skal åbne invitationen og gennemføre login før aktivering.')

  const { data, error } = await operator.rpc('sub_controlled_activate_invited_member', {
    p_request_id: plan.requestId,
    p_target_user_id: plan.userId,
    p_invited_email: plan.email,
    p_valid_until: plan.validUntil,
  })
  if (error) fail(`Medlemsadgangen blev ikke aktiveret: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.activation_id || row.tier !== 'member' || new Date(row.valid_until).getTime() !== new Date(plan.validUntil).getTime()) {
    fail('Aktiverings-RPC returnerede et uventet svar. Kontrollér shadow før flere handlinger.')
  }
  return {
    state: 'MEMBER_ACTIVATED',
    projectRef: plan.projectRef,
    email: plan.email,
    userId: plan.userId,
    activationId: row.activation_id,
    validUntil: new Date(row.valid_until).toISOString(),
    requestId: plan.requestId,
    tier: row.tier,
  }
}

function printUsage() {
  console.log(`Sikker owner-proces til én tester i Entropi subscription-shadow.

Først (ingen netværk):
  npm run owner:subscription-shadow-tester -- preflight --email TESTER --valid-until UTC

Invitation (dry-run uden --execute):
  npm run owner:subscription-shadow-tester -- invite --email TESTER --valid-until UTC

Omkostningsfri fallback uden udsendt Supabase-mail (følsomt link):
  npm run owner:subscription-shadow-tester -- invite-link --email TESTER --valid-until UTC

Ny loginadgang til en eksisterende, bekræftet shadow-tester (kopieres kun til udklipsholder):
  npm run owner:subscription-shadow-tester -- login-link --email TESTER --user-id UUID --redirect-to ${PUBLIC_SUBSCRIPTION_URL}

Status efter testerens første login (netværkslæsning, ingen skrivehandling):
  npm run owner:subscription-shadow-tester -- status --email TESTER --user-id UUID --execute --confirm-project ${EXPECTED_SHADOW_REF}

Aktivering (service-only RPC):
  npm run owner:subscription-shadow-tester -- activate --email TESTER --user-id UUID --valid-until UTC --execute --confirm-project ${EXPECTED_SHADOW_REF}

Kør invite eller invite-link med samme --execute og --confirm-project for faktisk at oprette invitationen.
Standard redirect er ${DEFAULT_REDIRECT_TO}. Brug --redirect-to med en godkendt HTTPS subscription-URL til en ekstern tester.`)
}

async function cli() {
  if (process.argv.slice(2).length === 0 || process.argv.includes('--help')) {
    printUsage()
    return
  }
  try {
    const parsed = parseArgs(process.argv.slice(2))
    const plan = buildPlan(parsed)
    const context = loadLocalContext(plan.envFile)
    const result = await executePlan(plan, context)
    console.log(JSON.stringify(result, null, 2))
    if (result.state === 'SENSITIVE_INVITE_LINK_CREATED') {
      console.warn('FØLSOMT: Linket giver adgang til testerens Auth-konto, indtil det bruges eller udløber. Del det kun direkte og sikkert.')
    }
    if (result.state === 'SENSITIVE_LOGIN_HANDOFF_COPIED') {
      console.warn('FØLSOMT: Et personligt engangslogin er kopieret til udklipsholderen. Terminalen viser ikke linket.')
    }
    if (result.state === 'DRY_RUN') {
      const next = plan.action === 'preflight'
        ? 'Preflight er afsluttet; vælg derefter invite som dry-run.'
        : 'Tilføj kun --execute efter manuel kontrol.'
      console.log(`Ingen netværks- eller Supabase-handling blev forsøgt. ${next}`)
    }
  } catch (error) {
    console.error(`STOP: ${error.message}`)
    console.error('Ingen automatisk retry udføres.')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await cli()
