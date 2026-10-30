/**
 * `log-mask.spec.ts`
 * - masking helper for log lines (token, endpoint, reporters' headers). (L-4)
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review L-4)
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2 } from 'lemon-core';
import { maskEndpoint, maskSecrets, maskValue } from './log-mask';

describe('log-mask', () => {
    it('masks a value w/o keeping any character', async () => {
        expect2(() => maskValue('super-secret-1234')).toEqual('[masked:17]');
        expect2(() => maskValue('')).toEqual('[masked:0]');
        expect2(() => maskValue(undefined)).toEqual(undefined);
    });

    it('keeps only scheme and host of an endpoint', async () => {
        expect2(() => maskEndpoint('https://hooks.slack.com/services/T0/B0/XYZ')).toEqual(
            'https://hooks.slack.com/***',
        );
        expect2(() => maskEndpoint('https://chat.example.com/hello/chat-send?channelId=C001')).toEqual(
            'https://chat.example.com/***',
        );
        expect2(() => maskEndpoint('not a url with secret')).toEqual('[masked:21]');
        expect2(() => maskEndpoint(undefined)).toEqual(undefined);
    });

    it('masks secret keys deeply (case-insensitive) and never changes the input', async () => {
        const input = {
            channel: 'error',
            token: 'super-secret-1234',
            endpoint: 'https://hooks.slack.com/services/T0/B0/XYZ',
            context: {
                headers: {
                    Authorization: 'Bearer abc',
                    cookie: 'sid=1',
                    'X-Lemon-Identity': '{"sid":"x"}',
                    'x-protocol-context': 'ctx',
                    'content-type': 'application/json',
                },
            },
            list: [{ token: 'tk' }, 'plain'],
        };
        const copy = JSON.parse(JSON.stringify(input));
        expect2(() => maskSecrets(input)).toEqual({
            channel: 'error',
            token: '[masked:17]',
            endpoint: 'https://hooks.slack.com/***',
            context: {
                headers: {
                    Authorization: '[masked:10]',
                    cookie: '[masked:5]',
                    'X-Lemon-Identity': '[masked:11]',
                    'x-protocol-context': '[masked:3]',
                    'content-type': 'application/json',
                },
            },
            list: [{ token: '[masked:2]' }, 'plain'],
        });
        expect2(() => input).toEqual(copy);
        //* non-object passes through.
        expect2(() => maskSecrets('text')).toEqual('text');
        expect2(() => maskSecrets(null)).toEqual(null);
    });

    it('stops at a deep or cyclic object (no stack overflow)', async () => {
        const a: any = { token: 't' };
        a.self = a;
        const res = maskSecrets(a);
        expect2(() => res.token).toEqual('[masked:1]');
        expect2(() => JSON.stringify(res).includes('[depth]')).toEqual(true);
    });
});
