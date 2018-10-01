
var chai = require('chai');		//adds chai library for assertions
var chaiHttp = require('chai-http');	//chai plugin for HTTP
var server = require('../main.js');	//adds main.js file
var should = chai.should();		//creates 'should' interface

chai.use(chaiHttp);	//adds chai plugin to chai library

//describe() block is used for grouping tests
//it() statements contain each test case
describe('Confirm Web Pages are running', function(){

	//uses res.should.have.stateus(200) to confirm site is running
	it('/ is running', function(done){
		chai.request(server)
		.get('/')
		.end(function(err,res){
			res.should.have.status(200);
			done();
		});
	});
	
	it('/sign-in is running', function(done){
                chai.request(server)
                .get('/sign-in')
                .end(function(err,res){
                        res.should.have.status(200);
                        done();
                });
	});


});
