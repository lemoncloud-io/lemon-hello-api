/**
 * `hello-api.spec.ts`
 * - sample unit test for `hello-api`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 * @date        2026-10-30 security review: dynamo/sqs/sns local-only (C-1, H-2), channel masking/allow-list (H-1), BUFF cap (L-3).
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, loadJsonSync, $U, $info, GETERR } from 'lemon-core';
import { HelloAPIController } from './hello-api';
import * as $service from '../service/hello-service.spec';
import { SlackService } from '../service/slack-service';
import { SlackChannelModel, StorageSupportable } from '../service/slack-types';
import { HelloService } from '../service/hello-service';
import { CHANNEL_ENDPOINT_HOSTS } from '../service/channel-policy';
import $defService from '../service/hello-service';

import { app } from '../express';
import request from 'supertest';

// create service instance
export const instance = (type: 'dummy' = 'dummy') => {
    const { service, current } = $service.instance(type);
    const controller = new HelloAPIController(service);
    return { controller, service, current };
};

//* run `fn` in lemon-core local mode (`$U.isLocalMode()`), then restore the env.
const inLocalMode = async <T>(fn: () => Promise<T>): Promise<T> => {
    const $org = { mode: process.env.LOCAL_MODE, fn: process.env.AWS_LAMBDA_FUNCTION_NAME };
    process.env.LOCAL_MODE = '1';
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    try {
        return await fn();
    } finally {
        //* restore both values exactly (unset stays unset).
        if ($org.mode === undefined) delete process.env.LOCAL_MODE;
        else process.env.LOCAL_MODE = $org.mode;
        if ($org.fn !== undefined) process.env.AWS_LAMBDA_FUNCTION_NAME = $org.fn;
    }
};

//*main test body.
describe('hello-controller', () => {
    const $pack = loadJsonSync('package.json');

    //* make sure each test starts outside local mode, w/ the test hosts allowed.
    const $mode = process.env.LOCAL_MODE;
    const $hosts = process.env[CHANNEL_ENDPOINT_HOSTS];
    beforeEach(() => {
        delete process.env.LOCAL_MODE;
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'example.com,slack.example.com';
    });
    //* restore the env of the runner.
    afterEach(() => {
        jest.restoreAllMocks();
        if ($mode === undefined) delete process.env.LOCAL_MODE;
        else process.env.LOCAL_MODE = $mode;
        if ($hosts === undefined) delete process.env[CHANNEL_ENDPOINT_HOSTS];
        else process.env[CHANNEL_ENDPOINT_HOSTS] = $hosts;
    });

    // basic test
    it('check type and identity of controller', async () => {
        const { controller } = instance();
        expect2(controller.type()).toEqual(`hello`);
        expect2(controller.hello()).toEqual(`hello-api-controller:${controller.type()}`);
    });

    it('should pass express route: GET /', async () => {
        const res = await request(app).get('/');
        expect2(() => ({ ...res, text: res.text.split('\n')[0] })).toMatchObject({
            status: 200,
            text: `${$pack.name}/${$pack.version}`,
        });
    });

    it(`should pass GET /hello/0`, async () => {
        const expected = { name: '1st', id: '0' };
        const res = await request(app).get(`/hello/0`);
        expect2(res).toMatchObject({
            status: 200,
            text: $U.json({ ...expected }),
        });
    });

    it('should pass channel save/read w/ chatic fields and token masking', async () => {
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
        const service = { $slack: new SlackService($channel) } as unknown as HelloService;
        const controller = new HelloAPIController(service);
        const id = 'chatic1';

        //* save a chatic channel.
        const saved = await controller.doPostChannel(
            id,
            {},
            {
                endpoint: 'https://example.com/hello/chat-send?channelId=C001',
                stereo: 'chatic',
                token: 'super-secret-1234',
            },
            { domain: 'localhost' },
        );
        //* H-1: the save response is masked outside local mode too. (same as the read)
        const masked = { channel: id, endpoint: 'https://exam', stereo: 'chatic', token: '****1234' };
        expect2(saved).toEqual(masked);

        //* read outside local mode -> endpoint/token masked. (existing endpoint convention)
        expect2(await controller.doGetChannel(id, {}, undefined, { domain: 'test.com' })).toEqual(masked);

        //* v5: `domain: 'localhost'` is only a request value and grants nothing -> still masked.
        expect2(await controller.doGetChannel(id, {}, undefined, { domain: 'localhost' })).toEqual(masked);

        //* v5: lemon-core local mode (`LOCAL_MODE=1`, not in Lambda) -> unmasked.
        expect2(await inLocalMode(() => controller.doGetChannel(id, {}, undefined, { domain: 'test.com' }))).toEqual({
            channel: id,
            endpoint: 'https://example.com/hello/chat-send?channelId=C001',
            stereo: 'chatic',
            token: 'super-secret-1234',
        });

        //* update w/ routing rules -> merged into the model. (consumed by `SlackService.route()`)
        const updated = await controller.doPostChannel(
            id,
            {},
            { rules: [{ pattern: '/./', copyTo: 'error' }] },
            { domain: 'localhost' },
        );
        expect2(updated, 'rules').toEqual({ rules: [{ pattern: '/./', copyTo: 'error' }] });

        //* no channel -> routed via `public` so its routing rules apply. (auto error-report path)
        const sent: { endpoint: string; message: any }[] = [];
        (service.$slack as any).postMessage = async (endpoint: string, message: any) => {
            sent.push({ endpoint, message });
            return { statusCode: 100, statusMessage: 'ok' };
        };
        await controller.doPostChannel(
            'public',
            {},
            { endpoint: 'https://slack.example.com', rules: [{ pattern: '/./', copyTo: id }] },
            { domain: 'localhost' },
        );
        await controller.doPostSlack('0', {}, { attachments: [{ title: 'T' }] }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual([
            'https://example.com/hello/chat-send?channelId=C001',
            'https://slack.example.com',
        ]);
        expect2(() => sent[0].message, 'stereo').toEqual({ stereo: 'webhook' });

        //* no id but `body.channel` -> respected over the `public` fallback. (see jsdoc of `doPostSlack`)
        sent.length = 0;
        await controller.doPostSlack('0', {}, { text: 'hello', channel: id }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual(['https://example.com/hello/chat-send?channelId=C001']);
    });

    it('should serve sqs/sns only in local mode, and take `body.service` there (H-2)', async () => {
        //* stub manager: record the payload instead of sending to AWS.
        const calls: { kind: string; service: string }[] = [];
        const $test = {
            sendToSqs: async (params: any) =>
                calls.push({ kind: 'sqs', service: params?.service }) && { messageId: 'q' },
            sendToSns: async (params: any) =>
                calls.push({ kind: 'sns', service: params?.service }) && { messageId: 's' },
        };
        const service = { $test } as unknown as HelloService;
        const controller = new HelloAPIController(service);
        const self = $info().service;
        const body = { service: 'other-api', type: 'hello', id: '1', cmd: 'dynamo' };

        //* outside local mode -> 404, nothing sent (even with `domain: 'localhost'`).
        expect2(await controller.doPostSqs('0', {}, body, { domain: 'localhost' }).catch(GETERR)).toEqual(
            '404 NOT FOUND - doPostSqs(hello/0) is local only',
        );
        expect2(await controller.doPostSns('0', {}, body, { domain: 'localhost' }).catch(GETERR)).toEqual(
            '404 NOT FOUND - doPostSns(hello/0) is local only',
        );
        expect2(() => calls.splice(0)).toEqual([]);

        //* local mode -> `body.service` is honoured (no `service` -> this service).
        await inLocalMode(() => controller.doPostSqs('0', {}, body, {}));
        await inLocalMode(() => controller.doPostSns('0', {}, { ...body, service: undefined }, {}));
        expect2(() => calls.splice(0)).toEqual([
            { kind: 'sqs', service: 'other-api' },
            { kind: 'sns', service: self },
        ]);
    });

    it('should serve dynamo only in local mode, never for reserved `@` ids (C-1)', async () => {
        //* stub manager: record the storage calls.
        const calls: string[] = [];
        const $test = {
            readFromDynamo: async (id: string) => calls.push(`read:${id}`) && { res: { id } },
            saveToDynamo: async (id: string, data: any) => calls.push(`save:${id}`) && { res: { id, ...data } },
        };
        const controller = new HelloAPIController({ $test } as unknown as HelloService);

        //* Lambda (not local) -> 404 w/o a storage call.
        expect2(await controller.doGetDynamo('@error', {}, null, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - doGetDynamo(hello/@error) is local only',
        );
        expect2(await controller.doGetDynamo('x', {}, null, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - doGetDynamo(hello/x) is local only',
        );
        expect2(await controller.doPostDynamo('x', {}, { name: 'n' }, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - doPostDynamo(hello/x) is local only',
        );
        expect2(() => calls).toEqual([]);

        //* local mode -> works for a normal id, still 404 for `@` ids.
        expect2(await inLocalMode(() => controller.doGetDynamo('x', {}, null, {}))).toEqual({ res: { id: 'x' } });
        expect2(await inLocalMode(() => controller.doPostDynamo('x', {}, { name: 'n' }, {}))).toEqual({
            res: { id: 'x', name: 'n' },
        });
        expect2(await inLocalMode(() => controller.doGetDynamo('@error', {}, null, {})).catch(GETERR)).toEqual(
            '404 NOT FOUND - id:@error is reserved',
        );
        expect2(await inLocalMode(() => controller.doPostDynamo('@error', {}, {}, {})).catch(GETERR)).toEqual(
            '404 NOT FOUND - id:@error is reserved',
        );
        expect2(() => calls).toEqual(['read:x', 'save:x']);
    });

    it('should give 404 on `GET /hello/@error/dynamo` via http w/o a storage read (C-1)', async () => {
        //* the default controller's service: spy on its storage.
        const read = jest.spyOn($defService.$test.storage, 'read');
        const res1 = await request(app).get(`/hello/${encodeURIComponent('@error')}/dynamo`);
        const res2 = await request(app).get(`/hello/x/dynamo`);
        expect2(() => [res1.status, res2.status]).toEqual([404, 404]);
        expect2(() => res1.text.includes('meta$')).toEqual(false);
        expect2(() => read.mock.calls.length).toEqual(0);
    });

    it('should reject a reserved `@` id on the channel and slack routes', async () => {
        const controller = new HelloAPIController({ $slack: {} } as unknown as HelloService);
        expect2(await controller.doGetChannel('@error', {}, undefined, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - id:@error is reserved',
        );
        expect2(await controller.doPostChannel('@x', {}, { name: 'x' }, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - id:@x is reserved',
        );
        expect2(await controller.doPostSlack('@x', {}, { text: 'x' }, {}).catch(GETERR)).toEqual(
            '404 NOT FOUND - id:@x is reserved',
        );
    });

    it('should validate endpoint host and rules when saving a channel (H-1, L-2)', async () => {
        const saved: any[] = [];
        const $slack = {
            default: async (id: string) => ({ channel: id }),
            $channel: { save: async (id: string, model: any) => saved.push(model) && model },
        };
        const controller = new HelloAPIController({ $slack } as unknown as HelloService);
        expect2(
            await controller.doPostChannel('c1', {}, { endpoint: 'https://evil.example.net/x' }, {}).catch(GETERR),
        ).toEqual('400 INVALID ENDPOINT - host not allowed @doPostChannel(hello/c1)');
        expect2(
            await controller.doPostChannel('c1', {}, { endpoint: 'http://example.com/x' }, {}).catch(GETERR),
        ).toEqual('400 INVALID ENDPOINT - host not allowed @doPostChannel(hello/c1)');
        expect2(await controller.doPostChannel('c1', {}, { rules: [{ pattern: '/(/' }] }, {}).catch(GETERR)).toEqual(
            '400 INVALID RULE - rules[0].pattern is not a valid regex @doPostChannel(hello/c1)',
        );
        expect2(() => saved).toEqual([]);

        //* clearing the endpoint (`''`) is allowed.
        expect2(await controller.doPostChannel('c1', {}, { endpoint: '' }, {})).toEqual({
            channel: 'c1',
            endpoint: '',
        });
    });

    it('should accept the stored host of the same channel when `CHANNEL_ENDPOINT_HOSTS` is unset (H-1)', async () => {
        delete process.env[CHANNEL_ENDPOINT_HOSTS];
        const saved: any[] = [];
        const stored: { [id: string]: any } = { c1: { endpoint: 'https://chat.example.net/old?channelId=C1' } };
        const $slack = {
            channel: async (id: string) => stored[id] || null,
            default: async (id: string) => ({ channel: id, ...stored[id] }),
            $channel: { save: async (id: string, model: any) => saved.push(model) && model },
        };
        const controller = new HelloAPIController({ $slack } as unknown as HelloService);
        //* same host as stored -> ok (an operator updates rules/token of an existing chatic channel).
        const ok = await controller.doPostChannel(
            'c1',
            {},
            { endpoint: 'https://chat.example.net/new?channelId=C2', token: 'tk-0001' },
            {},
        );
        expect2(() => ok).toEqual({ channel: 'c1', endpoint: 'https://chat', token: '****0001' });
        //* other host, or no stored channel -> 400.
        expect2(
            await controller.doPostChannel('c1', {}, { endpoint: 'https://other.example.net/x' }, {}).catch(GETERR),
        ).toEqual('400 INVALID ENDPOINT - host not allowed @doPostChannel(hello/c1)');
        expect2(
            await controller.doPostChannel('c2', {}, { endpoint: 'https://chat.example.net/x' }, {}).catch(GETERR),
        ).toEqual('400 INVALID ENDPOINT - host not allowed @doPostChannel(hello/c2)');
        expect2(() => saved.length).toEqual(1);
    });

    it('should cap the demo buffer (100 items, name <= 200 chars) (L-3)', async () => {
        const controller = new HelloAPIController({} as unknown as HelloService);
        //* a long name is cut to 200 chars.
        const one = await controller.doPost('subscribe', {}, { name: 'x'.repeat(500) }, {});
        expect2(() => one.name.length).toEqual(200);
        //* many posts keep at most 100 items (the oldest go first).
        for (let i = 0; i < 150; i++) await controller.doPost('subscribe', {}, { name: `n${i}` }, {});
        const { list } = await controller.doList('', {}, null, {});
        expect2(() => list.length).toEqual(100);
        expect2(() => list[list.length - 1].name).toEqual('n149');
        //* put keeps the cap on `name`, and only takes `name`.
        const put = await controller.doPut('0', {}, { name: 'y'.repeat(300), big: 'z' }, {});
        expect2(() => [put.name.length, put.big]).toEqual([200, undefined]);
    });
});
