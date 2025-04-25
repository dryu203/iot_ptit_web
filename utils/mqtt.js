const mqtt = require('mqtt');
const db = require('../utils/db');

const mqttClient = mqtt.connect({
    hostname: 'localhost',
    port: 2003,
    username: 'dryu',
    password: '251103',
    protocol: 'mqtt'
});

let deviceStatusCallback = null;

function setDeviceStatusCallback(cb) {
    deviceStatusCallback = cb;
}

mqttClient.on('connect', () => {
    console.log('Kết nối MQTT thành công!');
    mqttClient.subscribe('iot/sensors');
    mqttClient.subscribe('iot/devices');
});

mqttClient.on('error', (err) => {
    console.error('Lỗi kết nối MQTT:', err);
});

mqttClient.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        if (topic === 'iot/sensors') {
            if (!payload) {
                console.error("Payload is null or undefined.");
                return;
            }
            const { temperature, humidity, light, wind } = payload;
            if (
                temperature !== undefined &&
                humidity !== undefined &&
                light !== undefined &&
                wind !== undefined
            ) {
                const query = "INSERT INTO sensors (temperature, humidity, light, wind, timestamp) VALUES (?, ?, ?, ?, NOW())";
                db.query(query, [temperature, humidity, light, wind], (err) => {
                    if (err) {
                        console.error("Lỗi lưu dữ liệu cảm biến vào MySQL:", err);
                    } else {
                        console.log("Đã lưu dữ liệu cảm biến vào MySQL:", payload);
                    }
                });
            }
        } else if (topic === 'iot/devices') {
            // Gọi callback để phát WebSocket nếu có
            if (typeof deviceStatusCallback === 'function') {
                deviceStatusCallback(message.toString());
            }
            // Lưu trạng thái thiết bị vào DB
            const { device_name, status } = payload;
            if (device_name && status) {
                const query = "INSERT INTO devices (device_name, status, timestamp) VALUES (?, ?, NOW())";
                db.query(query, [device_name, status], (err) => {
                    if (err) {
                        console.error("Lỗi lưu trạng thái thiết bị vào MySQL:", err);
                    } else {
                        console.log("Trạng thái thiết bị đã được lưu vào MySQL.");
                    }
                });
            }
        }
    } catch (e) {
        console.error("Lỗi phân tích dữ liệu MQTT:", e);
    }
});

module.exports = mqttClient;
module.exports.setDeviceStatusCallback = setDeviceStatusCallback;