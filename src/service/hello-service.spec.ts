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
import { HelloProxyService, HelloMocksService, HelloService } from './hello-service';

//! create service instance.
export const instance = (type = 'dummy') => {
    const service: HelloProxyService = type == 'dummy' ? new HelloMocksService() : new HelloService();
    return { service };
};

//! main test body.
describe('QueueService', () => {
    const PROFILE = loadProfile(process); // override process.env.

    it('should pass running currect env', async done => {
        const { service } = instance('dummy');
        expect2(service.hello()).toEqual('hello-mocks-service');
        /* eslint-disable prettier/prettier */
        /* eslint-enable prettier/prettier */
        done();
    });
});
