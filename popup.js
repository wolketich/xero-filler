document.addEventListener('DOMContentLoaded', function() {
  const loadFieldsBtn = document.getElementById('loadFieldsBtn');
  const statusMessage = document.getElementById('statusMessage');
  const dataContainer = document.getElementById('dataContainer');
  const budgetSelect = document.getElementById('budgetSelect');
  const monthSelect = document.getElementById('monthSelect');
  const submitBtn = document.getElementById('submitBtn');
  
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
      // Execute content script in the active tab
      chrome.tabs.executeScript(
        tabs[0].id,
        {file: 'content.js'},
        function() {
          // After content script loads, send a message to scrape data
          chrome.tabs.sendMessage(tabs[0].id, {action: "scrapeData"}, function(response) {
            if (chrome.runtime.lastError) {
              showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
              return;
            }
            
            if (response && response.success) {
              // Populate budget dropdown
              budgetSelect.innerHTML = '';
              response.budgets.forEach(function(budget) {
                const option = document.createElement('option');
                option.value = budget;
                option.textContent = budget;
                budgetSelect.appendChild(option);
              });
              
              // Populate month dropdown
              monthSelect.innerHTML = '';
              response.months.forEach(function(month) {
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
          });
        }
      );
    });
  });
  
  // Handle submit button
  submitBtn.addEventListener('click', function() {
    const selectedBudget = budgetSelect.value;
    const selectedMonth = monthSelect.value;
    
    if (selectedBudget && selectedMonth) {
      showStatus(`Selected: ${selectedBudget} for ${selectedMonth}`, 'success');
      
      // Send the selected values to the content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "fillBudget",
          budget: selectedBudget,
          month: selectedMonth
        }, function(response) {
          if (response && response.success) {
            showStatus('Budget applied successfully!', 'success');
          } else {
            showStatus('Failed to apply budget. Please try again.', 'error');
          }
        });
      });
    } else {
      showStatus('Please select both a budget and a month.', 'error');
    }
  });
});