const mysql = require('mysql2');

// Tạo connection pool với các cấu hình tối ưu
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'iot_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Xử lý lỗi kết nối
pool.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
        console.error('Database connection was refused.');
    }
});

// Tạo promise wrapper cho pool
const promisePool = pool.promise();

// Hàm kiểm tra kết nối
const checkConnection = async () => {
    try {
        const connection = await promisePool.getConnection();
        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection check failed:', error);
        return false;
    }
};

// Export các hàm cần thiết
module.exports = {
    query: (sql, values) => {
        return new Promise((resolve, reject) => {
            pool.query(sql, values, (error, results) => {
                if (error) {
                    console.error('Query error:', error);
                    reject(error);
                    return;
                }
                resolve(results);
            });
        });
    },
    promise: () => promisePool,
    checkConnection
};
