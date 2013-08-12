var toexport = {
    listen_host: 'localhost',
    listen_port: 54322,
    heartbeat_timeout: 30,  // in seconds
    max_reports_per_day: 10,
    admin_mobiles: ['18715009901'],
    sms_suffix: ' [电子学生证]',
    card_id_size: 9,
};
for (key in toexport)
    exports[key] = toexport[key];
