/* eslint-disable no-undef */
//! with supertest via express.app
const request = require('supertest');
const app = require('../src/express')['app'];

describe('Test the root path', () => {
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
});
