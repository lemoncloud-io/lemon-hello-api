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
import { expect2, loadJsonSync, $U } from 'lemon-core';
import { HelloAPIController } from './hello-api';
import * as $service from '../service/hello-service.spec';

import { app } from '../express';
import request from 'supertest';

// create service instance
export const instance = (type: 'dummy' = 'dummy') => {
    const { service, current } = $service.instance(type);
    const controller = new HelloAPIController(service);
    return { controller, service, current };
};

//*main test body.
describe('hello-controller', () => {
    const $pack = loadJsonSync('package.json');

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

    it('should pass lemon-core-v4 test', async () => {
        jest.setTimeout(10000);
        const id = '100001';

        /**
         * 초기 저장 데이터
         * - DynamoDB에 저장될 기본값
         */
        const initialData = { name: 'original' };

        // 1. Save to Dynamo
        const resSave = await request(app).post(`/hello/${id}/dynamo`).send(initialData);
        expect2(resSave.status).toEqual(200);
        expect2(JSON.parse(resSave.text)).toEqual({ res: { _id: id, ...initialData } });

        // 2. Read back from Dynamo
        const resRead = await request(app).get(`/hello/${id}/dynamo`);
        expect2(resRead.status).toEqual(200);
        expect2(JSON.parse(resRead.text)).toEqual({ res: { _id: id, ...initialData } });

        // 3. Send to SQS
        const sqsPayload = {
            service: 'eureka-hello-api',
            stage: 'dev',
            type: 'hello',
            mode: 'POST',
            id,
            cmd: 'dynamo',
            body: { name: 'from-sqs' },
        };
        const resSqs = await request(app).post(`/hello/${id}/sqs`).send(sqsPayload);
        expect2(resSqs.status).toEqual(200);

        // 3-1. Wait for SQS consumer
        await new Promise(resolve => setTimeout(resolve, 5000));

        const resReadBack = await request(app).get(`/hello/${id}/dynamo`);
        expect2(resReadBack.status).toEqual(200);
        expect2(JSON.parse(resReadBack.text)).toEqual({
            res: { _id: id, name: 'from-sqs' },
        });

        // // 4. Publish to SNS
        // const snsPayload = {
        //     service: 'eureka-hello-api',
        //     stage: 'dev',
        //     type: 'hello',
        //     mode: 'POST',
        //     id,
        //     cmd: 'dynamo',
        //     body: { name: 'from-sns' },
        // };
        // const snsRequestBody = {
        //     target: 'eureka-hello-sns-dev',
        //     subject: 'save-to-dynamo',
        //     payload: snsPayload,
        // };
        // const resSns = await request(app).post(`/hello/${id}/sns`).send(snsRequestBody);
        // expect2(resSns.status).toEqual(200);
        // expect2(resSns.body).toHaveProperty('messageId');

        // // 4-1. Wait for SNS subscriber
        // await new Promise(resolve => setTimeout(resolve, 2000));

        // const resFinal = await request(app).get(`/hello/${id}/dynamo`);
        // expect2(resFinal.status).toEqual(200);
        // expect2(JSON.parse(resFinal.text)).toEqual({
        //     res: { id, name: 'from-sns' },
        // });
    });
});
