document.addEventListener("DOMContentLoaded", function () {
  // Data state variables
  let excelData = {
    fraudCases: [],
    clientInfo: [],
    accountInfo: [],
    directChannel: [],
    bankServices: [],
    cards: [],
  };
  // New: Store sorted data for each tab
  let sortedExcelData = {
    fraudCases: null,
    clientInfo: null,
    accountInfo: null,
    directChannel: null,
    bankServices: null,
    cards: null,
  };
  let currentTab = "fraudCases";
  let currentPage = 0;
  let rowsPerPage = 10;
  let filteredData = [];
  let sortConfig = {
    column: null,
    direction: "asc",
  };
  // New: Flag to indicate if global sorting is active
  let globalSortActive = false;
  let activeFilters = {};

  // Column mapping for multilingual/complex headers
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

  // Define important columns for each tab for filtering
  const keyColumnsForFiltering = {
    fraudCases: [
      "SAMA's Case Serial Number",
      "Case Type",
      "Amount",
      "Case Date",
      "Case Executed By",
    ],
    clientInfo: [
      "Client's National/Residency/Commercial ID",
      "Client Status",
      "City",
    ],
    accountInfo: ["Account Number", "Account Type", "Branch"],
    directChannel: [
      "Transaction ID (Unique)",
      "Transaction Amount",
      "Transaction Status",
      "Payment Method",
    ],
    bankServices: ["E-Services Session ID", "IP Address", "Browser"],
    cards: ["Card Number", "Card Type", "Transaction Amount"],
  };

  // Navigation mapping for linked data
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

  // DOM elements
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
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  // Event Listeners
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

  clearFiltersBtn.addEventListener("click", clearAllFilters);

  // Utility functions
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

  function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Core functionality
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

        // Reset sorted data on new file upload
        resetSortedData();

        filteredData = excelData[currentTab];
        currentPage = 0;
        activeFilters = {};
        globalSortActive = false;
        sortConfig = { column: null, direction: "asc" };
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

  // New: Function to reset sorted data
  function resetSortedData() {
    Object.keys(sortedExcelData).forEach((key) => {
      sortedExcelData[key] = null;
    });
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

    // Reset activeFilters when performing a new search
    activeFilters = {};

    // Get source data based on whether we have sorted data or not
    const sourceData =
      globalSortActive && sortedExcelData[currentTab]
        ? sortedExcelData[currentTab]
        : excelData[currentTab] || [];

    if (!searchText) {
      filteredData = sourceData;
    } else {
      filteredData = sourceData.filter((row) => {
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

    // Reset filters but keep sortConfig when changing tabs
    activeFilters = {};

    // Use sorted data if global sort is active, otherwise use original data
    if (globalSortActive && sortedExcelData[tabName]) {
      filteredData = sortedExcelData[tabName];
    } else {
      filteredData = excelData[tabName] || [];
    }

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
        // Reset filters when navigating
        activeFilters = {};
        // Don't reset sort config

        changeTab(tabName);

        const possibleTargetFields = [
          "SAMA's Case Serial Number",
          "SAMA Case Serial Number",
          "SAMA Case ID",
          "Case Serial Number",
          "SAMA Case Number",
          "SAMA ID",
        ];

        // Get source data based on whether we have sorted data or not
        const sourceData =
          globalSortActive && sortedExcelData[tabName]
            ? sortedExcelData[tabName]
            : excelData[tabName] || [];

        let matchingRows = [];

        for (const fieldName of possibleTargetFields) {
          const matches = sourceData.filter((row) => {
            if (!row[fieldName]) return false;
            return String(row[fieldName]) === String(samaID);
          });

          if (matches.length > 0) {
            matchingRows = matches;
            break;
          }
        }

        if (matchingRows.length === 0) {
          matchingRows = sourceData.filter((row) => {
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

    // Reset filters when navigating
    activeFilters = {};
    // Don't reset sort config

    changeTab(tabName);

    if (filterField && filterValue !== undefined) {
      // Get source data based on whether we have sorted data or not
      const sourceData =
        globalSortActive && sortedExcelData[tabName]
          ? sortedExcelData[tabName]
          : excelData[tabName] || [];

      const stringFilterValue = String(filterValue);
      let matchingRows = sourceData.filter((row) => {
        if (!row[filterField]) return false;
        return String(row[filterField]) === stringFilterValue;
      });

      filteredData = matchingRows;
    } else {
      filteredData =
        globalSortActive && sortedExcelData[tabName]
          ? sortedExcelData[tabName]
          : excelData[tabName] || [];
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

  // Modified: sortData function to maintain sorting across all tabs
  function sortData(column) {
    // Toggle direction if clicking the same column
    if (sortConfig.column === column) {
      sortConfig.direction = sortConfig.direction === "asc" ? "desc" : "asc";
    } else {
      sortConfig.column = column;
      sortConfig.direction = "asc";
    }

    // Set global sort active
    globalSortActive = true;

    // Helper function to sort array by column
    function sortArrayByColumn(array, sortColumn, direction) {
      return [...array].sort((a, b) => {
        const valA =
          a[sortColumn] !== undefined && a[sortColumn] !== null
            ? a[sortColumn]
            : "";
        const valB =
          b[sortColumn] !== undefined && b[sortColumn] !== null
            ? b[sortColumn]
            : "";

        // Check if values can be converted to numbers
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        let comparison = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          // Sort numerically
          comparison = numA - numB;
        } else {
          // Sort alphabetically
          comparison = String(valA).localeCompare(String(valB));
        }

        return direction === "asc" ? comparison : -comparison;
      });
    }

    // First, sort the current tab by the selected column
    sortedExcelData[currentTab] = sortArrayByColumn(
      excelData[currentTab],
      column,
      sortConfig.direction
    );

    // Create a relationship mapping based on SAMA's Case Serial Number or similar ID fields
    const relationshipMap = new Map();
    const keyFieldsList = [
      "SAMA's Case Serial Number",
      "SAMA Case Serial Number",
      "SAMA Case ID",
      "Case Serial Number",
      "SAMA Case Number",
      "SAMA ID",
      "Client's National/Residency/Commercial ID",
      "Transaction ID (Unique)",
      "E-Services Session ID",
    ];

    // Find which key field exists in the current tab
    let keyField = null;
    for (const field of keyFieldsList) {
      if (sortedExcelData[currentTab].some((row) => row[field] !== undefined)) {
        keyField = field;
        break;
      }
    }

    // If we found a key field, build a relationship map
    if (keyField) {
      // Build a map of order positions by ID
      sortedExcelData[currentTab].forEach((row, index) => {
        if (
          row[keyField] !== undefined &&
          row[keyField] !== null &&
          row[keyField] !== ""
        ) {
          relationshipMap.set(String(row[keyField]), index);
        }
      });

      // Sort other tabs based on the relationship map
      Object.keys(excelData).forEach((tabName) => {
        if (
          tabName !== currentTab &&
          excelData[tabName] &&
          excelData[tabName].length > 0
        ) {
          let keyFieldInTab = null;

          // Find which key field exists in this tab
          for (const field of keyFieldsList) {
            if (excelData[tabName].some((row) => row[field] !== undefined)) {
              keyFieldInTab = field;
              break;
            }
          }

          if (keyFieldInTab) {
            // Sort this tab according to the relationship map
            sortedExcelData[tabName] = [...excelData[tabName]].sort((a, b) => {
              const aVal =
                a[keyFieldInTab] !== undefined && a[keyFieldInTab] !== null
                  ? String(a[keyFieldInTab])
                  : "";
              const bVal =
                b[keyFieldInTab] !== undefined && b[keyFieldInTab] !== null
                  ? String(b[keyFieldInTab])
                  : "";

              const aPos = relationshipMap.has(aVal)
                ? relationshipMap.get(aVal)
                : Number.MAX_SAFE_INTEGER;
              const bPos = relationshipMap.has(bVal)
                ? relationshipMap.get(bVal)
                : Number.MAX_SAFE_INTEGER;

              // Sort first by relationship
              if (aPos !== bPos) {
                return aPos - bPos;
              }

              // If no relationship or same position, try to sort by the original column if it exists
              if (a[column] !== undefined && b[column] !== undefined) {
                const numA = parseFloat(a[column]);
                const numB = parseFloat(b[column]);

                if (!isNaN(numA) && !isNaN(numB)) {
                  return sortConfig.direction === "asc"
                    ? numA - numB
                    : numB - numA;
                } else {
                  const strComp = String(a[column]).localeCompare(
                    String(b[column])
                  );
                  return sortConfig.direction === "asc" ? strComp : -strComp;
                }
              }

              // As a fallback, maintain original order
              return 0;
            });
          } else {
            // If tab doesn't have a relationship field, sort by the column if it exists
            if (excelData[tabName].some((row) => row[column] !== undefined)) {
              sortedExcelData[tabName] = sortArrayByColumn(
                excelData[tabName],
                column,
                sortConfig.direction
              );
            } else {
              // Otherwise keep original order
              sortedExcelData[tabName] = [...excelData[tabName]];
            }
          }
        }
      });
    } else {
      // Fallback to original approach if no key field is found
      Object.keys(excelData).forEach((tabName) => {
        if (
          tabName !== currentTab &&
          excelData[tabName] &&
          excelData[tabName].length > 0
        ) {
          if (excelData[tabName].some((row) => row[column] !== undefined)) {
            sortedExcelData[tabName] = sortArrayByColumn(
              excelData[tabName],
              column,
              sortConfig.direction
            );
          } else {
            sortedExcelData[tabName] = [...excelData[tabName]];
          }
        }
      });
    }

    // Update current filtered data with sorted data
    filteredData = sortedExcelData[currentTab] || [];

    currentPage = 0;
    renderTable();

    // Update UI to show global sort is active
    updateGlobalSortIndicator(true, column, keyField);
  }

  // New: Update UI to show global sort is active
  // Updated: Update UI to show global sort is active with fixed position
  // Updated: Update UI to show global sort is active with fixed position
  function updateGlobalSortIndicator(isActive, column, relationshipField) {
    // Remove any existing indicator
    const existingIndicator = document.getElementById("globalSortIndicator");
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (isActive) {
      // Create a fixed container for the indicator
      const indicator = document.createElement("div");
      indicator.id = "globalSortIndicator";
      indicator.className = "global-sort-indicator";

      let indicatorText = `Global sort by "${column}" ${
        sortConfig.direction === "asc" ? "↑" : "↓"
      }`;
      if (relationshipField) {
        indicatorText += ` (preserving relationships by ${relationshipField})`;
      }
      indicator.innerHTML = indicatorText + " active";

      // Add a style tag if not already present
      if (!document.getElementById("globalSortStyles")) {
        const style = document.createElement("style");
        style.id = "globalSortStyles";
        style.textContent = `
        .global-sort-indicator {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          background-color: #e3f2fd;
          color: #0d47a1;
          font-size: 0.85rem;
          font-weight: bold;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1001;
          text-align: center;
          padding: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        /* Add padding to body to prevent content from being hidden under the fixed indicator */
        body.has-global-sort {
          padding-top: 40px;
        }
      `;
        document.head.appendChild(style);
      }

      // Add to body instead of table container so it persists across tab changes
      document.body.appendChild(indicator);

      // Add class to body for padding
      document.body.classList.add("has-global-sort");
    } else {
      // Remove body class when indicator is removed
      document.body.classList.remove("has-global-sort");
    }
  }

  function detectDateColumn(columnName) {
    const datePatterns = [
      "date",
      "time",
      "created",
      "updated",
      "when",
      "day",
      "month",
      "year",
    ];

    if (
      datePatterns.some((pattern) => columnName.toLowerCase().includes(pattern))
    ) {
      return true;
    }

    return false;
  }

  function detectAmountColumn(columnName) {
    const amountPatterns = [
      "amount",
      "total",
      "balance",
      "money",
      "price",
      "cost",
      "fee",
      "salary",
      "payment",
      "revenue",
      "expense",
      "profit",
      "loss",
      "sar",
      "usd",
      "eur",
      "gbp",
      "jpy",
      "budget",
      "frozen",
      "held",
      "value",
      "fund",
    ];

    const lowercaseCol = columnName.toLowerCase();

    if (amountPatterns.some((pattern) => lowercaseCol.includes(pattern))) {
      return true;
    }

    if (/[$€£¥]/.test(columnName) || /\(\s*sar\s*\)/i.test(columnName)) {
      return true;
    }

    return false;
  }

  function applyAmountRangeFilter(column, minAmount, maxAmount) {
    if ((!minAmount || minAmount === "") && (!maxAmount || maxAmount === "")) {
      delete activeFilters[column];
    } else {
      activeFilters[column] = {
        type: "amountRange",
        min: minAmount && minAmount !== "" ? parseFloat(minAmount) : null,
        max: maxAmount && maxAmount !== "" ? parseFloat(maxAmount) : null,
      };
    }

    applyFilters();
    closeAllFilterPopups();
  }

  function setupFilterPopupEvents(popup, column) {
    // For text filter popups
    const searchInput = popup.querySelector(".filter-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        const filterText = this.value.toLowerCase();
        const options = popup.querySelectorAll(
          ".filter-options label:not(:first-child)"
        );

        options.forEach((option) => {
          const text = option.textContent.toLowerCase();
          if (text.includes(filterText)) {
            option.style.display = "";
          } else {
            option.style.display = "none";
          }
        });
      });
    }

    // Handle "Select All" checkbox
    const selectAllCheckbox = popup.querySelector(".select-all-option");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", function () {
        const checkboxes = popup.querySelectorAll(
          '.filter-options input[type="checkbox"]:not(.select-all-option)'
        );
        checkboxes.forEach((checkbox) => {
          checkbox.checked = this.checked;
        });
      });
    }

    // For applying text filters
    const applyFilterBtn = popup.querySelector(".apply-filter");
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener("click", function () {
        const selectedValues = [];
        const checkboxes = popup.querySelectorAll(
          '.filter-options input[type="checkbox"]:not(.select-all-option)'
        );

        checkboxes.forEach((checkbox) => {
          if (checkbox.checked) {
            selectedValues.push(checkbox.value);
          }
        });

        applyColumnFilter(column, selectedValues);
      });
    }

    // For applying amount filters
    const applyAmountFilterBtn = popup.querySelector(".apply-amount-filter");
    if (applyAmountFilterBtn) {
      applyAmountFilterBtn.addEventListener("click", function () {
        const minAmount = popup.querySelector(".amount-min").value;
        const maxAmount = popup.querySelector(".amount-max").value;

        applyAmountRangeFilter(column, minAmount, maxAmount);
      });
    }

    // For clearing filters
    const clearFilterBtn = popup.querySelector(
      ".clear-filter, .clear-date-filter, .clear-amount-filter"
    );
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener("click", function () {
        if (popup.querySelector(".amount-min")) {
          popup.querySelector(".amount-min").value = "";
          popup.querySelector(".amount-max").value = "";
        }
        delete activeFilters[column];
        applyFilters();
        closeAllFilterPopups();
      });
    }
  }

  function closeAllFilterPopups() {
    const popups = document.querySelectorAll(".column-filter-popup");
    popups.forEach((popup) => {
      popup.remove();
    });
  }

  // Add document click listener to close popups when clicking outside
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest(".column-filter-popup") &&
      !e.target.closest(".column-filter-icon")
    ) {
      closeAllFilterPopups();
    }
  });

  function showColumnFilter(column, element) {
    // Close any open filter popups
    closeAllFilterPopups();

    const isDateColumn = detectDateColumn(column);
    const isAmountColumn = detectAmountColumn(column);
    const uniqueValues = getUniqueColumnValues(column);

    const popup = document.createElement("div");
    popup.className = "column-filter-popup";
    popup.setAttribute("data-column", column);

    if (isDateColumn) {
      // Create simple date filter (not date range)
      let filterHTML = `
        <div class="filter-search">
          <input type="text" placeholder="Search dates..." class="filter-search-input">
        </div>
        <div class="filter-options">
          <label><input type="checkbox" class="select-all-option" checked> (Select All)</label>
      `;

      uniqueValues.forEach((value) => {
        const displayValue = value === "" ? "(Blank)" : value;
        const isChecked =
          !activeFilters[column] ||
          (activeFilters[column] &&
            Array.isArray(activeFilters[column]) &&
            activeFilters[column].includes(value));

        filterHTML += `
          <label><input type="checkbox" value="${escapeHtml(value)}" ${
          isChecked ? "checked" : ""
        }> ${escapeHtml(displayValue)}</label>
        `;
      });

      filterHTML += `
        </div>
        <div class="filter-buttons">
          <button class="apply-filter" data-column="${column}">Apply</button>
          <button class="clear-filter" data-column="${column}">Clear</button>
        </div>
      `;

      popup.innerHTML = filterHTML;
    } else if (isAmountColumn) {
      // Extract min and max amounts from data
      let minAmount = null;
      let maxAmount = null;

      excelData[currentTab].forEach((row) => {
        if (row[column]) {
          // Extract numeric value, removing currency symbols and formatting
          let rawValue = String(row[column]).replace(/[^0-9.-]/g, "");
          let numValue = parseFloat(rawValue);

          if (!isNaN(numValue)) {
            if (minAmount === null || numValue < minAmount)
              minAmount = numValue;
            if (maxAmount === null || numValue > maxAmount)
              maxAmount = numValue;
          }
        }
      });

      // Get current filter values
      let currentMinAmount = "";
      let currentMaxAmount = "";

      if (
        activeFilters[column] &&
        activeFilters[column].type === "amountRange"
      ) {
        if (activeFilters[column].min !== null) {
          currentMinAmount = activeFilters[column].min;
        }
        if (activeFilters[column].max !== null) {
          currentMaxAmount = activeFilters[column].max;
        }
      }

      // Create amount range filter
      const amountFilterHTML = `
        <div class="amount-filter">
          <h4>Filter by Amount Range</h4>
          <div class="amount-range">
            <label>Min: <input type="number" step="0.01" class="amount-min" data-column="${column}" value="${currentMinAmount}" min="${
        minAmount || 0
      }" max="${maxAmount || 9999999}"></label>
            <label>Max: <input type="number" step="0.01" class="amount-max" data-column="${column}" value="${currentMaxAmount}" min="${
        minAmount || 0
      }" max="${maxAmount || 9999999}"></label>
          </div>
          <div class="filter-buttons">
            <button class="apply-amount-filter" data-column="${column}">Apply</button>
            <button class="clear-amount-filter" data-column="${column}">Clear</button>
          </div>
        </div>
      `;
      popup.innerHTML = amountFilterHTML;
    } else {
      // Standard text filter (unchanged)
      let filterHTML = `
        <div class="filter-search">
          <input type="text" placeholder="Search values..." class="filter-search-input">
        </div>
        <div class="filter-options">
          <label><input type="checkbox" class="select-all-option" checked> (Select All)</label>
      `;

      uniqueValues.forEach((value) => {
        const displayValue = value === "" ? "(Blank)" : value;
        const isChecked =
          !activeFilters[column] ||
          (activeFilters[column] &&
            Array.isArray(activeFilters[column]) &&
            activeFilters[column].includes(value));

        filterHTML += `
          <label><input type="checkbox" value="${escapeHtml(value)}" ${
          isChecked ? "checked" : ""
        }> ${escapeHtml(displayValue)}</label>
        `;
      });

      filterHTML += `
        </div>
        <div class="filter-buttons">
          <button class="apply-filter" data-column="${column}">Apply</button>
          <button class="clear-filter" data-column="${column}">Clear</button>
        </div>`;

      popup.innerHTML = filterHTML;
    }

    // Position and show popup
    const rect = element.getBoundingClientRect();
    popup.style.top = rect.bottom + window.scrollY + "px";
    popup.style.left = rect.left + window.scrollX + "px";

    document.body.appendChild(popup);

    // Add event listeners for the popup
    setupFilterPopupEvents(popup, column);
  }

  function applyColumnFilter(column, selectedValues) {
    // Update active filters
    if (
      selectedValues.length === 0 ||
      selectedValues.length === getUniqueColumnValues(column).length
    ) {
      // If all or none selected, remove filter
      delete activeFilters[column];
    } else {
      // Store selected values
      activeFilters[column] = selectedValues;
    }

    applyFilters();
    closeAllFilterPopups();
  }

  function applyFilters() {
    // Get data source based on global sort status
    let sourceData =
      globalSortActive && sortedExcelData[currentTab]
        ? sortedExcelData[currentTab]
        : excelData[currentTab] || [];

    // Apply active filters
    if (Object.keys(activeFilters).length > 0) {
      filtered = sourceData.filter((row) => {
        return Object.entries(activeFilters).every(([column, filter]) => {
          // Skip if column doesn't exist in this row
          if (row[column] === undefined) return false;

          // Handle different filter types
          if (filter && typeof filter === "object" && !Array.isArray(filter)) {
            // Handle object-type filters (amount range and date range)
            if (filter.type === "amountRange") {
              // Amount range filter
              let rowValue = row[column];

              // Extract numeric value
              let numericString = String(rowValue).replace(/[^0-9.-]/g, "");
              let numValue = parseFloat(numericString);

              // Skip invalid numbers
              if (isNaN(numValue)) return false;

              // Check range conditions
              if (filter.min !== null && numValue < filter.min) return false;
              if (filter.max !== null && numValue > filter.max) return false;

              return true;
            } else if (filter.type === "dateRange") {
              // Date range filter code
              let rowValue = row[column];
              let rowDate;

              if (typeof rowValue === "number") {
                rowDate = new Date(
                  Math.round((rowValue - 25569) * 86400 * 1000)
                );
              } else {
                rowDate = new Date(rowValue);
              }

              if (isNaN(rowDate.getTime())) return false;

              if (filter.from && rowDate < filter.from) return false;
              if (filter.to && rowDate > filter.to) return false;

              return true;
            }
            return false;
          } else if (Array.isArray(filter)) {
            // Multiple values filter (checkbox list)
            const rowValueStr = String(row[column] || "");
            return filter.includes(rowValueStr);
          } else {
            // Single value filter
            return String(row[column]) === String(filter);
          }
        });
      });
    } else {
      filtered = sourceData;
    }

    // Apply search
    const searchText = searchInput.value.trim().toLowerCase();
    if (searchText) {
      filtered = filtered.filter((row) => {
        return Object.values(row).some(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(searchText)
        );
      });
    }

    filteredData = filtered;
    currentPage = 0;
    renderTable();
  }

  function getUniqueColumnValues(column) {
    // Use the appropriate data source based on global sort status
    const sourceData =
      globalSortActive && sortedExcelData[currentTab]
        ? sortedExcelData[currentTab]
        : excelData[currentTab];

    const values = new Set();
    sourceData.forEach((row) => {
      if (row[column] !== undefined) {
        values.add(String(row[column]));
      }
    });
    return Array.from(values).sort();
  }

  function clearAllFilters() {
    // Clear search
    searchInput.value = "";

    // Clear all active filters
    activeFilters = {};

    // Reset global sort flag and clear sorted data
    globalSortActive = false;
    resetSortedData();

    // Reset sort config
    sortConfig = { column: null, direction: "asc" };

    // Remove global sort indicator
    updateGlobalSortIndicator(false);

    // Reset to full data for current tab
    filteredData = excelData[currentTab] || [];
    currentPage = 0;
    renderTable();
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
      // Add a filter row at the top for mobile
      let tableHTML = '<div class="mobile-filters">';

      // Add dropdown selector for columns
      tableHTML += `<select id="mobileColumnFilter" class="mobile-column-select">
                      <option value="">Select column to filter...</option>
                      ${columns
                        .map(
                          (col) =>
                            `<option value="${escapeHtml(col)}">${escapeHtml(
                              col
                            )}</option>`
                        )
                        .join("")}
                    </select>
                    <button id="mobileFilterBtn" class="mobile-filter-btn">
                      <i class="fas fa-filter"></i> Filter
                    </button>`;

      tableHTML += '</div><table class="mobile-table-view"><tbody>';

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

      // Attach mobile filter button event listener
      setTimeout(() => {
        const mobileFilterBtn = document.getElementById("mobileFilterBtn");
        if (mobileFilterBtn) {
          mobileFilterBtn.addEventListener("click", function () {
            const select = document.getElementById("mobileColumnFilter");
            const column = select.value;
            if (column) {
              showColumnFilter(column, this);
            }
          });
        }
      }, 0);
    } else {
      let tableHTML = `
  <table>
      <thead>
          <tr>
              ${columns
                .map((col) => {
                  const sortIcon =
                    sortConfig.column === col
                      ? sortConfig.direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : "";

                  const filterActiveClass = activeFilters[col] ? "active" : "";

                  return `
                      <th class="sortable" data-column="${escapeHtml(col)}">
                          <div class="column-header">
                              <span class="column-title">${escapeHtml(
                                col
                              )}${sortIcon}</span>
                              <div class="column-filter-icon ${filterActiveClass}" data-column="${escapeHtml(
                    col
                  )}">
                                  <i class="fas fa-filter" data-column="${escapeHtml(
                                    col
                                  )}"></i>
                              </div>
                          </div>
                      </th>`;
                })
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

    // Use a small timeout to ensure DOM is fully updated
    setTimeout(() => {
      // 1. Set up filter icon click handlers
      document
        .querySelectorAll(".column-filter-icon, .column-filter-icon i")
        .forEach((element) => {
          element.removeEventListener("click", handleFilterClick); // Remove old handlers if any
          element.addEventListener("click", handleFilterClick);
        });

      // 2. Set up column header sort handlers
      document.querySelectorAll("th.sortable").forEach((header) => {
        header.addEventListener("click", function (e) {
          // Only sort if the click was not on the filter icon
          if (!e.target.closest(".column-filter-icon")) {
            const column = this.getAttribute("data-column");
            sortData(column);
          }
        });
        header.style.cursor = "pointer";
      });

      // 3. Set up navigation link click handlers
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
    }, 0);

    // Helper function for filter click handling
    function handleFilterClick(e) {
      e.preventDefault();
      e.stopPropagation(); // Prevent triggering sort

      let column = this.getAttribute("data-column");
      if (!column && this.parentElement) {
        // Try to get from parent if it's the icon element
        column = this.parentElement.getAttribute("data-column");
      }

      if (column) {
        showColumnFilter(column, this);
      }
    }
  }

  window.addEventListener("resize", function () {
    if (window.currentPageData && window.currentColumns) {
      createResponsiveTables(
        window.currentPageData,
        window.currentColumns,
        window.currentStart || 0
      );
    }
  });
});
