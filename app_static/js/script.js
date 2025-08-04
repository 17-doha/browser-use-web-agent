class BrowserUseWebAgent {
    constructor() {
        this.testCases = [];
        this.users = [];
        this.actions = [];
        this.testRuns = [];
        this.currentUser = null;
        this.selectedActions = [];
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        await this.loadData();
        this.setupEventListeners();
        this.openTab('test-cases');
    }

    async loadCurrentUser() {
        const userId = localStorage.getItem('currentUserId');
        if (userId) {
            try {
                const response = await fetch(`/api/users/${userId}`);
                if (response.ok) {
                    this.currentUser = await response.json();
                    this.showUserInfo();
                }
            } catch (error) {
                console.error('Failed to load user:', error);
            }
        }
    }

    async loadData() {
        await Promise.all([
            this.loadTestCases(),
            this.loadUsers(),
            this.loadActions(),
            this.loadTestRuns()
        ]);
        this.renderAll();
    }

    async loadTestCases() {
        try {
            const url = this.currentUser 
                ? `/api/test_cases?user_id=${this.currentUser.id}`
                : '/api/test_cases';
            const response = await fetch(url);
            this.testCases = await response.json();
        } catch (error) {
            console.error('Failed to load test cases:', error);
            this.testCases = [];
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                this.users = await response.json();
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.users = [];
        }
    }

    async loadActions() {
        try {
            const response = await fetch('/api/actions');
            if (response.ok) {
                this.actions = await response.json();
            }
        } catch (error) {
            console.error('Failed to load actions:', error);
            this.actions = [];
        }
    }

    async loadTestRuns() {
        try {
            const response = await fetch('/api/test_runs');
            if (response.ok) {
                this.testRuns = await response.json();
            }
        } catch (error) {
            console.error('Failed to load test runs:', error);
            this.testRuns = [];
        }
    }

    // Authentication methods
    async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                const userData = await response.json();
                userData.raw_password = password;      // <-- Add this line!
                this.currentUser = userData;
                localStorage.setItem('currentUserId', this.currentUser.id);
                await this.loadData();
                this.showUserInfo();
                return true;

            } else {
                const error = await response.json();
                alert(error.error || 'Login failed');
                return false;
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed');
            return false;
        }
    }

    async register(name, email, password) {
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name, email, password })
            });
            
            if (response.ok) {
                alert('New User Added Successfully');
                return true;
            } else {
                const error = await response.json();
                alert(error.error || 'Registration failed');
                return false;
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed');
            return false;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUserId');
        this.testCases = [];
        this.hideUserInfo();
        this.renderAll();
    }

    showUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo && this.currentUser) {
            userInfo.innerHTML = `
                <span>Logged in as: ${this.currentUser.name}</span>
                <button onclick="app.logout()">Logout</button>
            `;
            userInfo.style.display = 'block';
        }
    }

    hideUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.style.display = 'none';
        }
    }

    // CRUD operations
    async saveTestCase(testCase) {
    try {
        if (testCase.id) {
            const response = await fetch(`/api/test_cases/${testCase.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(testCase)
            });
            return await response.json();
        } else {
            // Remove this line: testCase.user_id = this.currentUser?.id || null;
            const response = await fetch('/api/test_cases', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(testCase)
            });
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to save test case:', error);
        throw error;
    }
}
    async deleteAction(id) {
    if (!confirm('Are you sure you want to delete this action?')) return;
    try {
        const response = await fetch(`/api/actions/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to delete action');
            return;
        }
        await this.loadActions();
        this.renderActions();
        this.populateSelects();
    } catch (error) {
        alert('Error deleting action!');
        console.error(error);
    }
}


    async deleteTestCase(caseId) {
        if (!confirm('Delete this test case?')) return;
        
        try {
            await fetch(`/api/test_cases/${caseId}`, {
                method: 'DELETE'
            });
            await this.loadTestCases();
            this.renderTestCaseList();
        } catch (error) {
            console.error('Failed to delete test case:', error);
        }
    }


    async deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to delete user');
            return;
        }
        // Refresh the users list and UI
        await this.loadUsers();
        this.renderUsers();
        this.populateSelects();
    } catch (error) {
        alert('Error deleting user!');
        console.error(error);
    }
}

    async saveAction(action) {
    try {
        const response = await fetch('/api/actions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(action)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to save action:', error);
        throw error;
    }
}


    async saveTestRun(testRun) {
        try {
            const response = await fetch('/api/test_runs', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(testRun)
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to save test run:', error);
            throw error;
        }
    }

    // UI Event Handlers
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                await this.login(email, password);
            });
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('register-name').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                await this.register(name, email, password);
            });
        }
        const testCaseForm = document.getElementById('test-case-form');
        if (testCaseForm) {
            testCaseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addTestCase(); // Should call the class method
            });
        }


        // Other event listeners
        document.getElementById('test-case-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTestCase();
        });

        // Modal save button
        document.getElementById('modal-save')?.addEventListener('click', () => {
            this.saveModalChanges();
        });

        // Window click to close modal
        window.onclick = (event) => {
            if (event.target === document.getElementById('modal')) {
                this.closeModal();
            }
        };
    }

    // Core functionality
    populateSelects() {
  const userSelect = document.getElementById('user-select');
  if (userSelect && this.users.length) {
    userSelect.innerHTML = '<option value="">Select user</option>' + 
      this.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }


        const actionsCheckboxes = document.getElementById('actions-checkboxes');
        if (actionsCheckboxes) {
            actionsCheckboxes.innerHTML = this.actions.map(action => `
                <label>
                    <input type="checkbox" value="${action.prompt.replace(/ /g, '_').toLowerCase()}" 
                           onchange="app.toggleAction('${action.prompt}', this.checked)">
                    ${action.prompt}
                </label>
            `).join('');
        }
    }

    toggleAction(action, checked) {
        this.selectedActions = checked 
            ? [...this.selectedActions, action] 
            : this.selectedActions.filter(a => a !== action);
        this.updatePromptStepsTextarea();
    }

    updatePromptStepsTextarea() {
        const textarea = document.getElementById('prompt-steps');
        if (!textarea) return;

        const checkedBoxes = document.querySelectorAll('#actions-checkboxes input:checked');
        const selectedPrompts = Array.from(checkedBoxes).map(cb => cb.value);

        if (selectedPrompts.length === 0) {
            textarea.value = '';
            return;
        }

        const selectedActionObjs = this.actions.filter(action => 
            selectedPrompts.includes(action.prompt.replace(/ /g, '_').toLowerCase())
        );

        let allSteps = [];
        selectedActionObjs.forEach(action => {
            try {
                const parsed = JSON.parse(action.steps_json);
                if (Array.isArray(parsed.steps)) {
                    allSteps = allSteps.concat(parsed.steps);
                }
            } catch (e) {
                console.error('Invalid JSON in action steps:', e);
            }
        });

        textarea.value = JSON.stringify({ steps: allSteps }, null, 2);
    }
    async addAction() {
        const prompt = document.getElementById('action-prompt').value.trim();
        const stepsJson = document.getElementById('action-steps').value.trim();

        if (!prompt || !stepsJson) {
            alert('Please fill in all fields!');
            return;
        }

        try {
            JSON.parse(stepsJson); // Validate JSON

            const newAction = {
            prompt,
            steps_json: stepsJson,
            };

            await this.saveAction(newAction);      // Send to backend
            await this.loadActions();              // Reload actions list
            this.renderActions();                  // Render updated list
            this.populateSelects();                // Update selects/checkboxes that use actions

            document.getElementById('action-form').reset();
            alert('Action added successfully!');
        } catch (e) {
            alert('Invalid JSON in Steps!');
        }
        }



async addTestCase() {
    const title = document.getElementById('test-title').value.trim();
    const userSelect = document.getElementById('user-select');
    const userId = userSelect.value; // This is the UUID

    if (!title) {
        alert('Please enter a test case title');
        return;
    }
    if (!userId) {
        alert('Please select a user');
        return;
    }

    const checkedBoxes = document.querySelectorAll('#actions-checkboxes input[type="checkbox"]:checked');
    const actions = [...checkedBoxes].map(cb => cb.value);

    const promptStepsText = document.getElementById('prompt-steps').value.trim();
    let promptStepsJson;
    try {
        promptStepsJson = JSON.parse(promptStepsText);
    } catch (e) {
        alert('Invalid JSON in prompt steps');
        return;
    }

    const testCase = {
        title,
        user_id: userId,
        actions,
        prompt_steps: promptStepsJson,
        status: 'pending'
    };
    console.log("Test case payload:", testCase);


    try {
        await this.saveTestCase(testCase);
        await this.loadTestCases();
        this.renderTestCaseList();
        alert('Test case added successfully!');
    } catch (e) {
        alert('Error saving test case: ' + e.message);
    }
}







    // Test execution
async runTest(id) {
    const tc = this.testCases.find(t => t.id === id);
    if (!tc) return;
    tc.status = 'running';
    await this.saveTestCase(tc);
    this.renderTestCaseList();

    // -> Look up user at run-time!
    const userObj = this.users.find(u => u.id === tc.user_id);
    const email = userObj ? userObj.email : '';
    const password = userObj ? userObj.password : '';

    if (!email || !password) {
        alert('No credentials found for test case’s user.');
        tc.status = 'fail';
        await this.saveTestCase(tc);
        this.renderTestCaseList();
        return;
    }

    try {
        const res = await fetch('/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: tc.prompt_steps,
                username: email,
                password: password
            })
        });
        const data = await res.json();
        tc.status = res.ok ? data.test_status : 'fail';

        if (res.ok) {
            tc.gif_path = data.gif_url;
            tc.pdf_url = data.pdf_url;
        }

        await this.saveTestCase(tc);
        this.renderTestCaseList();
    } catch (e) {
        console.error('Test run failed:', e);
        tc.status = 'fail';
        await this.saveTestCase(tc);
        this.renderTestCaseList();
    }
}




    // Tab switching
    openTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    // Remove active from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    // Show the selected tab
    document.getElementById(tabId).classList.add('active');
    // Add active to the clicked tab button
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') === `app.openTab('${tabId}')`)
            btn.classList.add('active');
    });

    // (Optional) Render content for the tab
    if (tabId === 'test-cases') this.renderTestCaseList();
    if (tabId === 'users') this.renderUsers();
    if (tabId === 'actions') this.renderActions();
    if (tabId === 'reports') this.populateReports();
}


    // Rendering methods
    renderAll() {
        this.renderTestCaseList();
        this.renderUsers();
        this.renderActions();
        this.populateReports();
        this.populateSelects();
    }

    renderTestCaseList() {
        const container = document.getElementById('test-case-list');
        if (!container) return;

        if (this.testCases.length === 0) {
            container.innerHTML = '<p>No test cases found.</p>';
            return;
        }

        container.innerHTML = this.testCases.map(tc => `
            <div class="test-case-card">
                <h3>${tc.title}</h3>
                <p>User: ${tc.user || 'N/A'} | Created: ${new Date(tc.created_at).toLocaleDateString()}</p>
                <p>Status: <span class="badge badge-${tc.status === 'success' ? 'success' : 'failure'}">${tc.status || 'Pending'}</span></p>
                <div class="buttons">
                    <button onclick="app.runTest(${tc.id})" ${tc.status === 'running' ? 'disabled' : ''}>
                        ${tc.status === 'running' ? 'Running...' : 'Run Test'}
                    </button>
                    <button onclick="app.viewTestCase(${tc.id})">View</button>
                    <button onclick="app.editTestCase(${tc.id})">Edit</button>
                    <button onclick="app.deleteTestCase(${tc.id})">Delete</button>
                    ${tc.gif_path ? `<button onclick="app.showGif('${tc.gif_path}')">View GIF</button>` : ''}
                    ${tc.pdf_url ? `<button onclick="app.downloadPdf('${tc.pdf_url}')">Download PDF</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;

    if (this.users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr><th>ID</th><th>Name</th><th>Email</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${this.users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>
                            <button onclick="app.editUser('${user.id}')">Edit</button>
                            <button onclick="app.deleteUser('${user.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}



    renderActions() {
    const container = document.getElementById('actions-list');
    if (!container) return;

    if (this.actions.length === 0) {
        container.innerHTML = '<p>No actions found.</p>';
        return;
    }

    container.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Action Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.actions.map(action => `
              <tr>
                <td>${action.id}</td>
                <td>${action.prompt}</td>
                <td>
                  <button onclick="app.viewAction(${action.id})">View</button>
                  <button onclick="app.editAction(${action.id})">Edit</button>
                  <button onclick="app.deleteAction(${action.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
    `;
}



   populateReports() {
    document.getElementById('total-test-cases').textContent = this.testCases.length;
    const summaryContainer = document.getElementById('reports-summary');
    const tableContainer = document.getElementById('reports-table');
    if (!summaryContainer || !tableContainer) return;

    const totalRuns = this.testRuns.length;
    const totalTests = this.testRuns.reduce((sum, run) => sum + run.total_tests, 0);
    const totalPassed = this.testRuns.reduce((sum, run) => sum + run.passed, 0);
    const totalFailed = this.testRuns.reduce((sum, run) => sum + run.failed, 0);

    summaryContainer.innerHTML = `
        <div class="summary-card">
            <div class="summary-label">Total Runs</div>
            <div class="summary-value">${totalRuns}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Total Tests</div>
            <div class="summary-value">${totalTests}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Passed</div>
            <div class="summary-value">${totalPassed}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Failed</div>
            <div class="summary-value">${totalFailed}</div>
        </div>
    `;

    tableContainer.innerHTML = this.testRuns.length === 0 ?
        '<p>No test runs found.</p>'
        : `<table>
            <tr>
                <th>Run ID</th>
                <th>Timestamp</th>
                <th>Total Tests</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Success Rate</th>
            </tr>
            ${this.testRuns.map(run => {
                const successRate = run.total_tests > 0 ?
                    ((run.passed / run.total_tests) * 100).toFixed(1) : 0;
                return `
                    <tr>
                        <td>${run.id || ''}</td>
                        <td>${run.timestamp ? new Date(run.timestamp).toLocaleString() : 'N/A'}</td>
                        <td>${run.total_tests}</td>
                        <td>${run.passed}</td>
                        <td>${run.failed}</td>
                        <td>${successRate}%</td>
                    </tr>
                `;
            }).join('')}
        </table>`;
}

    viewAction(id) {
        const action = this.actions.find(a => a.id === id);
        if (!action) {
            alert('Action not found.');
            return;
        }

        document.getElementById('modal-title').textContent = `Action Details - ${action.prompt}`;
        document.getElementById('modal-form').innerHTML = `
            <p><strong>Name (Prompt):</strong> ${action.prompt}</p>
            <p><strong>Steps JSON:</strong></p>
            <pre style="white-space:pre-wrap; word-break:break-all; background:#f4f4f4; padding:10px;">
    ${typeof action.steps_json === "string" ? action.steps_json : JSON.stringify(action.steps_json, null, 2)}
            </pre>
        `;
        document.getElementById('modal-save').style.display = 'none';
        document.getElementById('modal').style.display = 'block';
    }



    // Modal methods
    viewTestCase(id) {
    const tc = this.testCases.find(t => t.id === id);
    if (!tc) {
        alert('Test case not found.');
        return;
    }

    // Find user by user_id (if you want to show the user name)
    const userObj = this.users.find(u => u.id === tc.user_id);

    // Find action prompts (if actions array is an array of prompt strings)
    let actionsList = (Array.isArray(tc.actions) && tc.actions.length)
      ? `<ul>${tc.actions.map(a => `<li>${a}</li>`).join('')}</ul>` : '<em>No actions.</em>';

    document.getElementById('modal-title').textContent = `Test Case Details - ${tc.title}`;
    document.getElementById('modal-form').innerHTML = `
        <p><strong>User:</strong> ${userObj ? userObj.name : tc.user_id || 'N/A'}</p>
        <p><strong>Actions:</strong> ${actionsList}</p>
        <p><strong>Prompt Steps:</strong></p>
        <pre style="white-space:pre-wrap; word-break:break-all; background:#f4f4f4; padding:10px;">${typeof tc.prompt_steps === 'string' ? tc.prompt_steps : JSON.stringify(tc.prompt_steps, null, 2)}</pre>
        <p><strong>Status:</strong> ${tc.status || 'pending'}</p>
    `;
    document.getElementById('modal-save').style.display = 'none';
    document.getElementById('modal').style.display = 'block';
}




    editTestCase(id) {
    const tc = this.testCases.find(t => t.id === id);
    if (!tc) return;

    document.getElementById('modal-title').textContent = 'Edit Test Case #' + id;

    // Populate users as a select
    let userSelect = `<select id="edit-user">` +
      this.users.map(user => 
        `<option value="${user.id}"${user.id === tc.user_id ? ' selected' : ''}>${user.name}</option>`
    ).join('') +
      `</select>`;

    // Populate actions as checkboxes
    let actionsCheckboxes = this.actions.map(action => 
      `<label>
        <input type="checkbox" value="${action.prompt.replace(/"/g, "&quot;")}"
            ${Array.isArray(tc.actions) && tc.actions.includes(action.prompt) ? 'checked' : ''}>
        ${action.prompt}
      </label>`
    ).join('');

    // Populate modal form
    document.getElementById('modal-form').innerHTML = `
        <label>Title:</label>
        <input type="text" id="edit-title" value="${tc.title}">

        <label>User:</label>
        ${userSelect}

        <label>Actions:</label>
        <div id="edit-actions-checkboxes">
          ${actionsCheckboxes}
        </div>

        <label>Prompt Steps:</label>
        <textarea id="edit-promptsteps">${typeof tc.prompt_steps === "string" ? tc.prompt_steps : JSON.stringify(tc.prompt_steps, null, 2)}</textarea>
    `;

    const modalSave = document.getElementById('modal-save');
    modalSave.style.display = 'block';
    modalSave.dataset.id = id;
    modalSave.dataset.type = 'testcase';
    document.getElementById('modal').style.display = 'block';
}


    editUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;

        document.getElementById('modal-title').textContent = `Edit User #${id}`;
        document.getElementById('modal-form').innerHTML = `
            <label>Name:</label>
            <input type="text" id="edit-name" value="${user.name}">
            <label>Email:</label>
            <input type="email" id="edit-email" value="${user.email}">
            <label>Password:</label>
            <input type="password" id="edit-password" value="${user.password_hash}">
        `;
        
        const modalSave = document.getElementById('modal-save');
        modalSave.style.display = 'block';
        modalSave.dataset.id = id;
        modalSave.dataset.type = 'user';
        document.getElementById('modal').style.display = 'block';
    }

    editAction(id) {
        const action = this.actions.find(a => a.id === id);
        if (!action) return;

        document.getElementById('modal-title').textContent = `Edit Action #${id}`;
        document.getElementById('modal-form').innerHTML = `
            <label>Prompt:</label>
            <input type="text" id="edit-prompt" value="${action.prompt.replace(/"/g, '&quot;')}" />
            
            <label>Steps JSON:</label>
            <textarea id="edit-steps" rows="8">${typeof action.steps_json === 'string' ? action.steps_json : JSON.stringify(action.steps_json, null, 2)}</textarea>
        `;

        const modalSave = document.getElementById('modal-save');
        modalSave.style.display = 'block';
        modalSave.dataset.id = id;
        modalSave.dataset.type = 'action';
        document.getElementById('modal').style.display = 'block';
        }


    async saveModalChanges() {
        const modalSave = document.getElementById('modal-save');
        const id = modalSave.dataset.id;
        const type = modalSave.dataset.type;

        try {
            switch (type) {
                case 'user':
                    await this.saveUserChanges(id);
                    break;
                case 'action':
                    await this.saveActionChanges(id);
                    break;
                case 'testcase':
                    await this.saveTestCaseChanges(id);
                    break;
            }
            this.closeModal();
        } catch (error) {
            alert('Save failed: ' + error.message);
        }
    }

    async saveTestCaseChanges(id) {
    const tc = this.testCases.find(t => t.id == id);
    if (!tc) return;

    tc.title = document.getElementById('edit-title').value.trim();
    tc.user_id = document.getElementById('edit-user').value;
    const checkedBoxes = document.querySelectorAll('#edit-actions-checkboxes input[type="checkbox"]:checked');
    tc.actions = [...checkedBoxes].map(cb => cb.value);

    const promptEdit = document.getElementById('edit-promptsteps').value;
    try {
        tc.prompt_steps = JSON.parse(promptEdit);
    } catch(e) {
        tc.prompt_steps = promptEdit;
    }

    await this.saveTestCase(tc);
    await this.loadTestCases();
    this.renderTestCaseList();
}


    async saveUserChanges(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;

        const newName = document.getElementById('edit-name').value.trim();
        const newEmail = document.getElementById('edit-email').value.trim();
        const newPassword = document.getElementById('edit-password').value.trim();

        if (!newName || !newEmail || !newPassword) {
            throw new Error('Please fill in all fields!');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            throw new Error('Please enter a valid email address!');
        }

        // Update via API would go here
        user.name = newName;
        user.email = newEmail;
        user.password_hash = newPassword;

        await this.loadUsers();
        this.renderUsers();
        this.populateSelects();
    }

    async saveActionChanges(id) {
    const newPrompt = document.getElementById('edit-prompt').value.trim();
    const newSteps = document.getElementById('edit-steps').value.trim();

    if (!newPrompt || !newSteps) {
        throw new Error('Please fill in all fields!');
    }

    try {
        JSON.parse(newSteps);
    } catch (e) {
        throw new Error('Invalid JSON in steps!');
    }

    try {
        const response = await fetch(`/api/actions/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: newPrompt,
                steps_json: newSteps
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update action');
        }

        await this.loadActions();
        this.renderActions();
        this.populateSelects();
    } catch (error) {
        throw new Error('Failed to update action: ' + error.message);
    }
}


    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    // Media methods
    showGif(gifUrl) {
        if (!gifUrl) return alert('No GIF available');
        const w = window.open();
        w.document.write(`<img src="${gifUrl}" style="max-width:100%;">`);
    }

    downloadPdf(pdfUrl) {
        if (!pdfUrl) return alert('No PDF available');
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = pdfUrl.split('/').pop() || 'test_report.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize the app
const app = new BrowserUseWebAgent();

// Make methods available globally for onclick handlers
window.app = app;
