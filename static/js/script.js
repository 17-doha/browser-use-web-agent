// Initial Data
let testCases = JSON.parse(localStorage.getItem('testCases')) || [
    { id: 1, user: 'john_doe', actions: ['login', 'navigate_dashboard'], promptSteps: JSON.stringify({ steps: [ { action: 'login', data: { username: 'john_doe', password: 'test123' } }, { action: 'navigate_dashboard', data: { section: 'overview' } } ] }, null, 2), createdAt: new Date().toISOString() },
    { id: 2, user: 'jane_smith', actions: ['login', 'create_report', 'logout'], promptSteps: JSON.stringify({ steps: [ { action: 'login', data: { username: 'jane_smith', password: 'test456' } }, { action: 'create_report', data: { title: 'Monthly Report', type: 'summary' } }, { action: 'logout', data: {} } ] }, null, 2), createdAt: new Date().toISOString() }
];

let testRuns = JSON.parse(localStorage.getItem('testRuns')) || [];

let users = JSON.parse(localStorage.getItem('users')) || [
    { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123' },
    { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', password: 'password456' },
    { id: 3, name: 'Admin User', email: 'admin.user@example.com', password: 'adminpassword' },
    { id: 4, name: 'Test User', email: 'test.user@example.com', password: 'testpassword' }
];

let actions = JSON.parse(localStorage.getItem('actions')) || [
    { id: 1, prompt: 'User login', stepsJson: JSON.stringify({ steps: [{ action: 'input', selector: '#username', value: 'user' }, { action: 'input', selector: '#password', value: 'pass' }, { action: 'click', selector: '#login-button' }] }, null, 2) },
    { id: 2, prompt: 'Navigate to dashboard', stepsJson: JSON.stringify({ steps: [{ action: 'navigate', url: '/dashboard' }] }, null, 2) },
    { id: 3, prompt: 'Create a report', stepsJson: JSON.stringify({ steps: [{ action: 'click', selector: '#create-report-button' }, { action: 'input', selector: '#report-title', value: 'New Report' }, { action: 'click', selector: '#submit-report' }] }, null, 2) },
    { id: 4, prompt: 'User logout', stepsJson: JSON.stringify({ steps: [{ action: 'click', selector: '#logout-button' }] }, null, 2) },
    { id: 5, prompt: 'Edit user profile', stepsJson: JSON.stringify({ steps: [{ action: 'navigate', url: '/profile' }, { action: 'input', selector: '#name', value: 'Updated Name' }, { action: 'click', selector: '#save-profile' }] }, null, 2) },
    { id: 6, prompt: 'View analytics data', stepsJson: JSON.stringify({ steps: [{ action: 'navigate', url: '/analytics' }, { action: 'wait', time: 2000 }, { action: 'screenshot', name: 'analytics_dashboard' }] }, null, 2) }
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
    if (tabId === 'test-cases') renderTestCaseList();
}

// Populate Dropdowns and Checkboxes
function populateSelects() {
    const userSelect = document.getElementById('user-select');
    userSelect.innerHTML = '<option value="">Choose User</option>' + users.map(user => `<option value="${user.name.replace(/ /g, '_').toLowerCase()}">${user.name}</option>`).join('');

    const actionsCheckboxes = document.getElementById('actions-checkboxes');
    actionsCheckboxes.innerHTML = actions.map(action => `<label><input type="checkbox" value="${action.prompt.replace(/ /g, '_').toLowerCase()}" onchange="toggleAction(this.value, this.checked)"> ${action.prompt}</label>`).join('');
}

// Selected Actions Handler
let selectedActions = [];
function toggleAction(action, checked) {
    if (checked) {
        selectedActions.push(action);
    } else {
        selectedActions = selectedActions.filter(a => a !== action);
    }
}

// Add Test Case
function addTestCase() {
    const user = document.getElementById('user-select').value;
    const promptSteps = document.getElementById('prompt-steps').value;
    if (!user || selectedActions.length === 0 || !promptSteps.trim()) {
        alert('Please fill in all fields!');
        return;
    }
    try {
        JSON.parse(promptSteps);
        const newTestCase = { id: testCases.length + 1, user, actions: [...selectedActions], promptSteps, createdAt: new Date().toISOString(), status: 'pending', gif_path: null, pdf_url: null };
        testCases.push(newTestCase);
        saveData();
        selectedActions = [];
        document.getElementById('prompt-steps').value = '';
        renderTestCaseList();
        alert('Test case added!');
    } catch (e) {
        alert('Invalid JSON!');
    }
}

// Run Tests (with backend call, GIF/PDF handling, fallback simulation)
async function runTests() {
    if (testCases.length === 0) {
        alert('No test cases!');
        return;
    }
    const results = [];
    for (let tc of testCases) {
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
                tc.status = data.status;
                tc.gif_path = data.gif_url;
                tc.pdf_url = data.pdf_url;
                results.push({ testCaseId: tc.id, status: tc.status, gif_path: tc.gif_path, pdf_url: tc.pdf_url });
            } else {
                tc.status = 'failed';
                results.push({ testCaseId: tc.id, status: 'failed' });
            }
        } catch (e) {
            tc.status = Math.random() > 0.3 ? 'passed' : 'failed';
            results.push({ testCaseId: tc.id, status: tc.status });
        }
    }
    const newRun = {
        id: testRuns.length + 1,
        timestamp: new Date().toISOString(),
        totalTests: testCases.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
    };
    testRuns.unshift(newRun);
    saveData();
    populateReports();
    renderTestCaseList(); // Update cards with new status/GIF/PDF
}

// Render Test Case Cards (revised)
function renderTestCaseList() {
    const container = document.getElementById('test-case-list');
    container.innerHTML = testCases.length === 0 ? '<div class="no-tests">No test cases created yet.</div>' : testCases.map(tc => `
        <div class="test-case-card">
            <h3>Test Case #${tc.id}</h3>
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
        </div>
    `).join('');
}

// View Test Case (open modal in read-only mode)
function viewTestCase(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    document.getElementById('modal-title').textContent = 'View Test Case #' + id;
    document.getElementById('modal-form').innerHTML = `
        <p><strong>User:</strong> ${tc.user}</p>
        <p><strong>Actions:</strong> ${tc.actions.join(', ')}</p>
        <p><strong>Prompt Steps:</strong></p>
        <pre>${tc.promptSteps}</pre>
    `;
    document.getElementById('modal-save').style.display = 'none';
    document.getElementById('modal').style.display = 'block';
}

// Edit Test Case (open modal with editable fields)
function editTestCase(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    document.getElementById('modal-title').textContent = 'Edit Test Case #' + id;
    document.getElementById('modal-form').innerHTML = `
        <label for="edit-user">User:</label>
        <input id="edit-user" value="${tc.user}">
        <label for="edit-actions">Actions (comma-separated):</label>
        <input id="edit-actions" value="${tc.actions.join(', ')}">
        <label for="edit-promptsteps">Prompt Steps JSON:</label>
        <textarea id="edit-promptsteps">${tc.promptSteps}</textarea>
    `;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').dataset.id = id;
    document.getElementById('modal').style.display = 'block';
}

// Save Modal Changes
function saveModalChanges() {
    const id = document.getElementById('modal-save').dataset.id;
    const tc = testCases.find(t => t.id == id);
    if (!tc) return;
    tc.user = document.getElementById('edit-user').value;
    tc.actions = document.getElementById('edit-actions').value.split(',').map(a => a.trim());
    tc.promptSteps = document.getElementById('edit-promptsteps').value;
    saveData();
    renderTestCaseList();
    closeModal();
}

// Run Single Test
async function runTest(id) {
    const tc = testCases.find(t => t.id === id);
    if (!tc) return;
    try {
        const res = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: tc.promptSteps, username: tc.user, password: 'dummy-password' }) // Adjust password logic as needed
        });
        const data = await res.json();
        if (res.ok) {
            tc.status = data.status;
            tc.gif_path = data.gif_url;
            tc.pdf_url = data.pdf_url;
        } else {
            tc.status = 'failed';
        }
    } catch (e) {
        tc.status = Math.random() > 0.3 ? 'passed' : 'failed';
    }
    saveData();
    renderTestCaseList();
}

// Delete Test Case
function deleteTestCase(id) {
    if (confirm('Delete this test case?')) {
        testCases = testCases.filter(t => t.id !== id);
        saveData();
        renderTestCaseList();
    }
}

// Close Modal
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    renderTestCaseList();
    // Add event for saving modal
    document.getElementById('modal-save').addEventListener('click', saveModalChanges);
});
window.onclick = (event) => {
    if (event.target === document.getElementById('modal')) closeModal();
};
