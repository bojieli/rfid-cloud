var url = require('url');
var http = require('http');
var querystring = require('querystring');

var goin = {}, goout = {};
var timeout = 10;
var timer_goin = false, timer_goout = false;
var in_startup = true;

function currtime() {
    return Math.round(+new Date()/1000);
}

function http_post(options, content) {
try {
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': content.length,
    };
    var post_req = http.request(options);
    post_req.on('error', function(e) { console.log('HTTP push API error: ' + e) });
    post_req.write(content);
    post_req.end();
} catch(e) {
    console.log(e);
}
}

function test_push_api(obj) {
    console.log(obj);
    var options = {
        'host': 'shi6.com',
        'port': 5678,
        'path': '/test-notify',
    };
    http_post(options, querystring.stringify(obj));
}

function check_timer(last_receive, action, flag) {
    var now = currtime();
    var received = 0, not_received = 0;
    for (id in last_receive) {
        if (now - last_receive[id] <= timeout)
            received++;
        else
            not_received++;
    }
    if (!flag && in_startup) // first timeout
        in_startup = false;
    if (!flag && not_received > 0)
        test_push_api({
            type: "error",
            msg: timeout+"秒超时内没有收集全" + action + "事件",
            received_num: received,
            not_received_num: not_received,
            time: now,
        });
    if (!in_startup && flag && not_received == 0) { // before first timeout, do not report
        test_push_api({
            type: "ok",
            msg: "收集全了" + action + "事件",
            received_num: received,
            not_received_num: not_received,
            time: now,
        });
        for (id in last_receive)
            last_receive[id] = undefined;
    }
}

function check_goin(flag) {
    check_timer(goin, "in", flag);
    if (!flag)
        timer_goin = false;
}
function check_goout(flag) {
    check_timer(goout, "out", flag);
    if (!flag)
        timer_goout = false;
}

function handle(obj) {
    if (typeof obj.card !== "string")
        return;
    if (obj.action == 1) {
        goout[obj.card] = currtime();
        check_goout(true);
        if (!timer_goout) {
            setTimeout(check_goout, timeout * 1000);
            timer_goout = true;
        }
    }
    else {
        goin[obj.card] = currtime();
        check_goin(true);
        if (!timer_goin) {
            setTimeout(check_goin, timeout * 1000);
            timer_goin = true;
        }
    }
}
function route(pathname, headers, data, response) {
    var obj = querystring.parse(data);
    handle(obj);
    response.returnOK(); 
}

function http_server(request, response) {
    response.on("error", function(e) { console.log('HTTP response error: ' + e) });
    response.returnCode = function(code, msg) {
        msg = (typeof msg === "string" ? msg : "");
        this.writeHeader(code, {'Content-Length': msg.length });
        this.write(msg);
        this.end();
    }
    response.except = function(e) {
        var message = (typeof e.message === "string") ? e.message : e.toString();

        if (typeof e.stack === "string")
            console.log(e.stack);
        else
            console.log(message);

        this.returnCode(400, message);
    }
    response.returnOK = function() {
        this.returnCode(200, "OK");
    }
    try {
        var pathname = url.parse(request.url).pathname;
        if (request.method == "POST") {
            var data = "";
            request.on("data", function(chunk) {
                data += chunk;
            });
            request.on("end", function() {
                route(pathname, request.headers, data, response);
            });
            request.on("error", function(e) {
                response.except(e);
            });
        }
        else throw "All requests must be POSTed";
    } catch(e) {
        response.except(e);
    }
}

http.createServer(http_server).listen(50000, 'localhost');
console.log('listening...');
