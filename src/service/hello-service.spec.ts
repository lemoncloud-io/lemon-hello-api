/**
 * `hello-service.spec.ts`
 * - common service for `hello-service`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @date        2020-06-10 refactor with api
 * @date        2020-06-23 optimized with lemon-core#2.2.1
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2022-09-08 supports database w/ manager
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2, loadJsonSync } from 'lemon-core';
import { HelloService } from './hello-service';
import { DummyHelloService } from './hello-dummies';
import { Model, ModelType, TestModel } from './hello-model';

//! create service instance.
export const instance = (type = 'dummy', current?: number) => {
    current = current ?? new Date().getTime();
    const service: DummyHelloService = type == 'dummy' ? new DummyHelloService() : new HelloService();
    service.setCurrent(current);
    return { service, current };
};

//! main test body.
describe('hello-service /w dummy', () => {
    const PROFILE = loadProfile(process); // override process.env.
    PROFILE && console.info(`! PROFILE =`, PROFILE);

    let footer: string;
    beforeEach(async () => {
        const $pack = loadJsonSync('package.json');
        footer = `lemon-hello-api/local#${$pack.version}`;
    });

    it('should pass postMessage()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        const webhook = 'https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC';
        const error_msg = {
            attachments: [
                {
                    pretext: 'error-report',
                    text: '<https://lemon-hello-www.s3.ap-northeast-2.amazonaws.com/be173267-406e-4c88-8bba-599f55fa2b77.json|:waning_gibbous_moon:> hello lemon',
                    color: '#FFB71B',
                    mrkdwn: true,
                    mrkdwn_in: ['pretext', 'text'],
                },
            ],
        };
        /* eslint-disable prettier/prettier */
        expect2(await service.postMessage(webhook, error_msg)).toEqual({ body: "ok", statusCode: 200, statusMessage: "OK" });
        /* eslint-enable prettier/prettier */
    });

    it('should pass running currect env', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');

        /* eslint-disable prettier/prettier */
        expect2(await service.loadSlackChannel('hello', 'Hello').catch(GETERR)).toEqual('@env[SLACK_HELLO] is not found!');
        expect2(await service.loadSlackChannel('hello', 'AA')).toEqual('https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC');
        expect2(await service.loadSlackChannel('AA', null)).toEqual('https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC');
        /* eslint-enable prettier/prettier */
    });

    it('should pass getSubscriptionConfirmation()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'', subscribeURL:''})).toEqual('PASS');
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:''})).toEqual('PASS');
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:'http://lemoncloud.io'})).toEqual('OK');
        /* eslint-enable prettier/prettier */
    });

    it('should pass buildSlackNotification()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const color = '#FFB71B';
        const result = {
            body: {
                attachments: [
                    {
                        color,
                        fields: [] as any,
                        pretext: '`#notification` at lemon-hello-api',
                        text: '',
                        title: '[] event received from `undefined/undefined`.',
                        ts: Math.floor(new Date().getTime() / 1000),
                        username: 'hello-alarm',
                        footer,
                    },
                ],
            },
            channel: 'public',
        };

        const fx = (body: any, color?: string) => {
            const ret = service.buildSlackNotification(body, color);
            ret.body.attachments[0].text = result.body.attachments[0].text; //WARN! DO NOT TEST `text`
            return ret;
        }

        expect2(() => fx({}, color)).toEqual(result);

        result.body.attachments[0].title = '[] event received from `login/undefined`.';
        result.body.attachments[0].text = '{\"service\":\"login\"}';
        expect2(() => fx({service:'login'}, color)).toEqual(result);

        result.body.attachments[0].title = '[] event received from `login/test`.';
        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\"}';
        expect2(() => fx({service:'login', stage:'test'}, color)).toEqual(result);

        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\",\"event\":\"login\"}';
        result.body.attachments[0].title = '[login] event received from `login/test`.';
        expect2(() => fx({service:'login', stage:'test', event:'login'}, color)).toEqual(result);

        result.body.attachments[0].pretext = '';
        result.body.attachments[0].title = '#login(`test`) of `/` via ``';
        result.body.attachments[0].color = '#FFC300';
        expect2(() => fx({service:'login', stage:'test', event:'login', type:'oauth'}, color)).toEqual(result);

        result.body.attachments[0].pretext = '';
        result.body.attachments[0].title = '#login(`test`) of `lemoncloud/lemon1234` via ``';
        result.body.attachments[0].color = '#FFC300';
        expect2(() => fx({service:'login', stage:'test', event:'login', type:'oauth', data:{accountId: 'lemon1234', provider:'lemoncloud'}}, color)).toEqual(result);
        /* eslint-enable prettier/prettier */

        //! test of mail boundced
        const sesBounced = {
            notificationType: 'Bounce',
            bounce: {
                feedbackId: '0100017d93b65feb-5b27348d-2fe2-47f2-9a36-f8d25e8f679e-000000',
                bounceType: 'Transient',
                bounceSubType: 'General',
                bouncedRecipients: [
                    {
                        emailAddress: 'xxxxxxxx@naver.comn',
                        action: 'failed',
                        status: '5.4.4',
                        diagnosticCode: 'smtp; 550 5.4.4 Invalid domain',
                    },
                ],
                timestamp: '2021-12-07T07:05:42.000Z',
                reportingMTA: 'dns; amazonses.com',
            },
            mail: {
                timestamp: '2021-12-07T07:05:41.668Z',
                source: '=?utf-8?B?7Iug7ZKN7Jyg7Ya1?= <noreply@lemoncloud.io>',
                sourceArn: 'arn:aws:ses:us-east-1:11111:22222',
                sourceIp: '1.1.1.1',
                sendingAccountId: '11111',
                messageId: '0100017d93b65c24-712d86fd-1916-42d3-8b7c-2b1854107e66-000000',
                headersTruncated: false,
                headers: [
                    {
                        name: 'From',
                        value: 'noreply <noreply@lemoncloud.io>',
                    },
                    {
                        name: 'To',
                        value: 'xxxxxxxx@naver.comn',
                    },
                ],
            },
        };
        result.body.attachments[0].pretext = '`#notification` at lemon-hello-api';
        result.body.attachments[0].title = '[mail/Bounce] event received as `Transient/xxxxxxxx@naver.comn`.';
        result.body.attachments[0].color = '#FFB71B';
        expect2(() => fx(sesBounced, color)).toEqual(result);

        //! from redis
        const redisEvent = {
            subject: '',
            data: {
                'ElastiCache:SnapshotComplete': 'carrot-redis-t3m-0001-001',
            },
            context: null as any,
        };
        result.body.attachments[0].pretext = '`#notification` at lemon-hello-api';
        result.body.attachments[0].title = '[ElastiCache:SnapshotComplete] event received.';
        result.body.attachments[0].color = '#FFB71B';
        expect2(() => fx(redisEvent, color)).toEqual(result);
    });

    it('should pass saveMessageToS3()', async () => {
        const { service } = instance('dummy', 1662964983745);
        expect2(() => service.hello()).toEqual('hello-mocks-service');

        // verify `s3.putObject`
        expect2(await service.$s3s.putObject('X').catch(GETERR)).toEqual({
            Bucket: 'X',
            Key: 'any-key',
            Location: 's3://dummy',
            ETag: null,
        });

        // verify the input data.
        const error_hello = loadJsonSync('./data/error-hello.json');
        expect2(() => error_hello?.attachments, 'pretext,title').toEqual([
            { pretext: 'hello lemon', title: 'error-report' },
        ]);

        // verify the expected data.
        const result = {
            attachments: [
                {
                    color: '#FFB71B',
                    mrkdwn: true,
                    mrkdwn_in: ['pretext', 'text'],
                    pretext: 'error-report',
                    text: '<s3://dummy|:waning_gibbous_moon:> hello lemon',
                    thumb_url: undefined as any,
                },
            ],
        };
        expect2(await service.saveMessageToS3(error_hello).catch(GETERR)).toEqual(result);
    });

    it('should pass buildAlarmForm()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const result = {
            body: {
                attachments: [
                    {
                        color: '#FFB71B',
                        fields: [] as any,
                        pretext: 'Alarm: ',
                        text: '',
                        title: '',
                        ts: Math.floor(new Date().getTime() / 1000),
                        username: 'hello-alarm',
                        footer,
                    },
                ],
            },
            channel: '',
        };
        expect2(await service.buildAlarmForm({})).toEqual(result);

        result.body.attachments[0].fields = [{short: false, title: "AlarmName", value: "hello error"}, {short: true, title: "AlarmDescription", value: "error test msg"}];
        result.body.attachments[0].pretext = 'Alarm: hello error';
        result.body.attachments[0].title = 'error test msg';
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg'}})).toEqual(result);

        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'}
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123'}})).toEqual(result);

        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'},
            {short: true, title: 'NewStateValue', value:'draft'}
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123', NewStateValue:'draft'}})).toEqual(result);

        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'},
            {short: true, title: 'NewStateValue', value:'draft'},
            {short: false, title: 'NewStateReason', value:'404'}
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123', NewStateValue:'draft', NewStateReason:'404'}})).toEqual(result);

        const now = Math.floor(new Date().getTime() / 1000);
        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'},
            {short: true, title: 'NewStateValue', value:'draft'},
            {short: false, title: 'NewStateReason', value:'404'},
            {short: true, title: 'StateChangeTime', value: now }
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123', NewStateValue:'draft', NewStateReason:'404', StateChangeTime:now}})).toEqual(result);


        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'},
            {short: true, title: 'NewStateValue', value:'draft'},
            {short: false, title: 'NewStateReason', value:'404'},
            {short: true, title: 'StateChangeTime', value: now },
            {short: true, title: 'Region', value: 'asia-2' }
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123', NewStateValue:'draft', NewStateReason:'404', StateChangeTime:now, Region:'asia-2'}})).toEqual(result);

        result.body.attachments[0].fields = [
            {short: false, title: "AlarmName", value: "hello error"},
            {short: true, title: "AlarmDescription", value: "error test msg"},
            {short: true, title: 'AWSAccountId', value:'123-123'},
            {short: true, title: 'NewStateValue', value:'draft'},
            {short: false, title: 'NewStateReason', value:'404'},
            {short: true, title: 'StateChangeTime', value: now },
            {short: true, title: 'Region', value: 'asia-2' },
            {short: true, title: 'OldStateValue', value: 'pending' },
            {short: false, title: 'Trigger', value: 'off' },
        ];
        expect2(await service.buildAlarmForm({data:{AlarmName:'hello error', AlarmDescription:'error test msg', AWSAccountId:'123-123', NewStateValue:'draft', NewStateReason:'404', StateChangeTime:now, Region:'asia-2', OldStateValue:'pending', Trigger:'off'}})).toEqual(result);

        /* eslint-enable prettier/prettier */
    });

    it('should pass buildDeliveryFailure()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const now = Math.floor(new Date().getTime() / 1000);
        const result = {
            body: {
                attachments: [
                    {
                        color: '#FFB71B',
                        fields: [
                            { short: true, title: 'Enabled', value: 'on' },
                            { short: true, title: 'CustomUserData', value: now },
                            { short: false, title: 'Token', value: '1234-1234-1234-1234' },
                        ],
                        pretext: 'SNS: ',
                        text: 'For more details, run below. \n```aws sns get-endpoint-attributes --endpoint-arn ""```',
                        title: '',
                        ts: now,
                        username: 'hello-alarm',
                        footer,
                    },
                ],
            },
            channel: '',
        };
        expect2(await service.buildDeliveryFailure({data:{}})).toEqual(result);

        result.body.attachments[0].pretext = 'SNS: event';
        expect2(await service.buildDeliveryFailure({data:{EventType:'event'}})).toEqual(result);

        result.body.attachments[0].title = 'failed event';
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event'}})).toEqual(result);

        result.body.attachments[0].text = 'For more details, run below. \n```aws sns get-endpoint-attributes --endpoint-arn \"arn:aaaa\"```';
        // TODO list의 순서를 맞춰주기 위해서 이렇게 할당한다.
        result.body.attachments[0].fields = [
            { short:false, title: 'EndpointArn', value:'arn:aaaa'},
            { short: true, title: 'Enabled', value: 'on' },
            { short: true, title: 'CustomUserData', value: now },
            { short: false, title: 'Token', value: '1234-1234-1234-1234' },
        ]
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa'}})).toEqual(result);

        result.body.attachments[0].fields = [
            { short: true, title: 'FailureType', value:'exception'},
            { short: false, title: 'EndpointArn', value:'arn:aaaa'},
            { short: true, title: 'Enabled', value: 'on' },
            { short: true, title: 'CustomUserData', value: now },
            { short: false, title: 'Token', value: '1234-1234-1234-1234' },
        ]
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception'}})).toEqual(result);
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception', DeliveryAttempts:'done'}})).toEqual(result);
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception', DeliveryAttempts:'done', Service:'hello'}})).toEqual(result);
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception', DeliveryAttempts:'done', Service:'hello', Time:now}})).toEqual(result);

        result.body.attachments[0].fields = [
            { short: true, title: 'FailureType', value:'exception'},
            { short: true, title: 'MessageId', value:'123-123-123'},
            { short: false, title: 'EndpointArn', value:'arn:aaaa'},
            { short: true, title: 'Enabled', value: 'on' },
            { short: true, title: 'CustomUserData', value: now },
            { short: false, title: 'Token', value: '1234-1234-1234-1234' },
        ]
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception', DeliveryAttempts:'done', Service:'hello', Time:now, MessageId:'123-123-123'}})).toEqual(result);

        result.body.attachments[0].fields = [
            { short: true, title: 'FailureType', value:'exception'},
            { short: true, title: 'MessageId', value:'123-123-123'},
            { short: false, title: 'EndpointArn', value:'arn:aaaa'},
            { short: false, title: 'Resource', value:'hello.json'},
            { short: true, title: 'Enabled', value: 'on' },
            { short: true, title: 'CustomUserData', value: now },
            { short: false, title: 'Token', value: '1234-1234-1234-1234' },
        ]
        expect2(await service.buildDeliveryFailure({data:{EventType:'event', FailureMessage:'failed event', EndpointArn:'arn:aaaa', FailureType:'exception', DeliveryAttempts:'done', Service:'hello', Time:now, MessageId:'123-123-123', Resource:'hello.json'}})).toEqual(result);
        /* eslint-enable prettier/prettier */
    });

    it('should pass buildErrorForm()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const now = Math.floor(new Date().getTime() / 1000);
        const result = {
            body: {
                attachments: [
                    {
                        color: '#FFB71B',
                        fields: [] as any,
                        pretext: '',
                        text: '',
                        title: 'error-report',
                        ts: now,
                        username: 'hello-alarm',
                        footer,
                    },
                ],
            },
            channel: '',
        };
        expect2(await service.buildErrorForm({data:{}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\"}';
        expect2(await service.buildErrorForm({data:{channel:'public'}})).toEqual(result);

        result.body.attachments[0].pretext = 'hello message';
        result.body.attachments[0].text = '{\"channel\":\"public\",\"message\":\"hello message\"}';
        expect2(await service.buildErrorForm({data:{channel:'public', message:'hello message'}})).toEqual(result);
        /* eslint-enable prettier/prettier */
    });

    it('should pass buildCallbackForm()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const now = Math.floor(new Date().getTime() / 1000);
        const result = {
            body: {
                attachments: [
                    {
                        color: '#B71BFF',
                        fields: [] as any,
                        pretext: '',
                        text: '',
                        title: 'callback-report',
                        ts: now,
                        username: 'hello-alarm',
                        footer,
                    },
                ],
            },
            channel: '',
        };
        expect2(service.buildCallbackForm({data:{}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\"}';
        expect2(service.buildCallbackForm({data:{channel:'public'}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\",\"service\":\"hello-service\"}';
        result.body.attachments[0].title = '#callback hello-service/';
        expect2(service.buildCallbackForm({data:{channel:'public', service:'hello-service'}})).toEqual(result);

        result.body.attachments[0].text = '{\"title\":\"callback message\",\"channel\":\"public\",\"service\":\"hello-service\"}';
        expect2(service.buildCallbackForm({data:{title:'callback message', channel:'public', service:'hello-service'}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\",\"service\":\"hello-service\",\"cmd\":\"hello\"}';
        expect2(service.buildCallbackForm({data:{channel:'public', service:'hello-service', cmd:'hello'}})).toEqual(result);
        /* eslint-enable prettier/prettier */
    });

    it('should pass buildCommonSlackForm()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        const fx = (d: any) => service.buildCommonSlackForm(d);
        expect2(() => fx({ data: {} })).toEqual({ body: undefined, channel: '' });
        expect2(() => fx({ data: { channel: 'dddd' } })).toEqual({ body: undefined, channel: 'dddd' });
        expect2(() => fx({ data: { channel: 'dddd', service: 'hello-service' } })).toEqual({
            body: undefined,
            channel: 'dddd',
        });
        const result = {
            body: { attachments: [{ fields: [{ title: 'context', value: '{}' }], pretext: 'hello-service' }] },
            channel: 'dddd',
        };
        expect2(
            fx({ data: { channel: 'dddd', service: 'hello-service', body: { attachments: [] } }, context: {} }),
        ).toEqual(result);
        /* eslint-disable prettier/prettier */
        /* eslint-enable prettier/prettier */
    });
});

describe('model-manager in service', () => {
    //! test service w/ dummy data
    it('should pass test-manager w/ storage', async () => {
        const { service, current } = instance('dummy');
        const _ts = (type: ModelType): Model => ({
            ns: 'TT',
            type,
            createdAt: current,
            updatedAt: current,
            deletedAt: 0,
        });

        //! test service marking
        expect2(service.hello()).toEqual('hello-mocks-service');
        const FIELDS =
            'name,test,stereo,ns,type,sid,uid,gid,lock,next,meta,createdAt,updatedAt,deletedAt,error,id'.split(',');
        expect2(() => service.$test.hello()).toEqual(
            `typed-storage-service:test/proxy-storage-service:dummy-storage-service:dummy-table/_id`,
        );
        expect2(() => service.$test.FIELDS).toEqual([...FIELDS]);

        //! test MyCoreManager of handling name.
        if (1) {
            const $test = service.$test;

            expect2(() => $test.onBeforeSave({ name: 'a' }, {})).toEqual({ name: 'a' }); // keep name
            expect2(() => $test.onBeforeSave({ name: 'a' }, { name: 'b' })).toEqual({ name: undefined }); // clear name

            expect2(() => $test.validateName(null)).toEqual(false);
            expect2(() => $test.validateName('')).toEqual(false);
            expect2(() => $test.validateName('a')).toEqual(true);
            expect2(() => $test.validateName(' ')).toEqual(false);
            expect2(() => $test.validateName(2 as any)).toEqual(true);
            expect2(() => $test.validateName('abc')).toEqual(true);

            //! check w/ lookup
            expect2(await $test.$unique.updateLookup({ id: 'XYZ' }, 'X').catch(GETERR)).toEqual({
                ..._ts('test'),
                _id: 'TT:test:XYZ',
                id: 'XYZ',
                name: 'X',
            });

            expect2(() => $test.asIdByName('a')).toEqual('#name/a');
            expect2(() => $test.asIdByName(null)).toEqual('#name/');

            //! readByName
            expect2(await $test.findByName(undefined).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName(null).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('').catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('a').catch(GETERR)).toEqual('404 NOT FOUND - test:name/a');
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');
            expect2(await $test.findByName('   ').catch(GETERR)).toEqual('@name (   ) is not valid!');
            expect2(await $test.findByName(123 as any).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName({} as any).catch(GETERR)).toEqual('@name (string) is required!');

            //! updateName(model) with name 'abc'
            const model: TestModel = { id: 't01', name: 'test' };
            expect2(await $test.storage.read(model.id).catch(GETERR)).toEqual('404 NOT FOUND - _id:TT:test:t01');
            expect2(await $test.storage.read($test.asIdByName('abc')).catch(GETERR)).toEqual(
                '404 NOT FOUND - _id:TT:test:#name/abc',
            );
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');

            /* eslint-disable prettier/prettier */
            expect2(await $test.updateName(model, undefined).catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName(model, null).catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName(model, '').catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName(model, 'abc').catch(GETERR)).toEqual('@name (abc) is not same as (test)!');
            expect2(await $test.updateName({ ...model, name:'abc' }, 'abc').catch(GETERR), '!updatedAt').toEqual({ id:'t01', name:'abc' });

            expect2(await $test.storage.read(model.id).catch(GETERR),'_id,id,name').toEqual({ _id: "TT:test:t01", id:'t01', name: "abc" });
            expect2(await $test.storage.read($test.asIdByName('abc')), '!createdAt,!updatedAt,!deletedAt').toEqual({ _id:'TT:test:#name/abc', id:'#name/abc', name:'abc', ns:'TT', meta:'t01', type:'test', stereo:'#' });
            expect2(await $test.findByName('abc').catch(GETERR), '_id,id,name').toEqual({ _id: "TT:test:t01", id:'t01', name: "abc" });

            //! updateName(model2) with same name 'abc'
            const model2: TestModel = { id:'t02', name:'Test' };
            expect2(await $test.storage.read(model2.id).catch(GETERR)).toEqual('404 NOT FOUND - _id:TT:test:t02');
            expect2(await $test.updateName(model2, undefined).catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName(model2, null).catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName(model2, '').catch(GETERR)).toEqual('@name () is not valid!');
            expect2(await $test.updateName({ ...model2, name:'abc' }, 'abc').catch(GETERR)).toEqual('400 DUPLICATED NAME - name[abc] is duplicated to test[t01]');
            /* eslint-enable prettier/prettier */
        }
    });

    it('should pass channel rules', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-mocks-service');

        //
    });
});
