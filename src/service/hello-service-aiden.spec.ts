/**
 * `hello-service-aiden.spec.ts`
 * - common unit test for `hello-controller`
 * 
 * 
 * @author      Aiden <aiden@lemoncloud.io>
 * @date        2022-11-02 initial version
 * 
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, expect2, loadJsonSync, $U } from 'lemon-core';
import { HelloService } from './hello-service';
import { DummyHelloService } from './hello-dummies';
import request from 'supertest';
import { app } from '../express';
import { Model, ModelType } from './hello-model';

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
            "@url[http://lemon.io/image/1.jpg] is invalid - not supported"
        );
        expect2(await service.makeSlackBody('https://cdn2.thecatapi.com/images/MTc5NjU2OA.jpg')).toEqual(expected);
        done();
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    it('should pass fetchRandomImageUrl()', async done => {
        const { service } = instance('dummy');
        const dogCaseExpected = `https://cdn2.thedogapi.com/images/MTc5NjU2OA.jpg`;
        const catCaseExpected = `https://cdn2.thecatapi.com/images/MTc5NjU2OA.jpg`;
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        
        expect2(await service.fetchRandomImageUrl({keyword:'cat',imageUrl:'https://api.thecatapi.com/dummy/AAAA'})).toEqual(catCaseExpected);
        expect2(await service.fetchRandomImageUrl({keyword:'dog',imageUrl:'https://api.thedogapi.com/dummy/BBBB'})).toEqual(dogCaseExpected);
        expect2(await service.fetchRandomImageUrl({keyword:'cow',imageUrl:'https://lemon.cowapi.com/dummy/CCCC'}).catch(GETERR)).toEqual(`@imageUrl[https://lemon.cowapi.com/dummy/CCCC] (string) is invalid - are not supported`);
        expect2(await service.fetchRandomImageUrl({keyword:'dog',imageUrl:'http://api.thedogapi.com/dummy/BBBB'}).catch(GETERR)).toEqual(`@imageUrl[http://api.thedogapi.com/dummy/BBBB] (string) is invalid - are not supported`);
        done();
    });
    
    it('should pass ImageUrl save, read, delete', async () => {
        const { service } = instance('dummy');
        const dogCaseExpected = {
            keyword: 'dog',
            imageUrl: 'https://lemon.dogimg.com/dummy/BBBB',
        };
        const catCaseExpected = {
            keyword: 'cat',
            imageUrl: 'https://lemon.catimg.com/dummy/AAAA',
        };
        
        expect2(() => service.hello()).toEqual('hello-mocks-service');
        expect2(() => service.$animal.storage.hello()).toEqual(`typed-storage-service:animal/proxy-storage-service:dummy-storage-service:dummy-table/_id`);
        
        expect2(await service.saveImageUrl({keyword: 'cat', imageUrl:'https://lemon.catimg.com/dummy/CCCC'})).toMatchObject({msg : 'SAVED'});
        expect2(await service.saveImageUrl({keyword: 'dog', imageUrl:'https://lemon.dogimg.com/dummy/BBBB'})).toMatchObject({msg : 'SAVED'});
        expect2(await service.saveImageUrl({keyword: 'cat', imageUrl:'https://lemon.catimg.com/dummy/AAAA'})).toMatchObject({msg : 'UPDATED'});
        expect2(await service.saveImageUrl({imageUrl: 'https://lemon.cowimg.com/dummy/CCCCCCCC'}).catch(GETERR)).toEqual(`@id (model-id) is required!`);
        
        expect2(await service.asImageInfo({})).toEqual(catCaseExpected);
        expect2(await service.asImageInfo({ keyword: 'cat' })).toEqual(catCaseExpected);
        expect2(await service.asImageInfo({ keyword: 'dog' })).toEqual(dogCaseExpected);
        expect2(await service.asImageInfo({ keyword: 'cow' }).catch(GETERR)).toEqual(`.keyword[cow] (string) is invalid - not supported`);
        expect2(await service.asImageInfo({ keyword: '' }).catch(GETERR)).toEqual(`@id (model-id) is required!`);

        expect2(await service.deleteImageUrl({keyword: 'cat'})).toMatchObject({msg : 'DELETED'});
        expect2(await service.deleteImageUrl({keyword: 'dog'})).toMatchObject({msg : 'DELETED'});
        expect2(await service.deleteImageUrl({keyword: 'cow'}).catch(GETERR)).toEqual({msg : "NOT FOUND", result : {_id : "TT:animal:cow"}});
        expect2(await service.deleteImageUrl({keyword: 'cat'}).catch(GETERR)).toEqual({msg : 'NOT FOUND', result : {_id : 'TT:animal:cat'}});
    });

    it('should pass asCheckImageBody', () => {
        const { service } = instance('dummy');

        expect2(() => service.hello()).toEqual('hello-mocks-service');

        expect2(() => service.asCheckImageBody({keyword:'cat'},'POST')).toEqual({keyword:'cat'})
        expect2(() => service.asCheckImageBody({keyword:'cow'},'DELETE')).toEqual({keyword:'cow'})
        expect2(() => service.asCheckImageBody({keyword:'dog', imageUrl:'https://lemon.dogimg.io'},'PUT')).toEqual({keyword:'dog', imageUrl:'https://lemon.dogimg.io'})

        expect2(() => service.asCheckImageBody(`{"keyword":"dog", "imageUrl":"https://lemon.dogimg.io"}`, 'PUT')).toEqual({keyword:'dog', imageUrl:'https://lemon.dogimg.io'})
        expect2(() => service.asCheckImageBody({keyword:'cat', imageUrl:'https://lemon.catimg.io'},'POST')).toEqual({keyword:'cat', imageUrl:'https://lemon.catimg.io'})
        expect2(() => service.asCheckImageBody({keyword:'cat', imageUrl:'https://lemon.catimg.io'},'DELETE')).toEqual({keyword:'cat', imageUrl:'https://lemon.catimg.io'})

        expect2(() => service.asCheckImageBody({keyword:'cat'}, 'PUT')).toEqual(`.imageUrl (string) is required!`);
        expect2(() => service.asCheckImageBody({imageUrl:'https://lemon.dogimg.com/dummy/BBBBBBBB'}, 'PUT')).toEqual(`.keyword (string) is required!`);
        expect2(() => service.asCheckImageBody({imageUrl:'https://lemon.dogimg.com/dummy/BBBBBBBB'}, 'POST')).toEqual(`.keyword (string) is required!`);
    })
});

