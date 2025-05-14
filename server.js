require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupMQTT, setDeviceStatusCallback } = require('./utils/mqtt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'UI')));

// Middleware phục vụ favicon
app.use('/favicon.ico', express.static(path.join(__dirname, 'UI', 'favicon.ico')));

// Routes
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/devices', require('./routes/devices'));

// API kiểm tra server hoạt động
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'UI', 'dashboard.html'));
});

// WebSocket server
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// WebSocket clients management
let wsClients = [];

wss.on('connection', function connection(ws) {
    wsClients.push(ws);
    
    ws.on('error', console.error);
    
    ws.on('close', () => {
        wsClients = wsClients.filter(client => client !== ws);
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Set up MQTT callback
setDeviceStatusCallback(broadcast);

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    setupMQTT();
});
