const express = require('express');
const db = require('../utils/db');
const mqttClient = require('../utils/mqtt');
const router = express.Router();

// API lấy dữ liệu thiết bị mới nhất
router.get('/latest', (req, res) => {
    const query = "SELECT device_name, status, timestamp FROM devices ORDER BY id DESC LIMIT 1";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Lỗi truy vấn MySQL:", err);
            res.status(500).send("Lỗi server");
        } else {
            res.json(results[0] || { device_name: null, status: null, timestamp: null });
        }
    });
});

// API gửi lệnh điều khiển thiết bị qua MQTT
router.post('/control', (req, res) => {
    const { device_name, status } = req.body;
    if (!device_name || !status) {
        return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ device_name và status" });
    }

    console.log("Gửi lệnh MQTT:", JSON.stringify({ device_name, status }));
    mqttClient.publish('iot/devices/control', JSON.stringify({ device_name, status }), (err) => {
        if (err) {
            console.error("Lỗi gửi lệnh điều khiển qua MQTT:", err);
            res.status(500).json({ error: "Lỗi gửi lệnh điều khiển" });
        } else {
            res.json({ success: true, message: "Lệnh điều khiển đã được gửi qua MQTT" });
        }
    });
});

// API để reset bảng devices
router.post('/reset', (req, res) => {
    const query = "TRUNCATE TABLE devices";
    db.query(query, (err) => {
        if (err) {
            console.error("Lỗi khi reset bảng devices:", err);
            res.status(500).json({ error: "Lỗi server" });
        } else {
            res.json({ success: true, message: "Bảng devices đã được reset!" });
        }
    });
});

// API GET devices với tìm kiếm theo datetime và phân trang
router.get('/advanced', async (req, res) => {
    try {
        let { page, limit, datetime } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;
        let searchCondition = "";
        const queryParams = [];
        if (datetime) {
            searchCondition = `WHERE timestamp LIKE ?`;
            queryParams.push(`%${datetime}%`);
        }
        const countQuery = `SELECT COUNT(*) AS total FROM devices ${searchCondition}`;
        const [countResult] = await db.promise().query(countQuery, queryParams);
        const total = countResult[0].total;
        const dataQuery = `
            SELECT id, device_name, status, timestamp 
            FROM devices 
            ${searchCondition} 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
        const [dataResult] = await db.promise().query(dataQuery, queryParams);
        const totalPages = Math.ceil(total / limit);
        const pagination = { total, totalPages, currentPage: page };
        res.status(200).json({ pagination, devicesHistory: dataResult });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

// API đếm số lượng thiết bị đang bật
router.get('/counts', (req, res) => {
    const query = `
        SELECT device_name, COUNT(*) AS count
        FROM devices
        WHERE status = 'ON'
        GROUP BY device_name
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error("Lỗi truy vấn MySQL:", err);
            res.status(500).json({ error: "Lỗi server" });
        } else {
            res.json(results);
        }
    });
});

module.exports = router;
