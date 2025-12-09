
import sqlite3
import json

def inspect_events():
    db_path = "python_service/agent_sessions.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get the most recent session
    cursor.execute("SELECT id, user_id, update_time FROM sessions ORDER BY update_time DESC LIMIT 1")
    session = cursor.fetchone()
    
    if not session:
        print("No sessions found.")
        return
        
    print(f"Inspecting Session: {session['id']} (User: {session['user_id']})")
    
    # Get events for this session
    cursor.execute("SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC", (session['id'],))
    events = cursor.fetchall()
    
    print(f"Found {len(events)} events:")
    for i, event in enumerate(events):
        # Try to parse content if it's JSON
        content_preview = event['content']
        if content_preview and len(content_preview) > 100:
            content_preview = content_preview[:100] + "..."
            
        print(f"[{i}] ID: {event['id']} | Author: {event['author']} | Time: {event['timestamp']}")
        # print(f"    Content: {content_preview}")
        
    conn.close()

if __name__ == "__main__":
    inspect_events()
