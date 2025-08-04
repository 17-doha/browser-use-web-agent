import json
import os
from supabase import create_client

# Make sure to set these environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
print(SUPABASE_KEY)
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Please set SUPABASE_URL and SUPABASE_KEY environment variables")
    exit(1)

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def migrate_localStorage_data():
    """
    First, run this in your browser console:
    copy(JSON.stringify(localStorage))
    
    Then paste the result into a file called 'export.json'
    """
    
    try:
        # Load the exported localStorage data
        with open('export.json', 'r') as f:
            data = json.load(f)
        
        print("Loaded localStorage data")
        
        # Migrate users
        if 'users' in data:
            users = json.loads(data['users'])
            for user in users:
                try:
                    result = supabase.table('users').insert({
                        'name': user.get('name'),
                        'email': user.get('email'),
                        'password_hash': user.get('password')
                    }).execute()
                    print(f"Migrated user: {user.get('name', 'Unknown')}")
                except Exception as e:
                    print(f"Error migrating user: {e}")
        
        # Migrate actions
        if 'actions' in data:
            actions = json.loads(data['actions'])
            for action in actions:
                try:
                    result = supabase.table('actions').insert({
                        'prompt': action.get('prompt'),
                        'steps_json': action.get('stepsJson')
                    }).execute()
                    print(f"Migrated action: {action.get('prompt', 'Unknown')}")
                except Exception as e:
                    print(f"Error migrating action: {e}")
        
        # Migrate test cases
        if 'testCases' in data:
            test_cases = json.loads(data['testCases'])
            for case in test_cases:
                try:
                    # Find user_id by name if needed
                    user_id = None
                    if 'users' in data:
                        users = json.loads(data['users'])
                        matching_user = next((u for u in users if u.get('name', '').replace(' ', '_').lower() == case.get('user', '')), None)
                        if matching_user:
                            # Get the user ID from database
                            user_result = supabase.table('users').select('id').eq('email', matching_user.get('email')).execute()
                            if user_result.data:
                                user_id = user_result.data['id']
                    
                    result = supabase.table('test_cases').insert({
                        'title': case.get('title'),
                        'user_id': user_id,
                        'actions': case.get('actions'),
                        'prompt_steps': case.get('promptSteps'),
                        'status': case.get('status', 'pending'),
                        'gif_path': case.get('gif_path'),
                        'pdf_url': case.get('pdf_url')
                    }).execute()
                    print(f"Migrated test case: {case.get('title', 'Untitled')}")
                except Exception as e:
                    print(f"Error migrating test case: {e}")
        
        # Migrate test runs
        if 'testRuns' in data:
            test_runs = json.loads(data['testRuns'])
            for run in test_runs:
                try:
                    result = supabase.table('test_runs').insert({
                        'total_tests': run.get('totalTests'),
                        'passed': run.get('passed'),
                        'failed': run.get('failed'),
                        'results': run.get('results')
                    }).execute()
                    print(f"Migrated test run from {run.get('timestamp', 'Unknown date')}")
                except Exception as e:
                    print(f"Error migrating test run: {e}")
        
        print("Migration completed!")
        
    except FileNotFoundError:
        print("export.json file not found. Please create it with your localStorage data.")
    except json.JSONDecodeError:
        print("Invalid JSON in export.json file.")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    migrate_localStorage_data()
