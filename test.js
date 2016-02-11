var request = require('supertest');
var mongoose = require('mongoose');
process.env.NODE_ENV = 'development';

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

    test('should had a home page', function(done){
        request(server)
        .get('/')
        .expect(200, done);
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

    // Search test
    test('should display search homepage', function(done){
        request(server)
        .get('/search/')
        .expect(200, done);
    });

    // Upload test
    test('should display upload file homepage', function(done){
        request(server)
        .get('/file/')
        .expect(200, done);
    });

    var procfile = {
        "name": "Procfile",
        "filesize": 19
    };
    test('should allow upload file', function(done){
        request(server)
        .post('/file/upload/')
        .attach('file', './Procfile')
        .expect(200, procfile, done);
    });
});


suite('Url Shortern Tests', function(){
    var server;
    suiteSetup(function (done) {
        // Flush cache
        delete require.cache[require.resolve('./index')];
        server = require('./index');

        // Clear MongoDB
        function clearDB() {
            for (var i in mongoose.connection.collections) {
            mongoose.connection.collections[i].remove(function() {});
            }
            return done();
        }

        if (mongoose.connection.readyState === 0) {
            mongoose.connect("mongodb://localhost:27017/test", function (err) {
            if (err) {
                throw err;
            }
            return clearDB();
            });
        } else {
            return clearDB();
        }
    });
    suiteTeardown(function (done) {
        mongoose.disconnect();
        server.close(done);
    });

    var url_short = {
        "original_url": "http://foo.com",
        "short_url": ""
    };

    test('should display url shortener home page', function(done) {
        request(server)
        .get('/url/')
        .expect(200, done);
    });

    test('should return short url', function(done) {
        request(server)
        .get('/url/new/' + url_short.original_url)
        .expect(function(res){
            url_short.short_url = res.body.short_url;
        })
        .expect(200, url_short, done);
    });

    test('should redirect to original url', function(done) {
        request(server)
        .get('/url/' + url_short.short_url)
        .expect('Location', url_short.original_url, done);
    });

});
