/**
 * `hello-controller.spec.ts`
 * - sample unit test for `hello-controller`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2019-12-03 initial version
 * @date        2020-06-30 optimized with lemon-core#2.2.1
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { expect2, loadJsonSync, $U, _it } from 'lemon-core';
import { app } from '../express';
import request from 'supertest';
import * as $service from '../service/hello-service.spec';
import { HelloAPIController } from './hello-api';

// create service instance
export const instance = (type: 'dummy' = 'dummy') => {
    const { service, current } = $service.instance(type);
    const controller = new HelloAPIController(service);
    return { controller, service, current };
};

//! main test body.
describe('hello-controller', () => {
    const $pack = loadJsonSync('package.json');

    // basic test
    it('check type and identity of controller', async done => {
        const { controller } = instance();
        expect2(controller.type()).toEqual(`hello`);
        expect2(controller.hello()).toEqual(`hello-api-controller:${controller.type()}`);
        done();
    });

    it('should pass express route: GET /', async done => {
        const res = await request(app).get('/');
        expect2(() => ({ ...res, text: res.text.split('\n')[0] })).toMatchObject({
            status: 200,
            text: `${$pack.name}/${$pack.version}`,
        });
        done();
    });

    it(`should pass GET /hello/0`, async done => {
        const expected = { name: 'lemon' };
        const res = await request(app).get(`/hello/0?name=hello`);
        expect2(res).toMatchObject({
            status: 200,
            text: $U.json({ ...expected }),
        });
        done();
    });

    it(`should pass GET /hello/1`, async done => {
        const expected = { name: 'cloud' };
        const res = await request(app).get(`/hello/1?name=world`);
        expect2(res).toMatchObject({
            status: 200,
            text: $U.json({ ...expected }),
        });
        done();
    });

    it(`should pass GET /hello/0/hello`, done => {
        const accountId = process.env.USER || 'guest';
        const expected = {
            id: '0',
            hello: 'hello-api-controller:hello',
            context: {
                identity: {},
                userAgent: 'node-superagent/3.8.3',
                clientIp: '::ffff:127.0.0.1',
                requestId: '2020-07-15 18:57:34.533',
                accountId: accountId,
                domain: '127.0.0.1',
                source: `api://${accountId}@${$pack.name}-dev#${$pack.version}`,
            },
        };

        request(app)
            .get(`/hello/0/hello?requestId=${expected.context.requestId}`)
            .set('Authorization', `Basic jest`)
            // .type(0 ? 'form' : 'json')
            // .send({ name: 'a@b.c' })
            .expect(200, { ...expected })
            .end(done);
    });

    it('should pass postHelloImage()', async done => {
        const expected = {
            body : 'ok',
            statusCode: 200,
            statusMessage: "OK"
        };

        const res = await request(app)
                            .post('/hello/test/image')
                            .set('Autorization', 'Basic jest')
                            .send({keyword:"dog"});

        expect2(res).toMatchObject({
            status: 200,
            text: $U.json(expected)
        });

        done();
    });

    it('should not pass postHelloImage()', async done => {
        const res = await request(app)
                            .post('/hello/test/image')
                            .set('Autorization', 'Basic jest')
                            .send({keyword:"cow"});

        expect2(res.text).toEqual('.keyword[cow] (string) is invalid - not supported');

        done();
    });
});
