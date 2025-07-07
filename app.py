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
    prompt = data.get("prompt", "")
    try:
        result = run_prompt(prompt)  # Wrap your structured_prompt into function
        return jsonify({"status": "success", "result": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)