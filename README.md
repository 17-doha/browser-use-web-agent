# AI-Powered Testing Automation

A comprehensive web application for creating, managing, and executing automated browser tests using AI-powered agents. This tool allows you to convert natural language instructions into structured test cases and run them against web applications with visual feedback.

## Features

### 🤖 AI-Powered Test Generation
- Convert natural language descriptions into structured JSON test steps
- Powered by Google's Gemini 2.0 Flash model
- Supports complex multi-step browser automation workflows

### 🎯 Test Case Management
- Create and organize test cases with intuitive web interface
- Manage user credentials and reusable action libraries
- Edit and update test cases with built-in modal editors

### 🎬 Visual Test Execution
- Automated screenshot capture during test execution
- Generate animated GIFs showing test progression
- Export detailed PDF reports with step-by-step results

### 🔧 Browser Automation Actions
- **Navigation**: Direct browser to specific URLs
- **Input**: Fill forms and text fields using CSS selectors
- **Click**: Interact with buttons and clickable elements
- **Wait**: Add delays for page loading and animations
- **Screenshot**: Capture specific moments during execution

## Technology Stack

- **Backend**: Flask (Python)
- **Browser Automation**: Playwright + browser-use library
- **AI/LLM**: Google Gemini 2.0 Flash
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Containerization**: Docker with Docker Compose
- **File Generation**: PIL (images), imageio (GIFs), FPDF (reports)

## Installation & Setup

### Prerequisites
- Docker and Docker Compose
- Google Cloud API key for Gemini access

### Environment Configuration
1. Create a `.env` file in the root directory:
GOOGLE_API_KEY=your_gemini_api_key_here

### Running with Docker
Clone the repository
git clone <repository-url>
cd browser-automation-suite

Start the application
docker-compose up --build

Access the application
open http://localhost:5000


## Usage Guide

### 1. Setting Up Users
Navigate to the **Users** tab to add login credentials:
- **Name**: Display name for the user
- **Email**: Login email address
- **Password**: Account password

### 2. Creating Action Libraries
Use the **Actions** tab to build reusable test components:
- **Prompt**: Natural language description of the action
- **Steps JSON**: Structured automation steps

Example action JSON:
{
"steps": [
{"action": "navigate", "url": "https://example.com"},
{"action": "input", "selector": "#username", "value": "testuser"},
{"action": "click", "selector": "button[type='submit']"}
]
}


### 3. Building Test Cases
In the **Test Cases** tab:
1. Enter a descriptive title
2. Select the target user account
3. Choose relevant actions from your library
4. Generate or manually write the test steps JSON
5. Save the test case

### 4. Executing Tests
- **Single Test**: Click "Run" on any individual test case
- **Bulk Execution**: Use "Run All Tests" to execute your entire suite
- Monitor progress through real-time status updates

### 5. Viewing Results
Access the **Reports** tab to:
- View test execution summaries
- Download animated GIFs of test runs
- Export detailed PDF reports
- Track pass/fail rates over time

## API Endpoints

### Generate Test Steps
POST /generate-action-json
Content-Type: application/json

{
"prompt": "Navigate to login page and sign in with user credentials"
}

### Execute Test Run
POST /run
Content-Type: application/json

{
"prompt": "JSON steps or natural language description",
"username": "user@example.com",
"password": "userpassword"
}

## Supported Browser Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `navigate` | `url` | Navigate to specified URL |
| `input` | `selector`, `value` | Enter text into form fields |
| `click` | `selector` | Click on elements |
| `wait` | `time` | Pause execution (milliseconds) |
| `screenshot` | `name` | Capture screenshot with custom name |

## File Structure

#  browser-automation-suite

##  Core Application
- `app.py` – Flask web server and API endpoints  
- `main.py` – Browser automation engine and AI agent logic  
- `requirements.txt` – Python package dependencies  
- `Dockerfile` – Container build instructions  
- `docker-compose.yaml` – Multi-container orchestration  
- `templates/`
  - `index.html` – Main web interface and UI components  
- `static/`
    - `screenshots/`
     - `gifs/` 
      - `pdfs/`
- `app_static/`
  - `screenshots/`
  - `gifs/` 
  - `pdfs/`
  - `styles.css` – Application styling and responsive design  
  - `script.js` – Frontend JavaScript logic and API calls  
- `.env` – Environment variables (API keys, settings)  
- `README.md` – Project documentation and setup guide

## Configuration

The application uses several configurable directories and settings:

- **Screenshots**: `app_static/screenshots/` - Timestamped folders for each test run
- **GIF Output**: `app_static/gifs/` - Animated recordings of test execution  
- **PDF Reports**: `app_static/pdfs/` - Detailed test result documents
- **Browser Config**: Headless Chrome with screenshot capabilities
- **Max Steps**: 100 steps per test execution (configurable in `main.py`)

## Data Persistence

All application data is stored in browser localStorage:
- Test cases and their configurations
- User credentials (stored locally for testing purposes)
- Action libraries and reusable components
- Test execution history and results

## Troubleshooting

### Common Issues

**Browser Launch Failures**:
- Ensure Docker has sufficient memory allocation
- Check that port 5000 is not in use by other applications

**API Key Errors**:
- Verify your Google Cloud API key is correctly set in `.env`
- Ensure the Gemini API is enabled in your Google Cloud project

**Test Execution Timeouts**:
- Increase wait times for slow-loading pages
- Check network connectivity to target websites

**File Generation Issues**:
- Verify write permissions in the `app_static` directory
- Check available disk space for screenshot and media storage

## License

This project is available under the MIT License. See the LICENSE file for more details.

