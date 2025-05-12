// Utility function to wait for an element to appear in the DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const interval = 100; // Check every 100ms
    const startTime = Date.now();

    const timer = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(timer);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(timer);
        reject(`Timeout waiting for element: ${selector}`);
      }
    }, interval);
  });
}

// Open the dropdown menu to reveal all options
function openDropdown() {
  const dropdownToggle = document.querySelector("#Budgets_toggle");
  if (dropdownToggle) {
    dropdownToggle.click(); // Simulate a click to open the dropdown
  }
}

// Extract location names from the dropdown menu
function extractLocations() {
  const locationElements = document.querySelectorAll("#Budgets_suggestions .p");
  return Array.from(locationElements).map((el) => el.textContent.trim());
}

// Extract months from the table header
function extractMonths() {
  const monthElements = document.querySelectorAll(".x-grid3-header .x-grid3-hd");
  return Array.from(monthElements).map((el) => el.textContent.trim());
}

// Populate the budget list dynamically
function populateLocations(locations) {
  const budgetListDiv = document.getElementById("budgetList");
  locations.forEach((location) => {
    const budgetItem = document.createElement("div");
    budgetItem.className = "budget-item";
    budgetItem.textContent = location;
    budgetItem.addEventListener("click", () => {
      alert(`You selected: ${location}`);
    });
    budgetListDiv.appendChild(budgetItem);
  });
}

// Populate the month dropdown dynamically
function populateMonths(months) {
  const monthSelect = document.getElementById("monthSelect");
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelect.appendChild(option);
  });
}

// Main function to initialize the popup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Wait for the dropdown toggle to appear
    await waitForElement("#Budgets_toggle");

    // Open the dropdown to reveal location names
    openDropdown();

    // Wait for the location suggestions to appear
    await waitForElement("#Budgets_suggestions .p");

    // Extract locations and months from the DOM
    const locations = extractLocations();
    const months = extractMonths();

    // Populate the UI with the extracted data
    populateLocations(locations);
    populateMonths(months);

    // Handle submit button click
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.addEventListener("click", () => {
      const selectedMonth = document.getElementById("monthSelect").value;
      alert(`You selected month: ${selectedMonth}`);
    });
  } catch (error) {
    console.error(error);
    alert("An error occurred while loading the data.");
  }
});