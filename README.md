# RFID 服务器端

## 服务器部署

依赖的软件：

* node.js
* MySQL
* dnspod-client (to install: ```npm install dnspod-client```)

初始化数据库：

1. ```mysql -u root -p``` 输入密码，进入 MySQL 命令行
2. ```source /path/to/install.sql``` 初始化 ecard 数据库结构
3. 在另一个终端里，```openssl rand -base64 15``` 生成一个随机密码
4. 在 MySQL 命令行里，```GRANT ALL ON ecard.* TO 'ecard-www'@'localhost' IDENTIFIED BY 'the-generated-password';```
5. 修改 db.js，把其中的 password 修改成刚才生成的密码

运行服务器：

* Debug: ```node ecard.js```
* Production: ```nohup node monitor.js >/dev/null 2>&1 &```


## Push API

将学生出入校门、考勤机故障等事件以 HTTP POST 的形式通知给第三方 API。

添加一个 Push API：

1. ```mysql -u root -p ecard``` 输入密码，进入 MySQL 命令行
2. ```INSERT INTO push_api (host, port, path, token) VALUES ('example.com', 80, '/notify/path', 'a-secret-token-for-you')```

外层是 URL encode（querystring.stringify），内层是 json encode（JSON.stringify）

POST 数据采用标准的 URL encode：```token=<a-secret-token-for-you>&data=<url-encoded-data>```

POST 数据中的 data 字段是 JSON 格式，下面详述。下面的竖线“|”表示“或”的关系。

### 学生出入校门事件

```js
{
    type: "notify",
    card: "0101xxxxxxxxxxxxxx",
    action: "0"|"1", // 分别表示进或出校门
    school: {
        id: schoolID, 
        name: schoolName
    },
    student: {
        id: studentID,
        report_mobile: mobileNumbers, // 如果有多个，用半角逗号隔开
        name: studentName
    },
}
```

### 服务器报警事件

```js
{
    type: "alert",
    action: "lost_heartbeat"    // 服务器收不到 master 的心跳
          | "resume_heartbeat"  // 服务器重新收到 master 的心跳
          | "alloc_fail"        // 内存分配失败
          | "connected"         // master|slave receiver 连接到 merger 上
          | "disconnected"      // master|slave receiver 从 merger 主动断开（如重启服务）
          | "dead"              // merger 检测到 master|slave receiver 死掉了
          | "report",           // 其他考勤机汇报上来的消息
    school: {
        id: schoolID,
        name: schoolName
    },
    source: "cloud"|"master"|"slave", // 报警消息来源

    // 以下两项仅对 lost_heartbeat 和 resume_heartbeat 有效
    curr_time: currentUnixTimestamp,
    last_time: lastTimestampReceivedHeartbeat,

    // 以下两项都可能不存在（即 undefined）
    daemon: "merger"|"receiver", // 是哪个应用出了问题
    msg: originalMsg, // 如果此事件是考勤机汇报来的，则附上原始消息
}
```

### 错误事件

#### 收到的 ID 不属于此学校，或者 ID 不存在

```js
{
    type: "error",
    error: "card_not_exist",
    school: {
        id: schoolID,
        name: schoolName
    },
    card: "0101xxxxxxxxxxxxxx",
    action: "0"|"1", // 分别表示进或出校门
}
```

#### 收到的消息格式错误

```js
{
    type: "error",
    error: "invalid_msg",
    school: {
        id: schoolID,
        name: schoolName
    },
    data: data,
}
```


## 添加（学号，卡号）对应关系的 API

外层是 URL encode（querystring.stringify），内层是 json encode（JSON.stringify）

POST 数据采用标准的 URL encode：```token=<school-token>&data=<url-encoded-data>```

POST 数据中的 data 字段是 JSON 格式：

```js
{
    token: <add-card-api-token>,
    card_id: "0101xxxxxxxxxxxxxx",
    student_id: <学生学号>, // 必须在学生数据库中已存在
}
```

```add_card.js``` 是一个添加（学号，卡号）的示例程序。
