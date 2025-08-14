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
    user_id = Column(String, ForeignKey('users.id'))
    actions = Column(JSON)  # Keep as JSON for action IDs
    prompt_steps = Column(Text)  # Change from JSON to Text
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
    results = Column(JSON)  # Changed from Text to JSON
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

        # Extract and validate action_ids
        action_ids = payload.get('actions', [])
        if not isinstance(action_ids, (list, tuple)):
            action_ids = []
        action_ids = [int(aid) for aid in action_ids if str(aid).isdigit()]
        
        # Parse user_prompt as JSON
        user_prompt = payload.get('prompt_steps', '{}')
        try:
            prompt_data = json.loads(user_prompt) if user_prompt else {}
        except json.JSONDecodeError:
            prompt_data = {'error': 'Invalid JSON in prompt_steps'}

        # Fetch selected actions from the database
        action_prompts = []
        if action_ids:
            actions = db.query(Action).filter(Action.id.in_(action_ids)).all()
            for action in actions:
                steps = action.steps_json
                if isinstance(steps, (dict, list)):
                    steps = json.dumps(steps)
                action_prompts.append({
                    "trigger": action.prompt,
                    "steps": steps
                })

        # Merge user_prompt with action prompts into a valid JSON structure
        merged_data = prompt_data.copy()
        if action_prompts:
            merged_data['action_prompts'] = action_prompts

        # Convert to JSON string for storage
        merged_prompt = json.dumps(merged_data)

        new_case = TestCase(
            title=payload.get('title'),
            user_id=payload.get('user_id'),
            actions=json.dumps(action_ids),  # Store action IDs as JSON
            prompt_steps=merged_prompt,     # Store merged prompt as valid JSON
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
        if db:
            db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        if db:
            db.close()

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
    
# Add this new endpoint to your app.py file

@app.route('/api/run_all_tests', methods=['POST'])
def run_all_tests():
    """Execute all test cases and create a test run record"""
    session = None
    try:
        session = get_db_session()
        payload = request.get_json()
        test_case_ids = payload.get('test_case_ids', [])
        user_passwords = payload.get('user_passwords', {})
        
        if not test_case_ids:
            return jsonify({'error': 'No test cases provided'}), 400
        
        # Get all test cases to run
        test_cases = session.query(TestCase).filter(TestCase.id.in_(test_case_ids)).all()
        
        if not test_cases:
            return jsonify({'error': 'No valid test cases found'}), 400
        
        # Initialize counters
        total_tests = len(test_cases)
        passed_count = 0
        failed_count = 0
        results = []
        
        print(f"[INFO] Starting batch execution of {total_tests} test cases")
        
        # Execute each test case
        for i, test_case in enumerate(test_cases):
            try:
                print(f"[INFO] Running test case {i+1}/{total_tests}: {test_case.title}")
                
                # Get user credentials for this test case
                user = session.query(User).filter(User.id == test_case.user_id).first()
                if not user:
                    print(f"[WARNING] No user found for test case {test_case.id}")
                    failed_count += 1
                    results.append({
                        'test_case_id': test_case.id,
                        'title': test_case.title,
                        'status': 'failed',
                        'error': 'User not found'
                    })
                    continue
                
                # Get password from user_passwords
                password = user_passwords.get(str(test_case.user_id))
                if not password:
                    print(f"[WARNING] No password provided for user {user.id} in test case {test_case.id}")
                    failed_count += 1
                    results.append({
                        'test_case_id': test_case.id,
                        'title': test_case.title,
                        'status': 'failed',
                        'error': 'Password not provided'
                    })
                    continue
                
                # Prepare the prompt
                username = user.email
                prompt = test_case.prompt_steps
                
                # Convert prompt_steps to string if it's stored as JSON
                if isinstance(prompt, (dict, list)):
                    prompt = json.dumps(prompt)
                
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
                
                # Execute the test case
                result = run_prompt(final_prompt)
                
                # Update test case with results
                status = result.get("status", "completed")
                update_data = {"status": status}
                
                if result.get("gif_path"):
                    update_data["gif_path"] = "/app_static/gifs/" + result["gif_path"].split("/")[-1]
                if result.get("pdf_path"):
                    update_data["pdf_url"] = "/app_static/pdfs/" + result["pdf_path"].split("/")[-1]
                
                # Update test case in database
                session.query(TestCase).filter(TestCase.id == test_case.id).update(update_data)
                
                # Count results
                if status in ['completed', 'success', 'passed']:
                    passed_count += 1
                else:
                    failed_count += 1
                
                results.append({
                    'test_case_id': test_case.id,
                    'title': test_case.title,
                    'status': status,
                    'gif_url': update_data.get('gif_path'),
                    'pdf_url': update_data.get('pdf_url'),
                    'result_text': result.get("text", "")
                })
                
                print(f"[INFO] Test case {test_case.title} completed with status: {status}")
                
            except Exception as e:
                print(f"[ERROR] Failed to execute test case {test_case.id}: {str(e)}")
                failed_count += 1
                results.append({
                    'test_case_id': test_case.id,
                    'title': test_case.title,
                    'status': 'failed',
                    'error': str(e)
                })
        
        # Calculate success rate
        success_rate = round((passed_count / total_tests) * 100, 2) if total_tests > 0 else 0
        
        # Create test run record
        test_run = TestRun(
            total_tests=total_tests,
            passed=passed_count,
            failed=failed_count,
            results=results,  # Store as Python object (assuming JSON column type)
            timestamp=datetime.utcnow()
        )
        
        session.add(test_run)
        session.commit()
        session.refresh(test_run)
        
        print(f"[INFO] Batch execution completed. Run ID: {test_run.id}")
        print(f"[INFO] Results - Total: {total_tests}, Passed: {passed_count}, Failed: {failed_count}")
        
        response_data = {
            'status': 'success',
            'run_id': test_run.id,
            'total_tests': total_tests,
            'passed': passed_count,
            'failed': failed_count,
            'success_rate': success_rate,
            'results': results,
            'timestamp': test_run.timestamp.isoformat()
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        if session:
            session.rollback()
        print(f"[ERROR] Batch execution failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Batch execution failed: {str(e)}'}), 500
    finally:
        if session:
            session.close()

# Also add this helper endpoint to get detailed results for a specific run
@app.route('/api/test_runs/<int:run_id>/details', methods=['GET'])
def get_test_run_details(run_id):
    """Get detailed results for a specific test run"""
    session = None
    try:
        session = get_db_session()
        test_run = session.query(TestRun).filter(TestRun.id == run_id).first()
        
        if not test_run:
            return jsonify({'error': 'Test run not found'}), 404
        
        # Handle results based on their type
        detailed_results = []
        if test_run.results:
            if isinstance(test_run.results, (list, dict)):
                # Already deserialized (e.g., by SQLAlchemy JSON type)
                detailed_results = test_run.results
            elif isinstance(test_run.results, str):
                # Parse JSON string if it's a string
                try:
                    detailed_results = json.loads(test_run.results)
                except json.JSONDecodeError as e:
                    print(f"Error parsing test run results: {e}")
                    detailed_results = []
            else:
                print(f"Unexpected results type: {type(test_run.results)}")
                detailed_results = []
        
        return jsonify({
            'run_id': test_run.id,
            'total_tests': test_run.total_tests,
            'passed': test_run.passed,
            'failed': test_run.failed,
            'timestamp': test_run.timestamp.isoformat(),
            'detailed_results': detailed_results
        })
        
    except Exception as e:
        print(f"Error getting test run details: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if session:
            session.close()

# --- Test Case Execution Endpoint ---
@app.route('/api/run_test_case', methods=['POST'])
def run_test_case():
    import traceback
    import logging
    
    # Set up logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Starting test case execution")
        
        # Get request data
        data = request.get_json()
        if not data:
            logger.error("No JSON data received")
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        prompt = data.get('prompt', '')
        username = data.get('username', '')
        password = data.get('password', '')
        test_case_id = data.get('test_case_id')
        
        logger.info(f"Test case ID: {test_case_id}")
        logger.info(f"Username: {username}")
        logger.info(f"Prompt length: {len(prompt) if prompt else 0}")
        
        if not all([prompt, username, password]):
            logger.error("Missing required parameters")
            return jsonify({
                'success': False, 
                'message': 'Missing required parameters: prompt, username, and password'
            }), 400
        
        # Debug: Check if browser binary exists
        import os
        import glob
        
        playwright_cache = "/home/www-data/.cache/ms-playwright"
        if os.path.exists(playwright_cache):
            logger.info(f"Playwright cache exists at {playwright_cache}")
            chrome_paths = glob.glob(f"{playwright_cache}/chromium-*/chrome-linux/chrome")
            if chrome_paths:
                logger.info(f"Found Chrome binary at: {chrome_paths[0]}")
                # Check if it's executable
                chrome_path = chrome_paths[0]
                if os.access(chrome_path, os.X_OK):
                    logger.info("Chrome binary is executable")
                else:
                    logger.error("Chrome binary is not executable")
            else:
                logger.error("No Chrome binary found")
        else:
            logger.error("Playwright cache directory does not exist")
        
        # Test browser launch before running main function
        try:
            logger.info("Testing browser launch...")
            from playwright.sync_api import sync_playwright
            
            with sync_playwright() as p:
                logger.info("Playwright started successfully")
                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-extensions',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                    ]
                )
                logger.info("Browser launched successfully")
                browser.close()
                logger.info("Browser closed successfully")
                
        except Exception as browser_error:
            logger.error(f"Browser test failed: {str(browser_error)}")
            logger.error(f"Browser error traceback: {traceback.format_exc()}")
            return jsonify({
                'success': False, 
                'message': f'Browser initialization failed: {str(browser_error)}'
            }), 500
        
        # Now run the actual test case
        logger.info("Running main test case function...")
        result = run_prompt(prompt, username, password, test_case_id)
        
        logger.info(f"Test case completed successfully: {result}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in run_test_case: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Return a proper JSON error response
        return jsonify({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500
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