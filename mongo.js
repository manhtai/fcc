var mongoose = require('mongoose');

// Setting up MongoDB
var opts = {
    server: {
        socketOptions: { keepAlive: 1 }
    }
};

switch(process.env.NODE_ENV){
    case 'production':
        mongoose.connect(process.env.MONGOLAB_URI, opts);
        break;
    case 'development':
        mongoose.connect("mongodb://localhost:27017/test", opts);
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

module.exports = {Url: Url, Search: Search};
