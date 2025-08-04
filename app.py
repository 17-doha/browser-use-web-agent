from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from main import run_prompt
import os
import json
import re
import traceback
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_url_path='', template_folder="templates")
CORS(app)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://YOUR_PROJECT.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', 'YOUR_ANON_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Helper Function for Robust JSON Extraction ---
def extract_json_from_string(text):
    """
    Finds and extracts the first valid JSON object string from a larger text block.
    """
    # Pattern 1: Look for a json code block and extract its content
    match = re.search(r"``````", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Pattern 2: Look for any code block and extract its content
    match = re.search(r"``````", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Pattern 3: Fallback to find the first '{' to the last '}' in the entire string
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        return match.group(1).strip()
    
    return None

# Static file serving
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

# --- User API Endpoints ---
@app.route('/api/users', methods=['GET'])   
def get_all_users():
    try:
        res = supabase.table('users').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/users', methods=['POST'])
def create_user():
    try:
        payload = request.get_json()
        # Store plain password for now (NOT secure for real prod)
        user_data = {
            'name': payload.get('name'),
            'email': payload.get('email'),
            'password': payload.get('password') 
            # 'password_hash': hash_function(payload.get('password')) # for future security
        }
        res = supabase.table('users').insert(user_data).execute()
        return jsonify(res.data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    try:
        res = supabase.table('users').select('*').eq('id', user_id).execute()
        if res.data:
            return jsonify(res.data[0])
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    
@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        res = supabase.table('users').delete().eq('id', user_id).execute()
        return jsonify({'message': 'User deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/login', methods=['POST'])
def login():
    try:
        payload = request.get_json()
        email = payload.get('email')
        password = payload.get('password')
        
        res = supabase.table('users').select('*').eq('email', email).eq('password', password).execute()
        if res.data:
            return jsonify(res.data[0])
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# --- Test Cases API Endpoints ---
@app.route('/api/test_cases', methods=['GET'])
def get_test_cases():
    try:
        user_id = request.args.get('user_id')
        if user_id:
            res = supabase.table('test_cases').select('*').eq('user_id', user_id).execute()
        else:
            res = supabase.table('test_cases').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_cases', methods=['POST'])
def create_test_case():
    try:
        payload = request.get_json()
        print("Raw payload:", request.data)

        print("Received test case payload:", payload)  # Add this line
        print("User ID:", payload.get('user_id'))  
        test_case_data = {
            'title': payload.get('title'),
            'user_id': payload.get('user_id'),
            'actions': payload.get('actions'),
            'prompt_steps': payload.get('prompt_steps'),
            'status': payload.get('status', 'pending'),
            'gif_path': payload.get('gif_path'),
            'pdf_url': payload.get('pdf_url')
        }
        res = supabase.table('test_cases').insert(test_case_data).execute()
        return jsonify(res.data), 201
    except Exception as e:
        print(f"Error creating test case: {e}")  # Log the error
        return jsonify({'error': str(e)}), 400


@app.route('/api/test_cases/<int:case_id>', methods=['PUT'])
def update_test_case(case_id):
    try:
        payload = request.get_json()
        res = supabase.table('test_cases').update(payload).eq('id', case_id).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_cases/<int:case_id>', methods=['DELETE'])
def delete_test_case(case_id):
    try:
        res = supabase.table('test_cases').delete().eq('id', case_id).execute()
        return jsonify({'message': 'Test case deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Actions API Endpoints ---
@app.route('/api/actions', methods=['GET'])
def get_actions():
    try:
        res = supabase.table('actions').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions', methods=['POST'])
def create_action():
    try:
        payload = request.get_json()
        action_data = {
            'prompt': payload.get('prompt'),
            'steps_json': payload.get('steps_json')
        }
        res = supabase.table('actions').insert(action_data).execute()
        return jsonify(res.data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions/<int:action_id>', methods=['PUT'])
def update_action(action_id):
    try:
        payload = request.get_json()
        res = supabase.table('actions').update(payload).eq('id', action_id).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions/<int:action_id>', methods=['DELETE'])
def delete_action(action_id):
    try:
        res = supabase.table('actions').delete().eq('id', action_id).execute()
        return jsonify({'message': 'Action deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400



# --- Test Runs API Endpoints ---
@app.route('/api/test_runs', methods=['GET'])
def get_test_runs():
    try:
        res = supabase.table('test_runs').select('*').order('timestamp', desc=True).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_runs', methods=['POST'])
def create_test_run():
    try:
        payload = request.get_json()
        test_run_data = {
            'total_tests': payload.get('total_tests'),
            'passed': payload.get('passed'),
            'failed': payload.get('failed'),
            'results': payload.get('results')
        }
        res = supabase.table('test_runs').insert(test_run_data).execute()
        return jsonify(res.data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Original API Endpoints ---
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
    data = request.json
    print(f"[DEBUG] /run payload: {data}")  # Debug print incoming JSON

    prompt = data.get("prompt")
    username = data.get("username")
    password = data.get("password")
    print(username)
    print(password)

    if not all([prompt, username, password]):
        print("[ERROR] Missing required fields in /run")
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
