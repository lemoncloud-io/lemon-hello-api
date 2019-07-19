/* eslint-disable no-undef */

//! sample.
const returnOnError = (operation, alternative) => {
	try {
		return operation();
	} catch (e) {
		return alternative;
	}
};

test('returns the result if no error was thrown', () => {
	expect(returnOnError(() => 'foo', 'bar')).toEqual('foo');
});

test('returns the alternative if an error was thrown', () => {
	expect(
		returnOnError(() => {
			throw 'Foo';
		}, 'bar')
	).toEqual('bar');
});

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

//!WARN! - deperecated test with 'chai'
// //During the test the env variable is set to test
// process.env.NODE_ENV = 'test';

// //Require the dev-dependencies
// let assert = require('assert');
// let chai = require('chai');
// let chaiHttp = require('chai-http');
// let should = chai.should();
// const server = 'http://localhost:8888/hello';

// chai.use(chaiHttp);

// //Top Level Block.
// describe('hello', () => {
//     //Before each test we empty the database
//     beforeEach((done) => {
//         // Book.remove({}, (err) => {
//         //     done();
//         // });
//         done();
//     });

//     /**
//      * Test the / route
//      */
//     describe('LIST', () => {
//         it('it should pass LIST', (done) => {
//             chai.request(server)
//             .get('/')
//             .query({page:0, ipp:1})
//             .end((err, res) => {
//                 console.log('LIST.res =', res.body);
//                 res.should.have.status(200);
//                 res.body.should.be.a('object');
//                 res.body.list.should.be.a('array');
//                 res.body.list.length.should.be.eql(2);
//                 done();
//             });
//         });
//     });

//     /**
//      * Test the /GET route
//      */
//     describe('GET', () => {
//         it('it should pass GET', (done) => {
//             const ID = 1;
//             chai.request(server)
//             .get('/'+ID)
//             .end((err, res) => {
//                 console.log('GET['+ID+'].res =', res.body);
//                 res.should.have.status(200);
//                 res.body.should.be.a('object');
//                 // res.body.length.should.be.eql(0);
//                 res.body.name.should.be.a('string');
//                 res.body.should.have.property('name').eql('cloud');
//                 done();
//             });
//         });
//     });

//     /**
//      * Test the /PUT route
//      */
//     describe('PUT', () => {
//         it('it should pass PUT', (done) => {
//             const ID = 1;
//             const data = {
//                 nick : 'Hoho'
//             }
//             chai.request(server)
//             .put('/'+ID)
//             .send(data)
//             .end((err, res) => {
//                 console.log('PUT['+ID+'].res =', res.body);
//                 res.should.have.status(200);
//                 res.body.should.be.a('object');
//                 res.body.should.have.property("nick").eql(data.nick);

//                 //! read back...
//                 return chai.request(server)
//                 .get('/'+ID)
//                 .end((err,res) => {
//                     console.log('GET['+ID+'].res =', res.body);
//                     res.should.have.status(200);
//                     res.body.should.be.a('object');
//                     res.body.should.have.property("nick").eql(data.nick);
//                     done();
//                 });
//             })
//         })
//     });

//     /**
//      * Test the /POST route
//      */
//     describe('POST', () => {
//         it('it should POST Model', (done) => {
//             const ID = 0;
//             const data = {
//                 nick : 'Haha'
//             }
//             chai.request(server)
//             .post('/'+ID)
//             .send(data)
//             .end((err, res) => {
//                 console.log('POST['+ID+'].res =', res.body);
//                 res.should.have.status(200);
//                 res.body.should.be.a('number').eql(2);
//                 done();
//             })
//         })
//     });

//     /**
//      * Test the /DELETE route
//      */
//     describe('DELETE', () => {
//         it('it should pass DELETE', (done) => {
//             const ID = 1;
//             chai.request(server)
//             .delete('/'+ID)
//             .end((err, res) => {
//                 console.log('DELETE['+ID+'].res =', res.body);
//                 res.should.have.status(200);
//                 res.body.should.be.a('object');

//                 //! read back...
//                 return chai.request(server)
//                 .get('/'+ID)
//                 .end((err,res) => {
//                     console.log('GET['+ID+'].res =', res&&res.body);
//                     // res.should.have.status(404);                         // NO REPONSE FOR ERROR.
//                     // err.response.should.have.status(404);                // ERROR IF RESPONSE IS NOT IN JSON.
//                     err.statusCode.should.be.eql(404);
//                     done();
//                 });
//             })
//         });
//     });

// });
