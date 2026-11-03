/**
 * `log-mask.spec.ts`
 * - masking helper for log lines (token, endpoint, reporters' headers). (L-4)
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review L-4)
 * @date        2026-11-03 never throw, JSON-encoded strings (PR #73 review)
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { $U, expect2 } from 'lemon-core';
import { maskEndpoint, maskSecrets, maskText, maskValue } from './log-mask';

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

    //* PR #73 (A): a value w/o a callable `toString()` must not throw.
    it('never throws on odd values (toString:1, null-prototype, symbol, bigint, cyclic)', async () => {
        expect2(() => maskValue({ toString: 1 })).toEqual('[masked:14]');
        expect2(() => maskValue(Object.create(null))).toEqual('[masked:2]');
        expect2(() => maskValue(Symbol('s'))).toEqual('[masked:9]');
        expect2(() => maskValue((global as any).BigInt(12345))).toEqual('[masked:5]');
        expect2(() => maskValue([1, 2])).toEqual('[masked:5]');
        const cyc: any = {};
        cyc.self = cyc;
        expect2(() => maskValue(cyc)).toEqual('[masked]');

        //* as a secret key's value inside maskSecrets().
        expect2(() => maskSecrets({ authorization: { toString: 1 }, ok: 1 })).toEqual({
            authorization: '[masked:14]',
            ok: 1,
        });
        const nul = Object.assign(Object.create(null), { token: 'tk', name: 'n' });
        expect2(() => maskSecrets({ token: Object.create(null), nested: nul })).toEqual({
            token: '[masked:2]',
            nested: { token: '[masked:2]', name: 'n' },
        });
        expect2(() => maskSecrets({ secret: Symbol('x'), cookie: cyc })).toEqual({
            secret: '[masked:9]',
            cookie: '[masked]',
        });
    });

    //* PR #73 (A): the last guard turns any failure into a fixed mark.
    it('returns `[masked:error]` instead of throwing', async () => {
        const bad = {
            get boom(): string {
                throw new Error('getter');
            },
        };
        expect2(() => maskSecrets(bad)).toEqual('[masked:error]');
        expect2(() => maskSecrets({ list: [bad] })).toEqual('[masked:error]');
    });

    //* PR #73 (B): serialized JSON in a report `text` (buildErrorForm → asText(data)).
    it('masks secrets inside a JSON-encoded attachment text, input unchanged', async () => {
        const input = {
            channel: 'error',
            body: {
                attachments: [
                    {
                        title: 'error-report',
                        text: JSON.stringify({ headers: { authorization: 'Bearer abc', host: 'h' }, message: 'm' }),
                    },
                ],
            },
        };
        const copy = JSON.parse(JSON.stringify(input));
        const res = maskSecrets(input);
        const text: string = res.body.attachments[0].text;
        expect2(() => text.includes('abc')).toEqual(false);
        expect2(() => text.includes('[masked:10]')).toEqual(true);
        expect2(() => JSON.parse(text)).toEqual({ headers: { authorization: '[masked:10]', host: 'h' }, message: 'm' });
        expect2(() => input).toEqual(copy);
    });

    //* PR #73 (B): caller context in a field value (buildCommonSlackForm → $U.json(context)).
    it('masks secrets inside a JSON-encoded field value ($U.json(context))', async () => {
        const context = {
            identity: { sid: 's1', uid: 'u1', roles: ['user'] },
            authorization: 'Bearer ctx-token-1',
            cookie: { SID: 'cookie-1' },
            clientIp: '127.0.0.1',
        };
        const body = { attachments: [{ pretext: 'svc', fields: [{ title: 'context', value: $U.json(context) }] }] };
        const res = maskSecrets(body);
        const value: string = res.attachments[0].fields[0].value;
        expect2(() => value.includes('ctx-token-1')).toEqual(false);
        expect2(() => value.includes('cookie-1')).toEqual(false);
        expect2(() => JSON.parse(value)).toEqual({
            identity: { sid: 's1', uid: 'u1', roles: ['user'] },
            authorization: '[masked:18]',
            cookie: '[masked:18]',
            clientIp: '127.0.0.1',
        });
        //* the body to send keeps the original text.
        expect2(() => body.attachments[0].fields[0].value).toEqual($U.json(context));
    });

    //* PR #73 (B): non-JSON or broken JSON text gets the regex pass.
    it('masks Bearer / token= / "secret":"…" in plain or broken text', async () => {
        expect2(() => maskSecrets({ text: 'call failed w/ Bearer xyz' })).toEqual({
            text: 'call failed w/ Bearer [masked:3]',
        });
        expect2(() => maskText('GET /x?access_token=abc123&page=2')).toEqual('GET /x?access_token=[masked:6]&page=2');
        expect2(() => maskText('{"token": "tk-1", "a": 1 ...cut')).toEqual('{"token": "[masked:4]", "a": 1 ...cut');
        //* plain strings (and unchanged JSON) stay as they were.
        expect2(() => maskSecrets({ text: 'hello world', json: '{ "a": 1 }', list: '[1, 2]' })).toEqual({
            text: 'hello world',
            json: '{ "a": 1 }',
            list: '[1, 2]',
        });
        expect2(() => maskSecrets('a basic message')).toEqual('a basic message');
    });

    //* PR #73 (B): a long JSON text is not parsed (regex pass only).
    it('does not parse a JSON text over the size limit', async () => {
        const big = JSON.stringify({ token: 'tk-big', pad: 'x'.repeat(70 * 1024) });
        const res: string = maskSecrets({ text: big }).text;
        expect2(() => res.includes('tk-big')).toEqual(false);
        expect2(() => res.startsWith('{"token":"[masked:6]"')).toEqual(true);
    });
});
