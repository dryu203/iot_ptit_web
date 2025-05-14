const mqtt = require('mqtt');
const db = require('./db');

let mqttClient = null;
let deviceStatusCallback = null;

function setupMQTT() {
    const options = {
        host: '192.168.51.4',
        port: 2003,
        protocol: 'mqtt',
        username: 'dryu',
        password: '251103',
        clientId: 'server_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000
    };

    mqttClient = mqtt.connect(options);

    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        mqttClient.subscribe(['iot/sensors', 'iot/devices'], (err) => {
            if (err) {
                console.error('MQTT Subscribe error:', err);
            }
        });
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT Error:', err);
    });

    mqttClient.on('close', () => {
        console.log('MQTT connection closed');
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            
            if (topic === 'iot/sensors') {
                handleSensorData(payload);
            } else if (topic === 'iot/devices') {
                handleDeviceData(payload);
            }
        } catch (err) {
            console.error('Error processing MQTT message:', err);
        }
    });
}

function handleSensorData(payload) {
    if (!payload) {
        console.error("Invalid sensor payload");
        return;
    }

    const { temperature, humidity, light, wind, wind_warning } = payload;
    
    if (temperature !== undefined && humidity !== undefined && 
        light !== undefined && wind !== undefined) {
        const query = "INSERT INTO sensors (temperature, humidity, light, wind, timestamp) VALUES (?, ?, ?, ?, NOW())";
        db.query(query, [temperature, humidity, light, wind], (err) => {
            if (err) {
                console.error("Error saving sensor data:", err);
            }
        });

        // Broadcast wind warning if present
        if (wind_warning !== undefined) {
            broadcastMessage(JSON.stringify({ wind_warning, wind_speed: wind }));
        }
    }
}

function handleDeviceData(payload) {
    const { device_name, status } = payload;
    if (device_name && status) {
        const query = "INSERT INTO devices (device_name, status, timestamp) VALUES (?, ?, NOW())";
        db.query(query, [device_name, status], (err) => {
            if (err) {
                console.error("Error saving device status:", err);
            }
        });

        // Broadcast device status
        broadcastMessage(JSON.stringify(payload));
    }
}

function broadcastMessage(message) {
    if (typeof deviceStatusCallback === 'function') {
        deviceStatusCallback(message);
    }
}

function setDeviceStatusCallback(callback) {
    deviceStatusCallback = callback;
}

module.exports = {
    setupMQTT,
    setDeviceStatusCallback,
    publish: (topic, message, callback) => {
        if (mqttClient) {
            mqttClient.publish(topic, message, callback);
        } else {
            callback(new Error('MQTT client not initialized'));
        }
    }
};