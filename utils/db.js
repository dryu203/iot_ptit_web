const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "iot_db"
});

db.connect(err => {
    if (err) console.error("Lỗi kết nối MySQL:", err);
    else console.log("Kết nối MySQL thành công!");
});

module.exports = db;
