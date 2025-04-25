document.addEventListener("DOMContentLoaded", function () {
    // Khai báo biến toàn cục
    const searchInput = document.getElementById("searchInput");
    const pageSizeSelect = document.getElementById("pageSize");
    const pagination = document.getElementById("pagination");
    const resetButton = document.getElementById("resetSensors");
    const columnSelect = document.getElementById("columnSelect");
    const tableId = "sensorDataTable";
    const paginationId = "pagination";
    const apiBase = "/api/sensors/advanced";

    if (!pageSizeSelect || !pagination) {
        console.warn("Không tìm thấy các phần tử cần thiết trên trang này.");
        return;
    }

    // Spinner
    function showSpinner() {
        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.style.display = "flex";
    }
    function hideSpinner() {
        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.style.display = "none";
    }

    // Xử lý dữ liệu bảng
    function processSensorData(item) {
        return `<tr>
            <td>${item.id}</td>
            <td>${item.temperature}</td>
            <td>${item.humidity}</td>
            <td>${item.light}</td>
            <td>${item.wind !== undefined ? item.wind : ""}</td>
            <td>${item.timestamp}</td>
        </tr>`;
    }

    // Fetch và render bảng
    function fetchData(apiUrl) {
        showSpinner();
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                const tbody = document.getElementById(tableId)?.querySelector("tbody");
                if (!tbody) return;
                const items = data.data || [];
                tbody.innerHTML = items.length
                    ? items.map(processSensorData).join("")
                    : `<tr><td colspan="6" class="text-center">Không có dữ liệu để hiển thị</td></tr>`;
                renderPagination(data.pagination);
            })
            .catch(error => console.error(`Lỗi khi lấy dữ liệu từ ${apiUrl}:`, error))
            .finally(hideSpinner);
    }

    // Phân trang
    function renderPagination(paginationData) {
        const pagination = document.getElementById(paginationId);
        pagination.innerHTML = "";
        if (!paginationData || !paginationData.totalPages) return;
        const { totalPages, currentPage } = paginationData;
        const maxVisiblePages = 5;
        const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        function createPageLi(page, text, active = false) {
            const li = document.createElement("li");
            li.className = `page-item${active ? " active" : ""}`;
            const a = document.createElement("a");
            a.className = "page-link";
            a.href = "#";
            a.dataset.page = page;
            a.textContent = text;
            li.appendChild(a);
            return li;
        }

        if (currentPage > 1) pagination.appendChild(createPageLi(currentPage - 1, "«"));
        for (let i = startPage; i <= endPage; i++) {
            pagination.appendChild(createPageLi(i, i, i === currentPage));
        }
        if (currentPage < totalPages) pagination.appendChild(createPageLi(currentPage + 1, "»"));
    }

    // Sắp xếp bảng
    function attachSortEvents() {
        document.querySelectorAll(`#${tableId} .sortButton`).forEach(button => {
            button.addEventListener("click", function () {
                const column = this.getAttribute("data-column");
                const currentOrder = this.getAttribute("data-order");
                const newOrder = currentOrder === "asc" ? "desc" : "asc";
                this.setAttribute("data-order", newOrder);
                loadSensorData({ sort: column, order: newOrder });
            });
        });
    }

    // Load dữ liệu bảng
    function loadSensorData(options = {}) {
        const pageSize = pageSizeSelect.value;
        const column = columnSelect.value;
        const query = searchInput.value.trim();
        let apiUrl = `${apiBase}?limit=${pageSize}`;
        if (query && column) {
            apiUrl += `&searchField=${encodeURIComponent(column)}&searchValue=${encodeURIComponent(query)}`;
        }
        if (options.sort && options.order) {
            apiUrl += `&sort=${encodeURIComponent(options.sort)}&order=${encodeURIComponent(options.order)}`;
        }
        fetchData(apiUrl);
    }

    // Sự kiện phân trang
    pagination.addEventListener("click", function (event) {
        if (event.target.tagName === "A") {
            event.preventDefault();
            const page = event.target.dataset.page;
            if (page) {
                const pageSize = pageSizeSelect.value;
                const column = columnSelect.value;
                const query = searchInput.value.trim();
                let apiUrl = `${apiBase}?page=${page}&limit=${pageSize}`;
                if (query && column) {
                    apiUrl += `&searchField=${encodeURIComponent(column)}&searchValue=${encodeURIComponent(query)}`;
                }
                fetchData(apiUrl);
            }
        }
    });

    // Sự kiện tìm kiếm, page size
    searchInput.addEventListener("input", () => loadSensorData());
    pageSizeSelect.addEventListener("change", () => loadSensorData());

    // Sắp xếp
    attachSortEvents();

    // Nút reset
    resetButton.addEventListener("click", function () {
        if (confirm("Bạn có chắc chắn muốn reset bảng sensors?")) {
            fetch("/api/sensors/reset", { method: "POST" })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        loadSensorData();
                    } else {
                        alert("Lỗi khi reset bảng sensors!");
                    }
                })
                .catch(error => console.error("Lỗi khi gọi API reset bảng sensors:", error));
        }
    });

    // Tải dữ liệu khi trang được tải
    loadSensorData();
});