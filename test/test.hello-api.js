/**
 * `test.hello-api.js`
 * - test runnder for api
 *
 *
 * @author Steve <steve@lemoncloud.io>
 * @date   2019-08-01 initial version with `supertest`.
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import request from 'supertest';
import { app } from '../src/express';
const $lemon = express['$lemon'];

// Test Hello
describe('Test Hello API', () => {
    //! test GET.
    test('It should response the GET method', done => {
        request(app)
            .get('/')
            .then(response => {
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
        expect($lemon.kms.hello().hello).toBe('kms-service');
        expect($lemon.sns.hello().hello).toBe('sns-service');
        expect($lemon.s3s.hello().hello).toBe('s3s-service');
    });

    test('It should get the unique id', () => {
        expect($lemon.s3s.nextId().length).toBe('583b839c-aa9d-4ea1-a2d7-2e374ee1566a'.length);
    });
});
