from flask import Flask, request, jsonify, send_from_directory
from main import run_prompt
import os
import json
import re
import traceback

app = Flask(__name__, static_url_path='', template_folder="templates")

# --- Helper Function for Robust JSON Extraction ---
def extract_json_from_string(text):
    """
    Finds and extracts the first valid JSON object string from a larger text block.
    """
    # Pattern 1: Look for a json code block and extract its content
    match = re.search(r"``````", text)
    if match:
        return match.group(1).strip()
    
    # Pattern 2: Look for any code block and extract its content
    match = re.search(r"``````", text)
    if match:
        return match.group(1).strip()

    # Pattern 3: Fallback to find the first '{' to the last '}' in the entire string
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        return match.group(1).strip()

    return None

# FIXED: Different function names for different routes
@app.route('/app_static/<path:filename>')
def serve_app_static(filename):
    static_dir = os.path.join(os.getcwd(), 'app_static')
    return send_from_directory(static_dir, filename)

@app.route('/static/<path:path>')
def serve_static_files(path):
    print(f"[DEBUG] Serving static file: /static/{path}")
    return send_from_directory('static', path)

@app.route("/")
def home():
    """Serves the main index.html file."""
    return send_from_directory("templates", "index.html")

# --- API Endpoints ---
@app.route("/generate-action-json", methods=["POST"])
def generate_action_json_route():
    """
    Called by the "Generate Steps JSON" button.
    Takes a natural language prompt and asks the LLM to convert it into a JSON object.
    """
    data = request.json
    prompt = data.get("prompt")

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    json_generation_pre_prompt = f"""
You are an expert at converting natural language instructions into a structured JSON format for a browser automation tool. Your task is to generate a JSON object containing a "steps" array. Each object in the array represents a single, atomic browser action.

The supported actions and their required formats are:
- {{"action": "navigate", "url": "https://example.com"}}
- {{"action": "input", "selector": "css_selector", "value": "text_to_type"}}
- {{"action": "click", "selector": "css_selector"}}
- {{"action": "wait", "time": 2000}} (time is in milliseconds)
- {{"action": "screenshot", "name": "screenshot_name"}}

Based on the user's request below, generate ONLY the JSON object. You can wrap it in ```

User Request: "{prompt}"
"""

    try:
        result = run_prompt(json_generation_pre_prompt)
        print(result)
        raw_text = result.get("text", "")

        json_string = extract_json_from_string(raw_text)

        if not json_string:
            return jsonify({
                "error": "The agent did not return a recognizable JSON object.",
                "raw_output": raw_text
            }), 500

        generated_json = json.loads(json_string)
        return jsonify(generated_json)

    except json.JSONDecodeError:
        return jsonify({
            "error": "Failed to parse JSON from the agent. The extracted response was not valid JSON.",
            "raw_output": json_string
        }), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route("/run", methods=["POST"])
def execute_test_run_route():
    """Executes a full test run based on a prompt and user credentials."""
    data = request.json
    prompt = data.get("prompt")
    username = data.get("username")
    password = data.get("password")

    if not all([prompt, username, password]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    pre_prompt = f"""You are a browser automation agent. Your goal is to execute a series of steps.

1. Navigate to the login page: https://testing.praxilabs-lms.com
2. Wait for the login form to fully load. Use CSS selectors:
   - Email input: input[type="email"]
   - Password input: input[type="password"]
   - Login button: button[type="submit"]
3. Log in using:
   - Email: {username}
   - Password: {password}
4. Verify successful login by checking for a visible "Courses" tab. Retry once if it fails.
5. After successful login, execute the following steps defined in the JSON:
"""
    
    final_prompt = f"{pre_prompt} {prompt}"

    try:
        result = run_prompt(final_prompt)
        response = {
            "status": "success",
            "result": result.get("text", "No text result returned."),
            "test_status": result.get("status", "unknown")
        }

        if result.get("gif_path"):
            response["gif_url"] = "/" + result["gif_path"]

        if result.get("pdf_path"):
            response["pdf_url"] = "/" + result["pdf_path"]

        return jsonify(response)
    except Exception as e:
        print(f"[ERROR] Exception in /run: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)
