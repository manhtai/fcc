var express = require('express');
var strf = require('strftime');
var app = express();
var parser = require('ua-parser-js');
var validUrl = require('valid-url');
var randomstring = require('randomstring');
var Url = require('./mongo');

app.set('port', process.env.PORT || 3000);

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
