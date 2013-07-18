var url = require('url');
var sys = require('util');
var http = require('http');
var mysql = require('./db.js');
var config = require('./config.js');
var smsapi = require('./sms.js');
var db = {};

var dbproto = {};
dbproto.myquery = function(query, values, callback) {
    if (typeof values == "function") {
        callback = values;
        values = [];
    }
    db.query(query, values, function(err, data) {
        if (err)
            err.query = query;
        callback(err, data);
    });
}
dbproto.find = function(query, cont, err_handler) {
try {
    db.myquery(query, function(err, results) {
        if (err)
            err_handler(err);
        if (results.length > 0)
            cont(results[0]);
        else
            cont();
    });
} catch(e) {
    console.log(e);
}
}
dbproto.result = function(query, cont, err_handler) {
try {
    db.find(query, function(result) {
        for (col in result) {
            cont(result[col]);
            return; // only the first column
        }
        cont(); // fallback
    }, err_handler);
} catch(e) {
    console.log(e);
}
}

function isInt(str) {
    return (typeof str === "number") && str % 1 == 0
        || (typeof str === "string") && RegExp(/^\d+$/g).test(str);
}

function test_and_query(test, query, cont) {
    db.result(test, function(result) {
        if (result) {
            try {
                db.myquery(query, cont);
            } catch(e) {
                console.log(e);
            }
        } else {
            cont({msg: 'Test Failed', query: test});
        }
    }, cont);
}

function toArray(obj) {
    var arr = [];
    for (prop in obj)
        if (typeof obj[prop] !== 'function')
            arr.push(obj[prop]);
    return arr;
}

function send_mobile(mobiles, msg) {
    db.query("INSERT INTO sms_log (time,mobile,msg) VALUES (NOW(),?,?)",
            [mobiles.join(','), msg]);
    smsapi.send(mobiles, msg);
}
function send_admin_mobile(msg) {
    send_mobile(config.admin_mobiles, msg);
}

function getInfoFromCardID(schoolID, cardID, cont) {
    db.find("SELECT student.id, student.report_mobile, student.name FROM student, card WHERE card.student=student.id AND student.school=? AND card.id=? AND card.isactive=TRUE AND student.isactive=TRUE",
            [schoolID, cardID],
            cont);
}

var handle = {};
handle.notify = function(schoolID, schoolName, data, response) {
    function invalid_msg(msg) {
        console.log('Received invalid message from [' + schoolName + ']: ' + msg);
    }
    var transactions = data.split('.');
    for (i in transactions) {
        if (transactions[i].length != config.card_id_size + 1) {
            invalid_msg(transactions[i]);
            continue;
        }
        var cardID = transactions[i].substr(0, config.card_id_size);
        var action = transactions[i].substr(config.card_id_size, 1);
        if (action != '0' && action != '1') {
            invalid_msg(trainsactions[i]);
            continue;
        }
        getInfoFromCardID(schoolID, cardID, function(student) {
            if (typeof student !== "object" || typeof student.report_mobile === "undefined") {
                log_error(schoolID, "student does not exist: " + cardID + " from " + schoolName);
                continue;
            }
            if (typeof student.report_mobile !== "object")
                student.report_mobile = [student.report_mobile];
            db.query("INSERT INTO gate_log (card,student,time,school,action) VALUES (?,?,NOW(),?,?)",
                [cardID, student.id, schoolID, action]);
            send_mobile(student.report_mobile, "您的孩子" + student.name + "已" + (action == '1' ? '走出' : '进入') + schoolName + "校门" + config.message_affix);
        });
    }
}

var dead_schools = {};
var heartbeats = {};
function check_heartbeat() {
    var now = Date().getTime();
    for (id in heartbeats) {
        if (typeof dead_schools[id] === "undefined"
            && now - heartbeats[id] > config.heartbeat_timeout * 1000) {
            dead_schools[id] = true;
            db.find("SELECT name FROM school WHERE id=" + db.escape(id),
                function(result) {
                    if (typeof result.name === "undefined")
                        return;
                    handle.reportitnow(id, result.name,
                        "考勤机有 " + parseInt((now - heartbeats[id])/1000) + " 秒没发心跳包了，请检查");
            });
        }
    }
}
function init_watchdog() {
    setInterval(check_heartbeat, config.heartbeat_timeout * 1000);
}

handle.heartbeat = function(schoolID, schoolName, data, response) {
    var now = Date().getTime();
    if (typeof heartbeats[id] === "undefined")
        heartbeats[id] = now;
    else if (now - heartbeats[id] > config.heartbeat_timeout * 1000) {
        handle.reportitnow(schoolID, schoolName,
            "考勤机已恢复，曾经 " + parseInt((now - heartbeats[id])/1000) + " 秒未发心跳包");
        heartbeats[id] = now;
    }
    dead_schools[id] = undefined;
    response.returnOK();
}

function log_error(school, msg, cont) {
    db.query("INSERT INTO error_log (school,time,msg) VALUES (?,NOW(),?)",
        [school, msg], cont);
}

handle.reportitnow = function(schoolID, schoolName, data, response) {
    log_error(schoolID, data,
        function(err) {
        try {
            if (typeof response === "object") {
                if (err)
                    response.except(err);
                else
                    response.returnOK();
            }
            db.query("SELECT COUNT(*) as cnt FROM error_log WHERE school=? AND time > DATESUB(NOW(), INTERAL 1 DAY)",
                [school],
                function(err, result) {
                    if (typeof result[0].cnt !== "undefined" && result[0].cnt <= config.max_reports_per_day)
                        send_admin_mobile("[" + schoolName + "]报告: " + data);
            });
        } catch(e) {
            console.log(e);
        }
    });
}

function route(pathname, headers, data, response) {
try {
    pathname = pathname.replace('/', '');
    if (typeof handle[pathname] == "function") {
        var POST = querystring.parse(data);
        if (POST.access_token.length == 0)
            throw "station-id or station-token not given";
        db.find("SELECT id, name FROM school WHERE access_token=" + db.escape(token),
            function(result) {
            try {
                if (typeof result == "undefined")
                    throw "School not found: Invalid access token";
                if (!isInt(result.id))
                    throw "Internal Data Error";
                handle[pathname](result.id, result.name, POST.data, response);
            } catch(e) {
                response.except(e);
            }
        });
    }
    else throw "Illegal action";
} catch(e) {
    response.except(e);
}
}

function http_server(request, response) {
    response.except = function(e) {
        var message = (typeof e.message === "string") ? e.message : e.toString();

        if (typeof e.stack === "string")
            console.log(e.stack);
        else
            console.log(message);

        this.writeHeader(400);
        this.write(message);
        this.end();
    }
    response.returnOK = function() {
        console.log("200 OK");
        this.writeHeader(200);
        this.write("OK");
        this.end();
    }
    response.return200 = function(str) {
        console.log("200 (length " + str.length + ")");
        this.writeHeader(200);
        this.write(str);
        this.end();
    }
    try {
        var pathname = url.parse(request.url).pathname;
        if (request.method == "POST") {
            var data = "";
            request.on("data", function(chunk) {
                data += chunk;
            });
            request.on("end", function() {
                console.log(pathname);
                console.log(data);
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

function handle_disconnect(connection) {
    // db is global var to hold connection
    db = connection;
    for (f in dbproto)
        db[f] = dbproto[f];
    function err_handler(err) {
        if (!err.fatal)
            return;
        if (err.code !== 'PROTOCOL_CONNECTION_LOST')
            throw err;
        console.log('Re-connecting lost connection: ' + err.stack);
  
        connection = mysql.createConnection(connection.config);
        handle_disconnect(connection);
        connection.connect();
    }
    connection.on('error', err_handler);
    connection.on('end', err_handler);
}

mysql.pool.getConnection(function(err, conn) {
    if (err)
        throw err;
    handle_disconnect(conn);
    try {
        http.createServer(http_server).listen(config.listen_port, config.listen_host);
        init_watchdog();
    } catch(e) {
        console.log("Failed to create HTTP server on port " + config.listen_port);
    }
});