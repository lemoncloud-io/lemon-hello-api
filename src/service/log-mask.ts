/**
 * `log-mask.ts`
 * - masking helper for log lines: `token`, full `endpoint`, reporters' secret headers. (L-4)
 * - lemon-core has `maskHeaders()` in `lib/log-mask`, but it is internal (not exported), so this is a local one
 *   with the same masked form `[masked:<length>]`.
 * - log only: never use the result as data to send.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review L-4)
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

/**
 * mask a value as `[masked:<length>]`. no character of the value is kept. `undefined`/`null` pass through.
 */
export const maskValue = (v: unknown): string =>
    v === undefined || v === null ? (v as any) : `[masked:${typeof v === 'string' ? v.length : `${v}`.length}]`;

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

/**
 * deep copy of `data` w/ secret keys masked. the input is never changed.
 */
export const maskSecrets = <T = any>(data: T, depth = 0): T => {
    if (!data || typeof data !== 'object') return data;
    if (depth >= MAX_DEPTH) return '[depth]' as any;
    //* arrays: mask each item.
    if (Array.isArray(data)) return data.map(N => maskSecrets(N, depth + 1)) as any;
    //* objects: mask by key, copy the rest.
    return Object.entries(data as any).reduce<any>((O, [k, v]) => {
        const key = k.toLowerCase();
        if (SECRET_KEYS.includes(key)) O[k] = maskValue(v);
        else if (ENDPOINT_KEYS.includes(key) && typeof v === 'string') O[k] = maskEndpoint(v);
        else O[k] = maskSecrets(v, depth + 1);
        return O;
    }, {});
};
