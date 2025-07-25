from flask import Flask, request, jsonify, send_from_directory
from main import run_prompt
import os

app = Flask(__name__, static_folder="static", template_folder="templates")


@app.route("/")
def home():
    return send_from_directory("templates", "index.html")


@app.route("/run", methods=["POST"])
def execute_prompt():
    data = request.json
    prompt = data.get("prompt")
    username = data.get("username")
    password = data.get("password")

    if not username or not password or not prompt:
        return jsonify({"status": "error", "message": "Missing fields"}), 400

    pre_prompt = f"""You are a browser automation agent.

1. Navigate to the login page: https://testing.praxilabs-lms.com

2. Wait for the login form to fully load. Use the following exact CSS selectors to locate the form fields:
   - Email input: input[type="email"]
   - Password input: input[type="password"]
   - Login button: button[type="submit"], or a button containing "Login"

3. Log in using:
   - Email: {username}
   - Password: {password}

4. Verify login was successful by checking for a visible "Courses" tab.

5. If login fails, retry once.

6. After successful login:
"""
    
    final_prompt = f"{pre_prompt} {prompt}"

    try:
        result = run_prompt(final_prompt)

        response = {
            "status": "success",
            "result": result["text"],
            "test_status": result["status"]  # success or fail
        }

        if result.get("gif_path"):
            response["gif_url"] = "/" + result["gif_path"]

        if result.get("pdf_path"):
            response["pdf_url"] = "/" + result["pdf_path"]

        return jsonify(response)

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
