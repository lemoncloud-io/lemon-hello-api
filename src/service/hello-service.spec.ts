/**
 * `hello-service.spec.js`
 * - common service for `hello-service`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2, _it, loadJsonSync } from 'lemon-core';
import { HelloProxyService, HelloService, DummyHelloService } from './hello-service';

//! create service instance.
export const instance = (type = 'dummy') => {
    const service: HelloProxyService = type == 'dummy' ? new DummyHelloService() : new HelloService();
    return { service };
};

//! main test body.
describe('QueueService', () => {
    const PROFILE = loadProfile(process); // override process.env.

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
});
