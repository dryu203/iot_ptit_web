function showSpinner() {
    const spinner = document.getElementById("spinner-overlay");
    if (spinner) spinner.style.display = "flex";
}
function hideSpinner() {
    const spinner = document.getElementById("spinner-overlay");
    if (spinner) spinner.style.display = "none";
}
window.fetchData = function (apiUrl, tableId, paginationId, processData) {
    showSpinner();
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById(tableId)?.querySelector("tbody");
            if (!tbody) return;
            tbody.innerHTML = "";
            const items = data.data || data.devicesHistory || [];
            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center">Không có dữ liệu để hiển thị</td></tr>`;
            } else {
                items.forEach(item => {
                    tbody.innerHTML += processData(item);
                });
            }
            const pagination = document.getElementById(paginationId);
            pagination.innerHTML = "";
            if (data.pagination && data.pagination.totalPages) {
                const { totalPages, currentPage } = data.pagination;
                const maxVisiblePages = 5;
                const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                if (currentPage > 1) {
                    const prevLi = document.createElement("li");
                    prevLi.className = "page-item";
                    const prevA = document.createElement("a");
                    prevA.className = "page-link";
                    prevA.href = "#";
                    prevA.dataset.page = currentPage - 1;
                    prevA.textContent = "«";
                    prevLi.appendChild(prevA);
                    pagination.appendChild(prevLi);
                }
                for (let i = startPage; i <= endPage; i++) {
                    const li = document.createElement("li");
                    li.className = `page-item ${i === currentPage ? "active" : ""}`;
                    const a = document.createElement("a");
                    a.className = "page-link";
                    a.href = "#";
                    a.dataset.page = i;
                    a.textContent = i;
                    li.appendChild(a);
                    pagination.appendChild(li);
                }
                if (currentPage < totalPages) {
                    const nextLi = document.createElement("li");
                    nextLi.className = "page-item";
                    const nextA = document.createElement("a");
                    nextA.className = "page-link";
                    nextA.href = "#";
                    nextA.dataset.page = currentPage + 1;
                    nextA.textContent = "»";
                    nextLi.appendChild(nextA);
                    pagination.appendChild(nextLi);
                }
            }
        })
        .catch(error => console.error(`Lỗi khi lấy dữ liệu từ ${apiUrl}:`, error))
        .finally(() => hideSpinner());
};
window.processSensorData = function (item) {
    return `<tr>
        <td>${item.id}</td>
        <td>${item.temperature}</td>
        <td>${item.humidity}</td>
        <td>${item.light}</td>
        <td>${item.wind !== undefined ? item.wind : ""}</td>
        <td>${item.timestamp}</td>
    </tr>`;
};
window.processDeviceData = function (item) {
    return `<tr>
        <td>${item.id}</td>
        <td>${item.device_name}</td>
        <td>${item.status}</td>
        <td>${item.timestamp}</td>
    </tr>`;
};
window.attachSortEvents = function (tableId, apiUrl, processData) {
    const sortButtons = document.querySelectorAll(`#${tableId} .sortButton`);
    sortButtons.forEach(button => {
        button.addEventListener("click", function () {
            const column = this.getAttribute("data-column");
            const currentOrder = this.getAttribute("data-order");
            const newOrder = currentOrder === "asc" ? "desc" : "asc";
            this.setAttribute("data-order", newOrder);
            const pageSize = document.getElementById("pageSize").value;
            const query = document.getElementById("searchInput")?.value.trim() || "";
            let sortedApiUrl = `${apiUrl}?limit=${pageSize}&sort=${column}&order=${newOrder}`;
            if (query) {
                sortedApiUrl += `&searchField=${encodeURIComponent(column)}&searchValue=${encodeURIComponent(query)}`;
            }
            fetchData(sortedApiUrl, tableId, "pagination", processData);
        });
    });
};