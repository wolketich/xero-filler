// Content script for Xero Budget Manager
// Created: 2025-05-12 10:41:34
// Author: wolketich

// This script allows direct interaction with the page DOM
// Functions are exposed and can be called by the popup script via chrome.scripting.executeScript

// Function to extract branches from the dropdown
function extractBranches() {
  const dropdownToggle = document.querySelector("#Budgets_toggle");
  if (dropdownToggle) {
    dropdownToggle.click();
    
    // Allow time for dropdown to appear
    return new Promise(resolve => {
      setTimeout(() => {
        const branchElements = document.querySelectorAll("#Budgets_suggestions .p");
        const branches = Array.from(branchElements).map(el => el.textContent.trim());
        
        // Close dropdown
        dropdownToggle.click();
        
        resolve(branches);
      }, 500);
    });
  } else {
    return Promise.resolve([]);
  }
}

// Function to extract months from table headers
function extractMonths() {
  const monthElements = document.querySelectorAll(".x-grid3-header .x-grid3-hd-inner");
  return Array.from(monthElements)
    .map(el => el.textContent.trim())
    .filter(text => /[A-Za-z]+-\d+/.test(text));
}

// Message listener - used for direct communication from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  
  if (message.action === "getDOMInfo") {
    // Return information about the current state of the page
    sendResponse({
      url: window.location.href,
      title: document.title,
      hasXeroElements: !!document.querySelector("#Budgets_toggle")
    });
  }
  
  return true; // Keep the message channel open for async responses
});