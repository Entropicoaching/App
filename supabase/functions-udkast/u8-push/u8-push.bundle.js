// u8-push samlet til én fil (U8, ordre 78). UDKAST, ikke deployet. Ret ikke her:
// ret kilden i supabase/functions-udkast/u8-push/ og kør node scripts/u8-push-bundle.mjs.
var defaults = () => ({
	push: true,
	send: true
});
function u8Enabled(part, value) {
	if (value === void 0) return defaults()[part] === true;
	return value === true;
}
Array.from({ length: 65 }, (_, i) => {
	const minutes = 360 + i * 15;
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
var validPublicKey = (value) => typeof value === "string" && /^B[A-Za-z0-9_-]{86}$/.test(value);
//#endregion
//#region supabase/functions-udkast/u8-push/webPush.mjs
var enc = new TextEncoder();
function b64urlEncode(bytes) {
	let text = "";
	for (const byte of bytes) text += String.fromCharCode(byte);
	return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(text) {
	const plain = String(text).replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
	return Uint8Array.from(atob(plain + "=".repeat((4 - plain.length % 4) % 4)), (c) => c.charCodeAt(0));
}
var concat = (...parts) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
};
async function importVapid({ publicKey, privateKey, crypto = globalThis.crypto }) {
	const pub = b64urlDecode(publicKey), d = b64urlDecode(privateKey);
	if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) throw Error("VAPID-nøglen har forkert form");
	const jwk = {
		kty: "EC",
		crv: "P-256",
		x: b64urlEncode(pub.slice(1, 33)),
		y: b64urlEncode(pub.slice(33)),
		d: b64urlEncode(d),
		ext: true
	};
	return {
		key: await crypto.subtle.importKey("jwk", jwk, {
			name: "ECDSA",
			namedCurve: "P-256"
		}, false, ["sign"]),
		publicKey: b64urlEncode(pub)
	};
}
async function vapidAuthorization({ endpoint, vapid, subject, nowSeconds, crypto = globalThis.crypto }) {
	const header = b64urlEncode(enc.encode(JSON.stringify({
		typ: "JWT",
		alg: "ES256"
	})));
	const claims = b64urlEncode(enc.encode(JSON.stringify({
		aud: new URL(endpoint).origin,
		exp: nowSeconds + 43200,
		sub: subject
	})));
	const signature = await crypto.subtle.sign({
		name: "ECDSA",
		hash: "SHA-256"
	}, vapid.key, enc.encode(`${header}.${claims}`));
	return `vapid t=${header}.${claims}.${b64urlEncode(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}
async function hkdf(crypto, salt, ikm, info, length) {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	return new Uint8Array(await crypto.subtle.deriveBits({
		name: "HKDF",
		hash: "SHA-256",
		salt,
		info
	}, key, length * 8));
}
async function encryptPayload({ payload, p256dh, auth, crypto = globalThis.crypto, salt, serverKeys }) {
	const ua = b64urlDecode(p256dh), secret = b64urlDecode(auth);
	if (ua.length !== 65 || ua[0] !== 4 || secret.length !== 16) throw Error("Telefonens nøgle har forkert form");
	const server = serverKeys ?? await crypto.subtle.generateKey({
		name: "ECDH",
		namedCurve: "P-256"
	}, true, ["deriveBits"]);
	const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", server.publicKey));
	const uaKey = await crypto.subtle.importKey("raw", ua, {
		name: "ECDH",
		namedCurve: "P-256"
	}, false, []);
	const ikm = await hkdf(crypto, secret, new Uint8Array(await crypto.subtle.deriveBits({
		name: "ECDH",
		public: uaKey
	}, server.privateKey, 256)), concat(enc.encode("WebPush: info\0"), ua, asPublic), 32);
	const s = salt ?? crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const cek = await hkdf(crypto, s, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(crypto, s, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
	const plain = concat(enc.encode(payload), new Uint8Array([2]));
	if (plain.length + 16 > 4096) throw Error("Beskeden er for lang");
	const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
	const sealed = new Uint8Array(await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: nonce
	}, key, plain));
	const header = new Uint8Array(21 + asPublic.length);
	header.set(s, 0);
	new DataView(header.buffer).setUint32(16, 4096);
	header[20] = asPublic.length;
	header.set(asPublic, 21);
	return concat(header, sealed);
}
async function sendPush({ subscription, payload, vapid, subject, fetch: http = fetch, nowSeconds, crypto = globalThis.crypto, ttl = 86400 }) {
	const body = await encryptPayload({
		payload,
		p256dh: subscription.p256dh,
		auth: subscription.auth,
		crypto
	});
	const authorization = await vapidAuthorization({
		endpoint: subscription.endpoint,
		vapid,
		subject,
		nowSeconds,
		crypto
	});
	const response = await http(subscription.endpoint, {
		method: "POST",
		body,
		headers: {
			Authorization: authorization,
			TTL: String(ttl),
			Urgency: "normal",
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream"
		},
		signal: AbortSignal.timeout(1e4)
	});
	return {
		status: response.status,
		gone: response.status === 404 || response.status === 410
	};
}
//#endregion
//#region src/athlete/kostNumbers.mjs
function calendarTime(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const time = Date.parse(value + "T00:00:00Z");
	return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
//#endregion
//#region src/calendarDate.js
var DAY = 864e5;
new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Copenhagen",
	year: "numeric",
	month: "2-digit",
	day: "2-digit"
});
function addCalendarDays(day, count) {
	const time = calendarTime(day);
	if (time === null || !Number.isSafeInteger(count)) return null;
	const date = new Date(time + count * DAY);
	if (!Number.isFinite(date.getTime())) return null;
	const result = date.toISOString().slice(0, 10);
	return calendarTime(result) === null ? null : result;
}
function calendarDaysBetween(from, to) {
	const a = calendarTime(from), b = calendarTime(to);
	return a === null || b === null ? null : (b - a) / DAY;
}
//#endregion
//#region src/entropi2/paamindelser/reminderRules.mjs
var validDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDaysBetween(value, value) === 0;
var validMinute = (value) => Number.isInteger(value) && value >= 0 && value < 1440;
function friendlyReminders(input = {}) {
	if (input?.enabled !== true) return [];
	const { today, minuteOfDay, window = {
		start: 540,
		end: 1200
	} } = input;
	if (!validDay(today) || !validMinute(minuteOfDay) || !window || !validMinute(window.start) || !validMinute(window.end) || window.start === window.end) return [];
	if (!(window.start < window.end ? minuteOfDay >= window.start && minuteOfDay < window.end : minuteOfDay >= window.start || minuteOfDay < window.end) || input.paused === true) return [];
	const reminders = [];
	const nutrition = input.nutrition;
	const since = addCalendarDays(today, -3);
	if (nutrition?.complete === true && validDay(nutrition.observedFrom) && nutrition.observedFrom <= since && Array.isArray(nutrition.loggedDays) && nutrition.loggedDays.every((day) => validDay(day) && day <= today) && !nutrition.loggedDays.some((day) => day >= since)) reminders.push({
		key: `nutrition:${today}`,
		kind: "nutrition",
		date: today,
		title: "Lyst til at notere et måltid?",
		text: "Du kan starte med det næste måltid, hvis det passer dig. Du behøver ikke udfylde de tidligere dage.",
		action: "nutrition"
	});
	const sessions = input.sessions;
	if (sessions?.complete === true && Array.isArray(sessions.items)) {
		const session = sessions.items.filter((item) => item && typeof item.id === "string" && item.id.trim() === item.id && item.id.length > 0 && item.id.length <= 120 && item.registered === false && validDay(item.date) && calendarDaysBetween(item.date, today) >= 1 && calendarDaysBetween(item.date, today) <= 3).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
		if (session) reminders.push({
			key: `session:${session.date}:${session.id}`,
			kind: "session",
			date: session.date,
			title: "Vil du notere dit pas?",
			text: "Hvis du trænede, kan du registrere passet, når det passer dig. Det er også okay, hvis planen ændrede sig.",
			action: "session",
			sessionId: session.id
		});
	}
	const checkin = input.checkin;
	if (checkin?.complete === true && checkin.submitted === false && validDay(checkin.dueDate)) {
		const age = calendarDaysBetween(checkin.dueDate, today);
		if (age >= 0 && age < 7) reminders.push({
			key: `checkin:${checkin.dueDate}`,
			kind: "checkin",
			date: checkin.dueDate,
			title: "Har du lyst til at dele, hvordan det går?",
			text: "Et kort check-in kan hjælpe med at tilpasse din plan. Du kan gøre det, når du har overskud.",
			action: "checkin"
		});
	}
	const local = input.localCheckin;
	if (!checkin && local?.complete === true && local.status === "empty" && validDay(local.weekStart) && (/* @__PURE__ */ new Date(`${local.weekStart}T00:00:00Z`)).getUTCDay() === 1) {
		const age = calendarDaysBetween(local.weekStart, today);
		if (age >= 0 && age < 7) reminders.push({
			key: `local-checkin:${local.weekStart}`,
			kind: "checkin",
			date: local.weekStart,
			title: "Lyst til ugens check-in?",
			text: "Du kan gemme en lokal kladde, når det passer dig.",
			action: "checkin"
		});
	}
	const dismissed = Array.isArray(input.dismissedKeys) ? input.dismissedKeys : [];
	return reminders.filter((reminder) => !dismissed.includes(reminder.key));
}
Object.freeze({
	D02: "Sammenligning kræver fem sammenlignelige check-ins på forskellige dage i de foregående 14 dage.",
	D04: "Forskel kræver to daterede check-ins med højst syv dage imellem.",
	D06: "Der er endnu ikke tre lave selvrapporter på sammenhængende dage.",
	D07: "Datoerne viser rækkefølge. En virkning er ikke dokumenteret.",
	D08: "Sammenligning kræver 12 matchede dage over 28 dage og seks i hvert bånd med kendt RPE-oprindelse.",
	D09: "Søvnsammenligning kræver 12 parrede dage over 28 dage og seks i hver af to grupper.",
	D10: "RPE uden dokumenteret eget valg indgår ikke som selvrapport.",
	D11: "Vægtforslag kræver tre sammenlignelige tidligere pas med to egne RPE-svar i hvert pas inden for 28 dage.",
	D12: "RPE-vurdering kræver 12 egne svar på tre pas inden for 14 dage og mindst 80 procent dækning.",
	D13: "RPE-stigning kræver fire sammenlignelige pas over 14 dage med tre egne svar i hvert pas.",
	D14: "Gennemgang kræver tre sammenhængende check-in-dage og 12 egne RPE-svar på tre pas i samme 14 dage.",
	D15: "Ugens RPE beskrives først ved 12 egne svar på tre pas og mindst 80 procent dækning.",
	D16: "RPE-signalet afventer dokumenteret oprindelse og 20 parrede sæt på tre pas inden for 21 dage.",
	D18: "Styrketendens kræver fire sammenlignelige tunge dage over mindst 21 dage.",
	D19: "Styrketendens kræver data fra fire forskellige afsluttede kalenderuger.",
	D21: "Trend kræver fire sammenlignelige tunge dage over mindst 21 dage.",
	D22: "Fremgangspil kræver fire sammenlignelige tunge dage over mindst 21 dage.",
	D25: "Retning kræver tre kvalificerede dage både i de seneste 28 dage og i perioden 28 til 84 dage før.",
	D26: "Plateau kræver fire trænede uger, tre uger efter toppen og nyere data.",
	D27: "Stagnation eller fald afventer dokumenteret træning i de relevante uger.",
	D33: "Tonnageudvikling kræver fire afsluttede daterede uger med fuld læsedækning og træning i hver.",
	D35: "Gab afventer afsluttede uger med kendt plan, logdækning og kortlægning.",
	D37: "Logaktivitet. Compliance kræver en afsluttet dateret planuge og komplet læsning.",
	D38: "Registreret aktivitet. Et fuldt pas kræver alle planpositioner og komplet læsning.",
	D39: "Plan eller foreløbige registreringer. Ugen er ikke bekræftet afsluttet og fuldt indlæst.",
	D40: "Ikke registreret er ikke dokumenteret fravær. Læsedækning og plankontekst mangler.",
	D41: "Grundlaget for en samlet status er endnu ikke bekræftet.",
	D46: "Vægttrend kræver tre vejninger på forskellige dage i hver af to afsluttede syvdagesperioder.",
	D47: "Vægttrend kræver tre vejninger på forskellige dage i hver af to afsluttede syvdagesperioder.",
	D48: "TDEE afventer 21 bekræftet komplette kostdage og tre vejninger i hver ende over mindst 21 dage.",
	D56: "Observationsudkast afventer kvalitetskontrol, tre gyldige reps og dokumenteret målegrundlag. Marc vurderer fortolkningen.",
	D59: "Personlig sammenligning afventer fem godkendte referenceanalyser på tre dage med samme metode og version.",
	D69: "Grundlag ikke dokumenteret. Forecast afventer dateret planreference og beregningsmotorens minimum.",
	D76: "Status afventer en fuld, fejlfri opdatering af alle relevante kilder."
});
//#endregion
//#region src/mealEvidence.mjs
var prefix = "[appData2-day-v1]";
var isDayReceipt = (row) => typeof row?.meal === "string" && row.meal.startsWith(prefix);
//#endregion
//#region src/entropi2/home/today/todayModel.mjs
var names = {
	weight: "vægt",
	readiness: "dagsform",
	training: "træning",
	meal: "mad"
};
function joinDanish(words) {
	return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} og ${words[words.length - 1]}`;
}
function todayItems({ weight, readiness, training, meal }) {
	const items = [];
	if (weight) items.push({
		key: "weight",
		done: weight.done === true
	});
	if (readiness) items.push({
		key: "readiness",
		done: readiness.done === true
	});
	if (training?.kind === "today" || training?.kind === "done" && training.today === true) items.push({
		key: "training",
		done: training.kind === "done" || training.total > 0 && training.logged >= training.total
	});
	if (meal && meal.status === "ready") items.push({
		key: "meal",
		done: meal.today > 0
	});
	const missing = items.filter((item) => !item.done).map((item) => item.key);
	const done = items.filter((item) => item.done).map((item) => item.key);
	return {
		items,
		missing,
		done,
		headline: !items.length ? null : missing.length ? `Mangler i dag: ${joinDanish(missing.map((key) => names[key]))}` : "Alt er logget i dag",
		doneLine: done.length && missing.length ? `Klaret: ${joinDanish(done.map((key) => names[key]))}` : null
	};
}
//#endregion
//#region supabase/functions-udkast/u8-push/plan.mjs
function copenhagen(now) {
	const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Copenhagen",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).formatToParts(now).map((p) => [p.type, p.value]));
	return {
		day: `${parts.year}-${parts.month}-${parts.day}`,
		minute: Number(parts.hour) * 60 + Number(parts.minute)
	};
}
var minuteOf = (time) => {
	const m = /^(\d{2}):(\d{2})(?::00)?$/.exec(String(time ?? ""));
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
function reminderDue(remindAt, minute) {
	const at = minuteOf(remindAt);
	return at != null && minute >= at && minute < at + 60;
}
function newestPerEndpoint(rows) {
	const seen = /* @__PURE__ */ new Set(), out = [];
	for (const row of [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
		if (!row?.endpoint || seen.has(row.endpoint)) continue;
		seen.add(row.endpoint);
		out.push(row);
	}
	return out;
}
function reminderMessage({ today, minute, weightDone, readinessDone, mealDays }) {
	const meals = Array.isArray(mealDays) ? mealDays : [];
	const items = todayItems({
		weight: { done: weightDone === true },
		readiness: { done: readinessDone === true },
		meal: {
			status: "ready",
			today: meals.includes(today) ? 1 : 0
		}
	});
	if (!items.missing.length) return null;
	const nutrition = friendlyReminders({
		enabled: true,
		today,
		minuteOfDay: minute,
		window: {
			start: 0,
			end: 1439
		},
		nutrition: {
			complete: true,
			observedFrom: addCalendarDays(today, -7),
			loggedDays: meals.filter((d) => d <= today)
		}
	}).find((r) => r.kind === "nutrition");
	return {
		title: items.headline,
		body: nutrition && items.missing.includes("meal") ? nutrition.text : "Det tager under et minut. Tryk for at åbne appen.",
		url: "/?u8=idag",
		tag: "paamindelse"
	};
}
var mealDaysOf = (rows) => [...new Set((Array.isArray(rows) ? rows : []).filter((row) => typeof row?.date === "string" && !isDayReceipt(row)).map((row) => row.date))];
function replyMessage(count) {
	return {
		title: "Din coach har svaret",
		body: count > 1 ? `${count} nye beskeder. Tryk for at læse dem.` : "Tryk for at læse beskeden.",
		url: "/?u8=beskeder",
		tag: "coach-svar"
	};
}
//#endregion
//#region supabase/functions-udkast/u8-push/handler.mjs
var CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
var json = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: {
		...CORS,
		"Content-Type": "application/json"
	}
});
var REPLY_WINDOW_MS = 18e5;
function sameSecret(given, secret) {
	if (typeof given !== "string" || typeof secret !== "string" || secret.length < 32 || given.length !== secret.length) return false;
	let diff = 0;
	for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
	return diff === 0;
}
function rest({ url, key, http }) {
	return async (path, { method = "GET", body, prefer } = {}) => {
		const response = await http(`${url}/rest/v1/${path}`, {
			method,
			body: body === void 0 ? void 0 : JSON.stringify(body),
			headers: {
				apikey: key,
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
				...prefer ? { Prefer: prefer } : {}
			}
		});
		if (!response.ok) throw Error(`${method} ${path.split("?")[0]}: ${response.status}`);
		const text = await response.text();
		return text ? JSON.parse(text) : null;
	};
}
var list = (values) => `(${[...new Set(values)].map((v) => `"${String(v).replace(/"/g, "")}"`).join(",")})`;
async function runSend({ db, now, send }) {
	const { day, minute } = copenhagen(now);
	const result = {
		reminders: 0,
		replies: 0,
		sent: 0,
		removed: 0,
		failed: 0
	};
	const subscriptions = newestPerEndpoint(await db("push_subscriptions_v1?select=user_id,endpoint,p256dh,auth,created_at&limit=5000"));
	if (!subscriptions.length) return result;
	const users = [...new Set(subscriptions.map((s) => s.user_id))];
	const prefs = new Map((await db(`push_preferences_v1?select=user_id,remind_at,reminders_on,replies_on&user_id=in.${list(users)}`)).map((p) => [p.user_id, p]));
	const athletes = await db(`athletes?select=id,user_id&user_id=in.${list(users)}`);
	const athletesOf = (user) => athletes.filter((a) => a.user_id === user).map((a) => a.id);
	const claim = (rows) => db("push_log_v1?on_conflict=user_id,kind,ref", {
		method: "POST",
		body: rows,
		prefer: "resolution=ignore-duplicates,return=representation"
	});
	const unclaim = (user, kind, refs) => db(`push_log_v1?user_id=eq.${encodeURIComponent(user)}&kind=eq.${kind}&ref=in.${list(refs)}`, { method: "DELETE" });
	async function deliver(user, message, ttl, release) {
		let delivered = 0, failed = 0;
		for (const subscription of subscriptions.filter((s) => s.user_id === user)) try {
			const answer = await send(subscription, JSON.stringify(message), ttl);
			if (answer.status >= 200 && answer.status < 300) {
				delivered++;
				result.sent++;
			} else if (answer.gone) {
				await db(`push_subscriptions_v1?user_id=eq.${encodeURIComponent(user)}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: "DELETE" });
				result.removed++;
			} else {
				failed++;
				result.failed++;
			}
		} catch {
			failed++;
			result.failed++;
		}
		if (!delivered && failed) await release().catch(() => {});
		return delivered;
	}
	const due = users.filter((u) => prefs.get(u)?.reminders_on === true && reminderDue(prefs.get(u).remind_at, minute) && athletesOf(u).length);
	if (due.length) {
		const ids = due.flatMap(athletesOf);
		const weights = await db(`weight_logs?select=athlete_id&athlete_id=in.${list(ids)}&logged_at=eq.${day}`);
		const readiness = await db(`readiness_logs?select=athlete_id&athlete_id=in.${list(ids)}&logged_date=eq.${day}`);
		const meals = await db(`meal_logs?select=athlete_id,date,meal&athlete_id=in.${list(ids)}&date=gte.${addCalendarDays(day, -7)}&date=lte.${day}&limit=5000`);
		const untilMidnight = Math.max(60, (1440 - minute) * 60);
		for (const user of due) {
			const mine = athletesOf(user);
			const message = reminderMessage({
				today: day,
				minute,
				weightDone: weights.some((r) => mine.includes(r.athlete_id)),
				readinessDone: readiness.some((r) => mine.includes(r.athlete_id)),
				mealDays: mealDaysOf(meals.filter((r) => mine.includes(r.athlete_id)))
			});
			if (!message) continue;
			if (!(await claim([{
				user_id: user,
				kind: "reminder",
				ref: day
			}]))?.length) continue;
			result.reminders++;
			await deliver(user, message, untilMidnight, () => unclaim(user, "reminder", [day]));
		}
	}
	const messages = await db(`messages?select=id,athlete_id,created_at&sender_role=eq.coach&read_at=is.null&created_at=gte.${(/* @__PURE__ */ new Date(now.getTime() - REPLY_WINDOW_MS)).toISOString()}&order=created_at.asc&limit=500`);
	if (messages.length) {
		const owners = await db(`athletes?select=id,user_id&id=in.${list(messages.map((m) => m.athlete_id))}`);
		const byUser = /* @__PURE__ */ new Map();
		for (const m of messages) {
			const user = owners.find((a) => a.id === m.athlete_id)?.user_id;
			if (!user || !users.includes(user) || prefs.get(user)?.replies_on === false) continue;
			const first = subscriptions.filter((s) => s.user_id === user).map((s) => String(s.created_at)).sort()[0];
			if (first && String(m.created_at) < first) continue;
			byUser.set(user, [...byUser.get(user) ?? [], m]);
		}
		for (const [user, mine] of byUser) {
			const claimed = await claim(mine.map((m) => ({
				user_id: user,
				kind: "reply",
				ref: String(m.id)
			})));
			if (!claimed?.length) continue;
			result.replies++;
			await deliver(user, replyMessage(claimed.length), 86400, () => unclaim(user, "reply", claimed.map((r) => r.ref)));
		}
	}
	return result;
}
function createHandler({ env, fetch: http = fetch, now = () => /* @__PURE__ */ new Date(), crypto = globalThis.crypto, sendEnabled = u8Enabled("send") }) {
	return async (request) => {
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: CORS
		});
		if (request.method !== "POST") return json({ error: "Kun POST" }, 405);
		const body = await request.json().catch(() => ({}));
		const publicKey = env("VAPID_PUBLIC_KEY"), privateKey = env("VAPID_PRIVATE_KEY");
		const keysReady = validPublicKey(publicKey) && typeof privateKey === "string" && privateKey.length > 0;
		if (body?.action === "public-key") return json({ publicKey: keysReady && sendEnabled ? publicKey : null });
		if (body?.action !== "send") return json({ error: "Ukendt handling" }, 400);
		if (!sameSecret(request.headers.get("x-u8-cron"), env("U8_CRON_SECRET"))) return json({ error: "Ikke tilladt" }, 401);
		if (!sendEnabled) return json({ off: true });
		if (!keysReady) return json({ missing: "nøgle" });
		const subject = env("VAPID_SUBJECT");
		if (typeof subject !== "string" || !/^(mailto:|https:\/\/)/.test(subject)) return json({ missing: "VAPID_SUBJECT" });
		try {
			const vapid = await importVapid({
				publicKey,
				privateKey,
				crypto
			});
			const at = now();
			const db = rest({
				url: env("SUPABASE_URL"),
				key: env("SUPABASE_SERVICE_ROLE_KEY"),
				http
			});
			const send = (subscription, payload, ttl) => sendPush({
				subscription,
				payload,
				vapid,
				subject,
				fetch: http,
				crypto,
				ttl,
				nowSeconds: Math.floor(at.getTime() / 1e3)
			});
			return json(await runSend({
				db,
				now: at,
				send
			}));
		} catch (error) {
			return json({ error: String(error?.message ?? error).slice(0, 200) }, 500);
		}
	};
}
//#endregion
//#region supabase/functions-udkast/u8-push/index.ts
Deno.serve(createHandler({ env: (name) => Deno.env.get(name) }));
//#endregion
