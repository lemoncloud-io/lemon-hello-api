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
});
