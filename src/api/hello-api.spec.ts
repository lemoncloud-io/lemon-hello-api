/**
 * `hello-api.spec.ts`
 * - sample unit test for `hello-api`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, loadJsonSync, $U, $info } from 'lemon-core';
import { HelloAPIController } from './hello-api';
import * as $service from '../service/hello-service.spec';
import { SlackService } from '../service/slack-service';
import { SlackChannelModel, StorageSupportable } from '../service/slack-types';
import { HelloService } from '../service/hello-service';

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

    //* make sure each test starts outside local mode.
    const $mode = process.env.LOCAL_MODE;
    beforeEach(() => {
        delete process.env.LOCAL_MODE;
    });
    //* restore the env of the runner.
    afterEach(() => {
        if ($mode === undefined) delete process.env.LOCAL_MODE;
        else process.env.LOCAL_MODE = $mode;
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
        expect2(saved).toEqual({
            channel: id,
            endpoint: 'https://example.com/hello/chat-send?channelId=C001',
            stereo: 'chatic',
            token: 'super-secret-1234',
        });

        //* read outside local mode -> endpoint/token masked. (existing endpoint convention)
        const masked = { channel: id, endpoint: 'https://exam', stereo: 'chatic', token: '****1234' };
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
            { endpoint: 'http://slack.example.com', rules: [{ pattern: '/./', copyTo: id }] },
            { domain: 'localhost' },
        );
        await controller.doPostSlack('0', {}, { attachments: [{ title: 'T' }] }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual([
            'https://example.com/hello/chat-send?channelId=C001',
            'http://slack.example.com',
        ]);
        expect2(() => sent[0].message, 'stereo').toEqual({ stereo: 'webhook' });

        //* no id but `body.channel` -> respected over the `public` fallback. (see jsdoc of `doPostSlack`)
        sent.length = 0;
        await controller.doPostSlack('0', {}, { text: 'hello', channel: id }, { domain: 'localhost' });
        expect2(() => sent.map(N => N.endpoint)).toEqual(['https://example.com/hello/chat-send?channelId=C001']);
    });

    it('should take `body.service` of sqs/sns only in local mode', async () => {
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

        //* outside local mode -> always this service, even with `domain: 'localhost'`.
        await controller.doPostSqs('0', {}, body, { domain: 'localhost' });
        await controller.doPostSns('0', {}, body, { domain: 'localhost' });
        expect2(() => calls.splice(0)).toEqual([
            { kind: 'sqs', service: self },
            { kind: 'sns', service: self },
        ]);

        //* local mode -> `body.service` is honoured (no `service` -> this service).
        await inLocalMode(() => controller.doPostSqs('0', {}, body, {}));
        await inLocalMode(() => controller.doPostSns('0', {}, { ...body, service: undefined }, {}));
        expect2(() => calls.splice(0)).toEqual([
            { kind: 'sqs', service: 'other-api' },
            { kind: 'sns', service: self },
        ]);
    });
});
