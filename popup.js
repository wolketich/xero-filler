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
              error: error.message || "Unknown error occurred" 
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
                  reject(error || new Error("Failed to extract branches"));
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
        showStatus('Error: ' + (error.message || "Unknown error"), 'error');
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
              console.log(`Starting getIncomeData for ${branch}, ${month}`);
              const data = await getIncomeData(branch, month);
              console.log("getIncomeData completed successfully:", data);
              return data;
            } catch (error) {
              console.error("Error in main execution:", error);
              return {
                success: false,
                error: error.message || "Unknown error occurred"
              };
            }
            
            // Get income data for specific branch and month
            async function getIncomeData(branch, month) {
              return new Promise((resolve, reject) => {
                try {
                  console.log(`Looking for budget dropdown...`);
                  // Step 1: Select the branch from dropdown
                  const dropdownToggle = document.querySelector("#Budgets_toggle");
                  const budgetInput = document.querySelector("#Budgets_value");
                  
                  if (!dropdownToggle || !budgetInput) {
                    console.error("Budget dropdown not found");
                    reject(new Error("Budget dropdown not found"));
                    return;
                  }
                  
                  console.log(`Selecting branch: ${branch} for month: ${month}`);
                  
                  // Open dropdown
                  dropdownToggle.click();
                  
                  // Wait for dropdown to open, then select the branch
                  setTimeout(() => {
                    try {
                      console.log("Finding branch in dropdown...");
                      const branchElements = document.querySelectorAll("#Budgets_suggestions .p");
                      console.log(`Found ${branchElements.length} branches in dropdown`);
                      
                      const targetBranch = Array.from(branchElements).find(el => el.textContent.trim() === branch);
                      
                      if (!targetBranch) {
                        console.error(`Branch "${branch}" not found in dropdown`);
                        reject(new Error(`Branch "${branch}" not found in dropdown`));
                        return;
                      }
                      
                      console.log(`Clicking on branch: ${branch}`);
                      // Click on the branch
                      targetBranch.click();
                      
                      console.log("Waiting for page to load...");
                      // Wait for page to load (monitor the loading element)
                      waitForLoading().then(() => {
                        try {
                          console.log("Page loaded, getting values");
                          
                          // Wait a bit more to ensure all elements are rendered
                          setTimeout(() => {
                            try {
                              console.log("Starting cell search...");
                              
                              // Find table cells for fee income and funding income
                              console.log("Looking for Fee income row...");
                              const feeRow = findRowByLabel("Fee income (0110)");
                              console.log("Looking for Funding income row...");
                              const fundingRow = findRowByLabel("Funding income (0120)");
                              
                              console.log(`Found fee row: ${!!feeRow}, funding row: ${!!fundingRow}`);
                              
                              if (!feeRow) {
                                console.error("Fee income row not found");
                                reject(new Error("Fee income row not found"));
                                return;
                              }
                              
                              if (!fundingRow) {
                                console.error("Funding income row not found");
                                reject(new Error("Funding income row not found"));
                                return;
                              }
                              
                              // Find month cells
                              console.log(`Looking for month cell: ${month} in fee row`);
                              const feeMonthCell = findMonthCellInRow(feeRow, month);
                              console.log(`Looking for month cell: ${month} in funding row`);
                              const fundingMonthCell = findMonthCellInRow(fundingRow, month);
                              
                              console.log(`Found fee month cell: ${!!feeMonthCell}, funding month cell: ${!!fundingMonthCell}`);
                              
                              if (!feeMonthCell) {
                                console.error(`Month cell for Fee Income (${month}) not found`);
                                reject(new Error(`Month cell for Fee Income (${month}) not found`));
                                return;
                              }
                              
                              if (!fundingMonthCell) {
                                console.error(`Month cell for Funding Income (${month}) not found`);
                                reject(new Error(`Month cell for Funding Income (${month}) not found`));
                                return;
                              }
                              
                              // Get current values
                              const feeInput = feeMonthCell.querySelector('input');
                              const fundingInput = fundingMonthCell.querySelector('input');
                              
                              console.log(`Fee input found: ${!!feeInput}, Funding input found: ${!!fundingInput}`);
                              
                              let feeValue, fundingValue;
                              
                              if (feeInput) {
                                feeValue = feeInput.value;
                              } else {
                                const inner = feeMonthCell.querySelector('.x-grid3-cell-inner');
                                feeValue = inner ? inner.textContent.trim() : "N/A";
                              }
                              
                              if (fundingInput) {
                                fundingValue = fundingInput.value;
                              } else {
                                const inner = fundingMonthCell.querySelector('.x-grid3-cell-inner');
                                fundingValue = inner ? inner.textContent.trim() : "N/A";
                              }
                              
                              console.log(`Fee value: ${feeValue}, Funding value: ${fundingValue}`);
                              
                              // Return results with input references (for future editing)
                              resolve({
                                success: true,
                                feeIncome: feeValue,
                                fundingIncome: fundingValue,
                                canEdit: !!(feeInput && fundingInput)
                              });
                            } catch (error) {
                              console.error("Error getting values:", error);
                              reject(new Error(`Error getting values: ${error.message || "Unknown error"}`));
                            }
                          }, 1000);
                        } catch (error) {
                          console.error("Error after page loaded:", error);
                          reject(new Error(`Error extracting data: ${error.message || "Unknown error"}`));
                        }
                      }).catch(error => {
                        console.error("Loading error:", error);
                        reject(new Error(`Timeout waiting for page to load: ${error || "Unknown error"}`));
                      });
                    } catch (error) {
                      console.error("Branch selection error:", error);
                      reject(new Error(`Error selecting branch: ${error.message || "Unknown error"}`));
                    }
                  }, 500);
                } catch (error) {
                  console.error("General error:", error);
                  reject(new Error(`Error: ${error.message || "Unknown error"}`));
                }
              });
            }
            
            // Helper function to find a row by its label text
            function findRowByLabel(label) {
              try {
                console.log(`Finding row with label: "${label}"`);
                const allLabelCells = document.querySelectorAll(".x-grid3-cell-inner");
                console.log(`Found ${allLabelCells.length} potential cells to check`);
                
                for (const cell of allLabelCells) {
                  if (cell.textContent.trim() === label) {
                    console.log(`Found matching cell: ${label}`);
                    // Go up to find the row
                    const row = cell.closest(".x-grid3-row");
                    console.log(`Found row: ${!!row}`);
                    return row;
                  }
                }
                console.log(`No matching cell found for: ${label}`);
                return null;
              } catch (error) {
                console.error(`Error in findRowByLabel: ${error}`);
                return null;
              }
            }
            
            // Helper function to find a month cell in a row
            function findMonthCellInRow(row, month) {
              try {
                console.log(`Finding month cell for: ${month}`);
                
                // Method 1: Try direct selector by ID
                let cell = row.querySelector(`[id="${month}"]`);
                if (cell) {
                  console.log("Found cell by ID");
                  return cell;
                }
                
                // Method 2: Try by class
                cell = row.querySelector(`.x-grid3-td-${month}`);
                if (cell) {
                  console.log("Found cell by class");
                  return cell;
                }
                
                console.log("Cell not found directly, checking if row is in locked section");
                
                // Method 3: If the row is in the locked section, we need to find the corresponding row in the scrollable section
                if (row.closest('.x-grid3-locked')) {
                  console.log("Row is in locked section, finding corresponding row in scrollable section");
                  
                  const lockedRows = document.querySelectorAll('.x-grid3-locked .x-grid3-row');
                  const rowIndex = Array.from(lockedRows).indexOf(row);
                  
                  console.log(`Row index in locked section: ${rowIndex}`);
                  
                  if (rowIndex !== -1) {
                    const scrollableBodies = document.querySelectorAll('.x-grid3-body:not(.x-grid3-locked)');
                    console.log(`Found ${scrollableBodies.length} scrollable bodies`);
                    
                    if (scrollableBodies.length > 0) {
                      const scrollableRows = scrollableBodies[0].querySelectorAll('.x-grid3-row');
                      console.log(`Found ${scrollableRows.length} rows in scrollable section`);
                      
                      if (rowIndex < scrollableRows.length) {
                        const scrollableRow = scrollableRows[rowIndex];
                        console.log(`Found matching scrollable row: ${!!scrollableRow}`);
                        
                        // Try direct methods on the scrollable row
                        cell = scrollableRow.querySelector(`[id="${month}"]`);
                        if (cell) {
                          console.log("Found cell by ID in scrollable row");
                          return cell;
                        }
                        
                        cell = scrollableRow.querySelector(`.x-grid3-td-${month}`);
                        if (cell) {
                          console.log("Found cell by class in scrollable row");
                          return cell;
                        }
                        
                        // Method 4: Find the cell by column index
                        console.log("Trying to find cell by column index");
                        const headers = document.querySelectorAll(".x-grid3-header:not(.x-grid3-locked) .x-grid3-hd-inner");
                        const columnIndex = Array.from(headers).findIndex(h => h.textContent.trim() === month);
                        
                        console.log(`Column index for ${month}: ${columnIndex}`);
                        
                        if (columnIndex !== -1) {
                          const cells = scrollableRow.querySelectorAll('td');
                          console.log(`Found ${cells.length} cells in scrollable row`);
                          
                          if (columnIndex < cells.length) {
                            console.log(`Found cell by column index: ${columnIndex}`);
                            return cells[columnIndex];
                          }
                        }
                      }
                    }
                  }
                }
                
                console.log(`Month cell for ${month} not found`);
                return null;
              } catch (error) {
                console.error(`Error in findMonthCellInRow: ${error}`);
                return null;
              }
            }
            
            // Wait for the loading indicator to disappear
            function waitForLoading(timeout = 20000) {
              return new Promise((resolve, reject) => {
                try {
                  const startTime = Date.now();
                  
                  // First check if it's already hidden
                  const loadingElement = document.querySelector("#loading");
                  console.log(`Initial loading element state: ${loadingElement ? loadingElement.style.display : 'element not found'}`);
                  
                  if (loadingElement && loadingElement.style.display === "none") {
                    console.log("Loading already complete");
                    resolve();
                    return;
                  }
                  
                  // If not hidden, set up an interval to check
                  const checkInterval = setInterval(() => {
                    try {
                      const loadingElement = document.querySelector("#loading");
                      
                      if (loadingElement && loadingElement.style.display === "none") {
                        console.log("Loading complete");
                        clearInterval(checkInterval);
                        // Add extra delay to ensure DOM is fully updated
                        setTimeout(resolve, 500);
                      } else if (Date.now() - startTime > timeout) {
                        console.log("Loading timeout exceeded");
                        clearInterval(checkInterval);
                        reject(new Error("Loading timeout exceeded"));
                      }
                    } catch (error) {
                      console.error("Error in loading interval:", error);
                      clearInterval(checkInterval);
                      reject(new Error(`Loading check error: ${error.message || "Unknown error"}`));
                    }
                  }, 200);
                } catch (error) {
                  console.error("Error in waitForLoading:", error);
                  reject(new Error(`Error in waitForLoading: ${error.message || "Unknown error"}`));
                }
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
              showStatus('Failed to retrieve income data: ' + (data.error || "Unknown error"), 'error');
            }
          } else {
            showStatus('Failed to process results from page', 'error');
          }
        }).catch(error => {
          showStatus('Error: ' + (error.message || "Unknown error"), 'error');
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
              error: error.message || "Unknown error occurred"
            };
          }
          
          // Function to save income data back to Xero
          async function saveIncomeData(branch, month, feeIncome, fundingIncome) {
            return new Promise((resolve, reject) => {
              try {
                // Make sure we have the right branch loaded
                const currentBranchText = document.querySelector('#Budgets_value').value;
                
                if (currentBranchText !== branch) {
                  reject(new Error(`Current branch (${currentBranchText}) doesn't match selected branch (${branch}). Please reload data.`));
                  return;
                }
                
                // Find table cells for fee income and funding income
                const feeRow = findRowByLabel("Fee income (0110)");
                const fundingRow = findRowByLabel("Funding income (0120)");
                
                if (!feeRow) {
                  reject(new Error("Fee income row not found"));
                  return;
                }
                
                if (!fundingRow) {
                  reject(new Error("Funding income row not found"));
                  return;
                }
                
                // Find month cells
                const feeMonthCell = findMonthCellInRow(feeRow, month);
                const fundingMonthCell = findMonthCellInRow(fundingRow, month);
                
                if (!feeMonthCell) {
                  reject(new Error(`Month cell for Fee Income (${month}) not found`));
                  return;
                }
                
                if (!fundingMonthCell) {
                  reject(new Error(`Month cell for Funding Income (${month}) not found`));
                  return;
                }
                
                // Get input elements
                const feeInput = feeMonthCell.querySelector('input');
                const fundingInput = fundingMonthCell.querySelector('input');
                
                if (!feeInput) {
                  reject(new Error("Fee income input not found (month may not be editable)"));
                  return;
                }
                
                if (!fundingInput) {
                  reject(new Error("Funding income input not found (month may not be editable)"));
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
                reject(new Error(`Error saving data: ${error.message || "Unknown error"}`));
              }
            });
          }
          
          // Helper function to find a row by its label text (same as before)
          function findRowByLabel(label) {
            try {
              const allLabelCells = document.querySelectorAll(".x-grid3-cell-inner");
              for (const cell of allLabelCells) {
                if (cell.textContent.trim() === label) {
                  return cell.closest(".x-grid3-row");
                }
              }
              return null;
            } catch (error) {
              console.error(`Error in findRowByLabel: ${error}`);
              return null;
            }
          }
          
          // Helper function to find a month cell in a row (same as before)
          function findMonthCellInRow(row, month) {
            try {
              // Method 1: Try direct selector by ID
              let cell = row.querySelector(`[id="${month}"]`);
              if (cell) return cell;
              
              // Method 2: Try by class
              cell = row.querySelector(`.x-grid3-td-${month}`);
              if (cell) return cell;
              
              // Method 3: If the row is in the locked section, find the corresponding row in the scrollable section
              if (row.closest('.x-grid3-locked')) {
                const lockedRows = document.querySelectorAll('.x-grid3-locked .x-grid3-row');
                const rowIndex = Array.from(lockedRows).indexOf(row);
                
                if (rowIndex !== -1) {
                  const scrollableBodies = document.querySelectorAll('.x-grid3-body:not(.x-grid3-locked)');
                  
                  if (scrollableBodies.length > 0) {
                    const scrollableRows = scrollableBodies[0].querySelectorAll('.x-grid3-row');
                    
                    if (rowIndex < scrollableRows.length) {
                      const scrollableRow = scrollableRows[rowIndex];
                      
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
                }
              }
              
              return null;
            } catch (error) {
              console.error(`Error in findMonthCellInRow: ${error}`);
              return null;
            }
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
            showStatus('Failed to save changes: ' + (data.error || "Unknown error"), 'error');
          }
        } else {
          showStatus('Failed to process results from page', 'error');
        }
      }).catch(error => {
        showStatus('Error: ' + (error.message || "Unknown error"), 'error');
      });
    });
  });
});