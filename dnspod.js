var Dnspod = require('dnspod-client'),
    client = new Dnspod({
        'login_email': 'boj@mail.ustc.edu.cn',
        'login_password': 'googleagelimit'
    });

client
    .domainList({length: 5})
    .on('domainList', function (err, data) {
        if (err) {
            throw err;
        } else {
            console.log(data);
        }
    });

client
    .getHostIp()
    .on('getHostIp', function (err, message) {
        if (err) {
            throw err;
        } else {
            console.log('get IP address: ' + message);
        }
    });

var domain_id = '';

function insert_host(sub_domain, ip) {
    client.recordCreate({
        domain_id: domain_id,
        sub_domain: sub_domain,
        record_type: 'A',
        record_line: '默认',
        value: ip,
    })
    .on('recordCreate', function(err, data) {
    try {
        if (data.status.code != 1) {
            console.log("Error recordCreate:");
            console.log(data);
        }
    } catch(e) {
        console.log(e);
    }
    });
}

// This function will first find the record id using RecordList API,
// then call Record.Ddn
function update_host(sub_domain, ip) {
}
