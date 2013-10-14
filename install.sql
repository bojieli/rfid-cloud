CREATE DATABASE IF NOT EXISTS ecard;
USE ecard;

CREATE TABLE IF NOT EXISTS school (
    id INT(10) NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    access_token VARCHAR(200) NOT NULL,
    merger_ok BOOL NOT NULL DEFAULT 0,
    master_ok BOOL NOT NULL DEFAULT 0,
    slave_ok BOOL NOT NULL DEFAULT 0,
    error_counter INT(10) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY key_token (access_token)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS class (
    id INT(10) NOT NULL AUTO_INCREMENT,
    name VARCHAR(200),
    school INT(10) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (school) REFERENCES school (id)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS student (
    id INT(10) NOT NULL AUTO_INCREMENT,
    school INT(10) NOT NULL,
    class INT(10) NOT NULL,
    isactive BOOL DEFAULT TRUE,
    register_time DATETIME,
    name VARCHAR(200),
    student_id VARCHAR(200) NOT NULL,
    report_mobile VARCHAR(200),
    is_in_school BOOL DEFAULT FALSE,
    last_activity DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (school) REFERENCES school (id),
    UNIQUE KEY (school, student_id),
    KEY key_class (class)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS dynamic_ip (
    school INT(10) NOT NULL,
    hostname VARCHAR(50) NOT NULL,
    eth0 VARCHAR(50),
    tun0 VARCHAR(50),
    FOREIGN KEY (school) REFERENCES school (id),
    UNIQUE KEY (school, hostname),
    KEY key_tun0 (tun0)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS card (
    id CHAR(18) NOT NULL,
    student INT(10) NOT NULL UNIQUE,
    register_time DATETIME,
    isactive BOOL DEFAULT TRUE,
    PRIMARY KEY (id),
    FOREIGN KEY (student) REFERENCES student (id)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS gate_log (
    card CHAR(18) NOT NULL,
    student INT(10) NOT NULL,
    time DATETIME NOT NULL,
    school INT(10) NOT NULL,
    action BOOL NOT NULL,
    KEY key_card (card),
    KEY key_student (student),
    KEY key_school (school),
    KEY key_time (time)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS error_log (
    school INT(10) NOT NULL,
    time DATETIME NOT NULL,
    msg TEXT NOT NULL,
    important BOOL NOT NULL DEFAULT 0,
    KEY key_school (school),
    KEY key_time (time)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS sms_log (
    time DATETIME NOT NULL,
    mobile VARCHAR(200) NOT NULL,
    msg TEXT NOT NULL,
    KEY key_time (time),
    KEY key_mobile (mobile)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS push_api (
    host VARCHAR(200) NOT NULL,
    port INT(5) NOT NULL DEFAULT 80,
    path VARCHAR(200) NOT NULL,
    token VARCHAR(200)
) DEFAULT CHARSET=utf8;
