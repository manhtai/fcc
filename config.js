module.exports = {
    secret: {
        production: process.env.SECRET_KEY,
        development: "you_guess_it",
        test: "you_guess_it"
    },
    db: {
        production: process.env.MONGOLAB_URI,
        development: "mongodb://localhost:27017/dev",
        test: "mongodb://localhost:27017/test"
    }
};
