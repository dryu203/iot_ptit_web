document.addEventListener("DOMContentLoaded", function () {
    // --- Khai báo ---
    const switches = [
        { id: "light1", device_name: "Light 1", bulbId: "light1-bulb", countId: "light1-count", loadingId: "light1-loading" },
        { id: "light2", device_name: "Light 2", bulbId: "light2-bulb", countId: "light2-count", loadingId: "light2-loading" },
        { id: "light3", device_name: "Light 3", bulbId: "light3-bulb", countId: "light3-count", loadingId: "light3-loading" }
    ];
    const pendingStates = { "Light 1": false, "Light 2": false, "Light 3": false };

    // Các hằng số thời gian
    const UPDATE_INTERVAL = 1000;  // 1 giây cho mọi cập nhật

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
                } else if (data.type === "wind_warning") {
                    updateWindWarning(data.data.wind);
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
    const sensorChartCanvas = document.getElementById("sensorChart");
    let sensorChart = null;
    const MAX_DATA_POINTS = 20; // Giới hạn số điểm dữ liệu hiển thị

    // Hàm cập nhật cảnh báo gió
    function updateWindWarning(wind) {
        const windWarning = document.getElementById("wind-warning");
        const windCard = document.getElementById("wind-card");
        if (!windWarning || !windCard) return;
        
        if (wind > 50) {
            windWarning.style.display = "block";
            windCard.classList.add("wind-warning-active");
        } else {
            windWarning.style.display = "none";
            windCard.classList.remove("wind-warning-active");
        }
    }

    if (sensorChartCanvas) {
        const ctx = sensorChartCanvas.getContext("2d");
        if (window._sensorChartInstance) {
            window._sensorChartInstance.destroy();
        }
        sensorChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    { label: "Nhiệt độ (°C)", data: [], borderColor: "red", fill: false, yAxisID: 'y' },
                    { label: "Độ ẩm (%)", data: [], borderColor: "blue", fill: false, yAxisID: 'y' },
                    { label: "Ánh sáng (Lux)", data: [], borderColor: "yellow", fill: false, yAxisID: 'y' },
                    { label: "Gió", data: [], borderColor: "green", fill: false, yAxisID: 'y' }
                ]
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
        window._sensorChartInstance = sensorChart;

        function fetchSensorDataForChart() {
            fetch("/api/sensors/advanced?limit=" + MAX_DATA_POINTS + "&sort=timestamp&order=desc")
                .then(r => r.json())
                .then(data => {
                    if (!data || !data.data || data.data.length === 0) return;
                    
                    const reversed = [...data.data].reverse();
                    const labels = reversed.map(i => new Date(i.timestamp).toLocaleTimeString());
                    
                    // Cập nhật dữ liệu cho biểu đồ
                    sensorChart.data.labels = labels;
                    sensorChart.data.datasets[0].data = reversed.map(i => i.temperature || null);
                    sensorChart.data.datasets[1].data = reversed.map(i => i.humidity || null);
                    sensorChart.data.datasets[2].data = reversed.map(i => i.light || null);
                    sensorChart.data.datasets[3].data = reversed.map(i => i.wind || null);
                    
                    sensorChart.update('none'); // Cập nhật không có animation
                    
                    // Cập nhật cảnh báo gió
                    const lastWindData = reversed[reversed.length - 1]?.wind;
                    if (lastWindData !== undefined) {
                        updateWindWarning(lastWindData);
                    }
                })
                .catch(e => console.error("Lỗi khi lấy dữ liệu cảm biến cho biểu đồ:", e));
        }

        // Cập nhật dữ liệu cảm biến
        function updateSensorData(data) {
            try {
                // Cập nhật các giá trị hiển thị
                document.getElementById('temperature').textContent = data.temperature?.toFixed(1) || 'N/A';
                document.getElementById('humidity').textContent = data.humidity?.toFixed(1) || 'N/A';
                document.getElementById('light').textContent = data.light?.toFixed(1) || 'N/A';
                document.getElementById('wind').textContent = data.wind?.toFixed(1) || 'N/A';

                // Cập nhật biểu đồ
                if (sensorChart) {
                    const timestamp = new Date().toLocaleTimeString();
                    
                    // Thêm dữ liệu mới
                    sensorChart.data.labels.push(timestamp);
                    sensorChart.data.datasets[0].data.push(data.temperature || null);
                    sensorChart.data.datasets[1].data.push(data.humidity || null);
                    sensorChart.data.datasets[2].data.push(data.light || null);
                    sensorChart.data.datasets[3].data.push(data.wind || null);

                    // Giới hạn số điểm dữ liệu
                    if (sensorChart.data.labels.length > MAX_DATA_POINTS) {
                        sensorChart.data.labels.shift();
                        sensorChart.data.datasets.forEach(dataset => dataset.data.shift());
                    }

                    sensorChart.update('none'); // Cập nhật không có animation

                    // Cập nhật cảnh báo gió
                    if (data.wind !== undefined) {
                        updateWindWarning(data.wind);
                    }
                }
            } catch (error) {
                console.error('Error updating sensor data:', error);
            }
        }

        // Khởi tạo và cập nhật định kỳ
        fetchSensorDataForChart();
        setInterval(fetchSensorDataForChart, UPDATE_INTERVAL);
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
                ["temperature", "humidity", "light", "wind"].forEach(key => {
                    const el = document.getElementById(key);
                    if (el) el.innerText = (data[key] !== undefined && data[key] !== null) ? String(data[key]) : "--";
                });
                // Cập nhật cảnh báo gió từ dữ liệu API
                if (data.wind !== undefined) {
                    updateWindWarning(data.wind);
                }
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