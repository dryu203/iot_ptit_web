require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mqtt = require('mqtt');
const db = require('./utils/db'); // Kết nối MySQL
const mqttClient = require('./utils/mqtt'); // Kết nối MQTT
const setDeviceStatusCallback = require('./utils/mqtt').setDeviceStatusCallback;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'UI')));

// Middleware phục vụ favicon
app.use('/favicon.ico', express.static(path.join(__dirname, 'UI', 'favicon.ico')));

// Import các route API
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/devices', require('./routes/devices'));

// API kiểm tra server hoạt động
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'UI', 'dashboard.html'));
});

// Thêm WebSocket server để phát trạng thái MQTT cho web
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Lưu tất cả client WebSocket
let wsClients = [];
wss.on('connection', function connection(ws) {
    wsClients.push(ws);
    ws.on('close', () => {
        wsClients = wsClients.filter(client => client !== ws);
    });
});

// Đăng ký callback để phát WebSocket khi có trạng thái thiết bị mới từ MQTT
setDeviceStatusCallback(function (deviceMessage) {
    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(deviceMessage);
        }
    });
});

// Lắng nghe kết nối
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});
