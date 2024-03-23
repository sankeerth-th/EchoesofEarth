import sys
import json
import duolingo
from requests.exceptions import JSONDecodeError

username = sys.argv[1]
password = sys.argv[2]
language = sys.argv[3]

try:
    print("Logging in to Duolingo...")
    lingo = duolingo.Duolingo('kartik', 'my password')
    print("Login successful.")
    
    print("Retrieving user information...")
    user = lingo.get_user_info()
    print("User information retrieved.")
    
    language_progress = user['language_data'].get(language)

    if language_progress:
        level = language_progress['level']
        xp = language_progress['points']
        fluency = language_progress['fluency_score']
        
        progress_data = {
            'level': level,
            'xp': xp,
            'fluency': fluency
        }
        print(json.dumps(progress_data))
    else:
        print(json.dumps(None))
except JSONDecodeError:
    print(json.dumps({'error': 'Invalid Duolingo API response'}))
except duolingo.DuolingoException as e:
    print(json.dumps({'error': str(e)}))
