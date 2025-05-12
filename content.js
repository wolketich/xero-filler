// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle scraping data from the page
  if (request.action === "scrapeData") {
    try {
      // Open the budget dropdown to ensure options are visible
      const dropdownToggle = document.querySelector("#Budgets_toggle");
      if (dropdownToggle) {
        dropdownToggle.click();
        
        // Wait for dropdown to appear
        setTimeout(() => {
          try {
            // Extract budgets
            const budgetElements = document.querySelectorAll("#Budgets_suggestions .p");
            const budgets = Array.from(budgetElements).map(el => el.textContent.trim());
            
            // Close dropdown to avoid interfering with the page
            dropdownToggle.click();
            
            // Extract months from table header
            const monthElements = document.querySelectorAll(".x-grid3-hd-inner");
            const months = Array.from(monthElements)
              .map(el => el.textContent.trim())
              .filter(text => /[A-Za-z]+-\d+/.test(text)); // Filter for month patterns like "Feb-25"
            
            // Send data back to popup
            sendResponse({
              success: true,
              budgets: budgets,
              months: months
            });
          } catch (e) {
            console.error("Error scraping data:", e);
            sendResponse({
              success: false,
              error: e.message
            });
          }
        }, 500); // Wait for dropdown to fully open
        
        // Return true to indicate we'll respond asynchronously
        return true;
      } else {
        sendResponse({
          success: false,
          error: "Budget dropdown not found"
        });
      }
    } catch (e) {
      console.error("Error:", e);
      sendResponse({
        success: false,
        error: e.message
      });
    }
  }
  
  // Handle filling in the budget
  else if (request.action === "fillBudget") {
    try {
      // Select the budget from dropdown
      const budgetInput = document.querySelector("#Budgets_value");
      const dropdownToggle = document.querySelector("#Budgets_toggle");
      
      if (budgetInput && dropdownToggle) {
        // Open dropdown
        dropdownToggle.click();
        
        setTimeout(() => {
          // Find and click the budget item
          const budgetItems = document.querySelectorAll("#Budgets_suggestions .p");
          const targetBudget = Array.from(budgetItems).find(
            item => item.textContent.trim() === request.budget
          );
          
          if (targetBudget) {
            targetBudget.click();
            
            // Now select the month column
            // This part requires more specific implementation based on
            // how the Xero budget table works for selecting months
            
            sendResponse({
              success: true,
              message: `Selected ${request.budget} for ${request.month}`
            });
          } else {
            sendResponse({
              success: false,
              error: "Could not find the specified budget"
            });
          }
        }, 500);
        
        return true;
      } else {
        sendResponse({
          success: false,
          error: "Budget input not found"
        });
      }
    } catch (e) {
      console.error("Error filling budget:", e);
      sendResponse({
        success: false,
        error: e.message
      });
    }
  }
});