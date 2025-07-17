let testCases = [];
let activeCategory = 'all';

function showSection(section, category = 'all') {
  document.querySelectorAll('.dashboard-container').forEach(el => el.classList.remove('active'));
  document.getElementById(section).classList.add('active');

  document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.nav-button[onclick*="${category}"]`)?.classList.add('active') ||
    document.querySelector(`.nav-button[onclick*="${section}"]`).classList.add('active');

  activeCategory = category;
  renderTestCases();
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function updateStats() {
  const filteredTests = activeCategory === 'all' 
    ? testCases 
    : testCases.filter(t => t.category === activeCategory);
  
  document.getElementById('totalTests').textContent = filteredTests.length;
  document.getElementById('successfulTests').textContent = filteredTests.filter(t => t.status === 'success').length;
  document.getElementById('failedTests').textContent = filteredTests.filter(t => t.status === 'failed').length;
  document.getElementById('categories').textContent = new Set(testCases.map(t => t.username)).size;
}

function renderTestCases() {
  const container = document.getElementById('testCaseContainer');
  container.innerHTML = '';

  const filteredTests = activeCategory === 'all' 
    ? testCases 
    : testCases.filter(t => t.category === activeCategory);

  filteredTests.forEach(test => {
    const div = document.createElement('div');
    div.className = 'test-case-card';
    div.innerHTML = `
      <div class="test-case-header">
        <span class="validation ${test.status === 'failed' ? 'failed' : ''}">
          ${test.status === 'failed' ? '⚠ ' : ''}${test.validation}
        </span>
        <span class="username">${test.username}</span>
        <span class="category">[${test.category}]</span>
      </div>
      <div class="test-case-actions">
        <button class="action-button small" onclick="deleteTestCase(${test.id})">🗑</button>
        <button class="action-button run" onclick="runTest(${test.id})">Run</button>
      </div>
    `;
    container.appendChild(div);
  });

  updateStats();
}

function createNewTest() {
  openModal('createModal');
  document.getElementById('newPromptInput').value = '';
  document.getElementById('newUsernameInput').value = '';
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('testCategory').value = activeCategory === 'all' ? 'login' : activeCategory;
}

function saveNewPrompt() {
  const newUsername = document.getElementById('newUsernameInput').value.trim();
  const newPassword = document.getElementById('newPasswordInput').value.trim();
  const newPrompt = document.getElementById('newPromptInput').value.trim();
  const category = document.getElementById('testCategory').value;

  if (!newUsername || !newPassword || !newPrompt) {
    return alert("Please enter username, password, and prompt");
  }

  const newTest = {
    id: Date.now(),
    validation: `Test ${newPrompt}`,
    username: newUsername,
    password: newPassword,
    prompt: newPrompt,
    category: category,
    status: 'pending'
  };

  testCases.push(newTest);
  closeModal('createModal');
  renderTestCases();
}

function deleteTestCase(id) {
  testCases = testCases.filter(t => t.id !== id);
  renderTestCases();
  alert(`Deleted test case with ID ${id}`);
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
        username: test.username,
        password: test.password
      })
    });

    const data = await res.json();
    if (res.ok) {
      test.status = 'success';
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
  const filteredTests = activeCategory === 'all' 
    ? testCases 
    : testCases.filter(t => t.category === activeCategory);
  const data = JSON.stringify(filteredTests, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `playbook_${activeCategory}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert(`Playbook exported as playbook_${activeCategory}.json`);
}

// Initialize
window.onload = () => {
  showSection('dashboard', 'all');
  renderTestCases();
};