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
    default:
        mongoose.connect("mongodb://localhost:27017/test", opts);
}

var urlSchema = mongoose.Schema({
    original_url: String,
    short_url: String
});

var Url = mongoose.model('Url', urlSchema);

module.exports = Url;
