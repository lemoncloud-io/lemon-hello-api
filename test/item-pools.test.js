//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

// let mongoose = require("mongoose");
// let Book = require('../app/models/book');

//Require the dev-dependencies
let assert = require('assert');
let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
const server = 'http://localhost:3000/item-pools';

chai.use(chaiHttp);

//Top Level Block.
describe('item-pools', () => {
    //Before each test we empty the database
    beforeEach((done) => {
        // Book.remove({}, (err) => { 
        //     done();         
        // });     
        done();
    });

    /**
     * Test the /GET route 
     */
    describe('/GET/:id', () => {
        it('it should GET Model', (done) => {
            const ID = 'TST1120'
            chai.request(server)
            // .get('?action=test-self')
            .get('/'+ID)
            // .send({})
            .end((err, res) => {
                console.log('res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                // res.body.length.should.be.eql(0);
                res.body.name.should.be.a('string');
                res.body.should.have.property('id').eql(ID);
                done();
            });
        });
    });

    /**
     * Test the /PUT route 
     */
    describe('/PUT/:id', () => {
        it('it should PUT Model', (done) => {
            const ID = 'TST1120';
            const data = {
                name : 'Name2',
                nick : 'Hoho'
            }

            chai.request(server)
            // .get('?action=test-self')
            .put('/'+ID)
            .send(data)
            .end((err, res) => {
                console.log('> res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property("name").eql(data.name);
                // res.body.length.should.be.eql(0);
                // res.body.name.should.be.a('string');

                //! read back...
                return chai.request(server)
                .get('/'+ID)
                .end((err,res) => {
                    console.log('>> res=', res.body);
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("name").eql(data.name);
                    done();
                });
            })
        })
    });

    /**
     * Test the /POST route 
     */
    describe('/POST/:id', () => {
        it('it should POST Model', (done) => {
            const ID = 'TST1111';
            const data = {
                // name : 'Name2',
                type : 'test',
                domain : 'hi.o',
                nick : 'Hoho'
            }

            chai.request(server)
            // .get('?action=test-self')
            .post('/'+ID)
            .send(data)
            .end((err, res) => {
                console.log('> res=', res.body);
                res.should.have.status(503);
                res.body.should.be.a('string').eql('name is required!');
                // res.body.should.have.property("name").eql(data.name);
                // res.body.length.should.be.eql(0);
                // res.body.name.should.be.a('string');
                done();
            })
        })
    });

    /**
     * Test the /DELETE route 
     */
    describe('/DELETE/:id', () => {
        it('it should DELETE Model', (done) => {
            const ID = 'TST1111';
            chai.request(server)
            // .get('?action=test-self')
            .delete('/'+ID)
            // .send(data)
            .end((err, res) => {
                console.log('> res=', res.body);
                res.should.have.status(404);
                res.body.should.be.a('string');
                // res.body.should.have.property("name").eql(data.name);
                // res.body.length.should.be.eql(0);
                // res.body.name.should.be.a('string');
                done();
            })
        });
    });


    describe('LIST', () => {
        it('it should LIST Models', (done) => {
            chai.request(server)
            .get('/')
            .query({page:0, ipp:1})
            .end((err, res) => {
                console.log('res=', res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.list.should.be.a('array');
                res.body.list.length.should.be.eql(1);
                // res.body.name.should.be.a('string');
                res.body.should.have.property('page').eql(0);
                res.body.should.have.property('ipp').eql(1);
                done();
            });
        });
    });
});