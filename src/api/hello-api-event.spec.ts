/**
 * `hello-api-event.spec.ts`
 * - the error-report path: SNS event -> lemon-core SNS handler -> `doPostEvent()` -> slack / chatic.
 * - outbound HTTP (`postMessage`) is a stub. no network, no AWS.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 v5: SNS error-report fan-out contract (lemon-core#5.0.11).
 * @date        2026-10-30 security review H-1: the test hosts are allowed by env `CHANNEL_ENDPOINT_HOSTS`.
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { expect2, LambdaHandler, LambdaSNSHandler } from 'lemon-core';
import { HelloAPIController } from './hello-api';
import { HelloService } from '../service/hello-service';
import { SlackService } from '../service/slack-service';
import { SlackChannelModel, StorageSupportable } from '../service/slack-types';
import { CHANNEL_ENDPOINT_HOSTS } from '../service/channel-policy';

//* in-memory channel storage (same contract as the DynamoDB one in `HelloService`).
const memoryChannels = () =>
    new (class implements StorageSupportable<SlackChannelModel> {
        public $map: { [id: string]: SlackChannelModel } = {};
        public hello = () => `memory-channel-storage`;
        //* read one channel, or null.
        public async read(id: string) {
            return this.$map[id] || null;
        }
        //* merge-save one channel (null deletes).
        public async save(id: string, model: SlackChannelModel) {
            const $fin = model === null ? null : { ...this.$map[id], ...model };
            if ($fin === null) delete this.$map[id];
            else this.$map[id] = $fin;
            return $fin;
        }
    })();

//* build a controller whose slack service records every outbound POST instead of sending it.
export const instance = () => {
    const $channel = memoryChannels();
    const sent: { endpoint: string; message: any }[] = [];
    const $slack = new (class extends SlackService {
        //* stubbed transport: record and answer 200.
        public postMessage = async (endpoint: string, message: any) => {
            sent.push({ endpoint, message });
            return { statusCode: 200, statusMessage: 'OK' };
        };
    })($channel);
    const service = { $slack } as unknown as HelloService;
    const controller = new HelloAPIController(service);
    return { controller, $channel, $slack, sent };
};

//* one SNS record like lemon-core `doReportError()` publishes it (subject `error`, JSON message).
const snsEvent = (Subject: string, message: any) => ({
    Records: [
        {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn: '',
            Sns: {
                Type: 'Notification',
                MessageId: 'm-0001',
                TopicArn: '',
                Subject,
                Message: typeof message === 'string' ? message : JSON.stringify(message),
                Timestamp: '2026-10-30T00:00:00.000Z',
                MessageAttributes: {},
            },
        },
    ],
});

//* a sns handler of our own (not the engine one), so only the test controller listens.
const snsHandler = (controller: HelloAPIController) => {
    const $sns = new LambdaSNSHandler(new LambdaHandler());
    $sns.addListener(controller.doPostEvent);
    return $sns;
};

//* the error-report payload shape of lemon-core `asErrorPayload()` (relevant fields only).
const ERROR_REPORT = {
    service: 'api://chatic-sample-api#1.2.3',
    message: '401 UNAUTHORIZED - not authenticated @invite.list',
    error: '401 UNAUTHORIZED - not authenticated @invite.list',
};

describe('hello-api error-report path (SNS -> slack/chatic)', () => {
    const $org = LambdaSNSHandler.REPORT_ERROR;
    const $hosts = process.env[CHANNEL_ENDPOINT_HOSTS];
    //* never publish a report of our own while testing. allow the test hosts (H-1).
    beforeEach(() => {
        LambdaSNSHandler.REPORT_ERROR = false;
        process.env[CHANNEL_ENDPOINT_HOSTS] = 'slack.example.com,chat.example.com';
    });
    //* restore the shared flag and the env.
    afterEach(() => {
        LambdaSNSHandler.REPORT_ERROR = $org;
        if ($hosts === undefined) delete process.env[CHANNEL_ENDPOINT_HOSTS];
        else process.env[CHANNEL_ENDPOINT_HOSTS] = $hosts;
    });

    it('routes an error report via `public` rules to the chatic channel (webhook payload)', async () => {
        const { controller, $channel, sent } = instance();
        await $channel.save('public', {
            endpoint: 'https://slack.example.com/public',
            useS3: false,
            rules: [{ pattern: 'error-report', moveTo: 'error' }],
        });
        await $channel.save('error', {
            endpoint: 'https://chat.example.com/hello/chat-send?channelId=C001',
            stereo: 'chatic',
            token: 'test-token-0001',
        });

        //* SNS never rejects: the handler resolves `void`.
        expect2(await snsHandler(controller).handle(snsEvent('error', ERROR_REPORT) as any, null)).toEqual(undefined);

        //* exactly one POST, to the chatic endpoint (moveTo stops the rules).
        expect2(() => sent.map(N => N.endpoint)).toEqual(['https://chat.example.com/hello/chat-send?channelId=C001']);
        expect2(() => sent[0].message, 'content,stereo,token').toEqual({
            content: 'error-report: `chatic-sample-api#1.2.3`\n' + ERROR_REPORT.message,
            stereo: 'webhook',
            token: 'test-token-0001',
        });
        expect2(() => sent[0].message.meta, 'pretext,title,username').toEqual({
            pretext: ERROR_REPORT.message,
            title: 'error-report: `chatic-sample-api#1.2.3`',
            username: 'hello-alarm',
        });
    });

    it('copies to slack and chatic when the rule is `copyTo`', async () => {
        const { controller, $channel, sent } = instance();
        await $channel.save('public', {
            endpoint: 'https://slack.example.com/public',
            useS3: false,
            rules: [{ pattern: 'error-report', copyTo: 'error' }],
        });
        await $channel.save('error', {
            endpoint: 'https://chat.example.com/hello/chat-send?channelId=C001',
            stereo: 'chatic',
            token: 'test-token-0001',
        });
        await snsHandler(controller).handle(snsEvent('error', ERROR_REPORT) as any, null);

        //* chatic first (copyTo), then the original to slack public.
        expect2(() => sent.map(N => N.endpoint)).toEqual([
            'https://chat.example.com/hello/chat-send?channelId=C001',
            'https://slack.example.com/public',
        ]);
        expect2(() => sent[1].message.channel).toEqual('public');
        expect2(() => sent[1].message.attachments[0], 'title,pretext').toEqual({
            title: 'error-report: `chatic-sample-api#1.2.3`',
            pretext: ERROR_REPORT.message,
        });
    });

    it('sends a `slack` subject to the channel of the subject, unchanged for slack', async () => {
        const { controller, $channel, sent } = instance();
        await $channel.save('public', { endpoint: 'https://slack.example.com/public', useS3: false });
        await $channel.save('ops', { endpoint: 'https://slack.example.com/ops' });
        const body = { channel: 'ops', service: 'sample-api', body: { attachments: [{ title: 'T', text: 'hi' }] } };
        await snsHandler(controller).handle(snsEvent('slack', body) as any, null);

        expect2(() => sent.map(N => N.endpoint)).toEqual(['https://slack.example.com/ops']);
        expect2(() => sent[0].message.channel).toEqual('ops');
        expect2(() => sent[0].message.attachments[0], 'title,text').toEqual({ title: 'T', text: 'hi' });
    });

    it('resolves (never rethrows) when the listener fails', async () => {
        const { controller, $channel, sent } = instance();
        //* a broken storage: every read fails.
        $channel.read = async () => {
            throw new Error('500 STORAGE DOWN - test');
        };
        expect2(await snsHandler(controller).handle(snsEvent('error', ERROR_REPORT) as any, null)).toEqual(undefined);
        expect2(() => sent.length).toEqual(0);
    });

    it('keeps an endpoint failure inside the result (no throw)', async () => {
        const { controller, $channel, $slack } = instance();
        await $channel.save('public', { endpoint: 'https://slack.example.com/public', useS3: false });
        //* transport rejects like a 4xx from the receiver.
        $slack.postMessage = async () => {
            throw { statusCode: 400, statusMessage: 'Bad Request' };
        };
        const res = await controller.doPostEvent('SNS', { subject: 'error' }, ERROR_REPORT, null);
        expect2(() => res?.statusCode).toEqual(500);
    });
});
