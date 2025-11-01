"""Design Language documentation route."""
from flask import Blueprint, render_template
from app.utils.helpers import login_required

designlanguage_bp = Blueprint('designlanguage', __name__)


@designlanguage_bp.route('/designlanguage')
@login_required
def design_language_page():
    """Design language documentation page (hidden, accessible only by direct URL)."""
    return render_template('designlanguage.html')
