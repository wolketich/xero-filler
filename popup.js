
// Budget data from the dropdown
const budgetData = [
  "+ Add new budget",
  "Overall Budget",
  "Barnhall Budget",
  "Barton Drive Budget",
  "Beech Park Budget",
  "Blanchardstown Budget",
  "Bray Budget",
  "Broomhall Budget",
  "Captains Hill Budget",
  "Donabate Budget",
  "Greenlane Budget",
  "Greystones Budget",
  "Head Office Budget",
  "Kinsealy Budget",
  "Kirvin Hill Budget",
  "Ledwill Park Budget",
  "Maynooth Budget",
  "Merrymeeting Budget",
  "Newbridge Budget",
  "Northwood Budget",
  "Swords Budget",
  "Taylors Hill Budget",
  "Westfield Budget",
];

// Month data from the table columns
const monthData = [
  "Feb-25",
  "Mar-25",
  "Apr-25",
  "May-25",
  "Jun-25",
  "Jul-25",
  "Aug-25",
  "Sep-25",
  "Oct-25",
  "Nov-25",
  "Dec-25",
  "Jan-26",
  "Feb-26",
  "Mar-26",
  "Apr-26",
];

// Populate the budget list
const budgetListDiv = document.getElementById("budgetList");
budgetData.forEach((budget) => {
  const budgetItem = document.createElement("div");
  budgetItem.className = "budget-item";
  budgetItem.textContent = budget;
  budgetItem.addEventListener("click", () => {
    alert(`You selected: ${budget}`);
  });
  budgetListDiv.appendChild(budgetItem);
});

// Populate the month dropdown
const monthSelect = document.getElementById("monthSelect");
monthData.forEach((month) => {
  const option = document.createElement("option");
  option.value = month;
  option.textContent = month;
  monthSelect.appendChild(option);
});

// Handle submit button click
const submitBtn = document.getElementById("submitBtn");
submitBtn.addEventListener("click", () => {
  const selectedMonth = monthSelect.value;
  alert(`You selected month: ${selectedMonth}`);
});