from flask import Flask, request, jsonify, send_from_directory
from main import run_prompt
import os
import json
import re

app = Flask(__name__, static_folder="static", template_folder="templates")

# ==============================================================================
# --- Helper Function for Robust JSON Extraction (No Changes Needed) ---
# ==============================================================================
def extract_json_from_string(text):
    """
    Finds and extracts the first valid JSON object string from a larger text block.
    """
    match = re.search(r"``````", text)
    if match:
        return match.group(1).strip()
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        return match.group(1).strip()
    return None

# --- Static File and Home Page Routes ---
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route("/")
def home():
    return send_from_directory("templates", "index.html")

# --- API Endpoints ---
# ==============================================================================
# --- ENDPOINT 1: For Generating a Single Action's JSON ---
# ==============================================================================
@app.route("/generate-action-json", methods=["POST"])
def generate_action_json_route():
    """
    Takes a simple user request and converts it into a JSON steps object.
    This IGNORES login and other test case contexts.
    """
    data = request.json
    prompt = data.get("prompt")

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # A very direct prompt focused ONLY on creating the JSON for the given action
    json_generation_pre_prompt = f"""
You are an expert at converting a single user instruction into a structured JSON format for a browser automation tool. Your only task is to translate the user's request into a JSON object with a "steps" array.

Do not ask for more information. Assume all context is already handled.

Supported actions and their formats are:
- {{"action": "navigate", "url": "https://example.com"}}
- {{"action": "input", "selector": "css_selector", "value": "text_to_type"}}
- {{"action": "click", "selector": "css_selector"}}
- {{"action": "wait", "time": 2000}} (time is in milliseconds)
- {{"action": "screenshot", "name": "screenshot_name"}}

Based on the user's request below, generate ONLY the JSON object.

User Request: "{prompt}"
"""
    try:
        result = run_prompt(json_generation_pre_prompt)
        raw_text = result.get("text", "")
        json_string = extract_json_from_string(raw_text)

        if not json_string:
            return jsonify({
                "error": "The agent did not return a recognizable JSON object.",
                "raw_output": raw_text
            }), 500

        generated_json = json.loads(json_string)
        return jsonify(generated_json)
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

# ==============================================================================
# --- ENDPOINT 2: For Running a Full Test Case ---
# ==============================================================================
@app.route("/run", methods=["POST"])
def execute_test_run_route():
    """
    Executes a full test run using your detailed prompt structure,
    which includes login, preconditions, and steps.
    """
    data = request.json
    prompt = data.get("prompt") # This prompt should be the detailed test case structure
    username = data.get("username")
    password = data.get("password")

    if not all([prompt, username, password]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    # This prompt now uses your full, structured test case format.
    # The login credentials are inserted into the initial steps.
    final_prompt = f"""
You are a browser automation agent. Your goal is to execute a series of steps based on the provided test case.

1.  **Login Step**: Navigate to https://testing.praxilabs-lms.com and log in.
    -   Input '{username}' into the email field (input[type="email"]).
    -   Input '{password}' into the password field (input[type="password"]).
    -   Click the login button (button[type="submit"]).
    -   ✅ Check: The "Courses" tab is visible after login.
    -   ❌ If not, report: "Login failed: Courses tab not found."

2.  **Execute Test Case Steps**: After a successful login, proceed with the following test case:

{prompt}
"""

    try:
        result = run_prompt(final_prompt)
        response = {
            "status": "success",
            "result": result.get("text", "No text result returned."),
            "test_status": result.get("status", "unknown")
        }

        if result.get("gif_path"):
            response["gif_url"] = "/" + result["gif_path"].replace("\\", "/")
        if result.get("pdf_path"):
            response["pdf_url"] = "/" + result["pdf_path"].replace("\\", "/")

        return jsonify(response)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Application Startup ---
if __name__ == "__main__":
    os.makedirs("static/gifs", exist_ok=True)
    os.makedirs("static/pdfs", exist_ok=True)
    app.run(debug=True, port=5000)
