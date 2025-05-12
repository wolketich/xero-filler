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
                              // Get values for fee income and funding income
                              const feeIncome = getValueByLabelAndMonth("Fee income (0110)", month);
                              console.log(`Fee income value: ${feeIncome}`);
                              
                              const fundingIncome = getValueByLabelAndMonth("Funding income (0120)", month);
                              console.log(`Funding income value: ${fundingIncome}`);
                              
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
                          }, 500); // Extra delay to ensure table is fully loaded
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
            
            // Get value by finding the row with the label and then the cell for the month
            function getValueByLabelAndMonth(label, month) {
              console.log(`Looking for label: "${label}" and month: "${month}"`);
              
              // Step 1: Find all row cells that might contain our label
              const allLabelCells = document.querySelectorAll(".x-grid3-cell-inner");
              console.log(`Found ${allLabelCells.length} potential label cells`);
              
              // Step 2: Find the row that contains our target label
              let targetRow = null;
              for (const cell of allLabelCells) {
                if (cell.textContent.trim() === label) {
                  console.log(`Found label: ${label}`);
                  // Go up the DOM to find the row
                  targetRow = cell.closest(".x-grid3-row");
                  break;
                }
              }
              
              if (!targetRow) {
                console.error(`Row not found for label: ${label}`);
                return `Error: Row not found for label: ${label}`;
              }
              
              // Step 3: Find the cell in this row that has the month ID or class
              const monthCell = targetRow.querySelector(`[id="${month}"]`) || 
                               targetRow.querySelector(`.x-grid3-td-${month}`);
              
              if (!monthCell) {
                console.error(`Cell not found for month: ${month}`);
                return `Error: Cell not found for month: ${month}`;
              }
              
              console.log(`Found cell for month: ${month}`, monthCell);
              
              // Step 4: Extract the value (either from input or from text)
              const input = monthCell.querySelector('input');
              
              if (input) {
                console.log(`Found input with value: ${input.value}`);
                return input.value;
              } else {
                const innerCell = monthCell.querySelector('.x-grid3-cell-inner');
                const value = innerCell ? innerCell.textContent.trim() : "N/A";
                console.log(`Found text value: ${value}`);
                return value;
              }
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