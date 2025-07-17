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
    category = data.get("category", "other")  # Default to "other" if category not provided
    print(username, password, category)

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
    
    pre_prompt_login = f"""
    You are a browser automation agent.

    Your goal is to test the login functionality of a web application under various scenarios (valid login, invalid credentials, empty fields, etc.).

    1. Navigate to the login page: https://testing.praxilyno-lms.com

    2. Wait for the login form to fully load. Use the following exact CSS selectors to locate the form fields:
    - Email input: input[type="email"]
    - Password input: input[type="password"]
    - Login button: button[type="submit"], or any button containing the visible text "Login"

    3. The following known valid credentials can be used when needed:
    - Valid email: {username}
    - Valid password: {password}

    4. If the test scenario calls for invalid input:
    - Use a clearly incorrect email, e.g.: wronguser@example.com
    - Use a clearly incorrect password, e.g.: WrongPass456!
    - If the test specifies an empty field, leave that input blank.

    5. After filling in the fields as instructed by the test prompt, always click the "Login" button to submit the form.

    6. Observe the system's response (e.g., redirection, success, error messages), and validate based on the test prompt.

    Messages should be checked based on their **intent or meaning**, not exact text. For example, "Wrong Email or Password!" and "Invalid credentials" are considered similar.
    """


    # Select prompt based on category
    selected_prompt = pre_prompt_login if category == "login" else pre_prompt
    full_prompt = f"{selected_prompt}\n{user_prompt}"

    try:
        result = run_prompt(full_prompt)
        return jsonify({"status": "success", "result": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)