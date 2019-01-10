//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

// let mongoose = require("mongoose");
// let Book = require('../app/models/book');

//Require the dev-dependencies
let assert = require('assert');
let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
const server = 'http://localhost:8084/item-tasks';

chai.use(chaiHttp);

//Top Level Block.
describe('item-tasks', () => {
    //Before each test we empty the database
    beforeEach((done) => {
        // Book.remove({}, (err) => { 
        //     done();         
        // });     
        done();
    });

    /**
     * Test Case
     */
    describe('/POST/:id', () => {
        it('it should handle task results.', (done) => {
            const data = require('../data/ns_6725779727.json');
            // console.log('> data=', data);
            const ID = 'T0000'
            chai.request(server)
            // .get('?action=test-self')
            .post('/'+ID)
            .send(data)
            .end((err, res) => {
                console.log('res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.name.should.be.a('string');
                res.body.should.have.property('id').eql('NS6725779727');
                done();
            });
        });
    });

    /**
     * Test Case : PUT
     */
    describe('/POST/:id', () => {
        it('it should handle task registering.', (done) => {
            const ID = 'NSf705b51424e741cd13d6f75025ef459f'
            chai.request(server)
            .put('/'+ID)
            .end((err, res) => {
                console.log('res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.name.should.be.a('string');
                res.body.should.have.property('id').eql(ID);
                res.body.should.have.property('type').eql('SRCH');
                res.body.should.have.property('MessageType').eql('NORMAL');
                done();
            });
        });
    });

    /**
     * Test Case : fetch sal9mart data.
     */
    describe('/GET/:id/sync-right-sal9', () => {
        it('it should fetch item information via godo.', (done) => {
            const ID = '1000003035'
            chai.request(server)
            .get('/item-tasks/'+ID+'/sync-right-sal9?page=26&save=0')
            .end((err, res) => {
                console.log('res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.data.should.be.a('object');
                res.body.should.have.property('data').eql(ID);
                res.body.should.have.property('nodes');
                done();
            });
        });
    });
});