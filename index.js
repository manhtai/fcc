var express = require('express');
var strf = require('strftime');
var parser = require('ua-parser-js');
var validUrl = require('valid-url');
var randomstring = require('randomstring');
var Url = require('./mongo').Url;
var Search = require('./mongo').Search;
var request = require('request');
var multer  = require('multer');
var upload = multer();

var app = express();
app.set('port', process.env.PORT || 3000);

// Homepage
app.get('/', function(req, res){
    res.type('text/plain');
    res.send('Please visit https://github.com/manhtai/fcc for more information.');
});

// Timestamp Microservice
app.get('/timestamp/', function(req, res){
    res.type('text/plain');
    res.send('Please visit /timestamp/1450137600 or /timestamp/December 15, 2015.');
});

app.get('/timestamp/:param', function(req, res){
    var param = req.params.param;
    var date;
    param = Number(param) ? Number(param) : Date.parse(param + ' UTC') / 1000;
    if (param) {
        date = new Date(0);
        date.setSeconds(param);
    } else {
        date = null;
    }
    var result = {
        "unix": date ? date.getTime() / 1000 : null,
        "natural": date ? strf("%B %d, %Y", date) : null
    };
    res.type('application/json');
    res.send(JSON.stringify(result));
});

// Request Header Parser Microservice
app.get('/whoyouare', function(req, res){
    var ua = parser(req.get('User-Agent'));
    res.type('application/json');
    var result = {
        "ipaddress": req.ip,
        "language": req.get('Accept-Language').split(',')[0],
        "software": ua.os.name
    };
    res.send(JSON.stringify(result));
});

// Url Shorterner Microservice
app.get('/url/new/*', function(req, res, next){
    var original_url = req.path.slice('/url/new/'.length);
    var result, short_url;
    res.type('application/json');
    if (validUrl.isUri(original_url)) {
        // Url existed
        Url.findOne({"original_url": original_url}, function(err, url){
            if (url) {
                result = {
                    "original_url": url.original_url,
                    "short_url": url.short_url
                };
            } else {
                // New url
                // FIXME: Overwritting are allowed!
                short_url = randomstring.generate(3);
                result = {
                    "original_url": original_url,
                    "short_url": short_url
                };
                // Save to database
                Url(result).save();
            }
            res.send(JSON.stringify(result));
        });
    } else {
        result = {
            "error": "Invalid url"
        };
        res.send(JSON.stringify(result));
    }
});

app.get('/url/', function(req, res){
    res.type('text/plain');
    res.send('Use /new/http://foo.com to create a new url.');
});

app.get('/url/:url', function(req, res){
    var short_url = req.params.url;
    var original_url;
    Url.findOne({"short_url": short_url}, function(err, url){
        if (url) {
            original_url = url.original_url;
            res.redirect(301, original_url);
        } else {
            res.redirect(301, '/url/');
        }
    });
});

// Image search
app.get('/search/', function(req, res){
    res.type('text/plain');
    res.send('Use `/search/image/funny cats` to create a new url\n' +
             'and `/search/latest/` to list latest searches.');
});

app.get('/search/image/:terms', function(req, res){
    res.type('application/json');
    var offset = parseInt(req.query.offset);
    offset = offset > 1 ? offset : 1;
    var query = encodeURIComponent("'" + req.params.terms + "'");
    var acctKey = process.env.BING_AUTH_KEY;
    var auth = Buffer(acctKey + ':' + acctKey).toString('base64');
    var rootUri = 'https://api.datamarket.azure.com/Bing/Search/Image';
    var requestUri = rootUri + '?$format=json&Query=' + query + '&$skip=' + 50*offset;
    var options = {
        url: requestUri,
        headers: {"Authorization": "Basic " + auth}
    };
    // Save query term to database
    Search({'term': query, 'date': new Date()}).save();
    // Callback function to display result
    function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
            var list = [], obj;
            var result = JSON.parse(body).d.results;
            result.forEach(function(r){
                obj = {
                    "url": r.MediaUrl,
                    "snippet": r.Title,
                    "thumbnail": r.Thumbnail.MediaUrl,
                    "context": r.SourceUrl
                };
                list.push(obj);
            });
            res.send(JSON.stringify(list));
        } else {
            res.send('{"error": "Bing server error!"}');
        }
    }
    request.post(options, callback);
});

app.get('/search/latest/', function(req, res){
    res.type('application/json');
    var limit = parseInt(req.query.limit);
    limit = limit < 100 ? limit : 10;
    Search.find({}).sort('-date').limit(limit).exec(function(err, searches){
        var result = [];
        searches.forEach(function(s) {
            result.push({'term': s.term, 'when': s.date});
        });
        res.send(JSON.stringify(result));
    });
});

// File Metadata Microservice
app.get('/file/', function(req, res){
    res.type('text/plain');
    res.send('Send a POST request to `/file/upload/` to analyze file.');
});

app.post('/file/upload/', upload.single('file'), function (req, res, next){
    res.type('application/json');
    var result = {
        "name": req.file.originalname,
        "filesize": req.file.size
    };
    res.send(JSON.stringify(result));
});

// custom 404 page
app.use(function(req, res, next){
    res.type('text/plain');
    res.status(404);
    res.send('404 - Not Found');
});

// custom 500 page
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
});

var server = app.listen(app.get('port'), function(){
    console.log( 'Express started on http://localhost:' +
    app.get('port') + '; press Ctrl-C to terminate.' );
});

module.exports = server;
