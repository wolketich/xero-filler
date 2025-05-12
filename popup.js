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
        function: async () => {
          // This function will be injected into the page and executed there
          try {
            // Extract branches (wait for the promise to resolve)
            const branches = await extractBranches();
            
            // Extract months
            const months = extractMonths();
            
            return { branches, months, success: true };
          } catch (error) {
            return { 
              success: false, 
              error: error.message 
            };
          }
          
          // Extract branches function - returns a Promise
          async function extractBranches() {
            // Open the dropdown to ensure options are visible
            const dropdownToggle = document.querySelector("#Budgets_toggle");
            if (!dropdownToggle) {
              throw new Error("Budget dropdown not found");
            }
            
            dropdownToggle.click();
            
            // Wait briefly for the dropdown to appear
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  const branchElements = document.querySelectorAll("#Budgets_suggestions .p");
                  const branches = Array.from(branchElements).map(el => el.textContent.trim());
                  
                  // Close dropdown
                  dropdownToggle.click();
                  
                  resolve(branches);
                } catch (error) {
                  reject(error);
                }
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
        if (results && results[0] && results[0].result && results[0].result.success) {
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
          const errorMsg = results && results[0] && results[0].result && results[0].result.error
            ? results[0].result.error
            : 'Failed to load data from Xero.';
          showStatus('Error: ' + errorMsg, 'error');
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
          function: async (branch, month) => {
            // This function will be injected into the page and executed there
            try {
              // Get income data (await the promise)
              const data = await getIncomeData(branch, month);
              return data;
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
            
            // Get income data for specific branch and month
            async function getIncomeData(branch, month) {
              return new Promise((resolve, reject) => {
                try {
                  // Step 1: Select the branch from dropdown
                  const dropdownToggle = document.querySelector("#Budgets_toggle");
                  const budgetInput = document.querySelector("#Budgets_value");
                  
                  if (!dropdownToggle || !budgetInput) {
                    reject("Budget dropdown not found");
                    return;
                  }
                  
                  console.log(`Selecting branch: ${branch} for month: ${month}`);
                  
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
                          console.log("Page loaded, getting values");
                          
                          // Wait a bit more to ensure all elements are rendered
                          setTimeout(() => {
                            try {
                              // First, let's examine the page structure
                              console.log("Analyzing page structure...");
                              
                              // Find all month headers to determine column index
                              const headerCells = document.querySelectorAll(".x-grid3-hd-inner");
                              const columnIndex = Array.from(headerCells).findIndex(cell => cell.textContent.trim() === month);
                              
                              if (columnIndex === -1) {
                                console.error(`Month column not found: ${month}`);
                                reject(`Month column not found: ${month}`);
                                return;
                              }
                              
                              console.log(`Found month ${month} at column index: ${columnIndex}`);
                              
                              // Get values using direct DOM traversal approach
                              const feeIncome = getValueForIncomeType("Fee income (0110)", month, columnIndex);
                              const fundingIncome = getValueForIncomeType("Funding income (0120)", month, columnIndex);
                              
                              // Return results
                              resolve({
                                success: true,
                                feeIncome: feeIncome,
                                fundingIncome: fundingIncome
                              });
                            } catch (error) {
                              console.error("Error getting values:", error);
                              reject(`Error getting values: ${error.message}`);
                            }
                          }, 1000); // Extra delay to ensure table is fully loaded
                        } catch (error) {
                          console.error("Error extracting data:", error);
                          reject(`Error extracting data: ${error.message}`);
                        }
                      }).catch(error => {
                        console.error("Loading error:", error);
                        reject(`Timeout waiting for page to load: ${error}`);
                      });
                    } catch (error) {
                      console.error("Branch selection error:", error);
                      reject(`Error selecting branch: ${error.message}`);
                    }
                  }, 500);
                } catch (error) {
                  console.error("General error:", error);
                  reject(`Error: ${error.message}`);
                }
              });
            }
            
            // Get value for a specific income type and month using column index
            function getValueForIncomeType(incomeType, month, columnIndex) {
              try {
                // First, get all rows in the grid
                const rowsWithLabels = document.querySelectorAll(".x-grid3-row");
                console.log(`Found ${rowsWithLabels.length} rows in grid`);
                
                // Find row index with matching income type
                let rowIndex = -1;
                let i = 0;
                
                for (const row of rowsWithLabels) {
                  const labelCell = row.querySelector(".x-grid3-cell-inner");
                  if (labelCell && labelCell.textContent.trim() === incomeType) {
                    rowIndex = i;
                    console.log(`Found "${incomeType}" at row index: ${rowIndex}`);
                    break;
                  }
                  i++;
                }
                
                if (rowIndex === -1) {
                  console.error(`Row not found for income type: ${incomeType}`);
                  return `Error: Row not found for income type: ${incomeType}`;
                }
                
                // Method 1: Try direct selector using month ID attribute
                console.log(`Looking for direct cell with id or class for ${month}...`);
                const directCell = document.querySelector(
                  `.x-grid3-row:nth-child(${rowIndex + 1}) [id="${month}"], ` +
                  `.x-grid3-row:nth-child(${rowIndex + 1}) .x-grid3-td-${month}`
                );
                
                if (directCell) {
                  console.log("Found cell by direct selector");
                  const input = directCell.querySelector('input');
                  
                  if (input) {
                    return input.value;
                  } else {
                    const innerCell = directCell.querySelector('.x-grid3-cell-inner');
                    return innerCell ? innerCell.textContent.trim() : "N/A";
                  }
                }
                
                // Method 2: Use debugging to find the value (more flexible approach)
                console.log("Direct selector failed. Using detailed search...");
                console.log(`Getting value for ${incomeType} (${month}) - Row ${rowIndex}, Column ${columnIndex}`);
                
                // Debug the specific row
                const targetRow = rowsWithLabels[rowIndex];
                console.log("Target row HTML:", targetRow.outerHTML);
                
                // Look for any month cell in the row
                const allMonthCells = Array.from(targetRow.querySelectorAll('td'))
                  .filter(td => td.id && td.id.match(/[A-Za-z]+-\d+/));
                  
                console.log(`Found ${allMonthCells.length} month cells in this row`);
                allMonthCells.forEach((cell, idx) => {
                  console.log(`Month cell ${idx}: id=${cell.id}, class=${cell.className}`);
                });
                
                // Find the scrollable grid section that contains month values
                const scrollableGrids = document.querySelectorAll('.x-grid3-body:not(.x-grid3-locked)');
                console.log(`Found ${scrollableGrids.length} scrollable grid sections`);
                
                if (scrollableGrids.length > 0) {
                  const scrollableRows = scrollableGrids[0].querySelectorAll('.x-grid3-row');
                  console.log(`Found ${scrollableRows.length} rows in scrollable section`);
                  
                  if (rowIndex < scrollableRows.length) {
                    const scrollableRow = scrollableRows[rowIndex];
                    console.log("Scrollable row HTML:", scrollableRow.outerHTML);
                    
                    // Get all cells in this scrollable row
                    const cells = scrollableRow.querySelectorAll('td');
                    console.log(`Found ${cells.length} cells in scrollable row`);
                    
                    // Try to find the cell with the month ID
                    const monthCell = Array.from(cells).find(c => c.id === month || c.className.includes(`x-grid3-td-${month}`));
                    
                    if (monthCell) {
                      console.log("Found month cell by ID or class:", monthCell.outerHTML);
                      const input = monthCell.querySelector('input');
                      
                      if (input) {
                        return input.value;
                      } else {
                        const innerCell = monthCell.querySelector('.x-grid3-cell-inner');
                        return innerCell ? innerCell.textContent.trim() : "N/A";
                      }
                    } else if (columnIndex < cells.length) {
                      // Fall back to using column index
                      const cell = cells[columnIndex];
                      console.log(`Using column index (${columnIndex}) to find cell:`, cell.outerHTML);
                      
                      const input = cell.querySelector('input');
                      if (input) {
                        return input.value;
                      } else {
                        const innerCell = cell.querySelector('.x-grid3-cell-inner');
                        return innerCell ? innerCell.textContent.trim() : "N/A";
                      }
                    } else {
                      return `Error: Column index ${columnIndex} out of range (cells: ${cells.length})`;
                    }
                  } else {
                    return `Error: Row index ${rowIndex} out of range (rows: ${scrollableRows.length})`;
                  }
                } else {
                  return "Error: Scrollable grid section not found";
                }
                
              } catch (error) {
                console.error(`Error getting value for ${incomeType} (${month}):`, error);
                return `Error: ${error.message}`;
              }
            }
            
            // Wait for the loading indicator to disappear
            function waitForLoading(timeout = 20000) {
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
                    // Add extra delay to ensure DOM is fully updated
                    setTimeout(resolve, 500);
                  } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject("Loading timeout exceeded");
                  }
                }, 200);
              });
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