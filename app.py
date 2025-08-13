# filename: app.py (Database configuration section)
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from main import run_prompt
import os
import json
import re
import traceback
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime, text
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.pool import QueuePool, NullPool
from uuid import uuid4
import time

load_dotenv()

app = Flask(__name__, static_url_path='', template_folder="templates")
CORS(app)

# --- SQLAlchemy Setup ---
# --- SQLAlchemy Setup with Better Error Handling ---
DATABASE_URL = "postgresql://postgres.rpwwyugngnvdegzfltvo:h5APXXtrN!Y%eP2@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # Disable connection pooling
    connect_args={
        'sslmode': 'disable',
        'connect_timeout': 10,
        'keepalives_idle': 600,
        'keepalives_interval': 30,
        'keepalives_count': 3,
    },
    echo=False,  # Set to True for SQL debugging
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database connection helper with retry logic
def get_db_session():
    """Get database session with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            session = SessionLocal()
            # Test the connection
            session.execute(text("SELECT 1"))
            return session
        except Exception as e:
            print(f"Database connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)  # Wait before retry
            else:
                raise e
# --- ORM Models ---
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)  # Use string UUID
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # plaintext in your current code

class TestCase(Base):
    __tablename__ = "test_cases"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    user_id = Column(String, ForeignKey('users.id')) # Changed to String
    actions = Column(JSON)          # store arrays/dicts directly
    prompt_steps = Column(JSON)     # store dicts directly
    status = Column(String)
    gif_path = Column(String)
    pdf_url = Column(String)
    user = relationship("User")

class Action(Base):
    __tablename__ = "actions"
    id = Column(Integer, primary_key=True, index=True)
    prompt = Column(Text)
    steps_json = Column(Text)

class TestRun(Base):
    __tablename__ = "test_runs"
    id = Column(Integer, primary_key=True, index=True)
    total_tests = Column(Integer)
    passed = Column(Integer)
    failed = Column(Integer)
    results = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

# Create tables with retry logic
def create_tables_with_retry():
    """Create database tables with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            print("Database tables created successfully")
            return
        except Exception as e:
            print(f"Table creation attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                print(f"Failed to create tables after {max_retries} attempts")
                raise e

# Initialize database
create_tables_with_retry()

Base.metadata.create_all(bind=engine)

# --- Helper Function for Robust JSON Extraction ---
def extract_json_from_string(text):
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
    return send_from_directory('static', path)

@app.route("/")
def home():
    return send_from_directory("templates", "index.html")

# --- Updated API Endpoints with Better Error Handling ---
@app.route('/api/users', methods=['GET'])
def get_all_users():
    session = None
    try:
        session = get_db_session()
        users = session.query(User).all()
        return jsonify([{
            "id": u.id, "name": u.name, "email": u.email
        } for u in users])
    except Exception as e:
        print(f"Error in get_all_users: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if session:
            session.close()

@app.route('/api/users', methods=['POST'])
def create_user():
    session = None
    try:
        session = get_db_session()
        payload = request.get_json()
        new_user = User(
            id=str(uuid4()),
            name=payload.get('name'),
            email=payload.get('email'),
            password=payload.get('password')
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        return jsonify({"id": new_user.id, "name": new_user.name, "email": new_user.email}), 201
    except Exception as e:
        if session:
            session.rollback()
        print(f"Error in create_user: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if session:
            session.close()

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return jsonify({"id": user.id, "name": user.name, "email": user.email})
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        db = SessionLocal()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
        return jsonify({'message': 'User deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    try:
        db = SessionLocal()
        payload = request.get_json()
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.name = payload.get('name', user.name)
        user.email = payload.get('email', user.email)
        if payload.get('password'):
            user.password = payload.get('password')
        db.commit()
        db.refresh(user)
        return jsonify({"id": user.id, "name": user.name, "email": user.email}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/login', methods=['POST'])
def login():
    try:
        db = SessionLocal()
        payload = request.get_json()
        email = payload.get('email')
        password = payload.get('password')
        user = db.query(User).filter(User.email == email, User.password == password).first()
        if user:
            return jsonify({"id": user.id, "name": user.name, "email": user.email})
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Test Cases API Endpoints ---
@app.route('/api/test_cases', methods=['GET'])
def get_test_cases():
    session = None
    try:
        session = get_db_session()
        user_id = request.args.get('user_id')
        if user_id:
            test_cases = session.query(TestCase).filter(TestCase.user_id == user_id).all()
        else:
            test_cases = session.query(TestCase).all()
        return jsonify([{
            "id": t.id, "title": t.title, "user_id": t.user_id,
            "actions": t.actions, "prompt_steps": t.prompt_steps,
            "status": t.status, "gif_path": t.gif_path, "pdf_url": t.pdf_url
        } for t in test_cases])
    except Exception as e:
        print(f"Error in get_test_cases: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if session:
            session.close()

@app.route('/api/test_cases', methods=['POST'])
def create_test_case():
    try:
        db = SessionLocal()
        
        # Log raw request data
        print("Headers:", dict(request.headers))
        print("Raw Data:", request.data)
        
        payload = request.get_json(force=True)
        print("Parsed JSON payload:", payload)

        new_case = TestCase(
            title=payload.get('title'),
            user_id=payload.get('user_id'),
            actions=json.dumps(payload.get('actions')),
            prompt_steps=json.dumps(payload.get('prompt_steps')),
            status=payload.get('status', 'pending'),
            gif_path=payload.get('gif_path'),
            pdf_url=payload.get('pdf_url')
        )

        db.add(new_case)
        db.commit()
        db.refresh(new_case)
        return jsonify({"id": new_case.id}), 201
    except Exception as e:
        import traceback
        print("Exception occurred:", str(e))
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_cases/<int:case_id>', methods=['PUT'])
def update_test_case(case_id):
    data = request.get_json()

    if not data or 'title' not in data or 'description' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    try:
        db = SessionLocal()
        payload = request.get_json(force=True)

        # Convert dicts/lists to JSON strings before update
        if isinstance(payload.get("prompt_steps"), (dict, list)):
            payload["prompt_steps"] = json.dumps(payload["prompt_steps"])
        if isinstance(payload.get("actions"), (dict, list)):
            payload["actions"] = json.dumps(payload["actions"])

        updated_rows = db.query(TestCase).filter(TestCase.id == case_id).update(payload)
        if updated_rows == 0:
            return jsonify({'error': 'Test case not found'}), 404

        db.commit()
        return jsonify({'message': 'Updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_cases/<int:case_id>', methods=['DELETE'])
def delete_test_case(case_id):
    try:
        db = SessionLocal()
        db.query(TestCase).filter(TestCase.id == case_id).delete()
        db.commit()
        return jsonify({'message': 'Test case deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Actions API Endpoints ---
@app.route('/api/actions', methods=['GET'])
def get_actions():
    try:
        db = SessionLocal()
        actions = db.query(Action).all()
        return jsonify([{"id": a.id, "prompt": a.prompt, "steps_json": a.steps_json} for a in actions])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions', methods=['POST'])
def create_action():
    try:
        db = SessionLocal()
        payload = request.get_json()
        new_action = Action(
            prompt=payload.get('prompt'),
            steps_json=payload.get('steps_json')
        )
        db.add(new_action)
        db.commit()
        db.refresh(new_action)
        return jsonify({"id": new_action.id, "prompt": new_action.prompt, "steps_json": new_action.steps_json}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions/<int:action_id>', methods=['PUT'])
def update_action(action_id):
    try:
        db = SessionLocal()
        payload = request.get_json()
        db.query(Action).filter(Action.id == action_id).update(payload)
        db.commit()
        return jsonify({'message': 'Updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/actions/<int:action_id>', methods=['DELETE'])
def delete_action(action_id):
    try:
        db = SessionLocal()
        db.query(Action).filter(Action.id == action_id).delete()
        db.commit()
        return jsonify({'message': 'Action deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Test Runs API Endpoints ---
@app.route('/api/test_runs', methods=['GET'])
def get_test_runs():
    try:
        db = SessionLocal()
        runs = db.query(TestRun).order_by(TestRun.timestamp.desc()).all()
        return jsonify([{
            "id": r.id, "total_tests": r.total_tests, "passed": r.passed,
            "failed": r.failed, "results": r.results, "timestamp": r.timestamp
        } for r in runs])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/test_runs', methods=['POST'])
def create_test_run():
    try:
        db = SessionLocal()
        
        # Print raw request data and parsed payload for debugging
        print("Headers:", dict(request.headers))
        print("Raw body:", request.data)
        
        payload = request.get_json(force=True)
        print("Parsed JSON payload:", payload)

        new_run = TestRun(
            total_tests=payload.get('total_tests'),
            passed=payload.get('passed'),
            failed=payload.get('failed'),
            results=payload.get('results')
        )
        db.add(new_run)
        db.commit()
        db.refresh(new_run)
        return jsonify({"id": new_run.id}), 201
    except Exception as e:
        import traceback
        print("Exception:", str(e))
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

# --- Test Case Execution Endpoint ---
@app.route('/api/run_test_case', methods=['POST'])
def run_test_case():
    try:
        db = SessionLocal()
        payload = request.get_json()
        prompt = payload.get('prompt')
        username = payload.get('username')
        password = payload.get('password')
        test_case_id = payload.get('test_case_id')

        if not all([prompt, username, password]):
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        pre_prompt = f"""You are a browser automation agent...
Email: {username}
Password: {password}
"""
        final_prompt = f"{pre_prompt} {prompt}"

        result = run_prompt(final_prompt)
        response = {
            "status": "success",
            "result": result.get("text", "No text result returned."),
            "test_status": result.get("status", "completed")
        }
        if result.get("gif_path"):
            response["gif_url"] = "/app_static/gifs/" + result["gif_path"].split("/")[-1]
        if result.get("pdf_path"):
            response["pdf_url"] = "/app_static/pdfs/" + result["pdf_path"].split("/")[-1]

        # Update test case status and media paths if ID is provided
        if test_case_id:
            update_data = {"status": result.get("status", "completed")}
            if result.get("gif_path"):
                update_data["gif_path"] = "/app_static/gifs/" + result["gif_path"].split("/")[-1]
            if result.get("pdf_path"):
                update_data["pdf_url"] = "/app_static/pdfs/" + result["pdf_path"].split("/")[-1]
            
            db.query(TestCase).filter(TestCase.id == test_case_id).update(update_data)
            db.commit()

        return jsonify(response)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Original LLM Endpoints ---
@app.route("/generate-action-json", methods=["POST"])
def generate_action_json_route():
    data = request.json
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    json_generation_pre_prompt = f"""
You are an expert at converting natural language instructions into a structured JSON format for a browser automation tool.
Given a user request, generate a JSON object with an "actions" array, where each action has a "type" (e.g., "click", "type", "navigate") and "details" (e.g., selector, text, url).
User Request: "{prompt}"
"""
    try:
        result = run_prompt(json_generation_pre_prompt)
        raw_text = result.get("text", "")
        json_string = extract_json_from_string(raw_text)
        if not json_string:
            return jsonify({"error": "Could not extract JSON", "raw_output": raw_text}), 500
        generated_json = json.loads(json_string)
        return jsonify(generated_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/run", methods=["POST"])
def execute_test_run_route():
    data = request.json
    prompt = data.get("prompt")
    username = data.get("username")
    password = data.get("password")
    if not all([prompt, username, password]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

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
            "result": result.get("text", "No text result returned."),
            "test_status": result.get("status", "unknown")
        }
        if result.get("gif_path"):
            response["gif_url"] = "/app_static/gifs/" + result["gif_path"].split("/")[-1]
        if result.get("pdf_path"):
            response["pdf_url"] = "/app_static/pdfs/" + result["pdf_path"].split("/")[-1]
        return jsonify(response)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)