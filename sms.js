var access_token = 'M2La02Jd334Os3Nx';
var post_options = {
    host: 'blog.ustc.edu.cn',
    port: '80',
    path: '/servmon/sms-api.php',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    }
};

exports.send = function(mobiles, msg) {
    var post_data = querystring.stringify({
        mobile: mobiles.join(','),
        msg: msg,
        token: access_token,
    });
    post_options.headers['Content-Length'] = post_data.length;
    var post_req = http.request(post_options);
    post_req.write(post_data);
    post_req.end();
}
