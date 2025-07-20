// Initialize
window.onload = () => {
  showSection('dashboard');
  renderTestCases();
};


let testCases = [];
let currentEditingId = null; // Track which test case is being edited


// Initialize the application
document.addEventListener("DOMContentLoaded", function() {
  showSection("dashboard");
  renderTestCases();
  updateStats();


  // Close dropdown when clicking outside
  document.addEventListener("click", function(event) {
    if (!event.target.matches(".frequent-btn")) {
      closeFrequentDropdown();
    }
  });
});


function showSection(section) {
  document.querySelectorAll(".dashboard-container").forEach(el => el.classList.remove("active"));
  document.getElementById(section).classList.add("active");
  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.nav-button[onclick*="${section}"]`).classList.add("active");
}


function openModal(modalId) {
  document.getElementById(modalId).style.display = "block";
  if (modalId === "createModal") {
    clearCreateForm();
  }
}


function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  if (modalId === "editModal") {
    currentEditingId = null; // Clear editing state
  }
}


function clearCreateForm() {
  document.getElementById("newEmailInput").value = "";
  document.getElementById("newPasswordInput").value = "";
  document.getElementById("actionTypeSelect").value = "";
  document.getElementById("newPromptInput").value = "";
}


function clearEditForm() {
  document.getElementById("editEmailInput").value = "";
  document.getElementById("editPasswordInput").value = "";
  document.getElementById("editActionTypeSelect").value = "";
  document.getElementById("editPromptInput").value = "";
}


function updateStats() {
  document.getElementById("totalTests").textContent = testCases.length;
  document.getElementById("successfulTests").textContent = testCases.filter(t => t.status === "success").length;
  document.getElementById("failedTests").textContent = testCases.filter(t => t.status === "failed").length;
  document.getElementById("categories").textContent = new Set(testCases.map(t => t.actionType).filter(type => type)).size;
}


function renderTestCases() {
  const container = document.getElementById("testCaseContainer");
  container.innerHTML = "";


  if (testCases.length === 0) {
    container.innerHTML = 
      `<p style="text-align: center; color: #6b7280; padding: 2rem;">No test cases created yet.</p>`;
    return;
  }


  testCases.forEach(test => {
    const div = document.createElement("div");
    div.className = "test-case-card";
    div.innerHTML = `
      <div class="test-case-header">
        <span class="validation ${test.status === "failed" ? "failed" : ""}">
          ${test.status === "failed" ? "⚠ " : ""}${test.prompt}
        </span>
        <span class="username">${test.email}${test.actionType ? ` - ${test.actionType}` : ""}</span>
      </div>
      <div class="test-case-actions">
        <button class="action-button small" onclick="deleteTestCase(${test.id})">🗑</button>
        <button class="action-button run" onclick="runTest(${test.id})">Run</button>
        <button class="action-button edit" onclick="editTestCase(${test.id})">Edit</button>
        ${test.pdf_url ? `<button class="action-button download-btn" onclick="downloadPDF(${test.id})">🖥️ PDF</button>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
  updateStats();
}


function downloadPDF(id) {
  const test = testCases.find(t => t.id === id);
  if (test && test.pdf_url) {
    const link = document.createElement('a');
    link.href = test.pdf_url;
    link.download = `test_${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    alert("No PDF available for this test case.");
  }
}


function saveNewPrompt() {
  const newEmail = document.getElementById("newEmailInput").value.trim();
  const newPassword = document.getElementById("newPasswordInput").value.trim();
  const actionType = document.getElementById("actionTypeSelect").value;
  const newPrompt = document.getElementById("newPromptInput").value.trim();


  if (!newEmail || !newPassword || !newPrompt) {
    return alert("Please enter email, password, and prompt");
  }


  if (!isValidEmail(newEmail)) {
    alert("Please enter a valid email address");
    return;
  }


  const newTest = {
    id: Date.now(),
    email: newEmail,
    password: newPassword,
    actionType: actionType,
    prompt: newPrompt,
    status: "pending"
  };


  testCases.push(newTest);
  closeModal("createModal");
  renderTestCases();
  updateLatestResult("New test case created successfully");
}


function editTestCase(id) {
  const test = testCases.find(t => t.id === id);
  if (!test) {
    alert("Test case not found");
    return;
  }


  // Set the current editing ID
  currentEditingId = id;


  // Populate the edit form with current values
  document.getElementById("editEmailInput").value = test.email;
  document.getElementById("editPasswordInput").value = test.password;
  document.getElementById("editActionTypeSelect").value = test.actionType || "";
  document.getElementById("editPromptInput").value = test.prompt;


  // Open the edit modal
  openModal("editModal");
}


function saveEditedPrompt() {
  if (!currentEditingId) {
    alert("No test case selected for editing");
    return;
  }


  const editedEmail = document.getElementById("editEmailInput").value.trim();
  const editedPassword = document.getElementById("editPasswordInput").value.trim();
  const editedActionType = document.getElementById("editActionTypeSelect").value;
  const editedPrompt = document.getElementById("editPromptInput").value.trim();


  if (!editedEmail || !editedPassword || !editedPrompt) {
    return alert("Please enter email, password, and prompt");
  }


  if (!isValidEmail(editedEmail)) {
    alert("Please enter a valid email address");
    return;
  }


  // Find and update the test case
  const testIndex = testCases.findIndex(t => t.id === currentEditingId);
  if (testIndex !== -1) {
    testCases[testIndex].email = editedEmail;
    testCases[testIndex].password = editedPassword;
    testCases[testIndex].actionType = editedActionType;
    testCases[testIndex].prompt = editedPrompt;
    
    closeModal("editModal");
    renderTestCases();
    updateLatestResult(`Test case ${currentEditingId} updated successfully`);
  } else {
    alert("Test case not found");
  }
}


function editLatestEntry() {
  if (testCases.length > 0) {
    const latestTest = testCases[testCases.length - 1];
    editTestCase(latestTest.id);
  } else {
    alert("No entries to edit");
  }
}


function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}


function deleteTestCase(id) {
  if (confirm("Are you sure you want to delete this test case?")) {
    testCases = testCases.filter(t => t.id !== id);
    renderTestCases();
    updateLatestResult(`Deleted test case with ID ${id}`);
  }
}


async function runTest(id) {
  const test = testCases.find(t => t.id === id);
  if (!test) return alert("Test not found");


  try {
    const res = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: test.prompt,
        username: test.email,
        password: test.password
      })
    });


    const data = await res.json();
    if (res.ok) {
      test.status = data.test_status || 'success';  // Use returned status
      test.pdf_url = data.pdf_url;  // Store PDF URL
      document.getElementById('latestResult').textContent = `Test ${id} succeeded: ${data.result}`;
    } else {
      test.status = 'failed';
      document.getElementById('latestResult').textContent = `Test ${id} failed: ${data.message}`;
    }
    renderTestCases();
  } catch (error) {
    test.status = 'failed';
    document.getElementById('latestResult').textContent = `Test ${id} failed: ${error.message}`;
    renderTestCases();
  }
}


function exportPlaybook() {
  const data = JSON.stringify(testCases, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "playbook.json";
  a.click();
  URL.revokeObjectURL(url);
  updateLatestResult("Playbook exported as playbook.json");
}


function updateLatestResult(message) {
  document.getElementById("latestResult").textContent = message;
}


// Frequent dropdown functions
function toggleFrequentDropdown() {
  const dropdown = document.getElementById("frequentDropdown");
  dropdown.classList.toggle("show");
}


function closeFrequentDropdown() {
  const dropdown = document.getElementById("frequentDropdown");
  dropdown.classList.remove("show");
}


function handleFrequentAction(action) {
  closeFrequentDropdown();
  switch (action) {
    case "add":
      alert("Frequent Add action triggered");
      // Add your frequent add logic here
      break;
    case "drop":
      alert("Frequent Drop action triggered");
      // Add your frequent drop logic here
      break;
    case "delete":
      alert("Frequent Delete action triggered");
      // Add your frequent delete logic here
      break;
    case "Search":
      alert("Frequent Search action triggered");
      // Add your frequent search logic here
      break;
    default:
      console.log("Unknown frequent action:", action);
  }
}


// Control button functions (Delete, Run, and Edit for latest entry)
function deleteLatestEntry() {
  if (testCases.length > 0) {
    if (confirm("Are you sure you want to delete the latest entry?")) {
      testCases.pop();
      updateStats();
      renderTestCases();
      updateLatestResult("Latest entry deleted");
    }
  } else {
    alert("No entries to delete");
  }
}


function runLatestEntry() {
  if (testCases.length > 0) {
    const latestTest = testCases[testCases.length - 1];
    runTest(latestTest.id);
  } else {
    alert("No entries to run");
  }
}


// Keyboard shortcuts
document.addEventListener("keydown", function(event) {
  // Escape key to close modals
  if (event.key === "Escape") {
    closeModal("createModal");
    closeModal("editModal");
    closeFrequentDropdown();
  }


  // Ctrl+N to open new test case modal
  if (event.ctrlKey && event.key === "n") {
    event.preventDefault();
    openModal("createModal");
  }


  // Ctrl+E to edit latest entry
  if (event.ctrlKey && event.key === "e") {
    event.preventDefault();
    editLatestEntry();
  }
});
