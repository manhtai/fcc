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
var emailSchema = mongoose.Schema({
    email: { type: String, index: { unique: true }},
    valid: Boolean
});

var userSchema = mongoose.Schema({
    username: { type: String, index: { unique: true }},
    password: String,
    emails: [emailSchema]
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

module.exports = {Url: Url, Search: Search, User: User};
