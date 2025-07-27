// Initial Data
let testCases = JSON.parse(localStorage.getItem('testCases')) || [
    { id: 1, title: "Login and check dashboard", user: 'john_doe', actions: ['login', 'navigate_dashboard'], promptSteps: JSON.stringify({ steps: [ { action: 'login', data: { username: 'john_doe', password: 'test123' } }, { action: 'navigate_dashboard', data: { section: 'overview' } } ] }, null, 2), createdAt: new Date().toISOString(), status: 'pending', gif_path: null, pdf_url: null },
    { id: 2, title: "Create and logout", user: 'jane_smith', actions: ['login', 'create_report', 'logout'], promptSteps: JSON.stringify({ steps: [ { action: 'login', data: { username: 'jane_smith', password: 'test456' } }, { action: 'create_report', data: { title: 'Monthly Report', type: 'summary' } }, { action: 'logout', data: {} } ] }, null, 2), createdAt: new Date().toISOString(), status: 'pending', gif_path: null, pdf_url: null }
];

let testRuns = JSON.parse(localStorage.getItem('testRuns')) || [];

let users = JSON.parse(localStorage.getItem('users')) || [
    { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123' },
    { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', password: 'password456' },
];

let actions = JSON.parse(localStorage.getItem('actions')) || [
    { id: 1, prompt: 'User login', stepsJson: JSON.stringify({ steps: [{ action: 'input', selector: '#username', value: 'user' }, { action: 'input', selector: '#password', value: 'pass' }, { action: 'click', selector: '#login-button' }] }, null, 2) },
    { id: 2, prompt: 'Navigate to dashboard', stepsJson: JSON.stringify({ steps: [{ action: 'navigate', url: '/dashboard' }] }, null, 2) },
];

// Helper to save to localStorage
function saveData() {
    localStorage.setItem('testCases', JSON.stringify(testCases));
    localStorage.setItem('testRuns', JSON.stringify(testRuns));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('actions', JSON.stringify(actions));
}

// Tab Switching
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[onclick="openTab('${tabId}')"]`).classList.add('active');
    // Refresh content when tab is opened
    if (tabId === 'test-cases') renderTestCaseList();
    if (tabId === 'users') renderUsers();
    if (tabId === 'actions') renderActions();
    if (tabId === 'reports') populateReports();
}

// Populate Dropdowns and Checkboxes
function populateSelects() {
    const userSelect = document.getElementById('user-select');
    if(userSelect) userSelect.innerHTML = '<option value="">Choose User</option>' + users.map(user => `<option value="${user.name.replace(/ /g, '_').toLowerCase()}">${user.name}</option>`).join('');

    const actionsCheckboxes = document.getElementById('actions-checkboxes');
    if(actionsCheckboxes) actionsCheckboxes.innerHTML = actions.map(action => `<label><input type="checkbox" value="${action.prompt.replace(/ /g, '_').toLowerCase()}" onchange="toggleAction(this.value, this.checked)"> ${action.prompt}</label>`).join('');
}

// Selected Actions Handler
let selectedActions = [];
function toggleAction(action, checked) {
    selectedActions = checked 
        ? [...selectedActions, action] 
        : selectedActions.filter(a => a !== action);
}

// Add Test Case
function addTestCase() {
    const title = document.getElementById('test-title').value.trim();
    const user = document.getElementById('user-select').value;
    const promptSteps = document.getElementById('prompt-steps').value;

    if (!title || !user || !promptSteps.trim()) {
        alert('Please fill in title, user, and prompt steps!');
        return;
    }
    try {
        JSON.parse(promptSteps);
        const newTestCase = {
            id: testCases.length ? Math.max(...testCases.map(tc => tc.id)) + 1 : 1,
            title,
            user,
            actions: [...selectedActions],
            promptSteps,
            createdAt: new Date().toISOString(),
            status: 'pending',
            gif_path: null,
            pdf_url: null
        };
        testCases.push(newTestCase);
        saveData();
        selectedActions = [];
        document.getElementById('test-case-form').reset();
        document.querySelectorAll('#actions-checkboxes input').forEach(cb => cb.checked = false);
        renderTestCaseList();
        alert('Test case added!');
    } catch (e) {
        alert('Invalid JSON in Prompt Steps!');
    }
}

// --- Test Execution ---
async function runTestById(testCaseId) {
    const tc = testCases.find(t => t.id === testCaseId);
    if (!tc) return null;

    try {
        const userObj = users.find(u => u.name.replace(/ /g, '_').toLowerCase() === tc.user);
        const email = userObj ? userObj.email : '';
        const password = userObj ? userObj.password : '';
        const res = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: tc.promptSteps, username: email, password: password })
        });
        const data = await res.json();
        if (res.ok) {
            tc.status = data.test_status;
            tc.gif_path = data.gif_url;
            tc.pdf_url = data.pdf_url;
        } else {
            tc.status = 'failed';
        }
        return { testCaseId: tc.id, status: tc.status, gif_path: tc.gif_path, pdf_url: tc.pdf_url };
    } catch (e) {
        console.error(`Run failed for test ${tc.id}:`, e);
        tc.status = 'failed';
        return { testCaseId: tc.id, status: 'failed' };
    } finally {
        saveData();
        renderTestCaseList();
    }
}

async function runTest(id) {
    await runTestById(id);
}

async function runTests() {
    if (testCases.length === 0) {
        alert('No test cases to run!');
        return;
    }
    const results = [];
    for (let tc of testCases) {
        const result = await runTestById(tc.id);
        if(result) results.push(result);
    }
    const newRun = {
        id: testRuns.length ? Math.max(...testRuns.map(r => r.id)) + 1 : 1,
        timestamp: new Date().toISOString(),
        totalTests: testCases.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
    };
    testRuns.unshift(newRun); // Add to the beginning of the array
    saveData();
    populateReports();
    alert('All tests have been run!');
}

function deleteTestCase(id) {
    if (confirm('Delete this test case?')) {
        testCases = testCases.filter(t => t.id !== id);
        saveData();
        renderTestCaseList();
    }
}
// --- Rendering Functions ---
function renderTestCaseList() {
    const container = document.getElementById('test-case-list');
    if(!container) return;
    container.innerHTML = testCases.length === 0
        ? '<div class="no-tests">No test cases created yet.</div>'
        : testCases.map(tc => `
            <div class="test-case-card">
                <h3>${tc.title || 'Test Case #' + tc.id}</h3>
                <p>User: ${tc.user} | Created: ${new Date(tc.createdAt).toLocaleDateString()}</p>
                <p>Status: <span class="badge ${tc.status === 'passed' ? 'badge-success' : tc.status === 'failed' ? 'badge-failure' : ''}">${tc.status || 'Pending'}</span></p>
                <div class="buttons">
                    <button onclick="viewTestCase(${tc.id})">View</button>
                    <button onclick="editTestCase(${tc.id})">Edit</button>
                    <button onclick="runTest(${tc.id})">Run</button>
                    <button onclick="deleteTestCase(${tc.id})">Delete</button>
                    ${tc.gif_path ? `<button onclick="showGif('${tc.gif_path}')">Show GIF</button>` : ''}
                    ${tc.pdf_url ? `<button onclick="downloadPdf('${tc.pdf_url}')">Download PDF</button>` : ''}
                </div>
            </div>`).join('');
}

function renderUsers() {
    const tbody = document.querySelector('#users-table tbody');
    if(!tbody) return;
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
                <button onclick="editUser(${user.id})">Edit</button>
                <button onclick="deleteUser(${user.id})">Delete</button>
            </td>
        </tr>`).join('');
}

function renderActions() {
    const tbody = document.querySelector('#actions-table tbody');
    if(!tbody) return;
    tbody.innerHTML = actions.map(action => `
        <tr>
            <td>${action.id}</td>
            <td>${action.prompt}</td>
            <td>
                <button onclick="editAction(${action.id})">Edit</button>
                <button onclick="deleteAction(${action.id})">Delete</button>
            </td>
        </tr>`).join('');
}

function populateReports() {
    // Update the summary cards
    document.getElementById('total-test-cases').textContent = testCases.length;
    document.getElementById('total-runs').textContent = testRuns.length;

    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;
    
    // Handle case with no test runs
    if (testRuns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No test runs recorded yet.</td></tr>`;
        return;
    }

    // Generate table rows from testRuns data
    tbody.innerHTML = testRuns.map(run => {
        // Calculate success rate, handle division by zero
        const successRate = run.totalTests > 0 ? (run.passed / run.totalTests) * 100 : 0;
        
        // Format the timestamp to be more readable
        const timestamp = new Date(run.timestamp).toLocaleString([], {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(',', '');

        // Determine the class for the progress bar based on success rate
        const progressBarClass = successRate < 60 ? 'failed' : '';

        return `
            <tr>
                <td>#${run.id}</td>
                <td>${run.totalTests}</td>
                <td>${run.failed}</td>
                <td>
                    ${successRate.toFixed(0)}%
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill ${progressBarClass}" style="width: ${successRate}%;"></div>
                    </div>
                </td>
                <td>${timestamp}</td>
            </tr>
        `;
    }).join('');
}

// --- CRUD for Users and Actions ---
function addUser() {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value.trim();
    if (!name || !email || !password) return alert('Please fill in all fields!');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('Please enter a valid email address!');
    if (users.some(u => u.email === email)) return alert('A user with this email already exists!');

    const newUser = { id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1, name, email, password };
    users.push(newUser);
    saveData();
    renderUsers();
    populateSelects();
    document.getElementById('user-form').reset();
    alert('User added successfully!');
}

function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user?')) {
        users = users.filter(u => u.id !== id);
        saveData();
        renderUsers();
        populateSelects();
    }
}

// --- UPDATED Actions Workflow ---
// Step 1: Generate JSON from prompt and populate the textarea
async function generateActionJson() {
    const prompt = document.getElementById('action-prompt').value.trim();
    if (!prompt) {
        return alert('Please enter a prompt first!');
    }

    const generateButton = document.getElementById('generate-json-btn');
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    try {
        const response = await fetch('/generate-action-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
        }
        // Populate the textarea with the formatted JSON
        document.getElementById('action-steps').value = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error('Error generating action JSON:', error);
        alert(`Failed to generate JSON: ${error.message}`);
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Steps JSON';
    }
}

// Step 2: Add the action using the (potentially edited) content of the form
function addAction() {
    const prompt = document.getElementById('action-prompt').value.trim();
    const stepsJson = document.getElementById('action-steps').value.trim();

    if (!prompt || !stepsJson) {
        return alert('Please enter a prompt and then generate the steps JSON.');
    }

    try {
        JSON.parse(stepsJson); // Validate JSON before saving
    } catch (e) {
        return alert('The Steps JSON is not valid. Please check the formatting or generate it again.');
    }

    const newAction = {
        id: actions.length ? Math.max(...actions.map(a => a.id)) + 1 : 1,
        prompt,
        stepsJson
    };

    actions.push(newAction);
    saveData();
    renderActions();
    populateSelects();
    document.getElementById('action-form').reset();
    alert('Action added successfully!');
}

function deleteAction(id) {
    if (confirm('Are you sure you want to delete this action?')) {
        actions = actions.filter(a => a.id !== id);
        saveData();
        renderActions();
        populateSelects();
    }
}

// --- Modal Management (View/Edit) ---
function viewTestCase(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    document.getElementById('modal-title').textContent = 'View Test Case: ' + tc.title;
    document.getElementById('modal-form').innerHTML = `
        <p><strong>User:</strong> ${tc.user}</p>
        <p><strong>Actions:</strong> ${tc.actions.join(', ')}</p>
        <p><strong>Prompt Steps:</strong></p>
        <pre>${JSON.stringify(JSON.parse(tc.promptSteps), null, 2)}</pre>`;
    document.getElementById('modal-save').style.display = 'none';
    document.getElementById('modal').style.display = 'block';
}

function editTestCase(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    document.getElementById('modal-title').textContent = 'Edit Test Case #' + id;
    document.getElementById('modal-form').innerHTML = `
        <label for="edit-title">Title:</label>
        <input id="edit-title" value="${tc.title || ''}">
        <label for="edit-user">User:</label>
        <input id="edit-user" value="${tc.user}">
        <label for="edit-actions">Actions (comma-separated):</label>
        <input id="edit-actions" value="${tc.actions.join(', ')}">
        <label for="edit-promptsteps">Prompt Steps JSON:</label>
        <textarea id="edit-promptsteps">${tc.promptSteps}</textarea>`;
    const modalSave = document.getElementById('modal-save');
    modalSave.style.display = 'block';
    modalSave.dataset.id = id;
    modalSave.dataset.type = 'testcase';
    document.getElementById('modal').style.display = 'block';
}

function editUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    document.getElementById('modal-title').textContent = `Edit User #${id}`;
    document.getElementById('modal-form').innerHTML = `
        <label for="edit-name">Name:</label>
        <input id="edit-name" value="${user.name}">
        <label for="edit-email">Email:</label>
        <input id="edit-email" type="email" value="${user.email}">
        <label for="edit-password">Password:</label>
        <input id="edit-password" type="password" value="${user.password}">`;
    const modalSave = document.getElementById('modal-save');
    modalSave.style.display = 'block';
    modalSave.dataset.id = id;
    modalSave.dataset.type = 'user';
    document.getElementById('modal').style.display = 'block';
}

function editAction(id) {
    const action = actions.find(a => a.id === id);
    if (!action) return;
    document.getElementById('modal-title').textContent = `Edit Action #${id}`;
    document.getElementById('modal-form').innerHTML = `
        <label for="edit-prompt">Prompt:</label>
        <input id="edit-prompt" value="${action.prompt}">
        <label for="edit-steps">Steps JSON:</label>
        <textarea id="edit-steps">${action.stepsJson}</textarea>`;
    const modalSave = document.getElementById('modal-save');
    modalSave.style.display = 'block';
    modalSave.dataset.id = id;
    modalSave.dataset.type = 'action';
    document.getElementById('modal').style.display = 'block';
}

// --- Refactored Save Logic ---
function saveTestCaseChanges(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    tc.title = document.getElementById('edit-title').value.trim();
    tc.user = document.getElementById('edit-user').value;
    tc.actions = document.getElementById('edit-actions').value.split(',').map(a => a.trim());
    tc.promptSteps = document.getElementById('edit-promptsteps').value;
    saveData();
    renderTestCaseList();
}

function saveUserChanges(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newName = document.getElementById('edit-name').value.trim();
    const newEmail = document.getElementById('edit-email').value.trim();
    const newPassword = document.getElementById('edit-password').value.trim();

    if (!newName || !newEmail || !newPassword) return alert('Please fill in all fields!');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return alert('Please enter a valid email address!');
    if (users.some(u => u.id !== id && u.email === newEmail)) return alert('A user with this email already exists!');
    
    user.name = newName;
    user.email = newEmail;
    user.password = newPassword;
    saveData();
    renderUsers();
    populateSelects();
}

function saveActionChanges(id) {
    const action = actions.find(a => a.id === id);
    if (!action) return;
    const newPrompt = document.getElementById('edit-prompt').value.trim();
    const newSteps = document.getElementById('edit-steps').value.trim();
    if (!newPrompt || !newSteps) return alert('Please fill in all fields!');
    try {
        JSON.parse(newSteps);
    } catch (e) {
        return alert('Invalid JSON in steps!');
    }
    action.prompt = newPrompt;
    action.stepsJson = newSteps;
    saveData();
    renderActions();
    populateSelects();
}

function saveModalChanges() {
    const modalSave = document.getElementById('modal-save');
    const id = parseInt(modalSave.dataset.id);
    const type = modalSave.dataset.type;

    switch (type) {
        case 'user':
            saveUserChanges(id);
            break;
        case 'action':
            saveActionChanges(id);
            break;
        case 'testcase':
            saveTestCaseChanges(id);
            break;
        default:
            console.error('Unknown modal type:', type);
            return;
    }
    closeModal();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// --- Media Previews ---
function showGif(gifUrl) {
    if (!gifUrl) return alert('No GIF available');
    const w = window.open();
    w.document.write(`<body style="margin:0; background:#333;"><img src="${gifUrl}" alt="Test GIF" style="max-width: 100%;"></body>`);
}

function downloadPdf(pdfUrl) {
    if (!pdfUrl) return alert('No PDF available');
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfUrl.split('/').pop() || 'test_report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    openTab('test-cases');
    document.getElementById('modal-save').addEventListener('click', saveModalChanges);
    window.onclick = (event) => {
        if (event.target === document.getElementById('modal')) closeModal();
    };
});
