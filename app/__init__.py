"""Flask application factory and initialization."""
import os
from flask import Flask
from flask_session import Session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize extensions
session = Session()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute", "2000 per hour"],
    storage_uri="memory://"
)


def create_app(config_name='development'):
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_PERMANENT'] = False
    app.config['SESSION_USE_SIGNER'] = True
    app.config['DATABASE_URL'] = os.getenv('DATABASE_URL', 'sqlite:///data/confai.db')

    # Initialize extensions with app
    session.init_app(app)
    limiter.init_app(app)

    # Initialize database
    from app.models import init_db
    with app.app_context():
        init_db()

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.chat import chat_bp
    from app.routes.insights import insights_bp
    from app.routes.admin import admin_bp
    from app.routes.designlanguage import designlanguage_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(insights_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(designlanguage_bp)

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return {'error': 'Rate limit exceeded. Please try again later.'}, 429

    return app
