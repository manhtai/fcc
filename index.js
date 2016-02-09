var express = require('express');
var strf = require('strftime');
var app = express();
app.set('port', process.env.PORT || 3000);

// TimeStamp Microservice
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
