var access_token = 'M2La02Jd334Os3Nx';
var post_options = {
    host: 'servmon.lug.ustc.edu.cn',
    port: '80',
    path: '/sms-api.php',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
};

var querystring = require('querystring');
var http = require('http');

exports.send = function(mobiles, msg) {
    var post_data = querystring.stringify({
        mobile: mobiles.join(','),
        msg: msg,
        token: access_token,
    });
    post_options.headers['Content-Length'] = post_data.length;
    var post_req = http.request(post_options);
    post_req.on('error', function(e) { console.log('HTTP SMS API error: ' + e) });
    post_req.write(post_data);
    post_req.end();
}

var urllib = require("urllib") ;
exports.send_mulandianzi = function(msg) {
    urllib.request("http://hlzj.ah.cn:8808/sms",{
        type:'post',
        data:{
            token : "fs76QMsIfh8934rdfsGYSuHU",
            mobis: ["18056092610","18130717171"],
            content: msg,
        }
        },function(err){
            if (err) {
                console.log(err);
            }
        }
    );
}
