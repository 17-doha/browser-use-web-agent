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
from sqlalchemy.pool import QueuePool

load_dotenv()

app = Flask(__name__, static_url_path='', template_folder="templates")
CORS(app)

# --- SQLAlchemy Setup ---
# Try different SSL configurations for Supabase
import ssl

# Option 1: Try with SSL context
try:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    DATABASE_URL = "postgresql://postgres.rpwwyugngnvdegzfltvo:h5APXXtrN!Y%eP2@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    engine = create_engine(
        DATABASE_URL,
        pool_size=3,
        max_overflow=5,
        pool_timeout=20,
        poolclass=QueuePool,
        connect_args={
            "sslmode": "require",
            "connect_timeout": 10,
            "application_name": "browser_agent_app",
            "sslcert": None,
            "sslkey": None,
            "sslrootcert": None
        }
    )
except Exception as e:
    print(f"Failed to create engine with SSL context: {e}")
    # Fallback to basic configuration
    DATABASE_URL = "postgresql://postgres.rpwwyugngnvdegzfltvo:h5APXXtrN!Y%eP2@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    engine = create_engine(
        DATABASE_URL,
        pool_size=3,
        max_overflow=5,
        pool_timeout=20,
        poolclass=QueuePool
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Database Session Management ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        print(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
Base = declarative_base()

# --- ORM Models ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # plaintext in your current code

class TestCase(Base):
    __tablename__ = "test_cases"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    user_id = Column(Integer, ForeignKey('users.id'))
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
    max_retries = 3
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            print("Database tables created successfully")
            return True
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                print("Failed to create database tables after all retries")
                return False
            import time
            time.sleep(2)  # Wait 2 seconds before retrying
    return False

# Try to create tables, but don't fail the application if it doesn't work
tables_created = create_tables_with_retry()
if not tables_created:
    print("WARNING: Could not create database tables. Database functionality will be limited.")

# --- Database Connection Test ---
def test_database_connection():
    try:
        print("Testing database connection...")
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("Database connection test successful")
            return True
    except Exception as e:
        print(f"Database connection test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

# Test the connection
connection_success = test_database_connection()
if not connection_success:
    print("WARNING: Database connection failed. The application may not work properly.")
    print("You can still run the application without database functionality.")

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

# --- User API Endpoints ---
@app.route('/api/users', methods=['GET'])
def get_all_users():
    try:
        db = SessionLocal()
        users = db.query(User).all()
        return jsonify([{
            "id": u.id, "name": u.name, "email": u.email
        } for u in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/users', methods=['POST'])
def create_user():
    try:
        db = SessionLocal()
        payload = request.get_json()
        new_user = User(
            name=payload.get('name'),
            email=payload.get('email'),
            password=payload.get('password')
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return jsonify({"id": new_user.id, "name": new_user.name, "email": new_user.email}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

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
    try:
        db = SessionLocal()
        user_id = request.args.get('user_id')
        if user_id:
            test_cases = db.query(TestCase).filter(TestCase.user_id == user_id).all()
        else:
            test_cases = db.query(TestCase).all()
        return jsonify([{
            "id": t.id, "title": t.title, "user_id": t.user_id,
            "actions": t.actions, "prompt_steps": t.prompt_steps,
            "status": t.status, "gif_path": t.gif_path, "pdf_url": t.pdf_url
        } for t in test_cases])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

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
        return jsonify({"id": new_action.id}), 201
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
            response["gif_url"] = "/" + result["gif_path"]
        if result.get("pdf_path"):
            response["pdf_url"] = "/" + result["pdf_path"]

        # Update test case status if ID is provided
        if test_case_id:
            db.query(TestCase).filter(TestCase.id == test_case_id).update({"status": result.get("status", "completed")})
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

    pre_prompt = f"""You are a browser automation agent...
Email: {username}
Password: {password}
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
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)

