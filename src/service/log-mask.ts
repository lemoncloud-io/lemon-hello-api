/**
 * `log-mask.ts`
 * - masking helper for log lines: `token`, full `endpoint`, reporters' secret headers. (L-4)
 * - lemon-core has `maskHeaders()` in `lib/log-mask`, but it is internal (not exported), so this is a local one
 *   with the same masked form `[masked:<length>]`.
 * - log only: never use the result as data to send.
 * - never throws: a value that cannot be measured becomes `[masked]`, and any failure `[masked:error]`. (PR #73)
 * - strings carrying serialized JSON (e.g. a report `text`, a `context` field) are masked inside too. (PR #73)
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review L-4)
 * @date        2026-11-03 never throw, mask JSON-encoded strings (PR #73 review)
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */

/** keys whose value is always masked (lower case; compared case-insensitively). */
export const SECRET_KEYS: readonly string[] = [
    'token',
    'authorization',
    'cookie',
    'set-cookie',
    'x-lemon-identity',
    'x-protocol-context',
    'x-protocol-signature',
    'password',
    'secret',
];

/** keys whose value is an endpoint url (only scheme + host are kept). */
export const ENDPOINT_KEYS: readonly string[] = ['endpoint'];

/** max depth to copy (deeper or cyclic parts become `[depth]`). */
const MAX_DEPTH = 8;

/** strings longer than this are not parsed as JSON (only the regex pass runs). */
const MAX_PARSE = 64 * 1024;

/**
 * mask a value as `[masked:<length>]`. no character of the value is kept. `undefined`/`null` pass through.
 * - objects/arrays count their JSON length; anything that cannot be measured (e.g. `{ toString: 1 }`, cyclic) is `[masked]`.
 */
export const maskValue = (v: unknown): string => {
    if (v === undefined || v === null) return v as any;
    //* measure w/o calling a custom `toString()`; never throw.
    try {
        const text = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return typeof text === 'string' ? `[masked:${text.length}]` : '[masked]';
    } catch (e) {
        return '[masked]';
    }
};

/**
 * keep only `<scheme>//<host>/***` of an endpoint (path and query can carry a secret).
 */
export const maskEndpoint = (endpoint: string): string => {
    if (endpoint === undefined || endpoint === null) return endpoint;
    //* a broken url is masked as a whole.
    try {
        const url = new URL(`${endpoint}`);
        return `${url.protocol}//${url.host}/***`;
    } catch (e) {
        return maskValue(endpoint);
    }
};

/** `"<secret-key>": "<value>"` inside a (broken or long) JSON text. */
const RE_JSON_SECRET = new RegExp(
    `"(${SECRET_KEYS.map(k => k.replace(/[-]/g, '\\-')).join('|')})"(\\s*:\\s*)"((?:[^"\\\\]|\\\\.)*)"`,
    'gi',
);
/** `Bearer <token>` / `Basic <credential>` in any text (`Basic` capitalized only, to spare plain words). */
const RE_AUTH_SCHEME = /\b([Bb]earer|BEARER|Basic)(\s+)([A-Za-z0-9\-._~+/]+=*)/g;
/** `token=<v>` / `access_token=<v>` / `password=<v>` / `secret=<v>` (query or form text; bounded prefix, no backtracking blow-up). */
const RE_PARAM_SECRET = /\b([\w-]{0,32}(?:token|password|secret))=([^&\s"',;]+)/gi;

/**
 * regex pass for a text that is not (parsable) JSON: mask secret JSON pairs, auth schemes and secret params.
 */
export const maskText = (text: string): string =>
    text
        .replace(RE_JSON_SECRET, (_, k: string, sep: string, v: string) => `"${k}"${sep}"${maskValue(v)}"`)
        .replace(RE_AUTH_SCHEME, (_, s: string, sp: string, v: string) => `${s}${sp}${maskValue(v)}`)
        .replace(RE_PARAM_SECRET, (_, k: string, v: string) => `${k}=${maskValue(v)}`);

/**
 * mask a string value: serialized JSON is parsed, masked and serialized again; any other text gets the regex pass.
 * - an unchanged JSON text is returned as it was (formatting kept).
 * - the parsed value gets its own `MAX_DEPTH` (a string cannot be cyclic, and `MAX_PARSE` bounds the nesting).
 */
const maskString = (text: string): string => {
    const head = text.trimStart().charAt(0);
    //* JSON object/array text (not too long): mask the parsed value.
    if ((head === '{' || head === '[') && text.length <= MAX_PARSE) {
        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return maskText(text);
        }
        const masked = JSON.stringify(maskAny(parsed, 0));
        return masked === JSON.stringify(parsed) ? text : masked;
    }
    return maskText(text);
};

/**
 * recursive body of `maskSecrets()` (may throw; the caller guards it).
 */
const maskAny = (data: any, depth: number): any => {
    if (typeof data === 'string') return maskString(data);
    if (!data || typeof data !== 'object') return data;
    if (depth >= MAX_DEPTH) return '[depth]';
    //* arrays: mask each item.
    if (Array.isArray(data)) return data.map(N => maskAny(N, depth + 1));
    //* objects: mask by key, copy the rest.
    return Object.entries(data).reduce<any>((O, [k, v]) => {
        const key = k.toLowerCase();
        if (SECRET_KEYS.includes(key)) O[k] = maskValue(v);
        else if (ENDPOINT_KEYS.includes(key) && typeof v === 'string') O[k] = maskEndpoint(v);
        else O[k] = maskAny(v, depth + 1);
        return O;
    }, {});
};

/**
 * deep copy of `data` w/ secret keys masked (also inside JSON-encoded strings). the input is never changed.
 * - log only: never throws; on any failure the whole result is `[masked:error]`.
 */
export const maskSecrets = <T = any>(data: T, depth = 0): T => {
    //* last guard: a log line must never break the caller.
    try {
        return maskAny(data, depth);
    } catch (e) {
        return '[masked:error]' as any;
    }
};
