var config = require('./config');
var express = require('express');
var strf = require('strftime');
var parser = require('ua-parser-js');
var validUrl = require('valid-url');
var randomstring = require('randomstring');
var Url = require('./mongo').Url;
var Search = require('./mongo').Search;
var User = require('./mongo').User;
var Poll = require('./mongo').Poll;
var Item = require('./mongo').Item;
var Vote = require('./mongo').Vote;
var request = require('request');
var multer  = require('multer');
var upload = multer();
var validator = require('validator');
var cookie = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var ensureLogin = require('connect-ensure-login').ensureLoggedIn();
var Strategy = require('passport-local').Strategy;
var log = require('morgan')('combined');

var session_opts = {
    secret: config.secret[process.env.NODE_ENV],
    resave: false,
    saveUninitialized: false
};
var session = require('express-session')(session_opts);

var app = express();

// Passport setting
passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
    User.findOne({_id: id}, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});

passport.use(new Strategy(
    function(username, password, cb) {
        User.findOne({username: username}, function(err, user) {
            if (err) { return cb(err); }
            if (!user) { return cb(null, false); }
            User.comparePasswordAndHash(password,
                                        user.password,
                                        function(err, valid) {
                if (err) { return cb(err); }
                if (!valid) {
                    return cb(null, false, { message: 'Invalid password.' });
                }
                return cb(err, user);
            });
        });
}));


// View engine
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Middlewares
app.use(log);
app.use(cookie());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session);

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

// Set port
app.set('port', process.env.PORT || 3000);

// Homepage
app.get('/', function(req, res){
    res.render('home', { user: req.user });
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


// User model
app.get('/signup', function(req, res) {
    if (req.user) res.redirect('/');
    else res.render('signup');
});

app.post('/signup', function(req, res){
    if (req.body.username && validator.isAlphanumeric(req.body.username)) {
        User.hashPassword(req.body.password, function (err, passwordHash) {
            if (err) res.redirect('/signup');
            // We only allow username and password when creating account
            var newUser = {
                username: req.body.username,
                password: passwordHash
            };
            // Create new user
            User.count({username: newUser.username}, function(err, count) {
                if (err || count) res.redirect('/signup');
                else User.create(newUser, function (err, user) {
                        if (!err) {
                            // Log in immediatetly
                            req.logIn(user, function (err) {
                                if (err) res.redirect('/signup');
                                else return res.redirect('/account');
                            });
                        }
                        else res.redirect('/signup');
                    });
            });
        });
    }
    else res.redirect('/signup');
});

app.get('/login', function(req, res) {
    if (req.user) res.redirect('/');
    else res.render('login');
});

app.post('/login',
    passport.authenticate('local', { successRedirect: '/',
                                     failureRedirect: '/login'})
);

app.get('/account', ensureLogin, function(req, res){
    res.render('account', { user: req.user });
});

app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

// Polls app
// All polls
app.get('/poll', function (req, res) {
    Poll.find(function (err, polls) {
        res.render('polls', { polls: polls, user: req.user });
    });
});

// Create poll
app.get('/poll/new', ensureLogin, function (req, res) {
    res.render('newpoll', { user: req.user });
});

app.post('/poll/new', ensureLogin, function (req, res) {
    var newPoll = {
        title: req.body.title,
        user: req.user.username
    };
    Poll.create(newPoll, function (err, poll) {
        if (err) res.render('newpoll', {user: req.user});
        else res.redirect('/poll/' + poll.id);
    });
});

// List of my polls
app.get('/poll/:username', function (req, res) {
    User.findOne({username: req.params.username}, function (err, user) {
        if (err || !user) res.redirect('/poll');
        else Poll.find({"user": user.username}, function (err, polls) {
            if (err || !polls) res.redirect('/poll');
            else res.render('mypolls', { polls: polls, user: user });
        });
    });
});

// A poll
app.get('/poll/:username/:id', function (req, res) {
    var username = req.params.username;
    var owner = req.user && username == req.user.username;
    User.findOne({username: username}, function (err, user) {
        if (err || !user) res.redirect('/poll');
        else Poll.findOne({_id: req.params.id}, function (err, poll) {
            if (err || !poll) res.redirect('/poll/' + user.username);
            else Item.find({poll : poll.id},
                            function (err, items) {
                res.render('poll',
                            { poll: poll, items: items, owner: owner, user: req.user });
            });
        });
    });
});

// Edit poll
app.get('/poll/:username/:id/edit', ensureLogin, function (req, res) {
    var username = req.params.username;
    if (username != req.params.username) res.redirect('/poll/' + username);
    else Poll.findOne({_id: req.params.id},
                      function (err, poll) {
                        if (err || !poll)
                            res.redirect('/poll/' + username);
                        else Item.find({poll : poll.id},
                                        function (err, items) {
                            res.render('editpoll',
                                       { poll: poll, items: items, user: req.user });
                        });
    });
});

app.post('/poll/:username/:id/edit', ensureLogin, function (req, res) {
    var username = req.params.username;
    if (username != req.params.username) res.redirect('/poll/' + username);
    else Poll.findOne({_id: req.params.id},
                      function (err, poll) {
                        if (err || !poll)
                            res.redirect('/poll/' + username);
                        else {
                            poll.title = req.body.title;
                            poll.save();
                            Item.find({poll : poll.id},
                                      function (err, items) {
                                          items.forEach(function (item) {
                                              item.title = req.body[item.id] ?
                                                  req.body[item.id]
                                                  : item.title;
                                              item.save();
                                          });
                                      });
                            res.redirect('/poll/' + username + '/' + poll.id);
                        }
    });
});

// Add new poll item
app.get('/poll/:username/:id/add', ensureLogin, function (req, res) {
    var username = req.params.username;
    if (username != req.user.username) res.redirect('/poll/' + username);
    else Poll.findOne({_id: req.params.id},
                      function (err, poll) {
                            if (err || !poll)
                                res.redirect('/poll/' + username);
                            else res.render('newitem', { poll: poll, user: req.user });
                      });
});

app.post('/poll/:username/:id/add', ensureLogin, function (req, res) {
    var username = req.params.username;
    if (username != req.user.username) res.redirect('/poll/' + username);
    else Poll.findOne({_id: req.params.id}, function (err, poll) {
        if (err || !poll)
            res.redirect('/poll/' + username);
        else Item.create({
                title: req.body.title,
                poll: poll.id,
                user: username
            }, function (err, item) {
                if (!err) {
                    if (poll.items) poll.items.push(item);
                    else poll.items = [item];
                    poll.save();
                }
                res.redirect('/poll/' + username + '/' + poll.id);
            });
    });
});

// Vote item
app.post('/item/:id/vote', function (req, res) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var unique = req.user && req.user.username || ip;
    Item.findOne({_id: req.params.id}, function (err, item) {
        if (err || !item)
            res.redirect('/poll/');
        else {
            var username = item.user;
            // 1 poll only can be voted by 1 unique
            Vote.count({unique: unique, poll: item.poll},
                       function (err, count) {
                if (!err && !count)
                    Vote.create({unique: unique, poll: item.poll, item: item.id},
                                function (err, vote) {
                                    if (vote) {
                                        item.vote += 1;
                                        item.save();
                                    }
                });
                res.redirect('/poll/' + username + '/' + item.poll);
            });
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
    console.log('Express started on http://localhost:' + app.get('port'));
});

module.exports = server;
