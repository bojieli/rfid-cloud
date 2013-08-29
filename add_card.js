var url = require('url');
var http = require('http');
var querystring = require('querystring');

var config = {
    school_token: 'MUp0JBjFn5LNgWPfFNQT',
    api_token: 'FWDnVlLmFvWRutaKSc0EDCk6',
}

function http_post(options, content) {
try {
    var data = querystring.stringify({'token': config.school_token, 'data':content});
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length,
    };
    var post_req = http.request(options, function(res) {
        res.on('data', function(chunk) {
            console.log("" + chunk);
        });
    });

    post_req.on('error', function(e) { console.log('HTTP push API error: ' + e) });
    post_req.write(data);
    post_req.end();
} catch(e) {
    console.log(e);
}
}

function add_card(cardID, studentID) {
    var obj = {
        'token': config.api_token,
        'card_id': cardID,
        'student_id': studentID,
    };
    var options = {
        'host': 'shi6.com',
        'port': 80,
        'path': '/ecard/add_card',
    };
    http_post(options, JSON.stringify(obj));
}

console.log("Input format: one (cardID, studentID) pair per line, separated by space");
console.log("Example: 010101010101010101 PB00000000");

var readline = require('readline');
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.on('line', function(line) {
    var arr = line.split(' ');    
    if (arr.length == 2)
        add_card(arr[0], arr[1]);
    else
        process.stderr.write("input format error\n");
});

