document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput");
    const pageSizeSelect = document.getElementById("pageSize");
    const pagination = document.getElementById("pagination");
    const resetButton = document.getElementById("resetDevices");
    const tableId = "deviceHistoryTable";
    const paginationId = "pagination";
    const apiBase = "/api/devices/advanced";

    function loadDeviceData(page = 1) {
        const pageSize = pageSizeSelect.value;
        const query = searchInput.value.trim();
        let apiUrl = `${apiBase}?page=${page}&limit=${pageSize}`;
        if (query) apiUrl += `&datetime=${encodeURIComponent(query)}`;
        fetchData(apiUrl, tableId, paginationId, processDeviceData);
    }

    searchInput.addEventListener("input", () => loadDeviceData(1));
    pageSizeSelect.addEventListener("change", () => loadDeviceData(1));
    pagination.addEventListener("click", function (event) {
        if (event.target.tagName === "A") {
            event.preventDefault();
            const page = event.target.dataset.page;
            if (page) loadDeviceData(page);
        }
    });

    resetButton.addEventListener("click", function () {
        if (confirm("Bạn có chắc chắn muốn reset bảng devices?")) {
            fetch("/api/devices/reset", { method: "POST" })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        loadDeviceData();
                    } else {
                        alert("Lỗi khi reset bảng devices!");
                    }
                })
                .catch(e => console.error("Lỗi khi gọi API reset bảng devices:", e));
        }
    });

    loadDeviceData();
});