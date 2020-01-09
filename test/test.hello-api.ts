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
});
