/**
 * `channel-policy.ts`
 * - write/send-time rules of a channel: endpoint host allow-list (H-1), routing patterns (L-2).
 * - pure functions. the allow-list is read from env at each call (no restart in tests).
 * - no breaking change: while env `CHANNEL_ENDPOINT_HOSTS` is unset, an unlisted `https:` host is still sent (warn line),
 *   and a write keeps the host already stored for the channel. setting the env turns on full enforcement.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review H-1, L-2)
 * @date        2026-10-30 no breaking change: `endpointStatus()`, `isEnforced()`, `checkSendEndpoint()`, stored host.
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { $U } from 'lemon-core';
import type { RouteRule } from './slack-types';
import { maskEndpoint } from './log-mask';

/** env key of the extra allowed endpoint hosts (comma list). ex) the chatic webhook host. */
export const CHANNEL_ENDPOINT_HOSTS = 'CHANNEL_ENDPOINT_HOSTS';

/** hosts allowed always: the slack incoming webhook. (no other host is in the code) */
export const DEFAULT_ENDPOINT_HOSTS: readonly string[] = ['hooks.slack.com'];

/** max length of a routing `pattern` (all forms). */
export const PATTERN_MAX = 200;

/** max count of compiled patterns kept in memory. */
const PATTERN_CACHE_MAX = 100;

/**
 * the allowed endpoint hosts: defaults + env `CHANNEL_ENDPOINT_HOSTS` (lower case, no duplicates).
 */
export const allowedHosts = (): string[] =>
    [...DEFAULT_ENDPOINT_HOSTS, ...envHosts()].filter((h, i, L) => L.indexOf(h) === i);

//* the hosts of env `CHANNEL_ENDPOINT_HOSTS` (lower case, blanks dropped).
const envHosts = (): string[] =>
    `${$U.env(CHANNEL_ENDPOINT_HOSTS, '') || ''}`
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => !!s);

/**
 * true if the allow-list is fully enforced: env `CHANNEL_ENDPOINT_HOSTS` has at least one host.
 */
export const isEnforced = (): boolean => envHosts().length > 0;

/** class of an endpoint: in the allow-list, a valid `https:` url not in the list, or never allowed. */
export type EndpointStatus = 'allowed' | 'unlisted' | 'invalid';

//* the host of a valid `https:` url w/o credentials (lower case), else `null`.
const httpsHostOf = (endpoint: string): string | null => {
    if (!endpoint || typeof endpoint !== 'string') return null;
    //* a broken url has no host.
    const url = (() => {
        try {
            return new URL(endpoint);
        } catch (e) {
            return null;
        }
    })();
    if (!url || url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.hostname.toLowerCase();
};

/**
 * classify an endpoint. `invalid` = not `https:`, broken, or credentials in url (never allowed).
 */
export const endpointStatus = (endpoint: string): EndpointStatus => {
    const host = httpsHostOf(endpoint);
    if (!host) return 'invalid';
    return allowedHosts().includes(host) ? 'allowed' : 'unlisted';
};

/**
 * true if the endpoint is `https:` to an allowed host (exact host match, no credentials in url).
 */
export const isAllowedEndpoint = (endpoint: string): boolean => endpointStatus(endpoint) === 'allowed';

/**
 * send-time check: `allowed` → true. `unlisted` → true w/ one warn line only while the env is unset. else false.
 * - the warn line has the masked host only (no path, no query).
 *
 * @param endpoint  the endpoint to post.
 * @param warn      the log function for the warn line.
 */
export const checkSendEndpoint = (endpoint: string, warn: (line: string) => void): boolean => {
    const status = endpointStatus(endpoint);
    if (status === 'allowed') return true;
    if (status === 'invalid' || isEnforced()) return false;
    warn(`WARN! endpoint host not in allow-list (${CHANNEL_ENDPOINT_HOSTS} unset) = ${maskEndpoint(endpoint)}`);
    return true;
};

/**
 * write-time check: throw `400 INVALID ENDPOINT` if not allowed. the message never has the endpoint.
 * - while the env is unset, an `unlisted` host equal to the host of `stored` (same channel) is accepted.
 *
 * @param endpoint  the new endpoint.
 * @param errScope  scope for the error message.
 * @param stored    (optional) the endpoint already stored for the same channel.
 */
export const assertEndpoint = (endpoint: string, errScope: string, stored?: string): void => {
    const status = endpointStatus(endpoint);
    if (status === 'allowed') return;
    const sameHost = status === 'unlisted' && !!stored && httpsHostOf(stored) === httpsHostOf(endpoint);
    if (sameHost && !isEnforced()) return;
    throw new Error(`400 INVALID ENDPOINT - host not allowed @${errScope}`);
};

/** true if the pattern is in the regex form `/.../`. */
export const isRegexForm = (pattern: string): boolean =>
    typeof pattern === 'string' && pattern.startsWith('/') && pattern.endsWith('/');

//* compiled patterns by source (`null` = invalid). bounded: cleared when full.
const $patterns = new Map<string, RegExp | null>();

/**
 * compile a `/.../` pattern once (no flags, so `test()` has no state). `null` if invalid, too long, or not the form.
 */
export const compilePattern = (pattern: string): RegExp | null => {
    if (!isRegexForm(pattern) || pattern.length < 3 || pattern.length > PATTERN_MAX) return null;
    if ($patterns.has(pattern)) return $patterns.get(pattern);
    //* an invalid regex is kept as `null` (no throw at match time).
    const re = (() => {
        try {
            return new RegExp(pattern.slice(1, -1));
        } catch (e) {
            return null;
        }
    })();
    if ($patterns.size >= PATTERN_CACHE_MAX) $patterns.clear();
    $patterns.set(pattern, re);
    return re;
};

/**
 * validate routing rules at write time: each `pattern` is at most `PATTERN_MAX` chars, and a `/.../` one compiles.
 * - `undefined` means no change (nothing to check).
 */
export const validateRules = (rules: RouteRule[], errScope: string): void => {
    if (rules === undefined) return;
    if (!Array.isArray(rules)) throw new Error(`400 INVALID RULE - rules (array) is required @${errScope}`);
    rules.forEach((rule, i) => {
        const pattern = `${rule?.pattern ?? ''}`;
        if (pattern.length > PATTERN_MAX)
            throw new Error(`400 INVALID RULE - rules[${i}].pattern is longer than ${PATTERN_MAX} @${errScope}`);
        if (isRegexForm(pattern) && !compilePattern(pattern))
            throw new Error(`400 INVALID RULE - rules[${i}].pattern is not a valid regex @${errScope}`);
    });
};
