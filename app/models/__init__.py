"""Database models for ConfAI."""
import os
import sqlite3
from datetime import datetime
from contextlib import contextmanager

DATABASE_PATH = os.getenv('DATABASE_URL', 'sqlite:///data/confai.db').replace('sqlite:///', '')


@contextmanager
def get_db():
    """Get database connection context manager."""
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    # Enable foreign key constraints (disabled by default in SQLite)
    conn.execute('PRAGMA foreign_keys = ON')

    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def init_db():
    """Initialize the database with tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                avatar_gradient TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_allowed BOOLEAN DEFAULT 1
            )
        ''')

        # Login tokens table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS login_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Chat threads table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'New Chat',
                model_used TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Chat messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
            )
        ''')

        # Insights table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message_id INTEGER,
                content TEXT NOT NULL,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
            )
        ''')

        # Votes table (track individual votes)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                insight_id INTEGER NOT NULL,
                vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE,
                UNIQUE(user_id, insight_id)
            )
        ''')

        # User vote count tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_vote_counts (
                user_id INTEGER PRIMARY KEY,
                votes_used INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Settings table for app configuration
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Activity log table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                activity_type TEXT NOT NULL,
                description TEXT NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Token usage table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER,
                message_id INTEGER,
                model_used TEXT NOT NULL,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cache_creation_tokens INTEGER DEFAULT 0,
                cache_read_tokens INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
            )
        ''')

        # Insert default welcome message if not exists
        cursor.execute('''
            INSERT OR IGNORE INTO settings (key, value)
            VALUES ('welcome_message', '# Welcome to ConfAI! 👋

I''m your conference intelligence assistant. I can help you with insights from conference materials and answer your questions.

**Get started by creating a new chat!**')
        ''')

        # Create indexes for performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_votes_insight ON votes(insight_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_token_usage_thread ON token_usage(thread_id)')

        # Run migrations
        _run_migrations(cursor)

        conn.commit()
        print("Database initialized successfully")


def _run_migrations(cursor):
    """Run database migrations to update existing tables."""
    # Check if model_used column exists in chat_threads
    cursor.execute("PRAGMA table_info(chat_threads)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'model_used' not in columns:
        print("Running migration: Adding model_used column to chat_threads")
        cursor.execute('ALTER TABLE chat_threads ADD COLUMN model_used TEXT')
        print("Migration completed: model_used column added")

    # Check if hash_id column exists in chat_threads
    if 'hash_id' not in columns:
        print("Running migration: Adding hash_id column to chat_threads")
        cursor.execute('ALTER TABLE chat_threads ADD COLUMN hash_id TEXT')
        # Generate hash_ids for existing threads
        import secrets
        cursor.execute('SELECT id FROM chat_threads')
        for row in cursor.fetchall():
            hash_id = secrets.token_urlsafe(16)
            cursor.execute('UPDATE chat_threads SET hash_id = ? WHERE id = ?', (hash_id, row[0]))
        # Create unique index
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_hash_id ON chat_threads(hash_id)')
        print("Migration completed: hash_id column added and populated")

    # Check if title column exists in insights
    cursor.execute("PRAGMA table_info(insights)")
    insight_columns = [row[1] for row in cursor.fetchall()]

    if 'title' not in insight_columns:
        print("Running migration: Adding title column to insights")
        cursor.execute('ALTER TABLE insights ADD COLUMN title TEXT')
        print("Migration completed: title column added")


# Helper functions for models
class User:
    """User model helper."""

    @staticmethod
    def create(email, name, avatar_gradient):
        """Create a new user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO users (email, name, avatar_gradient) VALUES (?, ?, ?)',
                (email, name, avatar_gradient)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_email(email):
        """Get user by email."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
            return cursor.fetchone()

    @staticmethod
    def get_by_id(user_id):
        """Get user by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            return cursor.fetchone()


class ChatThread:
    """Chat thread model helper."""

    @staticmethod
    def create(user_id, title='New Chat', model_used=None):
        """Create a new chat thread."""
        import secrets
        hash_id = secrets.token_urlsafe(16)
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO chat_threads (user_id, title, model_used, hash_id) VALUES (?, ?, ?, ?)',
                (user_id, title, model_used, hash_id)
            )
            return cursor.lastrowid, hash_id

    @staticmethod
    def get_by_user(user_id):
        """Get all threads for a user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM chat_threads WHERE user_id = ? ORDER BY updated_at DESC',
                (user_id,)
            )
            return cursor.fetchall()

    @staticmethod
    def get_by_hash_id(hash_id):
        """Get thread by hash_id."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM chat_threads WHERE hash_id = ?', (hash_id,))
            return cursor.fetchone()

    @staticmethod
    def get_by_id(thread_id):
        """Get thread by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM chat_threads WHERE id = ?', (thread_id,))
            return cursor.fetchone()

    @staticmethod
    def update_title(thread_id, new_title):
        """Update thread title."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE chat_threads SET title = ? WHERE id = ?',
                (new_title, thread_id)
            )

    @staticmethod
    def update_model(thread_id, model):
        """Update thread model."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE chat_threads SET model_used = ? WHERE id = ?',
                (model, thread_id)
            )

    @staticmethod
    def delete(thread_id):
        """Delete a thread."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM chat_threads WHERE id = ?', (thread_id,))


class ChatMessage:
    """Chat message model helper."""

    @staticmethod
    def create(thread_id, role, content):
        """Create a new message."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO chat_messages (thread_id, role, content) VALUES (?, ?, ?)',
                (thread_id, role, content)
            )
            # Update thread's updated_at
            cursor.execute(
                'UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (thread_id,)
            )
            return cursor.lastrowid

    @staticmethod
    def get_by_thread(thread_id):
        """Get all messages for a thread."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC',
                (thread_id,)
            )
            return cursor.fetchall()


class Insight:
    """Insight model helper."""

    @staticmethod
    def create(user_id, content, message_id=None, title=None):
        """Create a new insight."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO insights (user_id, content, message_id, title) VALUES (?, ?, ?, ?)',
                (user_id, content, message_id, title)
            )
            return cursor.lastrowid

    @staticmethod
    def get_all():
        """Get all insights with vote counts."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT i.*, u.name as user_name, u.avatar_gradient,
                       (i.upvotes - i.downvotes) as net_votes
                FROM insights i
                JOIN users u ON i.user_id = u.id
                ORDER BY net_votes DESC, i.created_at DESC
            ''')
            return cursor.fetchall()

    @staticmethod
    def vote(insight_id, user_id, vote_type):
        """Add or update a vote for an insight."""
        with get_db() as conn:
            cursor = conn.cursor()

            # Check if user has already voted on this insight
            cursor.execute(
                'SELECT vote_type FROM votes WHERE user_id = ? AND insight_id = ?',
                (user_id, insight_id)
            )
            existing_vote = cursor.fetchone()

            if existing_vote:
                # Update vote
                old_vote = existing_vote['vote_type']
                if old_vote != vote_type:
                    # Remove old vote count
                    if old_vote == 'up':
                        cursor.execute(
                            'UPDATE insights SET upvotes = upvotes - 1 WHERE id = ?',
                            (insight_id,)
                        )
                    else:
                        cursor.execute(
                            'UPDATE insights SET downvotes = downvotes - 1 WHERE id = ?',
                            (insight_id,)
                        )

                    # Add new vote count
                    if vote_type == 'up':
                        cursor.execute(
                            'UPDATE insights SET upvotes = upvotes + 1 WHERE id = ?',
                            (insight_id,)
                        )
                    else:
                        cursor.execute(
                            'UPDATE insights SET downvotes = downvotes + 1 WHERE id = ?',
                            (insight_id,)
                        )

                    # Update vote record
                    cursor.execute(
                        'UPDATE votes SET vote_type = ? WHERE user_id = ? AND insight_id = ?',
                        (vote_type, user_id, insight_id)
                    )
            else:
                # New vote
                # Check vote limit
                cursor.execute(
                    'SELECT votes_used FROM user_vote_counts WHERE user_id = ?',
                    (user_id,)
                )
                vote_count = cursor.fetchone()

                if vote_count and vote_count['votes_used'] >= 3:
                    return False, "Vote limit reached"

                # Insert vote
                cursor.execute(
                    'INSERT INTO votes (user_id, insight_id, vote_type) VALUES (?, ?, ?)',
                    (user_id, insight_id, vote_type)
                )

                # Update insight counts
                if vote_type == 'up':
                    cursor.execute(
                        'UPDATE insights SET upvotes = upvotes + 1 WHERE id = ?',
                        (insight_id,)
                    )
                else:
                    cursor.execute(
                        'UPDATE insights SET downvotes = downvotes + 1 WHERE id = ?',
                        (insight_id,)
                    )

                # Update user vote count
                cursor.execute('''
                    INSERT INTO user_vote_counts (user_id, votes_used)
                    VALUES (?, 1)
                    ON CONFLICT(user_id) DO UPDATE SET votes_used = votes_used + 1
                ''', (user_id,))

            return True, "Vote recorded"

    @staticmethod
    def get_user_vote_count(user_id):
        """Get how many votes a user has used."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT votes_used FROM user_vote_counts WHERE user_id = ?',
                (user_id,)
            )
            result = cursor.fetchone()
            return result['votes_used'] if result else 0

    @staticmethod
    def delete(insight_id):
        """Delete an insight and its associated votes."""
        with get_db() as conn:
            cursor = conn.cursor()
            # Delete associated votes first
            cursor.execute('DELETE FROM votes WHERE insight_id = ?', (insight_id,))
            # Delete the insight
            cursor.execute('DELETE FROM insights WHERE id = ?', (insight_id,))
            return cursor.rowcount > 0

    @staticmethod
    def get_user_share_count(user_id):
        """Get how many insights a user has shared."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT COUNT(*) as count FROM insights WHERE user_id = ?',
                (user_id,)
            )
            result = cursor.fetchone()
            return result['count'] if result else 0

    @staticmethod
    def get_by_message_id(message_id, user_id):
        """Get insight by message_id for a specific user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM insights WHERE message_id = ? AND user_id = ?',
                (message_id, user_id)
            )
            return cursor.fetchone()

    @staticmethod
    def delete_by_user(insight_id, user_id):
        """Delete an insight only if it belongs to the user."""
        with get_db() as conn:
            cursor = conn.cursor()
            # Delete associated votes first
            cursor.execute('DELETE FROM votes WHERE insight_id = ?', (insight_id,))
            # Delete the insight only if it belongs to the user
            cursor.execute(
                'DELETE FROM insights WHERE id = ? AND user_id = ?',
                (insight_id, user_id)
            )
            return cursor.rowcount > 0


class Settings:
    """Settings model helper."""

    @staticmethod
    def get(key, default=None):
        """Get a setting value by key."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            result = cursor.fetchone()
            return result['value'] if result else default

    @staticmethod
    def set(key, value):
        """Set a setting value."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
            ''', (key, value))

    @staticmethod
    def get_all():
        """Get all settings."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM settings')
            return cursor.fetchall()


class ActivityLog:
    """Activity log model helper."""

    @staticmethod
    def log(user_id, activity_type, description, metadata=None):
        """Log an activity."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO activity_log (user_id, activity_type, description, metadata)
                VALUES (?, ?, ?, ?)
            ''', (user_id, activity_type, description, metadata))
            return cursor.lastrowid

    @staticmethod
    def get_recent(limit=20):
        """Get recent activities."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT a.*, u.name as user_name
                FROM activity_log a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.created_at DESC
                LIMIT ?
            ''', (limit,))
            return cursor.fetchall()


class TokenUsage:
    """Token usage model helper."""

    @staticmethod
    def log(thread_id, message_id, model_used, input_tokens=0, output_tokens=0,
            cache_creation_tokens=0, cache_read_tokens=0):
        """Log token usage."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO token_usage
                (thread_id, message_id, model_used, input_tokens, output_tokens,
                 cache_creation_tokens, cache_read_tokens)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (thread_id, message_id, model_used, input_tokens, output_tokens,
                  cache_creation_tokens, cache_read_tokens))
            return cursor.lastrowid

    @staticmethod
    def get_totals():
        """Get total token usage across all models."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT
                    SUM(input_tokens) as total_input,
                    SUM(output_tokens) as total_output,
                    SUM(cache_creation_tokens) as total_cache_creation,
                    SUM(cache_read_tokens) as total_cache_read
                FROM token_usage
            ''')
            return cursor.fetchone()

    @staticmethod
    def get_by_model():
        """Get token usage grouped by model."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT
                    model_used,
                    COUNT(*) as message_count,
                    SUM(input_tokens) as total_input,
                    SUM(output_tokens) as total_output,
                    SUM(cache_creation_tokens) as total_cache_creation,
                    SUM(cache_read_tokens) as total_cache_read
                FROM token_usage
                GROUP BY model_used
            ''')
            return cursor.fetchall()
