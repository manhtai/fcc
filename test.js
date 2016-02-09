var request = require('supertest');

suite('FCC Tests', function(){
    var server;
    setup(function () {
        // Flush cache
        delete require.cache[require.resolve('./index')];
        server = require('./index');
    });
    teardown(function (done) {
        server.close(done);
    });

    // Timestamp tests
    var timestamp = {"unix":1450137600, "natural":"December 15, 2015"};
    var null_timestamp = {"unix":null, "natural":null};

    test('should be able to convert natural date', function(done){
        request(server)
        .get('/timestamp/December 15, 2015')
        .expect(200, timestamp, done);
    });

    test('should be able to convert Unix date', function(done){
        request(server)
        .get('/timestamp/1450137600')
        .expect(200, timestamp, done);
    });

    test('should return null on error parsing', function(done){
        request(server)
        .get('/timestamp/foo')
        .expect(200, null_timestamp, done);
    });

    test('should display intro', function(done){
        request(server)
        .get('/timestamp')
        .expect(200, done);
    });

    // Whoyouare tests
    var whoyouare = {
        "ipaddress": "::ffff:127.0.0.1",
        "language": "vi",
        "software": "Ubuntu"
    };
    test('should display who you are', function(done){
        request(server)
        .get('/whoyouare/')
        .set('Accept-Language', 'vi')
        .set('User-Agent', 'Ubuntu')
        .expect(200, whoyouare, done);
    });
});
