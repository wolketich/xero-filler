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
  const feeIncomeInput = document.getElementById('feeIncomeInput');
  const fundingIncomeInput = document.getElementById('fundingIncomeInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const saveBtn = document.getElementById('saveBtn');
  
  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 3000);
    }
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
  
  // Handle submit button - Get income data
  submitBtn.addEventListener('click', function() {
    fetchIncomeData();
  });
  
  // Handle refresh button - Refresh income data
  refreshBtn.addEventListener('click', function() {
    fetchIncomeData();
  });
  
  // Function to fetch income data
  function fetchIncomeData() {
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
                              // Find table cells for fee income and funding income
                              const feeRow = findRowByLabel("Fee income (0110)");
                              const fundingRow = findRowByLabel("Funding income (0120)");
                              
                              if (!feeRow) {
                                reject("Fee income row not found");
                                return;
                              }
                              
                              if (!fundingRow) {
                                reject("Funding income row not found");
                                return;
                              }
                              
                              // Find month cells
                              const feeMonthCell = findMonthCellInRow(feeRow, month);
                              const fundingMonthCell = findMonthCellInRow(fundingRow, month);
                              
                              if (!feeMonthCell) {
                                reject(`Month cell for Fee Income (${month}) not found`);
                                return;
                              }
                              
                              if (!fundingMonthCell) {
                                reject(`Month cell for Funding Income (${month}) not found`);
                                return;
                              }
                              
                              // Get current values
                              const feeInput = feeMonthCell.querySelector('input');
                              const fundingInput = fundingMonthCell.querySelector('input');
                              
                              const feeValue = feeInput ? feeInput.value : 
                                feeMonthCell.querySelector('.x-grid3-cell-inner').textContent.trim();
                              
                              const fundingValue = fundingInput ? fundingInput.value : 
                                fundingMonthCell.querySelector('.x-grid3-cell-inner').textContent.trim();
                              
                              // Return results with input references (for future editing)
                              resolve({
                                success: true,
                                feeIncome: feeValue,
                                fundingIncome: fundingValue,
                                canEdit: !!(feeInput && fundingInput)
                              });
                            } catch (error) {
                              console.error("Error getting values:", error);
                              reject(`Error getting values: ${error.message}`);
                            }
                          }, 1000);
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
            
            // Helper function to find a row by its label text
            function findRowByLabel(label) {
              const allLabelCells = document.querySelectorAll(".x-grid3-cell-inner");
              for (const cell of allLabelCells) {
                if (cell.textContent.trim() === label) {
                  // Go up to find the row
                  return cell.closest(".x-grid3-row");
                }
              }
              return null;
            }
            
            // Helper function to find a month cell in a row
            function findMonthCellInRow(row, month) {
              // Method 1: Try direct selector by ID
              let cell = row.querySelector(`[id="${month}"]`);
              if (cell) return cell;
              
              // Method 2: Try by class
              cell = row.querySelector(`.x-grid3-td-${month}`);
              if (cell) return cell;
              
              // Method 3: If the row is in the locked section, we need to find the corresponding row in the scrollable section
              if (row.closest('.x-grid3-locked')) {
                const rowIndex = Array.from(row.parentElement.children).indexOf(row);
                const scrollableRow = document.querySelector(`.x-grid3-body:not(.x-grid3-locked) .x-grid3-row:nth-child(${rowIndex + 1})`);
                
                if (scrollableRow) {
                  cell = scrollableRow.querySelector(`[id="${month}"]`);
                  if (cell) return cell;
                  
                  cell = scrollableRow.querySelector(`.x-grid3-td-${month}`);
                  if (cell) return cell;
                  
                  // Method 4: Find the cell by column index
                  const headers = document.querySelectorAll(".x-grid3-header:not(.x-grid3-locked) .x-grid3-hd-inner");
                  const columnIndex = Array.from(headers).findIndex(h => h.textContent.trim() === month);
                  
                  if (columnIndex !== -1) {
                    const cells = scrollableRow.querySelectorAll('td');
                    if (columnIndex < cells.length) {
                      return cells[columnIndex];
                    }
                  }
                }
              }
              
              return null;
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
              feeIncomeInput.value = data.feeIncome;
              fundingIncomeInput.value = data.fundingIncome;
              
              // Enable or disable editing based on cell type
              saveBtn.disabled = !data.canEdit;
              if (!data.canEdit) {
                feeIncomeInput.readOnly = true;
                fundingIncomeInput.readOnly = true;
                feeIncomeInput.style.backgroundColor = '#f5f5f5';
                fundingIncomeInput.style.backgroundColor = '#f5f5f5';
                showStatus('This month is not editable in Xero', 'loading');
              } else {
                feeIncomeInput.readOnly = false;
                fundingIncomeInput.readOnly = false;
                feeIncomeInput.style.backgroundColor = '';
                fundingIncomeInput.style.backgroundColor = '';
              }
              
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
  }
  
  // Handle save button - Save edited values back to Xero
  saveBtn.addEventListener('click', function() {
    const selectedBranch = resultBranch.textContent;
    const selectedMonth = resultMonth.textContent;
    const newFeeIncome = feeIncomeInput.value;
    const newFundingIncome = fundingIncomeInput.value;
    
    if (!selectedBranch || !selectedMonth) {
      showStatus('Missing branch or month information', 'error');
      return;
    }
    
    if (!newFeeIncome || !newFundingIncome) {
      showStatus('Please enter values for both fee income and funding income', 'error');
      return;
    }
    
    showStatus(`Saving changes to Xero...`, 'loading');
    
    // Send the values back to Xero
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: async (branch, month, feeIncome, fundingIncome) => {
          // This function will be injected into the page and executed there
          try {
            // Save the edited values
            const result = await saveIncomeData(branch, month, feeIncome, fundingIncome);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
          
          // Function to save income data back to Xero
          async function saveIncomeData(branch, month, feeIncome, fundingIncome) {
            return new Promise((resolve, reject) => {
              try {
                // Make sure we have the right branch loaded
                const currentBranchText = document.querySelector('#Budgets_value').value;
                
                if (currentBranchText !== branch) {
                  reject(`Current branch (${currentBranchText}) doesn't match selected branch (${branch}). Please reload data.`);
                  return;
                }
                
                // Find table cells for fee income and funding income
                const feeRow = findRowByLabel("Fee income (0110)");
                const fundingRow = findRowByLabel("Funding income (0120)");
                
                if (!feeRow) {
                  reject("Fee income row not found");
                  return;
                }
                
                if (!fundingRow) {
                  reject("Funding income row not found");
                  return;
                }
                
                // Find month cells
                const feeMonthCell = findMonthCellInRow(feeRow, month);
                const fundingMonthCell = findMonthCellInRow(fundingRow, month);
                
                if (!feeMonthCell) {
                  reject(`Month cell for Fee Income (${month}) not found`);
                  return;
                }
                
                if (!fundingMonthCell) {
                  reject(`Month cell for Funding Income (${month}) not found`);
                  return;
                }
                
                // Get input elements
                const feeInput = feeMonthCell.querySelector('input');
                const fundingInput = fundingMonthCell.querySelector('input');
                
                if (!feeInput) {
                  reject("Fee income input not found (month may not be editable)");
                  return;
                }
                
                if (!fundingInput) {
                  reject("Funding income input not found (month may not be editable)");
                  return;
                }
                
                // Set new values
                const oldFeeValue = feeInput.value;
                const oldFundingValue = fundingInput.value;
                
                feeInput.value = feeIncome;
                fundingInput.value = fundingIncome;
                
                // Trigger change events to ensure Xero registers the changes
                const changeEvent = new Event('change', { bubbles: true });
                feeInput.dispatchEvent(changeEvent);
                fundingInput.dispatchEvent(changeEvent);
                
                // Trigger blur events to simulate losing focus
                const blurEvent = new Event('blur', { bubbles: true });
                feeInput.dispatchEvent(blurEvent);
                fundingInput.dispatchEvent(blurEvent);
                
                // TODO: If Xero requires additional actions to save changes, add them here
                
                // Return success with old and new values for confirmation
                resolve({
                  success: true,
                  oldFeeIncome: oldFeeValue,
                  newFeeIncome: feeIncome,
                  oldFundingIncome: oldFundingValue,
                  newFundingIncome: fundingIncome
                });
                
              } catch (error) {
                console.error("Error saving data:", error);
                reject(`Error saving data: ${error.message}`);
              }
            });
          }
          
          // Helper function to find a row by its label text (same as before)
          function findRowByLabel(label) {
            const allLabelCells = document.querySelectorAll(".x-grid3-cell-inner");
            for (const cell of allLabelCells) {
              if (cell.textContent.trim() === label) {
                return cell.closest(".x-grid3-row");
              }
            }
            return null;
          }
          
          // Helper function to find a month cell in a row (same as before)
          function findMonthCellInRow(row, month) {
            // Method 1: Try direct selector by ID
            let cell = row.querySelector(`[id="${month}"]`);
            if (cell) return cell;
            
            // Method 2: Try by class
            cell = row.querySelector(`.x-grid3-td-${month}`);
            if (cell) return cell;
            
            // Method 3: If the row is in the locked section, find the corresponding row in the scrollable section
            if (row.closest('.x-grid3-locked')) {
              const rowIndex = Array.from(row.parentElement.children).indexOf(row);
              const scrollableRow = document.querySelector(`.x-grid3-body:not(.x-grid3-locked) .x-grid3-row:nth-child(${rowIndex + 1})`);
              
              if (scrollableRow) {
                cell = scrollableRow.querySelector(`[id="${month}"]`);
                if (cell) return cell;
                
                cell = scrollableRow.querySelector(`.x-grid3-td-${month}`);
                if (cell) return cell;
                
                // Method 4: Find by column index
                const headers = document.querySelectorAll(".x-grid3-header:not(.x-grid3-locked) .x-grid3-hd-inner");
                const columnIndex = Array.from(headers).findIndex(h => h.textContent.trim() === month);
                
                if (columnIndex !== -1) {
                  const cells = scrollableRow.querySelectorAll('td');
                  if (columnIndex < cells.length) {
                    return cells[columnIndex];
                  }
                }
              }
            }
            
            return null;
          }
        },
        args: [selectedBranch, selectedMonth, newFeeIncome, newFundingIncome]
      }).then(results => {
        // Handle the results from the injected script
        if (results && results[0] && results[0].result) {
          const data = results[0].result;
          
          if (data.success) {
            showStatus(`Changes saved successfully!`, 'success');
          } else {
            showStatus('Failed to save changes: ' + data.error, 'error');
          }
        } else {
          showStatus('Failed to process results from page', 'error');
        }
      }).catch(error => {
        showStatus('Error: ' + error.message, 'error');
      });
    });
  });
});