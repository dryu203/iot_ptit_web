document.addEventListener("DOMContentLoaded", function () {
    // --- Khai báo ---
    const switches = [
        { id: "light1", device_name: "Light 1", bulbId: "light1-bulb", countId: "light1-count", loadingId: "light1-loading" },
        { id: "light2", device_name: "Light 2", bulbId: "light2-bulb", countId: "light2-count", loadingId: "light2-loading" },
        { id: "light3", device_name: "Light 3", bulbId: "light3-bulb", countId: "light3-count", loadingId: "light3-loading" }
    ];
    const pendingStates = { "Light 1": false, "Light 2": false, "Light 3": false };

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
            .then(d => { if (d && d.device_name && d.status) updateBulbState(d.device_name, d.status); })
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
    function setupWebSocket() {
        const ws = new WebSocket("ws://localhost:3000/ws");
        ws.onopen = () => console.log("WebSocket connected!");
        ws.onmessage = event => {
            try {
                const d = JSON.parse(event.data);
                if (d.device_name && d.status) updateBulbState(d.device_name, d.status);
            } catch (e) { console.warn("WebSocket message parse error", e); }
        };
        ws.onclose = () => {
            console.warn("WebSocket bị đóng, đang thử kết nối lại...");
            setTimeout(setupWebSocket, 2000);
        };
    }
    setupWebSocket();

    // --- Biểu đồ ---
    const sensorChartCanvas = document.getElementById("sensorChart");
    let sensorChart = null;
    if (sensorChartCanvas) {
        const ctx = sensorChartCanvas.getContext("2d");
        if (window._sensorChartInstance) window._sensorChartInstance.destroy();
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
                scales: {
                    x: { title: { display: true, text: "Thời gian" } },
                    y: { title: { display: true, text: "Giá trị" } }
                }
            }
        });
        window._sensorChartInstance = sensorChart;

        function fetchSensorDataForChart() {
            fetch("/api/sensors/advanced?limit=20&sort=timestamp&order=desc")
                .then(r => r.json())
                .then(data => {
                    if (!data || !data.data || data.data.length === 0) return;
                    const reversed = [...data.data].reverse();
                    const labels = reversed.map(i => new Date(i.timestamp).toLocaleTimeString());
                    const temperatureData = reversed.map(i => (i.temperature !== undefined && i.temperature !== null ? Number(i.temperature) : null));
                    const humidityData = reversed.map(i => (i.humidity !== undefined && i.humidity !== null ? Number(i.humidity) : null));
                    const lightData = reversed.map(i => (i.light !== undefined && i.light !== null ? Number(i.light) : null));
                    const windData = reversed.map(i => (i.wind !== undefined && i.wind !== null ? Number(i.wind) : null));
                    sensorChart.data.labels = labels;
                    sensorChart.data.datasets[0].data = temperatureData;
                    sensorChart.data.datasets[1].data = humidityData;
                    sensorChart.data.datasets[2].data = lightData;
                    sensorChart.data.datasets[3].data = windData;
                    sensorChart.update();
                    updateWindWarning(windData[windData.length - 1]);
                })
                .catch(e => console.error("Lỗi khi lấy dữ liệu cảm biến cho biểu đồ:", e));
        }

        function updateWindWarning(wind) {
            const windWarning = document.getElementById("wind-warning");
            if (!windWarning) return;
            if (wind > 50) {
                windWarning.style.display = "block";
                windWarning.classList.add("blinking");
                windWarning.innerText = "CẢNH BÁO: Gió mạnh!";
            } else {
                windWarning.style.display = "none";
                windWarning.classList.remove("blinking");
                windWarning.innerText = "";
            }
        }

        fetchSensorDataForChart();
        setInterval(fetchSensorDataForChart, 3000);
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
            });
    }
    updateSensorDisplayFromAPI();
    setInterval(updateSensorDisplayFromAPI, 1000);

    // --- Đồng bộ hóa ---
    function updateAllData() {
        fetchDeviceStates();
        fetchLightCounts();
    }
    updateAllData();
    setInterval(updateAllData, 2000);
});