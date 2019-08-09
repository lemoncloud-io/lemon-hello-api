/**
 * `test.hello-api.ts`
 * - test runnder of hello-api
 *
 *
 * @author Steve <steve@lemoncloud.io>
 * @date   2019-08-01 initial version with `supertest`.
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import request from 'supertest';
import { app } from '../src/express';
import $engine from '../src/engine';

// Test Hello
describe('Test Hello API', () => {
    //! test GET.
    test('It should response the GET method', done => {
        request(app)
            .get('/')
            .then((response: any) => {
                expect(response.statusCode).toBe(200);
                done();
            });
    });

    test('It should response the GET method (w/o done)', () => {
        return request(app)
            .get('/')
            .expect(200);
    });

    test('It should get the proper instances', () => {
        expect($engine.$kms.hello().hello).toBe('kms-service');
        expect($engine.$sns.hello().hello).toBe('sns-service');
        expect($engine.$s3s.hello().hello).toBe('s3s-service');
    });

    test('It should get the unique id', () => {
        expect($engine.$s3s.nextId().length).toBe('583b839c-aa9d-4ea1-a2d7-2e374ee1566a'.length);
    });
});
