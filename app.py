from flask import Flask, request, jsonify, send_from_directory
from main import run_prompt  # You'll wrap your Gradio logic into a function
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route('/')
def serve_gui():
    return send_from_directory("templates", "index.html")

@app.route('/run', methods=['POST'])
def run_test():
    data = request.json
    user_prompt = data.get("prompt", "")
    username = data.get("username", "")
    password = data.get("password", "")
    print(username, password)

    pre_prompt = f"""You are a browser automation agent.

        1. Navigate to the login page: https://testing.praxilabs-lms.com

        2. Wait for the login form to fully load. Use the following exact CSS selectors to locate the form fields:

        - Email input: input[type="email"]
        - Password input: input[type="password"]
        - Login button: button[type="submit"] or any button containing the text "Login"

        3. Enter the following credentials:
        - Email: {username}
        - Password: {password}

        4. Click the login button.

        5. Wait for the page to change. Confirm that login is successful by checking for a visible "Courses" link or section.

        6. If the login fails, retry once by re-identifying the elements using the same selectors.

        7. After successful login:"""

    # Combine pre_prompt with the user-provided prompt
    full_prompt = f"{pre_prompt}\n{user_prompt}"

    try:
        result = run_prompt(full_prompt)
        return jsonify({"status": "success", "result": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)