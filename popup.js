document.addEventListener('DOMContentLoaded', function() {
  const loadFieldsBtn = document.getElementById('loadFieldsBtn');
  const statusMessage = document.getElementById('statusMessage');
  const dataContainer = document.getElementById('dataContainer');
  const branchSelect = document.getElementById('branchSelect');
  const monthSelect = document.getElementById('monthSelect');
  const submitBtn = document.getElementById('submitBtn');
  const resultContainer = document.getElementById('resultContainer');
  const resultBranch = document.getElementById('resultBranch');
  const resultMonth = document.getElementById('resultMonth');
  const resultFee = document.getElementById('resultFee');
  const resultFunding = document.getElementById('resultFunding');
  
  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
  }
  
  // Load fields from the active Xero page
  loadFieldsBtn.addEventListener('click', function() {
    showStatus('Loading data from Xero...', 'loading');
    
    // Get the current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Execute content script in the active tab using the scripting API
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => {
          // This function will be injected into the page and executed there
          return {
            branches: extractBranches(),
            months: extractMonths()
          };
          
          // Extract branches function
          function extractBranches() {
            // Open the dropdown to ensure options are visible
            const dropdownToggle = document.querySelector("#Budgets_toggle");
            if (dropdownToggle) {
              dropdownToggle.click();
            }
            
            // Wait briefly and get the branches
            return new Promise(resolve => {
              setTimeout(() => {
                const branchElements = document.querySelectorAll("#Budgets_suggestions .p");
                const branches = Array.from(branchElements).map(el => el.textContent.trim());
                
                // Close dropdown
                dropdownToggle.click();
                
                resolve(branches);
              }, 500);
            });
          }
          
          // Extract months function
          function extractMonths() {
            const monthElements = document.querySelectorAll(".x-grid3-header .x-grid3-hd-inner");
            return Array.from(monthElements)
              .map(el => el.textContent.trim())
              .filter(text => /[A-Za-z]+-\d+/.test(text)); // Filter for month patterns like "Feb-25"
          }
        }
      }).then(results => {
        // Handle the results from the injected script
        if (results && results[0] && results[0].result) {
          const data = results[0].result;
          
          // Populate branch dropdown
          branchSelect.innerHTML = '';
          data.branches.forEach(function(branch) {
            const option = document.createElement('option');
            option.value = branch;
            option.textContent = branch;
            branchSelect.appendChild(option);
          });
          
          // Populate month dropdown
          monthSelect.innerHTML = '';
          data.months.forEach(function(month) {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            monthSelect.appendChild(option);
          });
          
          // Show the form
          dataContainer.style.display = 'block';
          showStatus('Data loaded successfully!', 'success');
        } else {
          showStatus('Failed to load data from Xero. Please try again.', 'error');
        }
      }).catch(error => {
        showStatus('Error: ' + error.message, 'error');
      });
    });
  });
  
  // Handle submit button
  submitBtn.addEventListener('click', function() {
    const selectedBranch = branchSelect.value;
    const selectedMonth = monthSelect.value;
    
    if (selectedBranch && selectedMonth) {
      showStatus(`Getting data for ${selectedBranch} (${selectedMonth})...`, 'loading');
      resultContainer.style.display = 'none';
      
      // Send the selected values to the content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: (branch, month) => {
            // This function will be injected into the page and executed there
            return getIncomeData(branch, month);
            
            // Get income data for specific branch and month
            function getIncomeData(branch, month) {
              return new Promise((resolve, reject) => {
                try {
                  // Step 1: Select the branch from dropdown
                  const dropdownToggle = document.querySelector("#Budgets_toggle");
                  const budgetInput = document.querySelector("#Budgets_value");
                  
                  if (!dropdownToggle || !budgetInput) {
                    reject("Budget dropdown not found");
                    return;
                  }
                  
                  // Open dropdown
                  dropdownToggle.click();
                  
                  // Wait for dropdown to open, then select the branch
                  setTimeout(() => {
                    try {
                      const branchElements = document.querySelectorAll("#Budgets_suggestions .p");
                      const targetBranch = Array.from(branchElements).find(el => el.textContent.trim() === branch);
                      
                      if (!targetBranch) {
                        reject(`Branch "${branch}" not found in dropdown`);
                        return;
                      }
                      
                      // Click on the branch
                      targetBranch.click();
                      
                      // Wait for page to load (monitor the loading element)
                      waitForLoading().then(() => {
                        try {
                          // Find the column index for the selected month
                          const monthIndex = findMonthColumnIndex(month);
                          
                          if (monthIndex === -1) {
                            reject(`Month "${month}" not found in table headers`);
                            return;
                          }
                          
                          // Get fee income value
                          const feeIncome = getCellValue("Fee income (0110)", monthIndex);
                          
                          // Get funding income value
                          const fundingIncome = getCellValue("Funding income (0120)", monthIndex);
                          
                          // Return results
                          resolve({
                            success: true,
                            feeIncome: feeIncome,
                            fundingIncome: fundingIncome
                          });
                        } catch (error) {
                          reject(`Error extracting data: ${error.message}`);
                        }
                      }).catch(error => {
                        reject(`Timeout waiting for page to load: ${error}`);
                      });
                    } catch (error) {
                      reject(`Error selecting branch: ${error.message}`);
                    }
                  }, 500);
                } catch (error) {
                  reject(`Error: ${error.message}`);
                }
              });
            }
            
            // Wait for the loading indicator to disappear
            function waitForLoading(timeout = 10000) {
              return new Promise((resolve, reject) => {
                const startTime = Date.now();
                
                // First check if it's already hidden
                const loadingElement = document.querySelector("#loading");
                if (loadingElement && loadingElement.style.display === "none") {
                  resolve();
                  return;
                }
                
                // If not hidden, set up an interval to check
                const checkInterval = setInterval(() => {
                  const loadingElement = document.querySelector("#loading");
                  
                  if (loadingElement && loadingElement.style.display === "none") {
                    clearInterval(checkInterval);
                    resolve();
                  } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject("Loading timeout exceeded");
                  }
                }, 200);
              });
            }
            
            // Find the column index for a given month
            function findMonthColumnIndex(month) {
              const headers = document.querySelectorAll(".x-grid3-header .x-grid3-hd-inner");
              
              for (let i = 0; i < headers.length; i++) {
                if (headers[i].textContent.trim() === month) {
                  return i;
                }
              }
              
              return -1; // Month not found
            }
            
            // Get cell value for a specific row label and column index
            function getCellValue(rowLabel, columnIndex) {
              // Find the row with the given label
              const rows = document.querySelectorAll(".x-grid3-row");
              let targetRow = null;
              let rowIndex = -1;
              
              for (let i = 0; i < rows.length; i++) {
                const labelCell = rows[i].querySelector(".x-grid3-cell-inner");
                if (labelCell && labelCell.textContent.trim() === rowLabel) {
                  targetRow = rows[i];
                  rowIndex = i;
                  break;
                }
              }
              
              if (!targetRow) {
                throw new Error(`Row "${rowLabel}" not found`);
              }
              
              // Find the value cell in the corresponding column
              // We need to be careful with the column indexing as it's split between locked and scrollable sections
              const valueCell = document.querySelector(`.x-grid3-body:not(.x-grid3-locked) .x-grid3-row:nth-child(${rowIndex + 1}) .x-grid3-cell:nth-child(${columnIndex})`);
              
              if (!valueCell) {
                throw new Error(`Value cell not found for ${rowLabel} at column ${columnIndex}`);
              }
              
              const innerCell = valueCell.querySelector(".x-grid3-cell-inner");
              return innerCell ? innerCell.textContent.trim() : "N/A";
            }
          },
          args: [selectedBranch, selectedMonth]
        }).then(results => {
          // Handle the results from the injected script
          if (results && results[0] && results[0].result) {
            const data = results[0].result;
            
            if (data.success) {
              // Update result display
              resultBranch.textContent = selectedBranch;
              resultMonth.textContent = selectedMonth;
              resultFee.textContent = data.feeIncome;
              resultFunding.textContent = data.fundingIncome;
              
              // Show results
              resultContainer.style.display = 'block';
              showStatus('Data retrieved successfully!', 'success');
            } else {
              showStatus('Failed to retrieve income data: ' + data.error, 'error');
            }
          } else {
            showStatus('Failed to process results from page', 'error');
          }
        }).catch(error => {
          showStatus('Error: ' + error.message, 'error');
        });
      });
    } else {
      showStatus('Please select both a branch and a month.', 'error');
    }
  });
});