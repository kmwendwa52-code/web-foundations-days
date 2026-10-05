// ---------- Select elements ----------
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

// ---------- Data ----------
const API_URL = "https://jsonplaceholder.typicode.com/users";
let allUsers = [];

// ---------- Helpers ----------
function setStatus(message) {
  statusMessage.textContent = message;
}

// Returns the stored users whose name includes the typed text (ignoring case).
function getFilteredUsers() {
  const search = filterInput.value.trim().toLowerCase();
  return allUsers.filter(function (user) {
    return user.name.toLowerCase().includes(search);
  });
}

// ---------- Render ----------
function createUserItem(user) {
  const item = document.createElement("li");

  const name = document.createElement("strong");
  name.textContent = user.name;

  const email = document.createElement("p");
  email.textContent = `Email: ${user.email}`;

  const city = document.createElement("p");
  city.textContent = `City: ${user.address.city}`;

  const company = document.createElement("p");
  company.textContent = `Company: ${user.company.name}`;

  item.append(name, email, city, company);
  return item;
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.appendChild(message);
    return;
  }

  list.forEach(function (user) {
    usersList.appendChild(createUserItem(user));
  });
}

// ---------- Load users ----------
async function loadUsers() {
  loadButton.disabled = true;
  setStatus("Loading users...");

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    allUsers = await response.json();
    renderUsers(getFilteredUsers());
    setStatus(`Loaded ${allUsers.length} users.`);
  } catch (error) {
    setStatus(`Error: could not load users. ${error.message}`);
  } finally {
    loadButton.disabled = false;
  }
}

// ---------- Events ----------
loadButton.addEventListener("click", loadUsers);

// Filtering uses the users already stored, so no new request is made.
filterInput.addEventListener("input", function () {
  if (allUsers.length === 0) {
    return;
  }
  renderUsers(getFilteredUsers());
});
