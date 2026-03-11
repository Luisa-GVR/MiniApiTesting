//  CONFIGURACIÓN
//  - Local (node server.js):  cambia a 'http://localhost:3000/'
//  - Render / producción:     '' 

const API_BASE = '';


// DOM
const tabLogin      = document.getElementById('tabLogin');
const tabRegister   = document.getElementById('tabRegister');
const formLogin     = document.getElementById('formLogin');
const formRegister  = document.getElementById('formRegister');
const loginForm     = document.getElementById('loginForm');
const registerForm  = document.getElementById('registerForm');
const loginError    = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const loginBtn      = document.getElementById('loginBtn');
const registerBtn   = document.getElementById('registerBtn');
const toastEl       = document.getElementById('toast');

// Toast

let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  toastTimer = setTimeout(function() { toastEl.classList.remove('show'); }, 3000);
}


// Tabs

function switchTab(activeTab) {
  if (activeTab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.setAttribute('aria-selected', 'false');
    formLogin.removeAttribute('hidden');
    formRegister.setAttribute('hidden', '');
    loginError.textContent = '';
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.setAttribute('aria-selected', 'false');
    formRegister.removeAttribute('hidden');
    formLogin.setAttribute('hidden', '');
    registerError.textContent = '';
  }
}

tabLogin.addEventListener('click', function() { switchTab('login'); });
tabRegister.addEventListener('click', function() { switchTab('register'); });


// Validation

function validateAuthForm(username, password, isRegistered) {
    if (!username || !password) {
        return 'Username and password are required';
    }
    if (username.length < 3 || username.length > 20) {
        return 'Username must be between 3 and 20 characters';
    }
    if (password.length < 6) {
        return 'Password must be at least 6 characters';
    }
    if (isRegistered) {
        return null; // No format validation for login, just check if fields are filled
    }

    return null;
}

// Helpers

async function sendRequest(url, method, data) {
    try {
        const response = await fetch(API_BASE + url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending request:', error);
        throw error;
    }
}

// Login 
async function handleLogin(event) {
    event.preventDefault();

    const username = loginForm.username.value.trim();
    const password = loginForm.password.value.trim();

    const validationError = validateAuthForm(username, password, true);
    if (validationError) {
        loginError.textContent = validationError;
        return;
    }

    try {
        const result = await sendRequest('/auth/login', 'POST', { username, password });
        if (result.error) {
            loginError.textContent = result.error;
        } else {
            showToast('Login successful!'); 
            setTimeout(() => {window.location.href = '/';}, 1000);
        }
    } catch (error) {
        loginError.textContent = 'An error occurred during login';
    }
}

// Register
async function handleRegister(event) {
    event.preventDefault();
    const username = registerForm.username.value.trim();
    const password = registerForm.password.value.trim();
    const validationError = validateAuthForm(username, password, false);
    if (validationError) {
        registerError.textContent = validationError;
        return;
    }

    try {
        const result = await sendRequest('/auth/register', 'POST', { username, password });
        if (result.error) {
            registerError.textContent = result.error;
        } else {
            showToast('Registration successful! Please log in.'); 
            switchTab('login');
        }
    } catch (error) {
        registerError.textContent = 'An error occurred during registration';
    }
}

// Event Listeners
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);

// init
async function checkSession() {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.ok) {
      window.location.href = '/';
    }
  } catch {
    // error de red, quedarse en login
  }
}

checkSession();