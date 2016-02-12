var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var _ = require('underscore');
var config = require('./config');

// Setting up MongoDB
var opts = {
    server: {
        socketOptions: { keepAlive: 1 }
    }
};

switch(process.env.NODE_ENV){
    case 'production':
        mongoose.connect(config.db.production, opts);
        break;
    case 'development':
        mongoose.connect(config.db.development, opts);
        break;
    case 'test':
        mongoose.connect(config.db.test, opts);
        break;
}

// Url shortener model
var urlSchema = mongoose.Schema({
    original_url: String,
    short_url: String
});

var Url = mongoose.model('Url', urlSchema);

// Image search model
var searchSchema = mongoose.Schema({
    term: String,
    date: Date
});

var Search = mongoose.model('Search', searchSchema);

// User model
var userSchema = mongoose.Schema({
    username: { type: String, index: { unique: true }},
    password: String
});

// Hashpass using Bcrypt
var BCRYPT_COST = 12;
userSchema.statics.hashPassword = function (passwordRaw, fn) {
    if (process.env.NODE_ENV === 'test') {
        BCRYPT_COST = 1;
    }
    bcrypt.hash(passwordRaw, BCRYPT_COST, fn);
};

// Compare password
userSchema.statics.comparePasswordAndHash = function (password, passwordHash, fn) {
    bcrypt.compare(password, passwordHash, fn);
};

// New user
userSchema.statics.addUser = function (user, fn) {
    var self = this;
    this.hashPassword(user.password, function (err, hashedPassword) {
        var newUser = _.clone(user);
        newUser.password = hashedPassword;
        (new self(newUser)).save(fn);
    });
};

var User = mongoose.model('User', userSchema);

// Polls
var itemSchema = mongoose.Schema({
    title: String,
    vote: { type: Number, default: 0 },
    poll: String,
    user: String
});

var Item = mongoose.model('Item', itemSchema);

var voteSchema = mongoose.Schema({
    poll: String,
    unique: String
});

Vote = mongoose.model('Vote', voteSchema);

var pollSchema = mongoose.Schema({
    title: String,
    user: String,
    items: [itemSchema]
});

var Poll = mongoose.model('Poll', pollSchema);

module.exports = {
    Url: Url,
    Search: Search,
    User: User,
    Item: Item,
    Vote: Vote,
    Poll: Poll
};
