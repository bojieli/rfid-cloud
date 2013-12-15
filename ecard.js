var url = require('url');
var sys = require('util');
var http = require('http');
var querystring = require('querystring');
var mysql = require('./db.js');
var config = require('./config.js');
var smsapi = require('./sms.js');
var db = {};

var dbproto = {};
dbproto.myquery = function(query, values, callback) {
    if (typeof values === "function") {
        callback = values;
        values = [];
    }
    db.query(query, values, function(err, data) {
        if (err)
            err.query = query;
        callback(err, data);
    });
}
dbproto.find = function(query, values, cont, err_handler) {
try {
    if (typeof values === "function") {
        err_handler = cont;
        cont = values;
        values = [];
    }
    db.myquery(query, values, function(err, results) {
    try {
        if (err) {
            if (typeof err_handler === "function")
                err_handler(err);
            else
                throw err;
            return;
        }
        if (results.length > 0)
            cont(results[0]);
        else
            cont();
    } catch(e) {
        console.log(e);
    }
    });
} catch(e) {
    console.log(e);
}
}
dbproto.result = function(query, values, cont, err_handler) {
try {
    if (typeof values === "function") {
        err_handler = cont;
        cont = values;
        values = [];
    }
    db.find(query, values, function(result) {
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
    smsapi.send(mobiles, msg + config.sms_suffix);
}
function send_admin_mobile(msg) {
    console.log("Admin SMS: " + msg);
    send_mobile(config.admin_mobiles, msg);
}

function getStudentIdForMulandianzi(cardID) {
    var station = parseInt(cardID.slice(0,2).toLowercase(), 16);
    var raw = cardID.slice(2).toLowerCase();
    var tmp1 = parseInt(raw.slice(0,2), 16);
    var tmp2 = parseInt(raw.charAt(7), 16);
    switch (station) {
        case 2:
            tmp1 += (1<<7); break;
        case 10:
            break;
        default:
            console.log("Mulandianzi cardID " + cardID + " has station " + station + ", should be 2 or 10"); break;
    }
    tmp1 = tmp1 ^ 89;
    tmp2 = tmp2 ^ 6;
    return (tmp2 << 8) + tmp1;
}

function getInfoFromCardID(schoolID, cardID, cont) {
    // special case for mulandianzi
    if (schoolID == 2) {
        cont({
            id: getStudentIdForMulandianzi(cardID),
            report_mobile: '',
            name: '',
        });
    } else { // normal case
        db.find("SELECT student.id, student.report_mobile, student.name FROM student, card WHERE card.student=student.id AND student.school=? AND card.id=? AND card.isactive=TRUE AND student.isactive=TRUE",
            [schoolID, cardID],
            cont);
    }
}

var handle = {};
handle.notify = function(schoolID, schoolName, data, response) {
try {
    response.returned = false;
    function invalid_msg(msg) {
        console.log('Received invalid message from [' + schoolName + ']: ' + msg);
        if (!response.returned) {
            response.returnCode(400);
            response.returned = true;
        }
        push_api({
            type: "error",
            error: "invalid_msg",
            school: {id: schoolID, name: schoolName},
            data: data,
        });
    }
    function notify_student(cardID, schoolID, schoolName, student, action) {
    try {
        if (typeof student !== "object" || typeof student.report_mobile === "undefined") {
            log_error(schoolID, "CardID does not exist: " + cardID + " from " + schoolName);
            push_api({
                type: "error",
                error: "card_not_exist",
                school: {id: schoolID, name: schoolName},
                card: cardID,
                action: action,
            });
            return true;
        }
        db.query("INSERT INTO gate_log (card,student,time,school,action) VALUES (?,?,NOW(),?,?)",
            [cardID, student.id, schoolID, action]);
        db.query("UPDATE student SET is_in_school=" + (action == '1' ? 0 : 1) + ", last_activity=NOW() WHERE id=?", [student.id]);
        push_api({
            type: "notify",
            card: cardID,
            action: action,
            school: {id: schoolID, name: schoolName},
            student: student,
        });
        if (typeof student.report_mobile !== "string" || student.report_mobile.length == 0) // no mobile to be reported
            return true;
        student.report_mobile = student.report_mobile.split(",");
        send_mobile(student.report_mobile, "您的孩子" + student.name + "已" + (action == '1' ? '走出' : '进入') + schoolName + "校门");
        return true;
    } catch(e) {
        console.log(e);
        return false;
    }
    }
    var pending_callbacks = 0;
    var transactions = data.split('.');
    for (i in transactions) {
        if (transactions[i].length == 0)
            continue;
        if (config.card_id_check && transactions[i].length != config.card_id_size * 2 + 1) {
            invalid_msg(transactions[i]);
            continue;
        }
        var cardID = transactions[i].substr(0, transactions[i].length - 1);
        var action = transactions[i].substr(transactions[i].length - 1, 1);
        if (action != '0' && action != '1') {
            invalid_msg(transactions[i]);
            continue;
        }

        ++pending_callbacks;
        (function(schoolID, cardID, action) {
            getInfoFromCardID(schoolID, cardID, function(student) {
            try {
                if (!notify_student(cardID, schoolID, schoolName, student, action)) {
                    response.returnCode(500);
                    response.returned = true;
                }

                --pending_callbacks;
                if (pending_callbacks == 0 && !response.returned)
                    response.returnOK();
                else if (pending_callbacks < 0)
                    throw "Pending callback count less than zero: " + pending_callbacks;
            } catch(e) {
                console.log(e);
            }
            });
        })(schoolID, cardID, action);
    }
} catch(e) {
    console.log(e);
}
}

function reportitnow(schoolID, schoolName, msg) {
try {
    handle.reportitnow(schoolID, schoolName, msg, null, true);
} catch(e) {
    console.log(e);
}
}

var dead_schools = {};
var heartbeats = {};
function check_heartbeat() {
try {
    var now = Math.round(+new Date()/1000);
    for (id in heartbeats) {
        if (typeof dead_schools[id] === "undefined"
            && now - heartbeats[id] > config.heartbeat_timeout) {
            dead_schools[id] = true;
            db.find("SELECT name FROM school WHERE id=" + db.escape(id),
            function(result) {
                if (typeof result.name === "undefined")
                    return;
                reportitnow(id, result.name,
                    "考勤机有 " + (now - heartbeats[id]) + " 秒没发心跳包了，请检查");
                db.query("UPDATE school SET merger_ok = 0 WHERE id=" + db.escape(id));

                push_api({
                    type: "alert",
                    action: "lost_heartbeat",
                    school: {id: id, name: result.name},
                    source: "cloud",
                    curr_time: now,
                    last_time: heartbeats[id],
                });
            });
        }
    }
} catch(e) {
    console.log(e);
}
}
function init_watchdog() {
    setInterval(check_heartbeat, config.heartbeat_timeout);
}

handle.heartbeat = function(schoolID, schoolName, data, response) {
    var now = Math.round(+new Date()/1000);
    if (typeof heartbeats[schoolID] === "undefined")
        heartbeats[schoolID] = now;
    else if (now - heartbeats[schoolID] > config.heartbeat_timeout) {
        reportitnow(schoolID, schoolName,
            "考勤机已恢复，曾经 " + (now - heartbeats[schoolID]) + " 秒未发心跳包");
        db.query("UPDATE school SET merger_ok = 1 WHERE id=" + db.escape(schoolID));
        push_api({
            type: "alert",
            action: "resume_heartbeat",
            school: {id: schoolID, name: schoolName},
            source: "cloud",
            curr_time: now,
            last_time: heartbeats[schoolID],
        });
    }
    dead_schools[schoolID] = undefined;
    heartbeats[schoolID] = now;
    response.returnOK();
}

function log_error(school, msg, cont, important) {
    db.query("INSERT INTO error_log (school,time,msg,important) VALUES (?,NOW(),?,?)",
        [school, msg, (important ? 1 : 0)], cont);
}

// This function is async and does not guarantee delivery
function http_post(options, content) {
try {
    if (typeof content !== "string")
        throw "HTTP POST data should be string";
    var obj = {'data': content};
    if (typeof options.token === "string" && options.token.length > 0)
        obj.token = options.token;

    var data = querystring.stringify(obj);

    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    var post_req = http.request(options);
    post_req.on('error', function(e) { console.log('HTTP push API error: ' + e) });
    post_req.write(data);
    post_req.end();
} catch(e) {
    console.log(e);
}
}

// HTTP POST to all URLs registered for push API
function push_api(obj) {
    db.query("SELECT host, port, path, token FROM push_api", function(err, result) {
    try {
        if (err)
            throw err;
        for (i in result)
            http_post(result[i], JSON.stringify(obj));
    } catch(e) {
        console.log(e);
    }
    });
}

handle.reportitnow = function(schoolID, schoolName, data, response, isInternal) {
try {
    // if it is text message merger, parse the message.
    if (!isInternal) {
        var obj = {
            type: "alert",
            action: "report",
            school: {id: schoolID, name: schoolName},
            msg: data,
        };
        if (data.indexOf("allocate") >= 0) {
            obj.daemon = "merger";
            obj.source = "master";
            obj.action = "alloc_fail";
        } else if (data.indexOf("connected") >= 0
            || data.indexOf("exit") >= 0
            || data.indexOf("watchdog") >= 0 && data.indexOf("dead") >= 0)
        {
            obj.daemon = "receiver";
            if (data.indexOf("master") >= 0)
                obj.source = "master";
            else if (data.indexOf("slave") >= 0)
                obj.source = "slave";
            else
                obj.source = "unknown";

            if (data.indexOf("connected") >= 0)
                obj.action = "connected";
            else if (data.indexOf("exit") >= 0)
                obj.action = "disconnected";
            else if (data.indexOf("dead") >= 0)
                obj.action = "dead";
            else
                obj.action = "unknown";

            if (obj.source == "master" || obj.source == "slave")
                db.query("UPDATE school SET " + obj.source + "_ok = " + (obj.action == "connected" ? 1 : 0)
                    + " WHERE id=" + schoolID);
        } else if (data.indexOf("watchdog") >= 0) {
            obj.daemon = "merger";
            obj.source = "master";
        } else {
            obj.source = "unknown";
        }

        push_api(obj);
    }

    db.query("UPDATE school SET error_counter = error_counter+1 WHERE id=?", [schoolID]);
    log_error(schoolID, data,
        function(err) {
        try {
            if (response != null) {
                if (err)
                    response.except(err);
                else
                    response.returnOK();
            }
            db.query("SELECT COUNT(*) as cnt FROM error_log WHERE school=? AND time > DATE_SUB(NOW(), INTERVAL 1 DAY) AND important=1",
                [schoolID],
                function(err, result) {
                try {
                    if (err)
                        throw err;
                    if (typeof result[0].cnt !== "undefined" && result[0].cnt <= config.max_reports_per_day)
                        send_admin_mobile("[" + schoolName + "]报告: " + data);
                    else
                        console.log("reportitnow: reports for " + schoolName + " exceed " + config.max_reports_per_day + ", not sending SMS");
                } catch (e) {
                    console.log(e);
                }
            });
        } catch(e) {
            console.log(e);
        }
        }, // end function
    true); // important
} catch(e) {
    console.log(e);
}
}

handle.add_card = function(schoolID, schoolName, data, response) {
try {
    var obj = JSON.parse(data);
    if (obj.token !== config.add_student_api_token) {
        reportitnow(schoolID, schoolName, "invalid add_student token");
        response.returnCode(403);
        return;
    }
    if (typeof obj.student_id !== "string" || typeof obj.card_id !== "string") {
        response.returnCode(400, "invalid format");
        return;
    }
    if (config.card_id_check && obj.card_id.length != config.card_id_size * 2) {
        response.returnCode(400, "wrong card id size, " + config.card_id_size*2 + " expected, "
            + obj.card_id.length + " given");
        return;
    }
    db.find("SELECT id FROM student WHERE school=? AND student_id=?",
        [schoolID, obj.student_id],
        function(res) {
        try {
            if (typeof res !== "object" || typeof res.id !== "number") {
                response.returnCode(404, "student ID not found in your school");
                return;
            }
            db.query("REPLACE INTO card (id, student, register_time, isactive) VALUES (?,?,NOW(),1)",
                [obj.card_id, res.id]);
            response.returnOK();

            push_api({
                "action": "add_card",
                "card_id": obj.card_id,
                "school": { id: schoolID, name: schoolName },
                "student": { id: res.id, student_id: obj.student_id },
            });
        } catch(e) {
            console.log(e);
        }
        }
    );
} catch(e) {
    console.log(e);
}
}

handle.reportip = function(schoolID, schoolName, data, response) {
try {
    var obj = JSON.parse(data);
    db.query("REPLACE INTO dynamic_ip (school, hostname, eth0, tun0, last_report) VALUES (?,?,?,?,NOW())",
        [schoolID, obj.hostname, obj.eth0, obj.tun0]);
    response.returnOK();
    push_api({
        "action": "report_ip",
        "school": { id: schoolID, name: schoolName },
        "hostname": obj.hostname,
        "interfaces": { eth0: obj.eth0, tun0: obj.tun0 },
    });
} catch(e) {
    console.log(e);
}
}

function generic_queryip(schoolID, schoolName, hostname, field, response) {
try {
    db.find("SELECT " + field + " FROM dynamic_ip WHERE school=? AND hostname=?",
        [schoolID, hostname],
        function(res) {
        try {
            if (typeof res !== "object") {
                response.returnCode(404, "not found");
                return;
            }
            response.returnCode(200, res[field]);
        } catch(e) {
            console.log(e);
        }
        }
    );
} catch(e) {
    console.log(e);
}
}

handle.queryip = function(schoolID, schoolName, data, response) {
    generic_queryip(schoolID, schoolName, data, "eth0", response);
}

handle.queryvpnip = function(schoolID, schoolName, data, response) {
    generic_queryip(schoolID, schoolName, data, "tun0", response);
}

handle.queryip_lastreport = function(schoolID, schoolName, data, response) {
    generic_queryip(schoolID, schoolName, data, "last_report", response);
}

function route(pathname, headers, data, response) {
try {
    pathname = pathname.replace('/', '');
    if (typeof handle[pathname] == "function") {
        var POST = querystring.parse(data);
        if (typeof POST.data !== "string")
            throw "This request contains no data, ignoring";
        if (typeof POST.token !== "string" || POST.token.length == 0)
            throw "School access token not given";
        db.find("SELECT id, name FROM school WHERE access_token=" + db.escape(POST.token),
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
    response.on("error", function(e) { console.log('HTTP response error: ' + e) });
    response.returnCode = function(code, msg) {
        if (msg !== null && typeof msg === "object")
            msg = msg.toString();
        if (typeof msg !== "string")
            msg = "";
        console.log("Response: HTTP " + code + " (" + msg.length + " bytes)");
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
        if (pathname == "/ping") {
            response.returnCode(200, "pong");
            return;
        }
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
        console.log("Listening on " + config.listen_host + ":" + config.listen_port);
        init_watchdog();
    } catch(e) {
        console.log("Failed to create HTTP server on port " + config.listen_port);
    }
});
