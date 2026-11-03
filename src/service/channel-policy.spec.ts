/**
 * `channel-policy.spec.ts`
 * - endpoint host allow-list and routing pattern rules of a channel. (H-1, L-2)
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review H-1, L-2)
 * @date        2026-10-30 no breaking change: unset `CHANNEL_ENDPOINT_HOSTS` = warn at send, same host at write.
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, GETERR } from 'lemon-core';
import {
    allowedHosts,
    assertEndpoint,
    checkSendEndpoint,
    compilePattern,
    endpointStatus,
    isEnforced,
    isAllowedEndpoint,
    validateRules,
    CHANNEL_ENDPOINT_HOSTS,
    PATTERN_MAX,
} from './channel-policy';

describe('channel-policy', () => {
    const $org = process.env[CHANNEL_ENDPOINT_HOSTS];
    //* restore the env of the runner.
    afterEach(() => {
        if ($org === undefined) delete process.env[CHANNEL_ENDPOINT_HOSTS];
        else process.env[CHANNEL_ENDPOINT_HOSTS] = $org;
    });

    it('allows only `hooks.slack.com` by default (https only)', async () => {
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        expect2(() => allowedHosts()).toEqual(['hooks.slack.com']);
        expect2(() => isAllowedEndpoint('https://hooks.slack.com/services/T0/B0/x')).toEqual(true);
        expect2(() => isAllowedEndpoint('https://HOOKS.slack.com/services/T0')).toEqual(true);
        //* not https, other host, look-alike host, credentials in url, broken url.
        expect2(() => isAllowedEndpoint('http://hooks.slack.com/services/T0')).toEqual(false);
        expect2(() => isAllowedEndpoint('https://example.com/hook')).toEqual(false);
        expect2(() => isAllowedEndpoint('https://hooks.slack.com.example.com/x')).toEqual(false);
        expect2(() => isAllowedEndpoint('https://user:pw@hooks.slack.com/x')).toEqual(false);
        expect2(() => isAllowedEndpoint('https://169.254.169.254/latest')).toEqual(false);
        expect2(() => isAllowedEndpoint('not a url')).toEqual(false);
        expect2(() => isAllowedEndpoint('')).toEqual(false);
        expect2(() => isAllowedEndpoint(null)).toEqual(false);
    });

    it('adds hosts from env `CHANNEL_ENDPOINT_HOSTS` (comma list)', async () => {
        process.env[CHANNEL_ENDPOINT_HOSTS] = ' chat.example.com , ,Other.Example.com';
        expect2(() => allowedHosts()).toEqual(['hooks.slack.com', 'chat.example.com', 'other.example.com']);
        expect2(() => isAllowedEndpoint('https://chat.example.com/hello/chat-send?channelId=C001')).toEqual(true);
        expect2(() => isAllowedEndpoint('https://other.example.com/x')).toEqual(true);
        expect2(() => isAllowedEndpoint('https://sub.chat.example.com/x')).toEqual(false);
        expect2(() => isAllowedEndpoint('https://hooks.slack.com/x')).toEqual(true);
    });

    it('classifies an endpoint: allowed, unlisted (valid https), invalid', async () => {
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        expect2(() => isEnforced()).toEqual(false);
        expect2(() => endpointStatus('https://hooks.slack.com/x')).toEqual('allowed');
        expect2(() => endpointStatus('https://chat.example.net/x')).toEqual('unlisted');
        expect2(() => endpointStatus('http://hooks.slack.com/x')).toEqual('invalid');
        expect2(() => endpointStatus('https://u:p@chat.example.net/x')).toEqual('invalid');
        expect2(() => endpointStatus('nope')).toEqual('invalid');
        //* blank list -> not enforced.
        process.env[CHANNEL_ENDPOINT_HOSTS] = ' , ';
        expect2(() => isEnforced()).toEqual(false);
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'chat.example.com';
        expect2(() => isEnforced()).toEqual(true);
        expect2(() => endpointStatus('https://chat.example.com/x')).toEqual('allowed');
        expect2(() => endpointStatus('https://chat.example.net/x')).toEqual('unlisted');
    });

    it('decides at send time: unset env -> warn and send an unlisted https host; set env -> enforce', async () => {
        const warns: string[] = [];
        const warn = (line: string): void => void warns.push(line);
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        expect2(() => checkSendEndpoint('https://hooks.slack.com/x', warn)).toEqual(true);
        expect2(() => checkSendEndpoint('https://chat.example.net/hook?token=t0', warn)).toEqual(true);
        expect2(() => checkSendEndpoint('http://chat.example.net/hook', warn)).toEqual(false);
        expect2(() => warns).toEqual([
            'WARN! endpoint host not in allow-list (CHANNEL_ENDPOINT_HOSTS unset) = https://chat.example.net/***',
        ]);
        //* set env -> an unlisted host is refused, no warn line.
        warns.length = 0;
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'chat.example.com';
        expect2(() => checkSendEndpoint('https://chat.example.net/hook', warn)).toEqual(false);
        expect2(() => checkSendEndpoint('https://chat.example.com/hook', warn)).toEqual(true);
        expect2(() => warns).toEqual([]);
    });

    it('decides at write time: unset env accepts only the host already stored for the channel', async () => {
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        const stored = 'https://chat.example.net/old?channelId=C001';
        expect2(() => assertEndpoint('https://chat.example.net/new?channelId=C002', 'T', stored)).toEqual(undefined);
        expect2(() => assertEndpoint('https://other.example.net/x', 'T', stored)).toEqual(
            '400 INVALID ENDPOINT - host not allowed @T',
        );
        expect2(() => assertEndpoint('https://chat.example.net/x', 'T')).toEqual(
            '400 INVALID ENDPOINT - host not allowed @T',
        );
        //* never `http:` even if the stored one was.
        expect2(() => assertEndpoint('http://chat.example.net/x', 'T', 'http://chat.example.net/y')).toEqual(
            '400 INVALID ENDPOINT - host not allowed @T',
        );
        //* set env -> the stored host does not help.
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'chat.example.com';
        expect2(() => assertEndpoint('https://chat.example.net/new', 'T', stored)).toEqual(
            '400 INVALID ENDPOINT - host not allowed @T',
        );
    });

    it('throws `400 INVALID ENDPOINT` w/o echoing the endpoint', async () => {
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        expect2(() => assertEndpoint('https://hooks.slack.com/x', 'T')).toEqual(undefined);
        expect2(() => assertEndpoint('https://evil.example.com/secret-path', 'T')).toEqual(
            '400 INVALID ENDPOINT - host not allowed @T',
        );
    });

    it('compiles `/.../` patterns once w/ correct slicing (old bug: `substring(1, len-2)`)', async () => {
        //* old bug: '/error/' compiled as 'erro', '/abc$/' as 'abc'.
        expect2(() => compilePattern('/error/').source).toEqual('error');
        expect2(() => compilePattern('/abc$/').test('abcd')).toEqual(false);
        expect2(() => compilePattern('/abc$/').test('xabc')).toEqual(true);
        //* compiled once (same instance), and stateless (no `g` flag) across calls.
        expect2(() => compilePattern('/a/') === compilePattern('/a/')).toEqual(true);
        expect2(() => [compilePattern('/a/').test('a'), compilePattern('/a/').test('a')]).toEqual([true, true]);
        //* invalid or too long -> null. (never throws)
        expect2(() => compilePattern('/(/')).toEqual(null);
        expect2(() => compilePattern('/')).toEqual(null);
        expect2(() => compilePattern(`/${'a'.repeat(PATTERN_MAX)}/`)).toEqual(null);
        //* not a regex form -> null.
        expect2(() => compilePattern('#error')).toEqual(null);
    });

    it('validates rules at write time (length cap, regex must compile)', async () => {
        expect2(() => validateRules(undefined, 'T')).toEqual(undefined);
        expect2(() => validateRules([{ pattern: '/./' }, { pattern: '#error' }, { pattern: 'word' }], 'T')).toEqual(
            undefined,
        );
        expect2(() => validateRules([{ pattern: '/./' }, { pattern: '/(/' }], 'T')).toEqual(
            '400 INVALID RULE - rules[1].pattern is not a valid regex @T',
        );
        expect2(() => validateRules([{ pattern: 'x'.repeat(PATTERN_MAX + 1) }], 'T')).toEqual(
            `400 INVALID RULE - rules[0].pattern is longer than ${PATTERN_MAX} @T`,
        );
        expect2(() => validateRules([{ pattern: '/' }], 'T')).toEqual(
            '400 INVALID RULE - rules[0].pattern is not a valid regex @T',
        );
        expect2(
            await Promise.resolve(1)
                .then(() => validateRules('x' as any, 'T'))
                .catch(GETERR),
        ).toEqual('400 INVALID RULE - rules (array) is required @T');
    });
});
