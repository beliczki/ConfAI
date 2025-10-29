const emailForm = document.getElementById('email-form');
const pinForm = document.getElementById('pin-form');
const emailInput = document.getElementById('email');
const messageDiv = document.getElementById('message');
const backLink = document.getElementById('back-link');
const pinDigits = document.querySelectorAll('.pin-digit');

let userEmail = '';

// Email form submission
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            userEmail = email;
            showMessage(data.message, 'success');
            // Show dev PIN if available
            if (data.dev_pin) {
                showMessage(`PIN sent! (Dev mode: ${data.dev_pin})`, 'success');
            }
            emailForm.style.display = 'none';
            pinForm.style.display = 'block';
            pinDigits[0].focus();
        } else {
            showMessage(data.error || 'Failed to send PIN', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// PIN form submission
pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = Array.from(pinDigits).map(d => d.value).join('');

    if (pin.length !== 6) {
        showMessage('Please enter all 6 digits', 'error');
        return;
    }

    try {
        const response = await fetch('/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: userEmail, pin })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/chat', 1000);
        } else {
            showMessage(data.error || 'Invalid PIN', 'error');
            pinDigits.forEach(d => d.value = '');
            pinDigits[0].focus();
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// PIN input auto-focus
pinDigits.forEach((digit, index) => {
    digit.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < 5) {
            pinDigits[index + 1].focus();
        }
    });

    digit.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            pinDigits[index - 1].focus();
        }
    });
});

// Back link
backLink.addEventListener('click', (e) => {
    e.preventDefault();
    pinForm.style.display = 'none';
    emailForm.style.display = 'block';
    pinDigits.forEach(d => d.value = '');
    messageDiv.innerHTML = '';
});

function showMessage(text, type) {
    messageDiv.innerHTML = `<div class="message ${type}">${text}</div>`;
}
