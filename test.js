var request = require('supertest');

suite('Timestamp Microservice Tests', function(){
    var server;
    setup(function () {
        // Flush cache
        delete require.cache[require.resolve('./index')];
        server = require('./index');
    });
    teardown(function (done) {
        server.close(done);
    });

    var result = {"unix":1450137600, "natural":"December 15, 2015"};
    var null_result = {"unix":null, "natural":null};

    test('should be able to convert natural date', function(done){
        request(server)
        .get('/timestamp/December 15, 2015')
        .expect(200, result, done);
    });

    test('should be able to convert Unix date', function(done){
        request(server)
        .get('/timestamp/1450137600')
        .expect(200, result, done);
    });

    test('should return null on error parsing', function(done){
        request(server)
        .get('/timestamp/foo')
        .expect(200, null_result, done);
    });

    test('should display intro', function(done){
        request(server)
        .get('/timestamp')
        .expect(200, done);
    });
});
