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
        this.openTab('test-cases'); // Default tab
    }

    async loadCurrentUser() {
        const userId = localStorage.getItem('currentUserId');
        if (userId) {
            try {
                const response = await fetch(`/api/users/${userId}`);
                if (response.ok) {
                    this.currentUser = await response.json();
                    // Retrieve raw_password from localStorage if exists
                    this.currentUser.raw_password = localStorage.getItem(`user_${userId}_password`) || '';
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
                userData.raw_password = password; // Store raw password temporarily
                this.currentUser = userData;
                localStorage.setItem('currentUserId', this.currentUser.id);
                localStorage.setItem(`user_${this.currentUser.id}_password`, password); // Store password
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
                const newUser = await response.json();
                alert('New User Added Successfully');
                this.users.push(newUser); // Update local state
                this.renderUsers(); // Refresh user table
                return true;
            } else {
                const error = await response.json();
                alert(error.error || 'Registration failed');
                return false;
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
            return false;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUserId');
        localStorage.removeItem(`user_${this.currentUser?.id}_password`);
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
                testCase.user_id = this.currentUser?.id || null;
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
            await this.loadUsers();
            this.renderUsers();
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
        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('register-name').value.trim();
                const email = document.getElementById('register-email').value.trim();
                const password = document.getElementById('register-password').value.trim();
                if (!name || !email || !password) {
                    alert('Please fill in all fields!');
                    return;
                }
                await this.register(name, email, password);
                registerForm.reset();
            });
        }

        // Test case form
        const testCaseForm = document.getElementById('test-case-form');
        if (testCaseForm) {
            testCaseForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('test-case-title').value;
                const userId = document.getElementById('user-select').value;
                const actions = [...document.querySelectorAll('#actions-checkboxes input:checked')].map(cb => cb.value);
                const promptSteps = document.getElementById('prompt-steps').value;
                await this.saveTestCase({ title, user_id: userId, actions, prompt_steps: promptSteps });
                testCaseForm.reset();
                await this.loadTestCases();
                this.renderTestCaseList();
            });
        }

        // Action form
        const actionForm = document.getElementById('action-form');
        if (actionForm) {
            actionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const prompt = document.getElementById('action-prompt').value;
                const stepsJson = document.getElementById('action-steps').value;
                await this.saveAction({ prompt, steps_json: stepsJson });
                actionForm.reset();
                await this.loadActions();
                this.renderActions();
            });
        }

        // Modal save
        const modalSave = document.getElementById('modal-save');
        if (modalSave) {
            modalSave.addEventListener('click', () => this.saveModalChanges());
        }
    }

    // Tab Management
    openTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');

        document.querySelectorAll('.nav-button').forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('onclick').includes(tabId)) {
                button.classList.add('active');
            }
        });

        if (tabId === 'users') this.renderUsers();
        if (tabId === 'test-cases') this.renderTestCaseList();
        if (tabId === 'actions') this.renderActions();
        if (tabId === 'reports') this.renderReports();
    }

    // Render Methods
    renderAll() {
        this.renderTestCaseList();
        this.renderUsers();
        this.renderActions();
        this.renderReports();
        this.populateSelects();
    }

    renderTestCaseList() {
        const list = document.getElementById('test-case-list');
        if (!list) return;
        list.innerHTML = this.testCases.map(tc => `
            <div class="test-case-card">
                <h3>${tc.title}</h3>
                <p>User ID: ${tc.user_id}</p>
                <p>Status: ${tc.status}</p>
                <div class="buttons">
                    <button onclick="app.viewTestCase(${tc.id})">View</button>
                    <button onclick="app.editTestCase(${tc.id})">Edit</button>
                    <button onclick="app.deleteTestCase(${tc.id})">Delete</button>
                    <button onclick="app.runTestCase(${tc.id})">Run</button>
                </div>
            </div>
        `).join('');
    }

    renderUsers() {
        const table = document.getElementById('user-list');
        if (!table) return;
        table.innerHTML = this.users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    <button onclick="app.viewUser(${user.id})">View</button>
                    <button onclick="app.editUser(${user.id})">Edit</button>
                    <button onclick="app.deleteUser(${user.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    renderActions() {
        const list = document.getElementById('action-list');
        if (!list) return;
        list.innerHTML = this.actions.map(action => `
            <div class="report-item">
                <p><strong>Name (Prompt):</strong> ${action.prompt}</p>
                <p><strong>Steps JSON:</strong></p>
                <pre>${typeof action.steps_json === "string" ? action.steps_json : JSON.stringify(action.steps_json, null, 2)}</pre>
                <button onclick="app.deleteAction(${action.id})">Delete</button>
            </div>
        `).join('');
    }

    renderReports() {
        const table = document.getElementById('reports-table');
        if (!table) return;
        const tbody = table.getElementsByTagName('tbody')[0];
        tbody.innerHTML = this.testRuns.map(run => `
            <tr>
                <td>${run.id}</td>
                <td>${run.total_tests}</td>
                <td>${run.failed}</td>
                <td>${((run.passed / run.total_tests) * 100).toFixed(2)}%</td>
                <td>${new Date(run.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');
        document.getElementById('total-tests').textContent = this.testCases.length;
        document.getElementById('total-runs').textContent = this.testRuns.length;
    }

    populateSelects() {
        const userSelect = document.getElementById('user-select');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">Select User</option>' + this.users.map(user => `
                <option value="${user.id}">${user.name}</option>
            `).join('');
        }

        const actionsCheckboxes = document.getElementById('actions-checkboxes');
        if (actionsCheckboxes) {
            actionsCheckboxes.innerHTML = this.actions.map(action => `
                <label>
                    <input type="checkbox" value="${action.prompt.replace(/"/g, '&quot;')}">
                    ${action.prompt}
                </label>
            `).join('');
        }
    }

    // Modal methods
    viewTestCase(id) {
        const tc = this.testCases.find(t => t.id === id);
        if (!tc) {
            alert('Test case not found.');
            return;
        }
        const userObj = this.users.find(u => u.id === tc.user_id);
        let actionsList = (Array.isArray(tc.actions) && tc.actions.length)
            ? `<ul>${tc.actions.map(a => `<li>${a}</li>`).join('')}</ul>` : '<em>No actions.</em>';
        let structuredSteps = this.structureSteps(tc.prompt_steps);
        document.getElementById('modal-title').textContent = `Test Case Details - ${tc.title}`;
        document.getElementById('modal-form').innerHTML = `
            <p><strong>User:</strong> ${userObj ? userObj.name : tc.user_id || 'N/A'}</p>
            <p><strong>Actions:</strong> ${actionsList}</p>
            <p><strong>Prompt Steps:</strong></p>
            ${structuredSteps}
            <p><strong>Status:</strong> ${tc.status || 'pending'}</p>
        `;
        document.getElementById('modal-save').style.display = 'none';
        document.getElementById('modal').style.display = 'block';
    }

    viewUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) {
            alert('User not found.');
            return;
        }
        document.getElementById('modal-title').textContent = `User Details - ${user.name}`;
        document.getElementById('modal-form').innerHTML = `
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Password:</strong> [Hidden for security]</p>
        `;
        document.getElementById('modal-save').style.display = 'none';
        document.getElementById('modal').style.display = 'block';
    }

    editTestCase(id) {
        const tc = this.testCases.find(t => t.id === id);
        if (!tc) return;
        document.getElementById('modal-title').textContent = 'Edit Test Case #' + id;
        let userSelect = `<select id="edit-user">` +
            this.users.map(user => 
                `<option value="${user.id}"${user.id === tc.user_id ? ' selected' : ''}>${user.name}</option>`
            ).join('') +
            `</select>`;
        let actionsCheckboxes = this.actions.map(action => 
            `<label>
                <input type="checkbox" value="${action.prompt.replace(/"/g, "&quot;")}"
                    ${Array.isArray(tc.actions) && tc.actions.includes(action.prompt) ? 'checked' : ''}>
                ${action.prompt}
            </label>`
        ).join('');
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
        user.name = newName;
        user.email = newEmail;
        user.password_hash = newPassword;
        await this.saveUser({ id, name: newName, email: newEmail, password: newPassword });
        await this.loadUsers();
        this.renderUsers();
    }

    async saveUser(userData) {
        try {
            const response = await fetch(`/api/users/${userData.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: userData.name, email: userData.email, password: userData.password })
            });
            if (!response.ok) throw new Error('Failed to update user');
            return await response.json();
        } catch (error) {
            console.error('Failed to save user:', error);
            throw error;
        }
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

    runAllTests() {
        // Implementation to run all tests can be added here
        alert('Run All Tests functionality to be implemented');
    }

    async runTestCase(id) {
        const tc = this.testCases.find(t => t.id === id);
        if (!tc) {
            alert('Test case not found.');
            return;
        }
        // Prompt for credentials if missing
        let username = this.currentUser?.email || '';
        let password = this.currentUser?.raw_password || '';
        if (!username || !password) {
            username = prompt('Please enter your username (email):', username) || '';
            password = prompt('Please enter your password:', '') || '';
            if (!username || !password) {
                alert('Username and password are required to run the test case.');
                return;
            }
            // Optionally update currentUser for future runs
            if (!this.currentUser) {
                this.currentUser = { email: username, raw_password: password };
                localStorage.setItem('currentUserId', 'temp'); // Temporary ID
                localStorage.setItem('user_temp_password', password);
            } else {
                this.currentUser.email = username;
                this.currentUser.raw_password = password;
                localStorage.setItem(`user_${this.currentUser.id}_password`, password);
            }
        }

        try {
            const response = await fetch('/api/run_test_case', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: tc.prompt_steps,
                    username: username,
                    password: password,
                    test_case_id: tc.id
                })
            });
            if (response.ok) {
                const result = await response.json();
                alert(`Test case ${tc.title} ran successfully. Status: ${result.test_status}`);
                tc.status = result.test_status; // Update status
                await this.saveTestCase(tc); // Save updated status
                await this.loadTestCases();
                this.renderTestCaseList();
            } else {
                const error = await response.json();
                alert(`Failed to run test case: ${error.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error running test case:', error);
            alert('Error running test case: ' + error.message);
        }
    }

    structureSteps(steps) {
        try {
            let stepData = typeof steps === 'string' ? JSON.parse(steps) : steps;
            if (!Array.isArray(stepData)) {
                stepData = [stepData]; // Handle if it's an object
            }

            if (stepData.length > 0 && typeof stepData[0] === 'object' && 'action' in stepData[0]) {
                // Render as a table for structured objects
                return `
                    <table border="1" style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>Step #</th>
                                <th>Action</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stepData.map((step, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${step.action || 'N/A'}</td>
                                    <td>${step.details || 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                // Render as a list for simple arrays
                return `
                    <ol>
                        ${stepData.map((step, index) => {
                            if (typeof step === 'string') {
                                return `<li>${step}</li>`;
                            } else if (typeof step === 'object') {
                                return `<li>${index + 1}. ${step.action || JSON.stringify(step)}</li>`;
                            }
                            return `<li>${index + 1}. ${JSON.stringify(step)}</li>`;
                        }).join('')}
                    </ol>
                `;
            }
        } catch (e) {
            return `<p>Unable to parse steps: ${steps}</p>`;
        }
    }
}

// Initialize the app
const app = new BrowserUseWebAgent();

// Make methods available globally for onclick handlers
window.app = app;