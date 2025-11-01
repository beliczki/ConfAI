"""Check for orphaned insights and votes."""
import sqlite3

conn = sqlite3.connect('data/confai.db')
cursor = conn.cursor()

print("=== Orphaned Insights (message_id IS NULL) ===")
cursor.execute('SELECT COUNT(*) FROM insights WHERE message_id IS NULL')
count = cursor.fetchone()[0]
print(f"Total orphaned insights: {count}\n")

if count > 0:
    cursor.execute('''
        SELECT i.id, i.content, u.name, i.upvotes, i.downvotes
        FROM insights i
        JOIN users u ON i.user_id = u.id
        WHERE i.message_id IS NULL
    ''')
    print("Details:")
    for row in cursor.fetchall():
        insight_id, content, user_name, upvotes, downvotes = row
        print(f"  ID {insight_id}: {user_name}")
        print(f"    Content: {content[:100]}...")
        print(f"    Votes: +{upvotes} / -{downvotes}\n")

print("\n=== All Insights with Vote Counts ===")
cursor.execute('''
    SELECT i.id, i.content, u.name, i.upvotes, i.downvotes, i.message_id
    FROM insights i
    JOIN users u ON i.user_id = u.id
    ORDER BY i.id
''')
for row in cursor.fetchall():
    insight_id, content, user_name, upvotes, downvotes, message_id = row
    orphaned = " [ORPHANED]" if message_id is None else ""
    print(f"ID {insight_id}{orphaned}: {user_name} - +{upvotes}/-{downvotes}")
    print(f"  {content[:80]}...")

print("\n=== Votes by User ===")
cursor.execute('''
    SELECT u.name, COUNT(v.id) as vote_count
    FROM users u
    LEFT JOIN votes v ON u.id = v.user_id
    GROUP BY u.id
''')
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]} votes")

conn.close()
