from flask import Flask, request, jsonify, send_from_directory
from main import run_prompt
import os
import json
import re # Import regular expressions for JSON extraction

app = Flask(__name__, static_folder="static", template_folder="templates")

# ==============================================================================
# --- Helper Function for Robust JSON Extraction (CORRECTED) ---
# ==============================================================================
def extract_json_from_string(text):
    """
    Finds and extracts the first valid JSON object string from a larger text block.
    This is more robust and handles markdown fences and other text.
    """
    # Pattern 1: Look for a `````` code block and extract its content
    match = re.search(r"``````", text)
    if match:
        # If a json code block is found, return the cleaned content
        return match.group(1).strip()

    # Pattern 2: Fallback to find the first '{' to the last '}' in the entire string
    # This is useful if the agent forgets the markdown fences.
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        return match.group(1).strip()

    # Return None if no JSON-like structure is found
    return None

# --- Static File and Home Page Routes ---
@app.route('/static/<path:path>')
def serve_static(path):
    """Serves static files (CSS, JS, and generated GIFs/PDFs)."""
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

        # Use the NEW, more robust helper function
        json_string = extract_json_from_string(raw_text)

        if not json_string:
            # This is the error you were seeing. It means no JSON was found.
            return jsonify({
                "error": "The agent did not return a recognizable JSON object.",
                "raw_output": raw_text # Sending back the raw output can help with debugging
            }), 500

        # Now, parse the clean JSON string
        generated_json = json.loads(json_string)
        return jsonify(generated_json)

    except json.JSONDecodeError:
        # This error is a final fallback if the extracted string is still not valid JSON
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
    final_prompt = f"{pre_prompt}\n{prompt}"

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
