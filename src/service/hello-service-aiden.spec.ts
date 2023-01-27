/**
 * `hello-service-aiden.spec.ts`
 * - common unit test for `hello-controller`
 * @author Aiden
 */

import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2, loadJsonSync, SlackPostBody, NextContext } from 'lemon-core';
import { HelloService } from './hello-service';
import { DummyHelloService } from './hello-dummies';
import request from 'supertest';
import { app } from '../express';

//! create service instance.
export const instance = (type = 'dummy', current?: number) => {
    current = current ?? new Date().getTime();
    const service: DummyHelloService = type == 'dummy' ? new DummyHelloService() : new HelloService();
    service.setCurrent(current);
    return { service, current };
};

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
        expect2(await service.postMessage(webhook, error_msg)).toEqual({
            body: 'ok',
            statusCode: 200,
            statusMessage: 'OK',
        });
        /* eslint-enable prettier/prettier */
    });

    it('should pass getHelloTime()', async done => {
        const date = new Date();
        const expected = {
            status: 200,
            text: `Hello lemon! - ${date.getHours()}:${date.getMinutes()}`,
        };
        const res = await request(app).get('/hello/0/time');
        expect2(res).toMatchObject(expected);
        done();
    });

    it('should not pass getHelloTime()', async done => {
        const wrongId = 3;
        const res = await request(app).get(`/hello/${wrongId}/time`);
        expect2(res).toMatchObject({
            status: 404,
            text: `404 NOT FOUND - id:${wrongId}`,
        });
        done();
    });

    it('should pass determinePostDirectly()', done => {
        const { service } = instance('dummy');

        expect2(() => service.determinePostDirectly('lemon', {})).toEqual(['lemon', false]);
        expect2(() => service.determinePostDirectly('!lemon', {})).toEqual(['lemon', true]);
        expect2(() => service.determinePostDirectly('lemon', { direct: '' })).toEqual(['lemon', true]);
        expect2(() => service.determinePostDirectly('!lemon', { direct: '' })).toEqual(['lemon', true]);
        expect2(() => service.determinePostDirectly('lemon', { direct: 'false' })).toEqual(['lemon', false]);
        done();
    });

    it('should pass makeSlackBody()', async done => {
        const { service } = instance('dummy');
        const expected = {
            attachments: [
                {
                    fallback: 'Hello Cute Animal!',
                    color: '#2eb886',
                    title: '귀여운 사진을 드리겠습니다.',
                    fields: [
                        {
                            title: 'Priority',
                            value: 'High',
                            short: false,
                        },
                    ],
                    image_url: 'https://cdn2.thecatapi.com/images/MTc5NjU2OA.jpg',
                },
            ],
        };

        expect2(() => service.hello()).toEqual(`hello-mocks-service`);
        expect2(await service.makeSlackBody('http://lemon.io/image/1.jpg').catch(GETERR)).toEqual(
            '@url[http://lemon.io/image/1.jpg] is invalid - not supported',
        );
        expect2(await service.makeSlackBody('https://cdn2.thecatapi.com/images/MTc5NjU2OA.jpg')).toEqual(expected);
        done();
    });

    it('should pass fetchRandomImageUrl()', async done => {
        const { service } = instance('dummy');
        const dogCaseExpected = `https://cdn2.thedogapi.com/images/MTc5NjU2OA.jpg`;
        const catCaseExpected = `https://cdn2.thecatapi.com/images/MTc5NjU2OA.jpg`;
        expect2(() => service.hello()).toEqual('hello-mocks-service');

        expect2(
            await service.fetchRandomImageUrl({ type: 'dog', imageUrl: 'https://api.thedogapi.com/v1/images/search' }),
        ).toEqual(dogCaseExpected);
        expect2(
            await service.fetchRandomImageUrl({ type: 'cat', imageUrl: 'https://api.thecatapi.com/v1/images/search' }),
        ).toEqual(catCaseExpected);
        expect2(
            await service
                .fetchRandomImageUrl({ type: 'cow', imageUrl: 'https://api.thecowapi.com/v1/images/search' })
                .catch(GETERR),
        ).toEqual(`.imageUrl[https://api.thecowapi.com/v1/images/search] is invalid - 404 ERROR`);

        done();
    });

    it('should pass asImageInfo()', done => {
        const { service } = instance('dummy');
        const dogCaseExpected = {
            type: 'dog',
            imageUrl: 'https://api.thedogapi.com/v1/images/search',
        };
        const catCaseExpected = {
            type: 'cat',
            imageUrl: 'https://api.thecatapi.com/v1/images/search',
        };

        expect2(() => service.hello()).toEqual('hello-mocks-service');

        expect2(() => service.asImageInfo({})).toEqual(catCaseExpected);
        expect2(() => service.asImageInfo({ name: 'lemon' })).toEqual(catCaseExpected);
        expect2(() => service.asImageInfo({ keyword: 'cat' })).toEqual(catCaseExpected);
        expect2(() => service.asImageInfo({ keyword: 'dog' })).toEqual(dogCaseExpected);
        expect2(() => service.asImageInfo({ keyword: 'cow' })).toEqual(
            `.keyword[cow] (string) is invalid - not supported`,
        );
        expect2(() => service.asImageInfo({ keyword: '' })).toEqual('.keyword[] (string) is invalid - not supported');
        done();
    });
});
