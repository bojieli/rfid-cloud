var toexport = {
    listen_host: 'localhost',
    listen_port: 54322,
    heartbeat_timeout: 300,  // in seconds
    max_reports_per_day: 10,
    admin_mobiles: ['18715009901', '15556980100'],
    sms_suffix: ' [电子学生证]',
    card_id_size: 9,
    add_student_api_token: 'FWDnVlLmFvWRutaKSc0EDCk6',
};
for (key in toexport)
    exports[key] = toexport[key];
