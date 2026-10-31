/**
 * `slack-service.spec.ts`
 * - common service for `slack-service`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-24 optimized from `lemon-hello-api`
 * @date        2026-10-30 security review: endpoint allow-list (H-1), regex rules (L-2), `postMessage()` timeout (L-1).
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, GETERR } from 'lemon-core';
import https from 'https';
import { EventEmitter } from 'events';

//* import main models and service.
import { asChaticContent, asChaticPayload } from './chatic-transformer';
import { SlackService } from './slack-service';
import { SlackChannelModel, SlackResponse, StorageSupportable } from './slack-types';
import { CHANNEL_ENDPOINT_HOSTS } from './channel-policy';

//*create service instance.
export const instance = (options?: { current?: number }) => {
    const current = options?.current ?? new Date().getTime();
    const $channel = new (class implements StorageSupportable<SlackChannelModel> {
        public $map: { [id: string]: SlackChannelModel } = {};
        public hello = () => `dummy-channel-storage`;
        public async read(id: string) {
            return this.$map[id] || null;
        }
        public async save(id: string, model: SlackChannelModel) {
            const $old = this.$map[id];
            const $fin = model === null ? null : { ...$old, ...model };
            if ($fin === null) delete this.$map[id];
            else this.$map[id] = $fin;
            return $fin;
        }
    })();
    const service: SlackService = new (class extends SlackService {
        constructor() {
            super($channel);
        }
        /** dummy postMessage */
        public postMessage = async (endpoint: string, message: any): Promise<SlackResponse> => {
            return { statusCode: 100, statusMessage: 'ok', body: message };
        };
    })();
    return { service, current };
};

//*main test body.
describe('slack-service /w dummy', () => {
    const $hosts = process.env[CHANNEL_ENDPOINT_HOSTS];
    //* allow the test hosts. (default is `hooks.slack.com` only)
    beforeEach(() => {
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'example.com';
    });
    //* restore the env of the runner.
    afterEach(() => {
        if ($hosts === undefined) delete process.env[CHANNEL_ENDPOINT_HOSTS];
        else process.env[CHANNEL_ENDPOINT_HOSTS] = $hosts;
    });

    it('should pass hello()', async () => {
        // const PROFILE = loadProfile(process); // override process.env.
        // PROFILE && console.info(`! PROFILE =`, PROFILE);
        const { service } = instance();
        expect2(() => service?.hello()).toEqual('slack-service:dummy-channel-storage');

        expect2(await service.channel('').catch(GETERR)).toEqual('@id (channel) is required - slack.channel()');
        expect2(await service.channel('nonexist').catch(GETERR)).toEqual(null);

        expect2(await service.channel('usedefault', { name: 'default' }).catch(GETERR)).toEqual({ name: 'default' });
        expect2(await service.channel('usedefault', { name: 'nexttry' }).catch(GETERR)).toEqual({ name: 'default' });
        expect2(await service.channel('usedefault').catch(GETERR)).toEqual({ name: 'default' });

        expect2(await service.$channel.save('usedefault', { channel: 'x' }).catch(GETERR)).toEqual({
            name: 'default',
            channel: 'x',
        });

        expect2(await service.channel('public').catch(GETERR)).toEqual(null);
        expect2(await service.default()).toEqual({ channel: 'public' });

        //* test send() with various channel determination.
        if (1) {
            const endpoint = 'https://example.com/slack';
            expect2(await service.send({ text: 'hello' })).toEqual({
                channel: 'public',
                $sent: {
                    statusCode: 0,
                    statusMessage: '@endpoint(string) is required in channe[public] - slack.send(/)',
                },
            });
            expect2(await service.$channel.save('public', { endpoint })).toEqual({ endpoint });

            //* determine the channel in order: param.channel > message.channel > default.channel
            expect2(await service.send({ text: 'hello' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello' }, { channel: 'test' })).toEqual({
                channel: 'test',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello' }, { channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'test' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'test' }, { channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'public' })).toEqual({
                channel: 'public',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'public', text: 'hello' } },
                endpoint,
            });
            expect2(await service.send({ text: 'hello', channel: 'public' }, { channel: 'test' })).toEqual({
                channel: 'test',
                $sent: { statusCode: 100, statusMessage: 'ok', body: { channel: 'test', text: 'hello' } },
                endpoint,
            });
        }

        //* test `asChaticContent()`/`asChaticPayload()` - pure conversion from slack body to chatic payload.
        if (1) {
            expect2(() => asChaticContent({ text: 'hello' })).toEqual('hello');
            expect2(() => asChaticContent({})).toEqual('');
            //* w/ attachments -> summary lines only: `title` -> `pretext` in order.
            expect2(() =>
                asChaticContent({
                    text: 'hello',
                    attachments: [
                        {
                            pretext: '401 UNAUTHORIZED - not authenticated @invite.list',
                            title: 'error-report: `chatic-sockets-api/lemon-production#0.26.710`',
                            text: 'X',
                            fields: [{ title: 'F', value: 1 }],
                        },
                    ],
                }),
            ).toEqual(
                'error-report: `chatic-sockets-api/lemon-production#0.26.710`\n' +
                    '401 UNAUTHORIZED - not authenticated @invite.list',
            );

            //* long/object `text` never inlined - summary only (full payload is delegated to `meta.sourceUrl`).
            expect2(() =>
                asChaticPayload({ attachments: [{ pretext: 'P', title: 'T', text: { a: 1 } as any }] }),
            ).toEqual({ content: 'T\nP', stereo: 'webhook', meta: { pretext: 'P', title: 'T' } });
            expect2(() => asChaticContent({ attachments: [{ title: 'T', text: 'x'.repeat(501) }] })).toEqual('T');

            //* edge: no title/pretext -> falls back to a short attachment text (500 chars boundary kept).
            expect2(() => asChaticContent({ attachments: [{ text: 'only-text' }] })).toEqual('only-text');
            expect2(() => asChaticContent({ attachments: [{ text: 'x'.repeat(500) }] })).toEqual('x'.repeat(500));
            expect2(() => asChaticContent({ attachments: [{ text: 'x'.repeat(501) }] })).toEqual('');

            //* edge: all empty -> `meta` itself is omitted.
            expect2(() => asChaticPayload({})).toEqual({ content: '', stereo: 'webhook' });

            //* w/o attachments -> `meta.text` falls back to `body.text` (only field body carries).
            expect2(() => asChaticPayload({ text: 'hi' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                meta: { text: 'hi' },
            });

            //* w/ attachments -> `meta` extracted from the first attachment (representative), incl. `footer`.
            expect2(() =>
                asChaticPayload({
                    text: 'hello',
                    attachments: [
                        {
                            pretext: 'P',
                            title: 'T',
                            text: 'X',
                            color: 'danger',
                            username: 'hello-alarm',
                            ts: 1755000000,
                            footer: 'chatic-sockets-api/lemon-production#0.26.710',
                            fields: [
                                { title: 'F', value: 1 },
                                { title: '', value: 'v2' },
                            ],
                        },
                    ],
                }),
            ).toEqual({
                content: 'T\nP',
                stereo: 'webhook',
                meta: {
                    pretext: 'P',
                    title: 'T',
                    text: 'X',
                    color: 'danger',
                    username: 'hello-alarm',
                    ts: 1755000000,
                    footer: 'chatic-sockets-api/lemon-production#0.26.710',
                    fields: [{ title: 'F', value: 1 }, { value: 'v2' }],
                },
            });

            //* w/ `sourceUrl` -> carried in `meta.sourceUrl` only (not in `content` - app renders the link).
            expect2(() => asChaticPayload({ text: 'hi' }, { sourceUrl: 'https://s3.example.com/o.json' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                meta: { text: 'hi', sourceUrl: 'https://s3.example.com/o.json' },
            });

            //* w/ `token` -> carried in the body (no headers), omitted if not given.
            expect2(() => asChaticPayload({ text: 'hi' }, { token: 'secret-token' })).toEqual({
                content: 'hi',
                stereo: 'webhook',
                token: 'secret-token',
                meta: { text: 'hi' },
            });
        }

        //* test `send()` branching to `chatic` channel - transform body, carrying the service token in body.
        if (1) {
            const calls: { endpoint: string; message: any }[] = [];
            (service as any).postMessage = async (endpoint: string, message: any) => {
                calls.push({ endpoint, message });
                return { statusCode: 100, statusMessage: 'ok', body: message };
            };

            //* chatic channel w/ token -> converted body incl. `token`.
            await service.$channel.save('chatic1', {
                endpoint: 'https://example.com/chat-send?channelId=C001',
                stereo: 'chatic',
                token: 'secret-token',
            });
            await service.send({ text: 'hello' }, { channel: 'chatic1' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/chat-send?channelId=C001',
                message: {
                    content: 'hello',
                    stereo: 'webhook',
                    token: 'secret-token',
                    meta: { text: 'hello' },
                },
            });

            //* chatic channel w/o token -> converted body, no `token` field.
            await service.$channel.save('chatic2', {
                endpoint: 'https://example.com/chat-send2?channelId=C002',
                stereo: 'chatic',
            });
            await service.send({ text: 'hi' }, { channel: 'chatic2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/chat-send2?channelId=C002',
                message: {
                    content: 'hi',
                    stereo: 'webhook',
                    meta: { text: 'hi' },
                },
            });

            //* chatic channel w/ `$s3s` configured -> uploads original message, carries `meta.sourceUrl` only.
            const s3Calls: { json: string }[] = [];
            const $s3s = {
                bucket: () => 'test-bucket',
                putObject: async (json: string) => {
                    s3Calls.push({ json });
                    return { Bucket: 'test-bucket', Key: 'k.json', Location: 'https://s3.example.com/k.json' } as any;
                },
            } as any;
            const service2: SlackService = new (class extends SlackService {
                constructor() {
                    super(service.$channel, { $s3s });
                }
                public postMessage = async (endpoint: string, message: any) => {
                    calls.push({ endpoint, message });
                    return { statusCode: 100, statusMessage: 'ok', body: message };
                };
            })();
            await service2.send({ text: 'hello' }, { channel: 'chatic1' });
            expect2(() => JSON.parse(s3Calls.pop()?.json)).toEqual({ channel: 'chatic1', text: 'hello' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/chat-send?channelId=C001',
                message: {
                    content: 'hello',
                    stereo: 'webhook',
                    token: 'secret-token',
                    meta: {
                        text: 'hello',
                        sourceUrl: 'https://s3.example.com/k.json',
                    },
                },
            });

            //* `$s3s.putObject()` failing -> send proceeds w/o `sourceUrl` (no url, unchanged content/meta).
            const $s3sFail = {
                bucket: () => 'test-bucket',
                putObject: async () => {
                    throw new Error('put-failed');
                },
            } as any;
            const service3: SlackService = new (class extends SlackService {
                constructor() {
                    super(service.$channel, { $s3s: $s3sFail });
                }
                public postMessage = async (endpoint: string, message: any) => {
                    calls.push({ endpoint, message });
                    return { statusCode: 100, statusMessage: 'ok', body: message };
                };
            })();
            await service3.send({ text: 'hi' }, { channel: 'chatic2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/chat-send2?channelId=C002',
                message: {
                    content: 'hi',
                    stereo: 'webhook',
                    meta: { text: 'hi' },
                },
            });

            //* no `stereo` (slack, existing) -> unchanged body. (no-regression)
            await service.$channel.save('slack1', { endpoint: 'https://example.com/slack1' });
            await service.send({ text: 'hi' }, { channel: 'slack1' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/slack1',
                message: { channel: 'slack1', text: 'hi' },
            });

            //* explicit `stereo: 'slack'` -> same as default slack path. (no-regression)
            await service.$channel.save('slack2', { endpoint: 'https://example.com/slack2', stereo: 'slack' });
            await service.send({ text: 'hi' }, { channel: 'slack2' });
            expect2(calls.pop()).toEqual({
                endpoint: 'https://example.com/slack2',
                message: { channel: 'slack2', text: 'hi' },
            });
        }
    });

    it('should pass postMessage() as one https POST w/o network', async () => {
        const { service } = instance();
        const calls: { target: any; body: string }[] = [];
        //* normalize both call forms: `request(options, cb)` and `request(url, options, cb)`.
        const asTarget = (a: any, b: any) => {
            const u = typeof a === 'string' || a instanceof URL ? new URL(`${a}`) : null;
            const o = u ? b : a;
            const path = u ? `${u.pathname}${u.search}` : o?.path;
            return { protocol: u ? u.protocol : o?.protocol, hostname: u ? u.hostname : o?.hostname, path, ...o };
        };
        //* fake `https.request()`: record the request, answer with `status` after `end()`.
        const fakeRequest =
            (status: number) =>
            (...args: any[]) => {
                const cb = args.find(a => typeof a === 'function');
                const target = asTarget(args[0], args[1]);
                const call = { target, body: '' };
                calls.push(call);
                return {
                    write: (chunk: string) => (call.body += chunk),
                    on: (): void => undefined,
                    end: () => {
                        const res: any = new EventEmitter();
                        res.statusCode = status;
                        res.statusMessage = status < 400 ? 'OK' : 'Bad Request';
                        res.setEncoding = (): void => undefined;
                        cb(res);
                        res.emit('data', '{"ok":true}');
                        res.emit('end');
                    },
                };
            };
        //* the real `postMessage` of `SlackService` (the instance one is a dummy).
        const postMessage = new SlackService(service.$channel).postMessage;
        const spy = jest.spyOn(https, 'request');
        try {
            spy.mockImplementation(fakeRequest(200) as any);
            const res = await postMessage('https://hooks.example.com/services/T0/B0?x=1', { text: 'hi' });
            expect2(() => res).toEqual({ body: '{"ok":true}', statusCode: 200, statusMessage: 'OK' });
            expect2(() => calls[0].target, 'protocol,hostname,path,method').toEqual({
                protocol: 'https:',
                hostname: 'hooks.example.com',
                path: '/services/T0/B0?x=1',
                method: 'POST',
            });
            expect2(() => calls[0].target.headers).toEqual({
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': 13,
            });
            expect2(() => calls[0].body).toEqual('{"text":"hi"}');

            //* status >= 400 -> rejects with the same result shape.
            spy.mockImplementation(fakeRequest(400) as any);
            expect2(await postMessage('https://hooks.example.com/x', 'raw').catch(e => e)).toEqual({
                body: '{"ok":true}',
                statusCode: 400,
                statusMessage: 'Bad Request',
            });
            expect2(() => calls[1].body).toEqual('raw');
        } finally {
            spy.mockRestore();
        }
    });

    it('should match `/.../` rules w/ correct slicing, and never throw on a broken pattern (L-2)', async () => {
        const { service } = instance();
        const body = (title: string) => ({ attachments: [{ title }] });
        //* old bug: '/error/' was compiled as 'erro', '/abc$/' as 'abc'.
        expect2(() => service.match(body('erro x'), { pattern: '/error/' })).toEqual(undefined);
        expect2(() => service.match(body('an error x'), { pattern: '/error/' })).toEqual(body('an error x'));
        expect2(() => service.match(body('abcd'), { pattern: '/abc$/' })).toEqual(undefined);
        expect2(() => !!service.match(body('xabc'), { pattern: '/abc$/' })).toEqual(true);
        //* stateless across calls (compiled once, no `g` flag).
        const twice = [1, 2].map(() => !!service.match(body('a'), { pattern: '/a/' }));
        expect2(() => twice).toEqual([true, true]);
        //* an invalid pattern -> no match, no throw. (old code threw `Invalid regular expression`)
        expect2(() => service.match(body('(('), { pattern: '/((/' })).toEqual(undefined);
        //* other forms unchanged.
        expect2(() => !!service.match(body('#error here'), { pattern: '#error' })).toEqual(true);
        expect2(() => !!service.match(body('hello world'), { pattern: 'world' })).toEqual(true);
    });

    it('should not POST to an endpoint whose host is not allowed (H-1, env set)', async () => {
        const { service } = instance();
        const calls: string[] = [];
        //* record the outbound POSTs.
        (service as any).postMessage = async (endpoint: string) => {
            calls.push(endpoint);
            return { statusCode: 200, statusMessage: 'OK' };
        };
        await service.$channel.save('evil', { endpoint: 'https://evil.example.net/x' });
        await service.$channel.save('plain', { endpoint: 'http://example.com/x' });
        expect2(await service.send({ text: 'hi' }, { channel: 'evil' }), '$sent').toEqual({
            $sent: { statusCode: 400, statusMessage: '400 INVALID ENDPOINT - host not allowed @slack.send(/evil)' },
        });
        expect2(await service.send({ text: 'hi' }, { channel: 'plain' }), '$sent').toEqual({
            $sent: { statusCode: 400, statusMessage: '400 INVALID ENDPOINT - host not allowed @slack.send(/plain)' },
        });
        expect2(() => calls).toEqual([]);

        //* an allowed host is posted.
        await service.$channel.save('ok', { endpoint: 'https://example.com/x' });
        await service.send({ text: 'hi' }, { channel: 'ok' });
        expect2(() => calls).toEqual(['https://example.com/x']);
    });

    it('should send to an unlisted https host w/ a warn line while `CHANNEL_ENDPOINT_HOSTS` is unset', async () => {
        const { service } = instance();
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        const calls: string[] = [];
        const warns: string[] = [];
        //* record the outbound POSTs and the warn lines.
        (service as any).postMessage = async (endpoint: string) => {
            calls.push(endpoint);
            return { statusCode: 200, statusMessage: 'OK' };
        };
        service.logWarn = (line: string): void => void warns.push(line);
        await service.$channel.save('chatic', {
            endpoint: 'https://chat.example.net/hook?channelId=C1',
            stereo: 'chatic',
        });
        await service.$channel.save('plain', { endpoint: 'http://chat.example.net/hook' });
        expect2(await service.send({ text: 'hi' }, { channel: 'chatic' }), '$sent').toEqual({
            $sent: { statusCode: 200, statusMessage: 'OK' },
        });
        //* `http:` stays refused.
        expect2(await service.send({ text: 'hi' }, { channel: 'plain' }), '$sent').toEqual({
            $sent: { statusCode: 400, statusMessage: '400 INVALID ENDPOINT - host not allowed @slack.send(/plain)' },
        });
        expect2(() => calls).toEqual(['https://chat.example.net/hook?channelId=C1']);
        expect2(() => warns).toEqual([
            'WARN! endpoint host not in allow-list (CHANNEL_ENDPOINT_HOSTS unset) = https://chat.example.net/***',
        ]);
    });

    it('should abort postMessage() after 10 s, and reject on a request error (L-1)', async () => {
        const { service } = instance();
        const destroyed: string[] = [];
        //* fake `https.request()` that never answers (a hanging receiver).
        const hanging = () => {
            const req: any = new EventEmitter();
            req.write = (): boolean => true;
            req.end = (): void => undefined;
            req.destroy = (e?: Error) => {
                destroyed.push(GETERR(e));
                e && req.emit('error', e);
            };
            return req;
        };
        //* flush pending promise jobs.
        const flush = async () => {
            for (let i = 0; i < 10; i++) await Promise.resolve();
        };
        const postMessage = new SlackService(service.$channel).postMessage;
        const spy = jest.spyOn(https, 'request');
        jest.useFakeTimers();
        try {
            //* still pending just before 10 s, then rejected w/ `504 TIMEOUT`.
            let last: any = hanging();
            spy.mockImplementation((() => last) as any);
            let settled = false;
            const res = postMessage('https://hooks.example.com/x/secret', { text: 'hi' })
                .catch(GETERR)
                .finally(() => (settled = true));
            await flush();
            jest.advanceTimersByTime(9999);
            await flush();
            expect2(() => settled).toEqual(false);
            jest.advanceTimersByTime(1);
            expect2(await res).toEqual('504 TIMEOUT - postMessage(hooks.example.com) after 10000 ms');
            expect2(() => destroyed).toEqual(['504 TIMEOUT - postMessage(hooks.example.com) after 10000 ms']);

            //* a request error (ex: connection refused) -> rejects. (no unhandled `error` event)
            last = hanging();
            const res2 = postMessage('https://hooks.example.com/x', 'raw').catch(GETERR);
            await flush();
            last.emit('error', new Error('connect ECONNREFUSED'));
            expect2(await res2).toEqual('connect ECONNREFUSED');
        } finally {
            jest.useRealTimers();
            spy.mockRestore();
        }
    });
});
