// Dynamically extract budget names from the dropdown menu
function extractBudgets() {
  const budgetSuggestions = document.querySelectorAll("#Budgets_suggestions .p");
  return Array.from(budgetSuggestions).map((el) => el.textContent.trim());
}

// Dynamically extract months from the table header
function extractMonths() {
  const monthHeaders = document.querySelectorAll(".x-grid3-header .x-grid3-hd");
  return Array.from(monthHeaders).map((el) => el.textContent.trim());
}

// Populate the budget list dynamically
function populateBudgets(budgets) {
  const budgetListDiv = document.getElementById("budgetList");
  budgets.forEach((budget) => {
    const budgetItem = document.createElement("div");
    budgetItem.className = "budget-item";
    budgetItem.textContent = budget;
    budgetItem.addEventListener("click", () => {
      alert(`You selected: ${budget}`);
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
document.addEventListener("DOMContentLoaded", () => {
  // Extract budgets and months dynamically from the webpage
  const budgets = extractBudgets();
  const months = extractMonths();

  // Populate the popup UI with the extracted data
  populateBudgets(budgets);
  populateMonths(months);

  // Handle submit button click
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.addEventListener("click", () => {
    const selectedMonth = document.getElementById("monthSelect").value;
    alert(`You selected month: ${selectedMonth}`);
  });
});