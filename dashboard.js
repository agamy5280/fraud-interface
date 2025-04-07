document.addEventListener("DOMContentLoaded", function () {
  let excelData = {
    fraudCases: [],
    clientInfo: [],
    accountInfo: [],
    directChannel: [],
    bankServices: [],
    cards: [],
  };
  let currentTab = "fraudCases";
  let currentPage = 0;
  let rowsPerPage = 10;
  let filteredData = [];

  let columnMappings = {
    fraudCases: {},
    clientInfo: {},
    accountInfo: {},
    directChannel: {},
    bankServices: {},
    cards: {},
  };

  let reverseColumnMappings = {
    fraudCases: {},
    clientInfo: {},
    accountInfo: {},
    directChannel: {},
    bankServices: {},
    cards: {},
  };

  const fileUpload = document.getElementById("fileUpload");
  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const tabs = document.getElementById("tabs").querySelectorAll(".tab");
  const tableContainer = document.getElementById("tableContainer");
  const paginationInfo = document.getElementById("paginationInfo");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageButtons = document.getElementById("pageButtons");
  const rowsPerPageSelect = document.getElementById("rowsPerPageSelect");

  function normalizeColumnName(columnName) {
    if (!columnName) return "Column";

    const columnMapping = {
      "In Case of (Unauthorized), was there a Sim Swap\nفي حال تمت من قبل المحتال (unauthorized) هل تمت من خلالها استبدال شرائح الاتصال":
        "Sim Swap Occurred",
      "Was the device used to log in into the digital channels  previously used to perform any undisputed / normal course of business transactions before the fraud case ?\nهل الجهاز المستخدم في عملية الدخول على الخدمات الإلكترونية تم منه تنفيذ عمليات مالية غبر معترض عليها قبل تنفيذ عمليات الاحتيال":
        "Previous Normal Transactions",
      "Case done by: Fraudster (Unauthorized) or Client (Authorized)\nهل تم تنفيذ الحالة من قبل (العميل، المحتال)":
        "Case Executed By",
      "Is there screen sharing during fraud case? هل توجد مشاركة شاشة أثناء حالة الاحتيال؟":
        "Screen Sharing During Fraud",
      "Did The Client Notify The Law Inforcment": "Law Enforcement Notified",
      " Case done by: Fraudster (Unauthorized) or Client (Authorized)\nهل تم تنفيذ الحالة من قبل (العميل، المحتال)\n":
        "Case Executed By",
    };

    if (columnMapping[columnName]) {
      return columnMapping[columnName];
    }

    if (columnName.includes("\n") || /[\u0600-\u06FF]/.test(columnName)) {
      const cleanedName = columnName.split("\n")[0].trim();
      return cleanedName;
    }

    return columnName.trim();
  }

  const navigationMap = {
    "Number of Fraud Transactions": {
      fromTab: "fraudCases",
      toTab: "directChannel",
      linkField: "SAMA's Case Serial Number",
      alternateFields: [
        "SAMA Case Serial Number",
        "SAMA Case ID",
        "SAMA ID",
        "Case Serial Number",
      ],
    },
    "Transaction ID (Unique)": [
      {
        fromTab: "fraudCases",
        toTab: "cards",
        linkField: "Transaction ID (Unique)",
      },
      {
        fromTab: "directChannel",
        toTab: "cards",
        linkField: "Transaction ID (Unique)",
      },
      {
        fromTab: "cards",
        toTab: "directChannel",
        linkField: "Transaction ID (Unique)",
      },
    ],
    "E-Services Session ID": [
      {
        fromTab: "directChannel",
        toTab: "bankServices",
        linkField: "E-Services Session ID",
      },
      {
        fromTab: "bankServices",
        toTab: "directChannel",
        linkField: "E-Services Session ID",
      },
    ],
    "Client's National/Residency/Commercial ID": [
      {
        fromTab: "fraudCases",
        toTab: "clientInfo",
        linkField: "Client's National/Residency/Commercial ID",
      },
      {
        fromTab: "clientInfo",
        toTab: "fraudCases",
        linkField: "Client's National/Residency/Commercial ID",
      },
      {
        fromTab: "accountInfo",
        toTab: "clientInfo",
        linkField: "Client's National/Residency/Commercial ID",
      },
    ],
    "Beneficiary's National/Residency/Commercial ID": {
      fromTab: "directChannel",
      toTab: "clientInfo",
      linkField: "Client's National/Residency/Commercial ID",
    },
  };

  const tabKeys = {
    fraudCases: 0,
    clientInfo: 1,
    accountInfo: 2,
    directChannel: 3,
    bankServices: 4,
    cards: 5,
  };

  fileUpload.addEventListener("change", handleFileUpload);
  searchButton.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.getAttribute("data-tab");
      changeTab(tabName);
    });
  });

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  });

  nextPageBtn.addEventListener("click", () => {
    const maxPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < maxPages - 1) {
      goToPage(currentPage + 1);
    }
  });

  rowsPerPageSelect.addEventListener("change", function () {
    rowsPerPage = parseInt(this.value);
    currentPage = 0;
    renderTable();
  });

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showLoading();

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, {
          type: "binary",
          cellStyles: true,
          cellFormulas: true,
          cellDates: true,
        });

        excelData.fraudCases =
          processSheetData(workbook, "2- Fraud Cases", "fraudCases") ||
          processSheetData(workbook, "Fraud Cases", "fraudCases") ||
          processSheetData(workbook, "2-Fraud Cases", "fraudCases") ||
          [];

        excelData.clientInfo =
          processSheetData(workbook, "3.1- Client Info", "clientInfo") ||
          processSheetData(workbook, "Client Info", "clientInfo") ||
          processSheetData(workbook, "3.1-Client Info", "clientInfo") ||
          [];

        excelData.accountInfo =
          processSheetData(workbook, "3.2- Account Info", "accountInfo") ||
          processSheetData(workbook, "Account Info", "accountInfo") ||
          processSheetData(workbook, "3.2-Account Info", "accountInfo") ||
          [];

        excelData.directChannel =
          processSheetData(workbook, "4- Direct Channel", "directChannel") ||
          processSheetData(workbook, "Direct Channel", "directChannel") ||
          processSheetData(workbook, "4-Direct Channel", "directChannel") ||
          [];

        excelData.bankServices =
          processSheetData(workbook, "4.1- Bank Services", "bankServices") ||
          processSheetData(workbook, "Bank Services", "bankServices") ||
          processSheetData(workbook, "4.1-Bank Services", "bankServices") ||
          [];

        excelData.cards =
          processSheetData(workbook, "4.2- Cards", "cards") ||
          processSheetData(workbook, "Cards", "cards") ||
          processSheetData(workbook, "4.2-Cards", "cards") ||
          [];

        filteredData = excelData[currentTab];
        currentPage = 0;
        renderTable();
      } catch (error) {
        console.error("Error processing file:", error);
        tableContainer.innerHTML =
          '<div class="loading">Error processing the Excel file: ' +
          error.message +
          "</div>";
      }
    };

    reader.onerror = () => {
      tableContainer.innerHTML =
        '<div class="loading">Error reading file</div>';
    };

    reader.readAsBinaryString(file);
  }

  function processSheetData(workbook, sheetName, tabName) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return null;

    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (rawData.length < 2) return [];

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      if (
        rawData[i] &&
        rawData[i].some((cell) => cell && String(cell).trim() !== "")
      ) {
        headerRowIndex = i;
        break;
      }
    }

    headerRowIndex++;
    if (headerRowIndex >= rawData.length) {
      headerRowIndex = Math.max(0, rawData.length - 1);
    }

    columnMappings[tabName] = {};
    reverseColumnMappings[tabName] = {};

    const headerRow = rawData[headerRowIndex].map((header, index) => {
      if (header && String(header).trim() !== "") {
        const originalHeader = String(header).trim();
        const normalizedHeader = normalizeColumnName(originalHeader);

        columnMappings[tabName][originalHeader] = normalizedHeader;
        reverseColumnMappings[tabName][normalizedHeader] = originalHeader;

        return normalizedHeader;
      } else {
        return `Column_${index}`;
      }
    });

    const processedData = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row.some((cell) => cell && String(cell).trim() !== ""))
        continue;

      const rowData = {};
      headerRow.forEach((normalizedHeader, colIndex) => {
        rowData[normalizedHeader] =
          row[colIndex] !== undefined ? row[colIndex] : "";
      });
      processedData.push(rowData);
    }

    return processedData;
  }

  function handleSearch() {
    const searchText = searchInput.value.trim().toLowerCase();

    if (!searchText) {
      filteredData = excelData[currentTab] || [];
    } else {
      filteredData = (excelData[currentTab] || []).filter((row) => {
        return Object.values(row).some(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(searchText)
        );
      });
    }

    currentPage = 0;
    renderTable();
  }

  function changeTab(tabName) {
    tabs.forEach((tab) => {
      if (tab.getAttribute("data-tab") === tabName) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });

    currentTab = tabName;
    filteredData = excelData[currentTab] || [];
    currentPage = 0;
    renderTable();
  }

  function navigateToTab(tabName, filterField, filterValue, dataRow) {
    if (
      currentTab === "fraudCases" &&
      tabName === "directChannel" &&
      filterField === "SAMA's Case Serial Number"
    ) {
      let samaID = null;
      const currentRow =
        dataRow ||
        filteredData.find(
          (row) => row["Number of Fraud Transactions"] === filterValue
        );

      if (currentRow) {
        const possibleSAMAFields = [
          "SAMA's Case Serial Number",
          "SAMA Case Serial Number",
          "SAMA Case ID",
          "Case Serial Number",
          "SAMA Case Number",
          "SAMA ID",
        ];

        for (const fieldName of possibleSAMAFields) {
          if (
            currentRow[fieldName] !== undefined &&
            currentRow[fieldName] !== null &&
            currentRow[fieldName] !== ""
          ) {
            samaID = currentRow[fieldName];
            break;
          }
        }
      }

      if (samaID) {
        changeTab(tabName);

        const possibleTargetFields = [
          "SAMA's Case Serial Number",
          "SAMA Case Serial Number",
          "SAMA Case ID",
          "Case Serial Number",
          "SAMA Case Number",
          "SAMA ID",
        ];

        let matchingRows = [];

        for (const fieldName of possibleTargetFields) {
          const matches = (excelData[tabName] || []).filter((row) => {
            if (!row[fieldName]) return false;
            return String(row[fieldName]) === String(samaID);
          });

          if (matches.length > 0) {
            matchingRows = matches;
            break;
          }
        }

        if (matchingRows.length === 0) {
          matchingRows = (excelData[tabName] || []).filter((row) => {
            return Object.entries(row).some(([key, value]) => {
              return String(value) === String(samaID);
            });
          });
        }

        filteredData = matchingRows;
        currentPage = 0;
        renderTable();

        tabs.forEach((tab) => {
          if (tab.getAttribute("data-tab") === tabName) {
            tab.classList.add("active");
          } else {
            tab.classList.remove("active");
          }
        });

        return;
      }
    }

    changeTab(tabName);

    if (filterField && filterValue !== undefined) {
      const stringFilterValue = String(filterValue);
      let matchingRows = (excelData[tabName] || []).filter((row) => {
        if (!row[filterField]) return false;
        return String(row[filterField]) === stringFilterValue;
      });

      filteredData = matchingRows;
    } else {
      filteredData = excelData[tabName] || [];
    }

    currentPage = 0;
    renderTable();

    tabs.forEach((tab) => {
      if (tab.getAttribute("data-tab") === tabName) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  function goToPage(page) {
    currentPage = page;
    renderTable();
  }

  function isClickable(column, cellValue) {
    if (!cellValue) return false;

    let navRule = navigationMap[column];

    if (!navRule && reverseColumnMappings[currentTab][column]) {
      navRule = navigationMap[reverseColumnMappings[currentTab][column]];
    }

    if (!navRule) return false;

    if (Array.isArray(navRule)) {
      return navRule.some((rule) => rule.fromTab === currentTab);
    } else {
      return navRule.fromTab === currentTab;
    }
  }

  function getNavigationTarget(column, cellValue, rowIndex) {
    let navRule = navigationMap[column];

    if (!navRule && reverseColumnMappings[currentTab][column]) {
      navRule = navigationMap[reverseColumnMappings[currentTab][column]];
    }

    if (!navRule) return null;

    if (
      column === "Number of Fraud Transactions" &&
      currentTab === "fraudCases"
    ) {
      const currentRow = filteredData[rowIndex];
      let samaID = null;
      const possibleSAMAFields = [
        "SAMA's Case Serial Number",
        "SAMA Case Serial Number",
        "SAMA Case ID",
        "Case Serial Number",
        "SAMA Case Number",
        "SAMA ID",
      ];

      for (const fieldName of possibleSAMAFields) {
        if (
          currentRow &&
          currentRow[fieldName] &&
          currentRow[fieldName] !== ""
        ) {
          samaID = currentRow[fieldName];
          break;
        }
      }

      return {
        toTab: "directChannel",
        linkField: "SAMA's Case Serial Number",
        value: cellValue,
        dataRow: currentRow,
      };
    }

    if (Array.isArray(navRule)) {
      const applicableRule = navRule.find(
        (rule) => rule.fromTab === currentTab
      );
      if (applicableRule) {
        return {
          toTab: applicableRule.toTab,
          linkField: applicableRule.linkField,
          value: cellValue,
        };
      }
    } else if (navRule && navRule.fromTab === currentTab) {
      return {
        toTab: navRule.toTab,
        linkField: navRule.linkField,
        value: cellValue,
      };
    }

    return null;
  }

  function renderTable() {
    if (!filteredData || filteredData.length === 0) {
      tableContainer.innerHTML = '<div class="loading">No data available</div>';
      updatePagination(0, 0, 0);
      return;
    }

    const columnSet = new Set();
    filteredData.forEach((row) => {
      Object.keys(row).forEach((key) => columnSet.add(key));
    });
    const columns = Array.from(columnSet);

    const start = currentPage * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);

    window.currentColumns = columns;
    window.currentPageData = pageData;
    window.currentStart = start;

    createResponsiveTables(pageData, columns, start);

    updatePagination(
      start + 1,
      Math.min(end, filteredData.length),
      filteredData.length
    );
  }

  function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updatePagination(start, end, total) {
    paginationInfo.textContent =
      total === 0 ? "No items" : `Showing ${start}-${end} of ${total} items`;

    prevPageBtn.disabled = currentPage === 0;

    const maxPages = Math.ceil(total / rowsPerPage);
    nextPageBtn.disabled = currentPage >= maxPages - 1;

    pageButtons.innerHTML = "";

    const maxPageButtons = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(maxPages - 1, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(0, endPage - maxPageButtons + 1);
    }

    if (startPage > 0) {
      const pageButton = document.createElement("button");
      pageButton.textContent = "1";
      pageButton.addEventListener("click", () => goToPage(0));
      pageButtons.appendChild(pageButton);

      if (startPage > 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        pageButtons.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement("button");
      pageButton.textContent = i + 1;
      if (i === currentPage) {
        pageButton.classList.add("active");
      }
      pageButton.addEventListener("click", () => goToPage(i));
      pageButtons.appendChild(pageButton);
    }

    if (endPage < maxPages - 1) {
      if (endPage < maxPages - 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        pageButtons.appendChild(ellipsis);
      }

      const pageButton = document.createElement("button");
      pageButton.textContent = maxPages;
      pageButton.addEventListener("click", () => goToPage(maxPages - 1));
      pageButtons.appendChild(pageButton);
    }
  }

  function showLoading() {
    tableContainer.innerHTML =
      '<div class="loading"><div class="spinner"></div></div>';
  }

  function createResponsiveTables(pageData, columns, startIndex) {
    if (window.innerWidth <= 768) {
      let tableHTML = '<table class="mobile-table-view"><tbody>';

      pageData.forEach((row, rowIndex) => {
        const actualRowIndex = startIndex + rowIndex;
        tableHTML += `<tr data-row-index="${actualRowIndex}">`;

        columns.forEach((column) => {
          const cellValue = row[column];
          const displayValue =
            cellValue !== undefined && cellValue !== null
              ? escapeHtml(cellValue)
              : "";

          if (isClickable(column, cellValue)) {
            const navTarget = getNavigationTarget(
              column,
              cellValue,
              actualRowIndex
            );
            if (navTarget) {
              tableHTML += `
                            <td data-label="${escapeHtml(column)}">
                                <a href="#" class="clickable" 
                                    data-to-tab="${escapeHtml(
                                      navTarget.toTab
                                    )}" 
                                    data-link-field="${escapeHtml(
                                      navTarget.linkField
                                    )}" 
                                    data-value="${escapeHtml(navTarget.value)}"
                                    data-row-index="${actualRowIndex}">
                                    ${displayValue} ↗
                                </a>
                            </td>
                        `;
            } else {
              tableHTML += `<td data-label="${escapeHtml(
                column
              )}">${displayValue}</td>`;
            }
          } else {
            tableHTML += `<td data-label="${escapeHtml(
              column
            )}">${displayValue}</td>`;
          }
        });

        tableHTML += "</tr>";
      });

      tableHTML += "</tbody></table>";
      tableContainer.innerHTML = tableHTML;
    } else {
      let tableHTML = `
            <table>
                <thead>
                    <tr>
                        ${columns
                          .map((col) => `<th>${escapeHtml(col)}</th>`)
                          .join("")}
                    </tr>
                </thead>
                <tbody>
        `;

      pageData.forEach((row, rowIndex) => {
        const actualRowIndex = startIndex + rowIndex;
        tableHTML += `<tr data-row-index="${actualRowIndex}">`;

        columns.forEach((column) => {
          const cellValue = row[column];
          const displayValue =
            cellValue !== undefined && cellValue !== null
              ? escapeHtml(cellValue)
              : "";

          if (isClickable(column, cellValue)) {
            const navTarget = getNavigationTarget(
              column,
              cellValue,
              actualRowIndex
            );
            if (navTarget) {
              tableHTML += `
                            <td>
                                <a href="#" class="clickable" 
                                    data-to-tab="${escapeHtml(
                                      navTarget.toTab
                                    )}" 
                                    data-link-field="${escapeHtml(
                                      navTarget.linkField
                                    )}" 
                                    data-value="${escapeHtml(navTarget.value)}"
                                    data-row-index="${actualRowIndex}">
                                    ${displayValue} ↗
                                </a>
                            </td>
                        `;
            } else {
              tableHTML += `<td>${displayValue}</td>`;
            }
          } else {
            tableHTML += `<td>${displayValue}</td>`;
          }
        });

        tableHTML += "</tr>";
      });

      tableHTML += `
                </tbody>
            </table>
        `;

      tableContainer.innerHTML = tableHTML;
    }

    document.querySelectorAll(".clickable").forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        const toTab = this.getAttribute("data-to-tab");
        const linkField = this.getAttribute("data-link-field");
        const value = this.getAttribute("data-value");
        const rowIndex = parseInt(this.getAttribute("data-row-index"));

        const rowData = filteredData[rowIndex];
        navigateToTab(toTab, linkField, value, rowData);
      });
    });
  }

  window.addEventListener("resize", function () {
    if (window.currentTabData && window.currentHeaders) {
      createResponsiveTables(
        window.currentTabData,
        window.currentHeaders,
        "tableContainer"
      );
    }
  });
});
