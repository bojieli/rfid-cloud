exports.mysql = new require('mysql');
exports.pool = exports.mysql.createPool({
    host: 'localhost',
    user: 'ecard-www',
    password: '0CIigA0nStYlEGMM',
    database: 'ecard',
});
