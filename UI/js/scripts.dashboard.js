document.addEventListener("DOMContentLoaded", function () {
    // --- Khai báo ---
    const switches = [
        { id: "light1", device_name: "Light 1", bulbId: "light1-bulb", countId: "light1-count", loadingId: "light1-loading" },
        { id: "light2", device_name: "Light 2", bulbId: "light2-bulb", countId: "light2-count", loadingId: "light2-loading" },
        { id: "light3", device_name: "Light 3", bulbId: "light3-bulb", countId: "light3-count", loadingId: "light3-loading" }
    ];
    const pendingStates = { "Light 1": false, "Light 2": false, "Light 3": false };

    // Các hằng số thời gian
    const UPDATE_INTERVAL = 1000;  

    // --- Bóng đèn UI ---
    function updateBulbState(deviceName, status) {
        const s = switches.find(item => item.device_name === deviceName);
        if (!s) return;
        const sw = document.getElementById(s.id), bulb = document.getElementById(s.bulbId), loading = document.getElementById(s.loadingId);
        if (!sw || !bulb || !loading) return;
        const isOn = status === "ON";
        if (pendingStates[deviceName]) {
            if (sw._targetState === isOn) {
                sw.checked = isOn;
                bulb.classList.toggle("on", isOn);
                loading.style.display = "none";
                pendingStates[deviceName] = false;
                sw._targetState = undefined;
            }
        } else {
            sw.checked = isOn;
            bulb.classList.toggle("on", isOn);
            loading.style.display = "none";
        }
    }

    // --- Lấy trạng thái thiết bị ---
    function fetchDeviceStates() {
        fetch("/api/devices/latest")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Xử lý nhiều thiết bị
                    data.forEach(device => {
                        if (device.device_name && device.status) {
                            updateBulbState(device.device_name, device.status);
                        }
                    });
                } else if (data && data.device_name && data.status) {
                    // Xử lý một thiết bị
                    updateBulbState(data.device_name, data.status);
                }
            })
            .catch(e => console.error("Lỗi khi lấy trạng thái thiết bị:", e));
    }

    // --- Điều khiển thiết bị ---
    switches.forEach(s => {
        const sw = document.getElementById(s.id), loading = document.getElementById(s.loadingId);
        if (!sw || !loading) return;
        sw.onchange = null;
        sw.addEventListener("change", function () {
            if (sw._handlingChange) return;
            sw._handlingChange = true;
            const status = this.checked ? "ON" : "OFF";
            loading.style.display = "block";
            pendingStates[s.device_name] = true;
            sw._targetState = this.checked;
            sw.checked = !sw._targetState;
            fetch("/api/devices/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_name: s.device_name, status })
            })
            .then(r => { if (!r.ok) throw new Error("Lỗi khi gửi lệnh điều khiển thiết bị"); })
            .catch(() => {
                loading.style.display = "none";
                pendingStates[s.device_name] = false;
                sw._targetState = undefined;
                alert("Không thể gửi lệnh điều khiển thiết bị!");
                sw.checked = !sw.checked;
            })
            .finally(() => setTimeout(() => { sw._handlingChange = false; }, 300));
        });
    });

    // --- WebSocket ---
    let ws;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    function setupWebSocket() {
        if (ws) {
            ws.close();
        }

        ws = new WebSocket("ws://localhost:3000/ws");

        ws.onopen = () => {
            console.log("WebSocket connected");
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.device_name && data.status) {
                    updateBulbState(data.device_name, data.status);
                } else if (data.type === "sensor_data") {
                    updateSensorData(data.data);
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    reconnectAttempts++;
                    setupWebSocket();
                }, RECONNECT_DELAY);
            }
        };
    }
    // --- Biểu đồ ---
    const temperatureChartCanvas = document.getElementById("temperatureChart");
    const humidityChartCanvas = document.getElementById("humidityChart");
    const lightChartCanvas = document.getElementById("lightChart");
    let temperatureChart = null;
    let humidityChart = null;
    let lightChart = null;
    const MAX_DATA_POINTS = 20; // Giới hạn số điểm dữ liệu hiển thị

    function createChart(canvas, label, color) {
        if (!canvas) return null;
        const ctx = canvas.getContext("2d");
        return new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    fill: false,
                    yAxisID: 'y'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // Tắt animation để tăng hiệu suất
                },
                scales: {
                    x: { 
                        title: { display: true, text: "Thời gian" },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: { 
                        title: { display: true, text: "Giá trị" },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    if (temperatureChartCanvas && humidityChartCanvas && lightChartCanvas) {
        // Tạo các biểu đồ
        temperatureChart = createChart(temperatureChartCanvas, "Nhiệt độ", "red");
        humidityChart = createChart(humidityChartCanvas, "Độ ẩm", "blue");
        lightChart = createChart(lightChartCanvas, "Ánh sáng", "orange");

        function fetchSensorDataForCharts() {
            fetch("/api/sensors/advanced?limit=" + MAX_DATA_POINTS + "&sort=timestamp&order=desc")
                .then(r => r.json())
                .then(data => {
                    if (!data || !data.data || data.data.length === 0) return;
                    
                    const reversed = [...data.data].reverse();
                    const labels = reversed.map(i => new Date(i.timestamp).toLocaleTimeString());
                    
                    // Cập nhật dữ liệu cho các biểu đồ
                    [temperatureChart, humidityChart, lightChart].forEach(chart => {
                        if (chart) {
                            chart.data.labels = labels;
                        }
                    });

                    temperatureChart.data.datasets[0].data = reversed.map(i => i.temperature || null);
                    humidityChart.data.datasets[0].data = reversed.map(i => i.humidity || null);
                    lightChart.data.datasets[0].data = reversed.map(i => i.light || null);
                    
                    temperatureChart.update('none');
                    humidityChart.update('none');
                    lightChart.update('none');
                })
                .catch(e => console.error("Lỗi khi lấy dữ liệu cảm biến cho biểu đồ:", e));
        }

        // Xử lý cảnh báo
        function updateAlertStatus(type, value) {
            const bulb = document.getElementById(`${type}-alert-bulb`);
            const status = document.getElementById(`${type}-alert-status`);
            if (!bulb || !status) return;

            let isWarning = false;
            let warningText = '';

            switch(type) {
                case 'temp':
                    isWarning = value > 32;
                    warningText = 'Nhiệt độ cao!';
                    break;
                case 'humid':
                    isWarning = value > 50;
                    warningText = 'Độ ẩm cao!';
                    break;
                case 'light':
                    isWarning = value < 200;
                    warningText = 'Ánh sáng mạnh!';
                    break;
            }

            if (isWarning) {
                bulb.classList.add('warning');
                status.classList.add('warning');
                status.textContent = warningText;
            } else {
                bulb.classList.remove('warning');
                status.classList.remove('warning');
                status.textContent = 'Bình thường';
            }
        }

        // Cập nhật hàm updateSensorData
        function updateSensorData(data) {
            try {
                // Cập nhật các giá trị hiển thị
                document.getElementById('temperature').textContent = data.temperature?.toFixed(1) || 'N/A';
                document.getElementById('humidity').textContent = data.humidity?.toFixed(1) || 'N/A';
                document.getElementById('light').textContent = data.light?.toFixed(1) || 'N/A';

                // Cập nhật trạng thái cảnh báo
                if (data.temperature !== undefined) updateAlertStatus('temp', data.temperature);
                if (data.humidity !== undefined) updateAlertStatus('humid', data.humidity);
                if (data.light !== undefined) updateAlertStatus('light', data.light);

                // Cập nhật biểu đồ
                if (temperatureChart && humidityChart && lightChart) {
                    const timestamp = new Date().toLocaleTimeString();
                    
                    // Thêm dữ liệu mới
                    [temperatureChart, humidityChart, lightChart].forEach(chart => {
                        if (chart) {
                            chart.data.labels.push(timestamp);
                        }
                    });

                    temperatureChart.data.datasets[0].data.push(data.temperature || null);
                    humidityChart.data.datasets[0].data.push(data.humidity || null);
                    lightChart.data.datasets[0].data.push(data.light || null);

                    // Giới hạn số điểm dữ liệu
                    [temperatureChart, humidityChart, lightChart].forEach(chart => {
                        if (chart) {
                            if (chart.data.labels.length > MAX_DATA_POINTS) {
                                chart.data.labels.shift();
                                chart.data.datasets.forEach(dataset => dataset.data.shift());
                            }
                            chart.update('none');
                        }
                    });
                }
            } catch (error) {
                console.error('Error updating sensor data:', error);
            }
        }

        // Khởi tạo và cập nhật định kỳ
        fetchSensorDataForCharts();
        setInterval(fetchSensorDataForCharts, UPDATE_INTERVAL);
    } else {
        console.warn("Không tìm thấy canvas cho biểu đồ.");
    }

    // --- Số lần bật/tắt ---
    function updateLightCount(deviceName, count) {
        const s = switches.find(item => item.device_name === deviceName);
        if (s) {
            const countElement = document.getElementById(s.countId);
            if (countElement) countElement.innerText = count;
        }
    }
    function fetchLightCounts() {
        fetch("/api/devices/counts")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) data.forEach(i => updateLightCount(i.device_name, i.count));
            })
            .catch(e => console.error("Lỗi khi lấy số lần bật/tắt:", e));
    }

    // --- Dữ liệu cảm biến mới nhất ---
    function updateSensorDisplayFromAPI() {
        fetch("/api/sensors/latest")
            .then(res => res.json())
            .then(data => {
                if (!data) return;
                ["temperature", "humidity", "light"].forEach(key => {
                    const el = document.getElementById(key);
                    if (el) el.innerText = (data[key] !== undefined && data[key] !== null) ? String(data[key]) : "--";
                });
            });
    }
    updateSensorDisplayFromAPI();
    setInterval(updateSensorDisplayFromAPI, UPDATE_INTERVAL);

    // --- Đồng bộ hóa ---
    function updateAllData() {
        fetchDeviceStates();
        fetchLightCounts();
    }
    updateAllData();
    setInterval(updateAllData, UPDATE_INTERVAL);

    // --- Lấy dữ liệu từ API ---
    async function fetchSensorData() {
        try {
            const response = await fetch('/api/sensors/latest');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            updateSensorData(data);
        } catch (error) {
            console.error('Error fetching sensor data:', error);
        }
    }

    // --- Khởi tạo ---
    setupWebSocket();
    fetchSensorData();
    
    // Cập nhật dữ liệu mỗi giây
    setInterval(fetchSensorData, UPDATE_INTERVAL);
});