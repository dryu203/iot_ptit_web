const express = require('express');
const db = require('../utils/db');
const router = express.Router();

// Validation middleware
const validateSensorData = (req, res, next) => {
    const { temperature, humidity, light, wind } = req.body;
    if (temperature == null || humidity == null || light == null || wind == null) {
        return res.status(400).json({ error: "Missing required sensor data" });
    }
    next();
};

// API lưu dữ liệu cảm biến
router.post('/updatedata', validateSensorData, (req, res) => {
    const { temperature, humidity, light, wind } = req.body;
    const query = "INSERT INTO sensors (temperature, humidity, light, wind, timestamp) VALUES (?, ?, ?, ?, NOW())";
    
    db.query(query, [temperature, humidity, light, wind], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json({ success: true, id: results.insertId });
    });
});

// API lấy dữ liệu cảm biến mới nhất
router.get('/latest', (req, res) => {
    const query = "SELECT temperature, humidity, light, wind FROM sensors ORDER BY id DESC LIMIT 1";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        const data = results[0] || { temperature: null, humidity: null, light: null, wind: null };
        res.json(data);
    });
});

// API GET sensors với tìm kiếm, sắp xếp, và phân trang
router.get('/advanced', async (req, res) => {
    try {
        let { page, limit, sort, order, searchField, searchValue } = req.query;

        // Validate and sanitize input
        page = Math.max(1, parseInt(page) || 1);
        limit = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const offset = (page - 1) * limit;

        const allowedFields = ["temperature", "humidity", "light", "wind", "timestamp"];
        let searchCondition = "";
        const queryParams = [];

        if (searchField && allowedFields.includes(searchField) && searchValue) {
            if (searchField === "timestamp") {
                searchCondition = `WHERE ${searchField} = ?`;
                queryParams.push(decodeURIComponent(searchValue));
            } else {
                const value = parseFloat(searchValue);
                if (!isNaN(value)) {
                    searchCondition = `WHERE ${searchField} = ?`;
                    queryParams.push(value);
                }
            }
        }

        const sortField = allowedFields.includes(sort) ? sort : "timestamp";
        const sortOrder = order === "asc" ? "ASC" : "DESC";

        // Get total count
        const countQuery = `SELECT COUNT(*) AS total FROM sensors ${searchCondition}`;
        const [countResult] = await db.promise().query(countQuery, queryParams);
        const total = countResult[0].total;

        // Get paginated data
        const dataQuery = `
            SELECT id, temperature, humidity, light, wind, timestamp 
            FROM sensors 
            ${searchCondition} 
            ORDER BY ${sortField} ${sortOrder} 
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
        const [dataResult] = await db.promise().query(dataQuery, queryParams);

        const totalPages = Math.ceil(total / limit);
        res.json({
            pagination: { total, totalPages, currentPage: page },
            data: dataResult
        });
    } catch (error) {
        console.error("Error in advanced query:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// API để reset bảng sensors
router.post('/reset', (req, res) => {
    const query = "TRUNCATE TABLE sensors";
    db.query(query, (err) => {
        if (err) {
            console.error("Lỗi khi reset bảng sensors:", err);
            res.status(500).json({ error: "Lỗi server" });
        } else {
            res.json({ success: true, message: "Bảng sensors đã được reset!" });
        }
    });
});

module.exports = router;
