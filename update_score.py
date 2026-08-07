import os
import re
import json
import gspread
from google.oauth2.service_account import Credentials

# 1. Authenticate with Google Sheets
scopes = ["https://www.googleapis.com/auth/spreadsheets"]
creds_json = json.loads(os.environ['GCP_CREDENTIALS'])
creds = Credentials.from_service_account_info(creds_json, scopes=scopes)
client = gspread.authorize(creds)

sheet = client.open_by_key(os.environ['SHEET_ID']).sheet1

# 2. Retrieve GitHub Data
# 2. Retrieve GitHub Data
comment_body = os.environ['COMMENT_BODY']
pr_author = os.environ['PR_AUTHOR']
pr_url = os.environ['PR_URL'] # <-- Fetch the new PR URL variable

# 3. Regex Execution (Matches exactly "+10" or "+ 10")
match = re.search(r'\+\s*(\d+)', comment_body)
if not match:
    print("No regex match for points found. Exiting gracefully.")
    exit(0)

points_awarded = int(match.group(1))

# 4. Database Logic (Update or Append)
records = sheet.get_all_records(head=2) # Remembering your headers are on row 2
row_idx = 3 # Remembering your data starts on row 3
user_found = False

for row in records:
    # Match the PR author to the spreadsheet
    if str(row.get('GitHub Username', '')) == pr_author:
        # Update Points
        new_total = int(row.get('Points', 0)) + points_awarded
        sheet.update_cell(row_idx, 2, new_total)
        
        # Update PRs (Append the new PR URL to the existing ones)
        existing_prs = str(row.get('PRs', ''))
        if existing_prs:
            new_prs_string = existing_prs + ", \n" + pr_url # Adds a comma and new line for readability
        else:
            new_prs_string = pr_url
            
        sheet.update_cell(row_idx, 3, new_prs_string) # Updates column 3
        
        user_found = True
        print(f"Updated {pr_author}: {new_total} points, added PR {pr_url}.")
        break
    row_idx += 1

if not user_found:
    # Append row now includes the PR URL in the 3rd column
    sheet.append_row([pr_author, points_awarded, pr_url])
    print(f"Added new contributor {pr_author} with {points_awarded} points and PR {pr_url}.")