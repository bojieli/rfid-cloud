function start() {
    var ls = require('child_process').spawn('node', ['ecard.js']);
    ls.stdout.on('data', function(data) {
        process.stdout.write(data.toString());
    });
    ls.stderr.on('data', function(data) {
        process.stdout.write(data.toString());
    });
    ls.on('exit', function(code) {
        console.log('child process exited with code ' + code);
        start();
    });
}
start();
