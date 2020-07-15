/**
 * `hello-service.spec.ts`
 * - common service for `hello-service`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @date        2020-06-10 refactor with api
 * @date        2020-06-23 optimized with lemon-core#2.2.1
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2, _it, loadJsonSync } from 'lemon-core';
import { HelloService, DummyHelloService } from './hello-service';

//! create service instance.
export const instance = (type = 'dummy') => {
    const current = new Date().getTime();
    const service: DummyHelloService = type == 'dummy' ? new DummyHelloService() : new HelloService();
    return { service, current };
};

//! main test body.
describe('QueueService /w DummyHelloService', () => {
    const PROFILE = loadProfile(process); // override process.env.

    it('should pass postMessage()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        const webhook = 'https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC';
        const error_msg = {
            attachments: [
                {
                    pretext: 'error-report',
                    text:
                        '<https://lemon-hello-www.s3.ap-northeast-2.amazonaws.com/be173267-406e-4c88-8bba-599f55fa2b77.json|:waning_gibbous_moon:> hello lemon',
                    color: '#FFB71B',
                    mrkdwn: true,
                    mrkdwn_in: ['pretext', 'text'],
                },
            ],
        };
        /* eslint-disable prettier/prettier */
        expect2(await service.postMessage(webhook, error_msg)).toEqual({ body: "ok", statusCode: 200, statusMessage: "OK" });
        /* eslint-enable prettier/prettier */
        done();
    });

    it('should pass running currect env', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        expect2(await service.loadSlackChannel('hello', 'Hello').catch(GETERR)).toEqual('env[SLACK_HELLO] is required!');
        expect2(await service.loadSlackChannel('hello', 'AA')).toEqual('https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC');
        expect2(await service.loadSlackChannel('AA', null)).toEqual('https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC');
        /* eslint-enable prettier/prettier */
        done();
    });

    it('should pass getSubscriptionConfirmation()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'', subscribeURL:''})).toEqual('PASS');
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:''})).toEqual('PASS');
        expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:'http://lemoncloud.io'})).toEqual('OK');
        /* eslint-enable prettier/prettier */
        done();
    });

    it('should pass buildSlackNotification()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const result = {
            body: {
                attachments: [
                    {
                        color: '#FFB71B',
                        fields: [] as any,
                        pretext: '`#notification` from `undefined:undefined`',
                        text: '',
                        title: '[] event received.',
                        ts: Math.floor(new Date().getTime() / 1000),
                        username: 'hello-alarm',
                    },
                ],
            },
            channel: 'public',
        };

        expect2(await service.buildSlackNotification({})).toEqual(result);

        result.body.attachments[0].pretext = '`#notification` from `login:undefined`';
        result.body.attachments[0].text = '{\"service\":\"login\"}';
        expect2(await service.buildSlackNotification({service:'login'})).toEqual(result);

        result.body.attachments[0].pretext = '`#notification` from `login:test`';
        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\"}';
        expect2(await service.buildSlackNotification({service:'login', stage:'test'})).toEqual(result);

        result.body.attachments[0].pretext = '`#notification` from `login:test`';
        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\",\"event\":\"login\"}';
        result.body.attachments[0].title = '[login] event received.';
        expect2(await service.buildSlackNotification({service:'login', stage:'test', event:'login'})).toEqual(result);

        result.body.attachments[0].pretext = '`#notification` from `login:test`';
        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\",\"event\":\"login\",\"type\":\"oauth\"}';
        result.body.attachments[0].title = '[LOGIN] account `/`';
        expect2(await service.buildSlackNotification({service:'login', stage:'test', event:'login', type:'oauth'})).toEqual(result);

        result.body.attachments[0].pretext = '`#notification` from `login:test`';
        result.body.attachments[0].text = '{\"service\":\"login\",\"stage\":\"test\",\"event\":\"login\",\"type\":\"oauth\",\"data\":{\"accountId\":\"lemon1234\",\"provider\":\"lemoncloud\"}}';
        result.body.attachments[0].title = '[LOGIN] account `lemon1234/lemoncloud`';
        expect2(await service.buildSlackNotification({service:'login', stage:'test', event:'login', type:'oauth', data:{accountId: 'lemon1234', provider:'lemoncloud'}})).toEqual(result);
        /* eslint-enable prettier/prettier */

        done();
    });

    it('should pass saveMessageToS3()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        const error_hello = loadJsonSync('./data/error-hello.json');
        const result = {
            attachments: [
                {
                    color: '#FFB71B',
                    mrkdwn: true,
                    mrkdwn_in: ['pretext', 'text'],
                    pretext: 'error-report',
                    thumb_url: undefined as any,
                },
            ],
        };
        /* eslint-disable prettier/prettier */
        // TODO 어떻게 스팩을 더 상세화 할 수 있을까.
        // expect2(await service.saveMessageToS3(error_hello), '!attachments.text').toEqual(result);
        /* eslint-enable prettier/prettier */
        done();
    });

    it('should pass buildAlarmForm()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
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
        done();
    });

    it('should pass buildDeliveryFailure()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
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
        done();
    });

    it('should pass buildErrorForm()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
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
        done();
    });

    it('should pass buildCallbackForm()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
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
                    },
                ],
            },
            channel: '',
        };
        expect2(await service.buildCallbackForm({data:{}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\"}';
        expect2(await service.buildCallbackForm({data:{channel:'public'}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\",\"service\":\"hello-service\"}';
        result.body.attachments[0].title = '#callback hello-service/';
        expect2(await service.buildCallbackForm({data:{channel:'public', service:'hello-service'}})).toEqual(result);

        result.body.attachments[0].text = '{\"title\":\"callback message\",\"channel\":\"public\",\"service\":\"hello-service\"}';
        expect2(await service.buildCallbackForm({data:{title:'callback message', channel:'public', service:'hello-service'}})).toEqual(result);

        result.body.attachments[0].text = '{\"channel\":\"public\",\"service\":\"hello-service\",\"cmd\":\"hello\"}';
        expect2(await service.buildCallbackForm({data:{channel:'public', service:'hello-service', cmd:'hello'}})).toEqual(result);
        /* eslint-enable prettier/prettier */
        done();
    });

    it('should pass buildCommonSlackForm()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        const now = Math.floor(new Date().getTime() / 1000);
        expect2(await service.buildCommonSlackForm({data:{}})).toEqual({body: undefined, channel: ''});
        expect2(await service.buildCommonSlackForm({data:{channel:'dddd'}})).toEqual({body: undefined, channel: 'dddd'});
        expect2(await service.buildCommonSlackForm({data:{channel:'dddd', service:'hello-service'}})).toEqual({body: undefined, channel: "dddd"});
        const result = { body: {attachments: [{fields: [{title: "context", value: "{}"}], pretext: "hello-service"}]}, channel: "dddd"};
        expect2(await service.buildCommonSlackForm({data:{channel:'dddd', service:'hello-service', body:{attachments:[]}}, context:{}})).toEqual(result);
        /* eslint-enable prettier/prettier */
        done();
    });
});

describe('communication with horse, queue, session service', () => {
    const PROFILE = loadProfile(process); // override process.env.
    it('should pass postMessage()', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        /* eslint-enable prettier/prettier */
        done();
    });
});
