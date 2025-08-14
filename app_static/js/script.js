console.log("Script loaded - top");
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
                } else {
                    // If user fetch fails, clear the invalid user data
                    console.warn('Failed to load user, clearing invalid data');
                    this.currentUser = null;
                    localStorage.removeItem('currentUserId');
                    localStorage.removeItem(`user_${userId}_password`);
                    this.hideUserInfo();
                }
            } catch (error) {
                console.error('Failed to load user:', error);
                // Clear invalid user data on error
                this.currentUser = null;
                localStorage.removeItem('currentUserId');
                if (userId) {
                    localStorage.removeItem(`user_${userId}_password`);
                }
                this.hideUserInfo();
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
            if (response.ok) {
                this.testCases = await response.json();
            } else {
                console.error('Failed to load test cases:', response.status, response.statusText);
                this.testCases = [];
            }
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
                const response = await fetch('/api/test_cases', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(testCase)
                });
                console.log("Saving test case:", testCase);
                console.log("User ID:", testCase.user_id);
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
        console.log("deleteUser called", id);
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
            alert('User deleted successfully!');
        } catch (error) {
            alert('Error deleting user: ' + error.message);
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
        const title = document.getElementById('test-case-title').value.trim();
        const userId = document.getElementById('user-select').value;
        const actions = [...document.querySelectorAll('#actions-checkboxes input:checked')]
            .map(cb => parseInt(cb.value, 10))
            .filter(id => !isNaN(id));
        const promptSteps = document.getElementById('prompt-steps').value.trim();

        if (!title || !userId) {
            alert('Please fill in title and select a user!');
            return;
        }

        const mergedPrompt = await this.previewMergedPrompt(actions, promptSteps);
        if (!confirm(`Preview of merged prompt:\n\n${mergedPrompt}\n\nProceed with saving test case?`)) {
            return;
        }

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

        // Quick test form
        const quickTestForm = document.getElementById('quick-test-form');
        if (quickTestForm) {
            quickTestForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const prompt = document.getElementById('quick-test-prompt').value.trim();
                const username = document.getElementById('quick-test-username').value.trim();
                const password = document.getElementById('quick-test-password').value.trim();
                
                if (!prompt || !username || !password) {
                    alert('Please fill in all fields!');
                    return;
                }
                
                await this.runQuickTest(prompt, username, password);
            });
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

 // ... (other methods remain unchanged)

renderTestCaseList() {
    const list = document.getElementById('test-case-list');
    if (!list) return;
    
    // Ensure testCases is always an array
    if (!Array.isArray(this.testCases)) {
        console.warn('testCases is not an array, resetting to empty array');
        this.testCases = [];
    }
    
    list.innerHTML = this.testCases.map(tc => {
        // Debug logging
        console.log(`Rendering test case ${tc.id}:`, {
            title: tc.title,
            gif_path: tc.gif_path,
            pdf_url: tc.pdf_url,
            status: tc.status,
            user_id: tc.user_id
        });
        
        // Look up user name from this.users
        const user = this.users.find(u => u.id == tc.user_id);
        const userName = user ? user.name : 'Unknown User';
        
        return `
        <div class="test-case-card">
            <h3>${tc.title}</h3>
            <p>User Name: ${userName}</p>
            <p>Status: <span class="status-badge ${tc.status === 'completed' ? 'success' : tc.status === 'failed' ? 'failed' : 'pending'}">${tc.status || 'pending'}</span></p>
            <div class="buttons">
                <button onclick="app.viewTestCase(${tc.id})">View</button>
                <button onclick="app.editTestCase(${tc.id})">Edit</button>
                <button onclick="app.deleteTestCase(${tc.id})">Delete</button>
                <button onclick="app.runTestCase(${tc.id})">Run</button>
            </div>
            ${tc.gif_path || tc.pdf_url ? `
            <div class="media-buttons">
                ${tc.gif_path ? `<button class="media-btn gif-btn" onclick="app.showGif('${tc.gif_path}')">View GIF</button>` : ''}
                ${tc.pdf_url ? `<button class="media-btn pdf-btn" onclick="app.downloadPdf('${tc.pdf_url}')">Download PDF</button>` : ''}
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

    

    renderUsers() {
        const table = document.getElementById('user-list');
        if (!table) return;
        
        // Ensure users is always an array
        if (!Array.isArray(this.users)) {
            console.warn('users is not an array, resetting to empty array');
            this.users = [];
        }
        
        table.innerHTML = this.users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    <button onclick="app.viewUser('${user.id}')">View</button>
                    <button onclick="app.editUser('${user.id}')">Edit</button>
                    <button onclick="app.deleteUser('${user.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    renderActions() {
    const list = document.getElementById('action-list');
    if (!list) return;

    if (!Array.isArray(this.actions)) {
        console.warn('actions is not an array, resetting to empty array');
        this.actions = [];
    }

    list.innerHTML = `
        <div class="test-case-list"> <!-- Reuse test-case-list grid layout -->
            ${this.actions.map(action => `
                <div class="test-case-card">
                    <h3>${action.prompt}</h3>
                    <div class="buttons">
                        <button onclick="app.viewAction(${action.id})">View</button>
                        <button onclick="app.editAction(${action.id})">Edit</button>
                        <button onclick="app.deleteAction(${action.id})">Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

viewAction(id) {
    const action = this.actions.find(a => a.id === id);
    if (!action) return;
    document.getElementById('modal-title').textContent = `Action #${id}`;
    document.getElementById('modal-form').innerHTML = `
        <p><strong>Prompt:</strong> ${action.prompt}</p>
        <p><strong>Steps JSON:</strong></p>
        <pre>${typeof action.steps_json === 'string' ? action.steps_json : JSON.stringify(action.steps_json, null, 2)}</pre>
    `;
    document.getElementById('modal-save').style.display = 'none'; // Hide save button since this is a view-only mode
    document.getElementById('modal').style.display = 'block';
}
    // Replace the existing renderReports() method in script.js with this updated version

renderReports() {
    const reportsContainer = document.getElementById('reports');
    if (!reportsContainer) return;
    
    // Ensure testRuns is always an array
    if (!Array.isArray(this.testRuns)) {
        console.warn('testRuns is not an array, resetting to empty array');
        this.testRuns = [];
    }
    
    // Calculate summary statistics
    const totalTestCases = this.testCases.length;
    const totalRuns = this.testRuns.length;
    
    // Sort test runs by timestamp (most recent first)
    const sortedRuns = [...this.testRuns].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    reportsContainer.innerHTML = `
        <div class="reports-header">
            <h2>Test Execution Reports</h2>
            <button class="run-all-btn" onclick="app.runAllTests()">
                <span class="play-icon">▶</span>
                Run All Tests
            </button>
        </div>
        
        <div class="reports-summary">
            <p>View test execution history and results. Total Test Cases: ${totalTestCases} | Total Runs: ${totalRuns}</p>
        </div>
        
        <div class="test-runs-container">
            ${sortedRuns.length > 0 ? sortedRuns.map((run, index) => {
                const successRate = run.total_tests > 0 ? Math.round((run.passed / run.total_tests) * 100) : 0;
                const runDate = new Date(run.timestamp);
                const formattedDate = runDate.toLocaleDateString();
                const formattedTime = runDate.toLocaleTimeString();
                
                return `
                    <div class="test-run-card">
                        <div class="test-run-header" onclick="app.toggleRunDetails(${run.id})">
                            <div class="run-info">
                                <h3>Run #${run.id}</h3>
                                <div class="run-datetime">${formattedDate}, ${formattedTime}</div>
                            </div>
                            <div class="run-results">
                                <div class="result-item passed">
                                    <span class="result-icon">✓</span>
                                    <span class="result-count">${run.passed || 0} passed</span>
                                </div>
                                <div class="result-item failed">
                                    <span class="result-icon">✗</span>
                                    <span class="result-count">${run.failed || 0} failed</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="success-rate-section">
                            <div class="success-rate-label">Success Rate</div>
                            <div class="success-rate-bar-container">
                                <div class="success-rate-bar">
                                    <div class="success-rate-fill" style="width: ${successRate}%"></div>
                                </div>
                                <div class="success-rate-percentage">${successRate}%</div>
                            </div>
                        </div>
                        
                        <div class="test-run-details" id="run-details-${run.id}" style="display: none;">
                            <div class="failed-tests-section">
                                ${run.failed > 0 ? `
                                    <div class="failed-tests-header" onclick="app.toggleFailedTests(${run.id})">
                                        <span class="expand-icon">▶</span>
                                        <span class="failed-text">View Failed Tests (${run.failed})</span>
                                    </div>
                                    <div class="failed-tests-list" id="failed-tests-${run.id}" style="display: none;">
                                        ${this.getFailedTestsForRun(run)}
                                    </div>
                                ` : '<div class="no-failed-tests">No failed tests in this run</div>'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : `
                <div class="no-runs-message">
                    <h3>No test runs yet</h3>
                    <p>Click "Run All Tests" to execute your test cases and see results here.</p>
                </div>
            `}
        </div>
    `;
    
    // Update summary cards if they exist
    const totalTestsEl = document.getElementById('total-tests');
    const totalRunsEl = document.getElementById('total-runs');
    if (totalTestsEl) totalTestsEl.textContent = totalTestCases;
    if (totalRunsEl) totalRunsEl.textContent = totalRuns;
}

// Add these new methods to the BrowserUseWebAgent class

toggleRunDetails(runId) {
    const detailsEl = document.getElementById(`run-details-${runId}`);
    if (detailsEl) {
        const isVisible = detailsEl.style.display !== 'none';
        detailsEl.style.display = isVisible ? 'none' : 'block';
    }
}

toggleFailedTests(runId) {
    const failedTestsEl = document.getElementById(`failed-tests-${runId}`);
    const expandIcon = document.querySelector(`#run-details-${runId} .expand-icon`);
    
    if (failedTestsEl && expandIcon) {
        const isVisible = failedTestsEl.style.display !== 'none';
        failedTestsEl.style.display = isVisible ? 'none' : 'block';
        expandIcon.textContent = isVisible ? '▶' : '▼';
    }
}

// Replace the getFailedTestsForRun method in script.js with this improved version

async getFailedTestsForRun(run) {
    try {
        // Fetch detailed results for this run
        const response = await fetch(`/api/test_runs/${run.id}/details`);
        if (!response.ok) {
            throw new Error('Failed to fetch run details');
        }
        
        const runDetails = await response.json();
        const failedTests = runDetails.detailed_results.filter(result => 
            !['completed', 'success', 'passed'].includes(result.status)
        );
        
        if (failedTests.length === 0) {
            return '<div class="no-failed-tests">No failed tests in this run</div>';
        }
        
        return failedTests.map(test => `
            <div class="failed-test-item">
                <div class="failed-test-name">${test.title}</div>
                <div class="failed-test-reason">
                    Status: ${test.status} 
                    ${test.error ? `- ${test.error}` : ''}
                </div>
                ${test.result_text ? `
                    <div class="failed-test-details">
                        <details>
                            <summary>View Details</summary>
                            <pre class="test-result-text">${test.result_text}</pre>
                        </details>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error fetching failed tests:', error);
        // Fallback to generic display
        const failedCount = run.failed || 0;
        if (failedCount === 0) return '';
        
        let failedTestsHtml = '';
        for (let i = 1; i <= failedCount; i++) {
            failedTestsHtml += `
                <div class="failed-test-item">
                    <div class="failed-test-name">Test Case ${i} - Failed</div>
                    <div class="failed-test-reason">Unable to load details</div>
                </div>
            `;
        }
        return failedTestsHtml;
    }
}

// Also update the renderReports method to handle async getFailedTestsForRun
async renderReports() {
    const reportsContainer = document.getElementById('reports');
    if (!reportsContainer) return;
    
    // Ensure testRuns is always an array
    if (!Array.isArray(this.testRuns)) {
        console.warn('testRuns is not an array, resetting to empty array');
        this.testRuns = [];
    }
    
    // Calculate summary statistics
    const totalTestCases = this.testCases.length;
    const totalRuns = this.testRuns.length;
    
    // Sort test runs by timestamp (most recent first)
    const sortedRuns = [...this.testRuns].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Generate failed tests HTML for each run
    const runsWithFailedTests = await Promise.all(sortedRuns.map(async (run) => {
        const failedTestsHtml = await this.getFailedTestsForRun(run);
        return { ...run, failedTestsHtml };
    }));
    
    reportsContainer.innerHTML = `
        <div class="reports-header">
            <h2>Test Execution Reports</h2>
            <button class="run-all-btn" onclick="app.runAllTests()">
                <span class="play-icon">▶</span>
                Run All Tests
            </button>
        </div>
        
        <div class="reports-summary">
            <p>View test execution history and results. Total Test Cases: ${totalTestCases} | Total Runs: ${totalRuns}</p>
        </div>
        
        <div class="test-runs-container">
            ${runsWithFailedTests.length > 0 ? runsWithFailedTests.map((run, index) => {
                const successRate = run.total_tests > 0 ? Math.round((run.passed / run.total_tests) * 100) : 0;
                const runDate = new Date(run.timestamp);
                const formattedDate = runDate.toLocaleDateString();
                const formattedTime = runDate.toLocaleTimeString();
                
                return `
                    <div class="test-run-card">
                        <div class="test-run-header" onclick="app.toggleRunDetails(${run.id})">
                            <div class="run-info">
                                <h3>Run #${run.id}</h3>
                                <div class="run-datetime">${formattedDate}, ${formattedTime}</div>
                            </div>
                            <div class="run-results">
                                <div class="result-item passed">
                                    <span class="result-icon">✓</span>
                                    <span class="result-count">${run.passed || 0} passed</span>
                                </div>
                                <div class="result-item failed">
                                    <span class="result-icon">✗</span>
                                    <span class="result-count">${run.failed || 0} failed</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="success-rate-section">
                            <div class="success-rate-label">Success Rate</div>
                            <div class="success-rate-bar-container">
                                <div class="success-rate-bar">
                                    <div class="success-rate-fill" style="width: ${successRate}%"></div>
                                </div>
                                <div class="success-rate-percentage">${successRate}%</div>
                            </div>
                        </div>
                        
                        <div class="test-run-details" id="run-details-${run.id}" style="display: none;">
                            <div class="failed-tests-section">
                                ${run.failed > 0 ? `
                                    <div class="failed-tests-header" onclick="app.toggleFailedTests(${run.id})">
                                        <span class="expand-icon">▶</span>
                                        <span class="failed-text">View Failed Tests (${run.failed})</span>
                                    </div>
                                    <div class="failed-tests-list" id="failed-tests-${run.id}" style="display: none;">
                                        ${run.failedTestsHtml}
                                    </div>
                                ` : '<div class="no-failed-tests">No failed tests in this run</div>'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : `
                <div class="no-runs-message">
                    <h3>No test runs yet</h3>
                    <p>Click "Run All Tests" to execute your test cases and see results here.</p>
                </div>
            `}
        </div>
    `;
    
    // Update summary cards if they exist
    const totalTestsEl = document.getElementById('total-tests');
    const totalRunsEl = document.getElementById('total-runs');
    if (totalTestsEl) totalTestsEl.textContent = totalTestCases;
    if (totalRunsEl) totalRunsEl.textContent = totalRuns;
}

    populateSelects() {
    const userSelect = document.getElementById('user-select');
    const editUserSelect = document.getElementById('edit-user');
    const actionsCheckboxes = document.getElementById('actions-checkboxes');
    const editActionsCheckboxes = document.getElementById('edit-actions-checkboxes');

    if (userSelect) {
        userSelect.innerHTML = '<option value="">Select User</option>' + 
            this.users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');
    }
    if (editUserSelect) {
        editUserSelect.innerHTML = this.users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');
    }
    if (actionsCheckboxes) {
        actionsCheckboxes.innerHTML = this.actions.map(action => `
            <label><input type="checkbox" value="${action.id}"> ${action.prompt}</label>
        `).join('');
    }
    if (editActionsCheckboxes) {
        editActionsCheckboxes.innerHTML = this.actions.map(action => `
            <label><input type="checkbox" value="${action.id}"> ${action.prompt}</label>
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
            <p><strong>Status:</strong> <span class="status-badge ${tc.status === 'completed' ? 'success' : tc.status === 'failed' ? 'failed' : 'pending'}">${tc.status || 'pending'}</span></p>
            ${tc.gif_path || tc.pdf_url ? `
            <div class="media-section">
                <h4>Generated Files:</h4>
                <div class="media-buttons">
                    ${tc.gif_path ? `<button class="media-btn gif-btn" onclick="app.showGif('${tc.gif_path}')">View GIF Recording</button>` : ''}
                    ${tc.pdf_url ? `<button class="media-btn pdf-btn" onclick="app.downloadPdf('${tc.pdf_url}')">Download PDF Report</button>` : ''}
                </div>
            </div>
            ` : ''}
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
            <div class="user-details">
                <p><strong>ID:</strong> ${user.id}</p>
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Password:</strong> [Hidden for security]</p>
                <p><strong>Created:</strong> User account exists in system</p>
            </div>
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
            <input type="password" id="edit-password" placeholder="Enter new password">
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
    const title = document.getElementById('edit-title').value.trim();
    const userId = document.getElementById('edit-user').value;
    const actions = [...document.querySelectorAll('#edit-actions-checkboxes input[type="checkbox"]:checked')]
        .map(cb => parseInt(cb.value, 10))
        .filter(id => !isNaN(id));
    const promptSteps = document.getElementById('edit-promptsteps').value.trim();

    if (!title || !userId) {
        alert('Please fill in title and select a user!');
        return;
    }

    const mergedPrompt = await this.previewMergedPrompt(actions, promptSteps);
    if (!confirm(`Preview of merged prompt:\n\n${mergedPrompt}\n\nProceed with saving test case?`)) {
        return;
    }

    tc.title = title;
    tc.user_id = userId;
    tc.actions = actions;
    tc.prompt_steps = promptSteps;
    await this.saveTestCase(tc);
    await this.loadTestCases();
    this.renderTestCaseList();
}
async previewMergedPrompt(actionIds, userPrompt) {
    let mergedPrompt = userPrompt; // Start with user-provided prompt as JSON string
    if (actionIds.length > 0) {
        const actionDetails = this.actions
            .filter(action => actionIds.includes(action.id))
            .map(action => `Whenever you see "${action.prompt}", do the following test: ${typeof action.steps_json === 'string' ? action.steps_json : JSON.stringify(action.steps_json)}`);
        // Append action details as a readable string for preview
        mergedPrompt = `${userPrompt}\n\nAction Details:\n${actionDetails.join('\n')}`;
    }
    return mergedPrompt;
}

    async saveUserChanges(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        const newName = document.getElementById('edit-name').value.trim();
        const newEmail = document.getElementById('edit-email').value.trim();
        const newPassword = document.getElementById('edit-password').value.trim();
        if (!newName || !newEmail) {
            throw new Error('Please fill in name and email fields!');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            throw new Error('Please enter a valid email address!');
        }
        
        const updateData = { id, name: newName, email: newEmail };
        if (newPassword) {
            updateData.password = newPassword;
        }
        
        await this.saveUser(updateData);
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
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update user');
            }
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
        
        // Create a modal to display the GIF
        const modal = document.createElement('div');
        modal.className = 'gif-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = gifUrl;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 30px;
            background: #fff;
            border: none;
            font-size: 2rem;
            cursor: pointer;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.appendChild(img);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
        
        // Close modal on click
        modal.onclick = () => document.body.removeChild(modal);
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            document.body.removeChild(modal);
        };
    }

    downloadPdf(pdfUrl) {
        if (!pdfUrl) return alert('No PDF available');
        
        // Create a temporary link to download the PDF
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = pdfUrl.split('/').pop() || 'test_report.pdf';
        link.target = '_blank';
        
        // Add to DOM, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        setTimeout(() => {
            alert('PDF download started!');
        }, 100);
    }

    async runQuickTest(prompt, username, password) {
        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: prompt,
                    username: username,
                    password: password
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Show success message with media options
                let message = `Quick test completed successfully!\nStatus: ${result.test_status}`;
                if (result.gif_url || result.pdf_url) {
                    message += '\n\nMedia files generated:';
                    if (result.gif_url) message += '\n- GIF recording available';
                    if (result.pdf_url) message += '\n- PDF report available';
                }
                alert(message);
                
                // Show media buttons if available
                if (result.gif_url || result.pdf_url) {
                    const mediaDiv = document.createElement('div');
                    mediaDiv.className = 'quick-test-media';
                    mediaDiv.style.cssText = `
                        margin-top: 1rem;
                        padding: 1rem;
                        background: #f8f9fa;
                        border-radius: 8px;
                        text-align: center;
                    `;
                    
                    let mediaHTML = '<h4>Generated Files:</h4><div class="media-buttons">';
                    if (result.gif_url) {
                        mediaHTML += `<button class="media-btn gif-btn" onclick="app.showGif('${result.gif_url}')">View GIF Recording</button>`;
                    }
                    if (result.pdf_url) {
                        mediaHTML += `<button class="media-btn pdf-btn" onclick="app.downloadPdf('${result.pdf_url}')">Download PDF Report</button>`;
                    }
                    mediaHTML += '</div>';
                    
                    mediaDiv.innerHTML = mediaHTML;
                    
                    // Insert after the quick test form
                    const quickTestForm = document.getElementById('quick-test-form');
                    quickTestForm.parentNode.insertBefore(mediaDiv, quickTestForm.nextSibling);
                }
            } else {
                const error = await response.json();
                alert(`Failed to run quick test: ${error.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error running quick test:', error);
            alert('Error running quick test: ' + error.message);
        }
    }

    // Replace the existing runAllTests() method in script.js with this implementation

async runAllTests() {
    if (this.testCases.length === 0) {
        alert('No test cases available to run.');
        return;
    }

    const runButton = document.querySelector('.run-all-btn');
    const originalButtonText = runButton ? runButton.innerHTML : '';
    
    try {
        // Show loading state
        if (runButton) {
            runButton.innerHTML = '<span class="spinner">⏳</span> Running Tests...';
            runButton.disabled = true;
        }

        // Collect user passwords from localStorage
        const userPasswords = {};
        this.testCases.forEach(tc => {
            if (tc.user_id) {
                const password = localStorage.getItem(`user_${tc.user_id}_password`) || '';
                if (password) {
                    userPasswords[tc.user_id] = password;
                } else {
                    // Prompt for missing password
                    const user = this.users.find(u => u.id == tc.user_id);
                    const username = user ? user.email : '';
                    const promptedPassword = prompt(`Please enter the password for user ${username} (Test Case: ${tc.title}):`, '') || '';
                    if (promptedPassword) {
                        userPasswords[tc.user_id] = promptedPassword;
                        localStorage.setItem(`user_${tc.user_id}_password`, promptedPassword);
                    }
                }
            }
        });

        // Check if all required passwords are available
        const missingPasswords = this.testCases.filter(tc => tc.user_id && !userPasswords[tc.user_id]);
        if (missingPasswords.length > 0) {
            alert(`Cannot run tests: Missing passwords for test cases: ${missingPasswords.map(tc => tc.title).join(', ')}`);
            return;
        }

        const response = await fetch('/api/run_all_tests', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                test_case_ids: this.testCases.map(tc => tc.id),
                user_passwords: userPasswords
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            // Show success message
            const message = `All tests completed!\n` +
                          `Total: ${result.total_tests}\n` +
                          `Passed: ${result.passed}\n` +
                          `Failed: ${result.failed}\n` +
                          `Success Rate: ${result.success_rate}%`;
            
            alert(message);
            
            // Reload data to show updated results
            await this.loadTestCases();
            await this.loadTestRuns();
            this.renderAll();
            
            // Switch to reports tab to show results
            this.openTab('reports');
            
        } else {
            const error = await response.json();
            alert(`Failed to run all tests: ${error.error || 'Unknown error'}`);
        }
        
    } catch (error) {
        console.error('Error running all tests:', error);
        alert('Error running all tests: ' + error.message);
    } finally {
        // Reset button state
        if (runButton) {
            runButton.innerHTML = originalButtonText;
            runButton.disabled = false;
        }
    }
}

// Also add this helper method to show progress during batch execution
async runTestCaseWithProgress(testCase, index, total) {
    const runButton = document.querySelector('.run-all-btn');
    if (runButton) {
        runButton.innerHTML = `<span class="spinner">⏳</span> Running Test ${index + 1}/${total}...`;
    }
    
    // You can expand this to show individual test progress if needed
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 100); // Small delay to show progress
    });
}

    async runTestCase(id) {
    const tc = this.testCases.find(t => t.id === id);
    if (!tc) {
        alert('Test case not found.');
        return;
    }

    // Look up the user associated with tc.user_id
    let username = '';
    let password = '';
    let userName = 'Unknown User';
    console.log("Running test case:", tc.user_id);

    if (tc.user_id) {
        const user = this.users.find(u => u.id == tc.user_id);
        if (user) {
            username = user.email || '';
            userName = user.name || 'Unknown User';
            password = localStorage.getItem(`user_${tc.user_id}_password`) || '';
        }
    }

    // Prompt for credentials if missing
    if (!username || !password) {
        username = prompt('Please enter the username (email):', username) || '';
        password = prompt('Please enter the password:', '') || '';
        if (!username || !password) {
            alert('Username and password are required to run the test case.');
            return;
        }
        // Store credentials in localStorage for the user_id
        if (tc.user_id) {
            localStorage.setItem(`user_${tc.user_id}_password`, password);
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
            
            // Debug logging
            console.log('Server response for test case run:', result);
            
            // Update test case with results from server response
            tc.status = result.test_status;
            if (result.gif_url) tc.gif_path = result.gif_url;
            if (result.pdf_url) tc.pdf_url = result.pdf_url;
            
            // Debug logging after update
            console.log('Updated test case:', {
                id: tc.id,
                title: tc.title,
                status: tc.status,
                gif_path: tc.gif_path,
                pdf_url: tc.pdf_url,
                user_id: tc.user_id,
                user_name: userName
            });
            
            // Re-render the test case list to show the updated media buttons
            this.renderTestCaseList();
            
            // Show success message with media options
            let message = `Test case "${tc.title}" ran successfully for ${userName}.\nStatus: ${result.test_status}`;
            if (result.gif_url || result.pdf_url) {
                message += '\n\nMedia files generated:';
                if (result.gif_url) message += '\n- GIF recording available';
                if (result.pdf_url) message += '\n- PDF report available';
            }
            alert(message);
        } else {
            const error = await response.json();
            alert(`Failed to run test case for ${userName}: ${error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error running test case:', error);
        alert(`Error running test case for ${userName}: ${error.message}`);
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
console.log("window.app set", window.app);