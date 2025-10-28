// Konfigurasi Aplikasi
const CONFIG = {
    // Ganti dengan Client ID dari Google Cloud Console
    clientId: '883588123458-kc7p924f89q7dtg4ape0u8lslqjqvmrt.apps.googleusercontent.com',
    // Ganti dengan ID Google Sheet Anda
    spreadsheetId: '1gd1JcYiuUsPXO1xbwKHJomnLxMdK7s7xfJ60l3p7WKw',
    // Konfigurasi standar untuk Google API
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile',
};

// Session management constants
const SESSION_STORAGE_KEY = 'pos_session_data';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Application State Management (similar to exam.js pattern)
let state = {
    user: null,
    token: null,
    isLoggedIn: false,
    currentPage: 'kasir',
    loading: false,
    error: null,
    sessionTimestamp: null,
    products: [],
    categories: [],
    paymentMethods: [],
    cart: [],
    transactions: [],
    gapiInited: false,
    gisInited: false
};

// Legacy variables for backward compatibility
let products = [];
let categories = [];
let paymentMethods = [];
let cart = [];
let currentUser = null;
let gapiInited = false;
let gisInited = false;
let tokenClient;

// State Management Functions (similar to exam.js pattern)
function updateState(newState) {
    state = { ...state, ...newState };
    // Sync legacy variables for backward compatibility
    syncLegacyVariables();
}

function syncLegacyVariables() {
    // Sync arrays and objects properly
    products = Array.isArray(state.products) ? [...state.products] : [];
    categories = Array.isArray(state.categories) ? [...state.categories] : [];
    paymentMethods = Array.isArray(state.paymentMethods) ? [...state.paymentMethods] : [];
    cart = Array.isArray(state.cart) ? [...state.cart] : [];
    currentUser = state.user ? { ...state.user } : null;
    gapiInited = state.gapiInited || false;
    gisInited = state.gisInited || false;

    // Debug logging
    console.log('Legacy variables synced:', {
        products: products.length,
        categories: categories.length,
        paymentMethods: paymentMethods.length,
        cart: cart.length,
        currentUser: currentUser ? currentUser.name : null
    });
}

function showLoading() {
    updateState({ loading: true });
    // Show loading overlay if exists
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    updateState({ loading: false });
    // Hide loading overlay if exists
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

function showError(message) {
    updateState({ error: message });
    // Show error message if error elements exist
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        // Auto hide after 5 seconds
        setTimeout(() => {
            errorMessage.classList.add('hidden');
            updateState({ error: null });
        }, 5000);
    } else {
        // Fallback to alert if error elements don't exist
        alert('Error: ' + message);
    }
}

function hideError() {
    updateState({ error: null });
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
}

// Add transaction to state (enhanced transaction management)
function addTransactionToState(transaction) {
    try {
        updateState(prevState => ({
            transactions: [...prevState.transactions, {
                ...transaction,
                timestamp: Date.now()
            }]
        }));

        // Save session data after adding transaction
        if (state.user) {
            saveSessionData();
        }

        console.log('Transaction added to state successfully');

    } catch (error) {
        console.error('Error adding transaction to state:', error);
        showError('Gagal menambahkan transaksi ke state: ' + error.message);
    }
}

// Validate current session
function validateCurrentSession() {
    try {
        if (!state.isLoggedIn || !state.user) {
            return false;
        }

        // Check if session is expired
        if (!isSessionValid()) {
            console.log('Session validation failed - expired');
            return false;
        }

        // Check if we have a valid token
        const token = state.token || gapi.client.getToken();
        if (!token) {
            console.log('Session validation failed - no token');
            return false;
        }

        console.log('Session validation successful');
        return true;

    } catch (error) {
        console.error('Error validating session:', error);
        return false;
    }
}

// DOM Elements
const loginPage = document.getElementById('login-page');
const kasirPage = document.getElementById('kasir-page');
const pengaturanPage = document.getElementById('pengaturan-page');
const keranjangMobilePage = document.getElementById('keranjang-mobile-page');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginStatus = document.getElementById('login-status');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userAvatarSettings = document.getElementById('user-avatar-settings');
const userNameSettings = document.getElementById('user-name-settings');
const userAvatarKeranjang = document.getElementById('user-avatar-keranjang');
const userNameKeranjang = document.getElementById('user-name-keranjang');
const productGrid = document.getElementById('product-grid');
const cartItems = document.getElementById('cart-items');
const cartItemsMobile = document.getElementById('cart-items-mobile');
const cartCount = document.getElementById('cart-count');
const mobileCartBadge = document.getElementById('mobile-cart-badge');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartDiscount = document.getElementById('cart-discount');
const cartTotal = document.getElementById('cart-total');
const cartSubtotalMobile = document.getElementById('cart-subtotal-mobile');
const cartTotalMobile = document.getElementById('cart-total-mobile');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutBtnMobile = document.getElementById('checkout-btn-mobile');
const cancelBtn = document.getElementById('cancel-btn');
const cancelBtnMobile = document.getElementById('cancel-btn-mobile');
const navItems = document.querySelectorAll('.nav-item');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const productTableBody = document.getElementById('product-table-body');
const categoryTableBody = document.getElementById('category-table-body');
const paymentTableBody = document.getElementById('payment-table-body');
const addProductBtn = document.getElementById('add-product-btn');
const addCategoryBtn = document.getElementById('add-category-btn');
const addPaymentBtn = document.getElementById('add-payment-btn');
const productModal = document.getElementById('product-modal');
const categoryModal = document.getElementById('category-modal');
const paymentModal = document.getElementById('payment-modal');
const checkoutModal = document.getElementById('checkout-modal');
const productForm = document.getElementById('product-form');
const categoryForm = document.getElementById('category-form');
const paymentForm = document.getElementById('payment-form');
const productCategorySelect = document.getElementById('product-category');
const paymentMethodSelect = document.getElementById('payment-method'); // for backward compatibility
const paymentMethodsContainer = document.getElementById('payment-methods');
const amountPaidInput = document.getElementById('amount-paid');
const changeAmountSpan = document.getElementById('change-amount');
const checkoutTotalSpan = document.getElementById('checkout-total');
const confirmPaymentBtn = document.getElementById('confirm-payment');
const saveProductBtn = document.getElementById('save-product-btn');
const saveCategoryBtn = document.getElementById('save-category-btn');
const savePaymentBtn = document.getElementById('save-payment-btn');
const productSaveText = document.getElementById('product-save-text');
const categorySaveText = document.getElementById('category-save-text');
const paymentSaveText = document.getElementById('payment-save-text');
const confirmPaymentText = document.getElementById('confirm-payment-text');
const transactionTableBody = document.getElementById('transaction-table-body');
const transactionSearch = document.getElementById('transaction-search');
const dateFilter = document.getElementById('date-filter');

const paymentSuggestions = document.getElementById('payment-suggestions');
const paymentResult = document.getElementById('payment-result');
const changeBreakdown = document.getElementById('change-breakdown');  // This element was removed from HTML
const changeComposition = document.getElementById('change-composition');  // This element was removed from HTML
const paymentAmountOptions = document.getElementById('payment-amount-options');

// Payment System Variables
const availableDenominations = Array.from(
    { length: 20 },
    (_, i) => (i + 1) * 5000
);

const changeDenominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
let selectedPaymentAmount = 0;
let selectedPaymentMethod = null;

// Format Rupiah
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Generate ID Unik
function generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// Payment System Functions

// Payment suggestions algorithm
function getAvailablePaymentOptions(total) {
    const roundUp = (num, multiple) => Math.ceil(num / multiple) * multiple;
    const options = [];

    // Selalu tambahkan uang pas terlebih dahulu
    options.push(total);

    let nearOptions = [];

    if (total < 10000) {
        nearOptions.push(roundUp(total, 5000));
        nearOptions.push(10000);
    } else if (total < 20000) {
        const r1 = roundUp(total, 5000);
        if (r1 < 20000) nearOptions.push(r1);
        if (r1 + 5000 <= 20000) nearOptions.push(r1 + 5000);
    } else if (total < 50000) {
        const r1 = roundUp(total, 5000);
        nearOptions.push(r1);
        const next10 = roundUp(r1 + 10000, 10000);
        if (next10 <= 50000) nearOptions.push(next10);
    } else if (total < 100000) {
        const r1 = roundUp(total, 5000);
        nearOptions.push(r1);
        if (r1 + 5000 <= 100000) nearOptions.push(r1 + 5000);
    } else if (total < 500000) {
        // 🔧 Perubahan di sini: gunakan kelipatan 20.000 agar realistis
        const r1 = roundUp(total, 5000);
        const next20 = roundUp(total, 20000);
        nearOptions.push(r1);
        if (next20 !== r1) nearOptions.push(next20);
    } else {
        const r1 = roundUp(total, 50000);
        nearOptions.push(r1);
        nearOptions.push(r1 + 50000);
    }

    // Tambahkan pecahan besar umum sekali saja
    if (total < 100000) {
        nearOptions.push(50000);
        nearOptions.push(100000);
    }

    // Gabungkan & hapus duplikat
    const unique = Array.from(new Set([...options, ...nearOptions]));

    // Filter nominal valid
    const validDenoms = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
    const result = unique
        .filter(v => v >= total && validDenoms.some(d => v % d === 0))
        .sort((a, b) => a - b);

    return result;
}





// Render payment methods as buttons
function renderPaymentMethods() {
    if (!paymentMethodsContainer) return;

    paymentMethodsContainer.innerHTML = paymentMethods
        .filter(method => method.status === 'Aktif')
        .map(method => `
            <button type="button" 
                    class="payment-method-btn" 
                    data-id="${method.id}" 
                    data-name="${method.name}"
                    data-type="${method.type}">
                ${method.name}
            </button>
        `).join('');

    // Add event listeners to payment method buttons
    const methodBtns = paymentMethodsContainer.querySelectorAll('.payment-method-btn');
    methodBtns.forEach(btn => {
        btn.addEventListener('click', handlePaymentMethodClick);
    });
}

// Handle payment method button click
function handlePaymentMethodClick(e) {
    const btn = e.currentTarget;

    // Remove selected class from all buttons
    paymentMethodsContainer.querySelectorAll('.payment-method-btn').forEach(b => {
        b.classList.remove('selected');
    });

    // Add selected class to clicked button
    btn.classList.add('selected');

    // Set the selected payment method
    selectedPaymentMethod = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        type: btn.dataset.type
    };
}

// Format number to K (thousands) format
function formatToK(number) {
    if (number >= 1000) {
        return Math.round(number / 1000) + 'K';
    }
    return number.toString();
}

// Generate payment suggestions for text options based on total amount
function generatePaymentSuggestions(total) {
    const availablePaymentOptions = getAvailablePaymentOptions(total);
    const suggestions = [];

    // Add exact amount option first
    suggestions.push({
        type: 'exact',
        label: `${formatToK(total)} (Pas)`,
        value: total,
        class: 'exact'
    });

    // Add all available payment options as suggestions
    for (const value of availablePaymentOptions) {
        // Only add if it's not the exact amount (already added above)
        if (value !== total) {
            suggestions.push({
                type: 'denomination',
                label: formatToK(value),
                value: value,
                class: 'denomination'
            });
        }
    }

    return suggestions;
}

// Render payment amount options as text elements
function renderPaymentAmountOptions(total) {
    if (!paymentAmountOptions) return;

    const suggestions = generatePaymentSuggestions(total);

    // Show first 7 options, rest go to dropdown
    const maxVisibleOptions = 7;
    const visibleOptions = suggestions.slice(0, maxVisibleOptions);
    const hiddenOptions = suggestions.slice(maxVisibleOptions);

    // Render visible options
    paymentAmountOptions.innerHTML = visibleOptions.map(suggestion => `
        <div class="payment-amount-option ${suggestion.class}" 
             data-value="${suggestion.value}" 
             data-type="${suggestion.type}">
            ${suggestion.label}
        </div>
    `).join('');

    // Render hidden options in dropdown if there are any
    const moreOptionsContainer = document.getElementById('payment-amount-options-more');
    const moreOptionsContent = document.getElementById('more-options-content');

    if (hiddenOptions.length > 0) {
        moreOptionsContainer.style.display = 'block';
        moreOptionsContent.innerHTML = hiddenOptions.map(suggestion => `
            <div class="payment-amount-option ${suggestion.class}" 
                 data-value="${suggestion.value}" 
                 data-type="${suggestion.type}">
                ${suggestion.label}
            </div>
        `).join('');
    } else {
        moreOptionsContainer.style.display = 'none';
    }

    // Add event listeners to all payment amount options (visible + hidden)
    const allAmountOptions = paymentAmountOptions.querySelectorAll('.payment-amount-option');
    allAmountOptions.forEach(option => {
        option.addEventListener('click', handlePaymentAmountOptionClick);
    });

    // Add event listeners to hidden options
    const hiddenAmountOptions = moreOptionsContent.querySelectorAll('.payment-amount-option');
    hiddenAmountOptions.forEach(option => {
        option.addEventListener('click', handlePaymentAmountOptionClick);
    });

    // Add click event for the dropdown button
    const moreOptionsBtn = document.getElementById('more-options-btn');
    if (moreOptionsBtn) {
        moreOptionsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            moreOptionsContent.classList.toggle('show');
        });
    }

    // Close dropdown if clicked outside
    document.addEventListener('click', function (e) {
        if (!moreOptionsBtn?.contains(e.target) && !moreOptionsContent.contains(e.target)) {
            moreOptionsContent.classList.remove('show');
        }
    });
}

// Handle payment amount option click
function handlePaymentAmountOptionClick(e) {
    const option = e.currentTarget;
    const value = parseFloat(option.dataset.value);

    // Remove selected class from all options
    paymentAmountOptions.querySelectorAll('.payment-amount-option').forEach(o => {
        o.classList.remove('selected');
    });

    // Add selected class to clicked option
    option.classList.add('selected');

    // Set the selected amount
    selectedPaymentAmount = value;
    amountPaidInput.value = value;

    // Calculate and display payment result
    calculateAndDisplayPaymentResult(value);
}

// Calculate optimal change composition using greedy algorithm
function calculateChangeComposition(changeAmount) {
    if (changeAmount === 0) {
        return [];
    }

    const composition = [];
    let remaining = changeAmount;

    for (const denomination of changeDenominations) {
        if (remaining >= denomination) {
            const count = Math.floor(remaining / denomination);
            composition.push({
                denomination: denomination,
                count: count,
                total: count * denomination
            });
            remaining -= count * denomination;
        }

        if (remaining === 0) {
            break;
        }
    }

    return composition;
}

// Render payment suggestions (updated to render text options)
function renderPaymentSuggestions(total) {
    renderPaymentAmountOptions(total);
}

// Handle payment suggestion button click
function handlePaymentSuggestionClick(e) {
    const btn = e.currentTarget;
    const value = parseFloat(btn.dataset.value);
    const type = btn.dataset.type;

    // Remove selected class from all buttons
    paymentSuggestions.querySelectorAll('.payment-suggestion-btn').forEach(b => {
        b.classList.remove('selected');
    });

    // Add selected class to clicked button
    btn.classList.add('selected');

    // Set the selected amount
    selectedPaymentAmount = value;
    amountPaidInput.value = value;

    // Calculate and display payment result
    calculateAndDisplayPaymentResult(value);
}

// Calculate and display payment result
function calculateAndDisplayPaymentResult(amountPaid) {
    const total = parseFloat(checkoutTotalSpan.textContent.replace(/[^\d]/g, '')) || 0;

    if (amountPaid < total) {
        // Show error for insufficient payment
        paymentResult.style.display = 'block';
        changeAmountSpan.textContent = 'Pembayaran Kurang!';
        changeAmountSpan.style.color = 'var(--danger-color)';
        if (changeBreakdown) changeBreakdown.style.display = 'none';
        return false;
    }

    const change = amountPaid - total;

    // Show payment result
    paymentResult.style.display = 'block';
    changeAmountSpan.style.color = 'var(--dark-color)';

    if (change === 0) {
        changeAmountSpan.textContent = 'Uang Pas / Tidak Ada Kembalian';
        if (changeBreakdown) changeBreakdown.style.display = 'none';
    } else {
        changeAmountSpan.textContent = formatRupiah(change);

        // Change composition display has been removed as per requirements
        if (changeBreakdown) changeBreakdown.style.display = 'none';
    }

    return true;
}

// Render change composition
function renderChangeComposition(composition) {
    if (composition.length === 0) {
        changeComposition.innerHTML = '<div class="no-change">Tidak ada kembalian</div>';
        return;
    }

    changeComposition.innerHTML = composition.map(item => `
        <div class="change-item">
            <span class="change-denomination">${formatRupiah(item.denomination)}</span>
            <span class="change-count">${item.count} lembar/koin</span>
        </div>
    `).join('');
}

// Tampilkan status loading (enhanced with null checks)
function showLoading(button, textElement) {
    if (button) button.disabled = true;
    if (textElement) textElement.innerHTML = '<div class="loading"></div>';
}

// Sembunyikan status loading (enhanced with null checks)
function hideLoading(button, textElement, text) {
    if (button) button.disabled = false;
    if (textElement) textElement.textContent = text;
}

// Inisialisasi Google API
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: '',
            discoveryDocs: CONFIG.discoveryDocs,
        });

        updateState({ gapiInited: true });
        console.log('Google API Client initialized');

        maybeEnableButtons();

    } catch (error) {
        console.error('Error initializing Google API Client:', error);
        showError('Gagal menginisialisasi Google API Client: ' + error.message);
        updateState({ gapiInited: false });
    }
}

function gisLoaded() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.clientId,
            scope: CONFIG.scope,
            callback: '', // Akan diatur nanti
        });

        updateState({ gisInited: true });
        console.log('Google Identity Services initialized with scopes:', CONFIG.scope);

        maybeEnableButtons();

    } catch (error) {
        console.error('Error initializing Google Identity Services:', error);
        showError('Gagal menginisialisasi Google Identity Services: ' + error.message);
        updateState({ gisInited: false });
    }
}

function maybeEnableButtons() {
    if (state.gapiInited && state.gisInited) {
        console.log('Google APIs ready, enabling login button');

        // Use safe DOM element access
        const loginButton = document.getElementById('login-btn');
        const statusElement = document.getElementById('login-status');

        if (loginButton) loginButton.disabled = false;
        if (statusElement) statusElement.textContent = 'Aplikasi siap. Silakan login.';

        // Check for saved session when APIs are ready
        setTimeout(() => {
            restoreSession();
        }, 500); // Small delay to ensure everything is ready

    } else {
        console.log('Google APIs not ready yet');
        const statusElement = document.getElementById('login-status');
        if (statusElement) statusElement.textContent = 'Memuat Google APIs...';
    }
}

// Handle Login (enhanced with comprehensive state management)
async function handleAuthClick() {
    try {
        showLoading();
        updateState({ error: null });

        tokenClient.callback = async (resp) => {
            try {
                if (resp.error !== undefined) {
                    throw new Error(resp.error_description || resp.error || 'Login gagal');
                }

                console.log('Login response received:', resp);

                // Set token in gapi client immediately
                gapi.client.setToken({ access_token: resp.access_token });

                // Update state
                updateState({
                    token: resp.access_token,
                    isLoggedIn: true,
                    loading: true
                });

                // Set user info with enhanced error handling
                const userInfo = await getUserInfo();

                // If getUserInfo returns null (token expired), stop the login process
                if (!userInfo) {
                    console.log('User info not available, clearing token and stopping login process');
                    gapi.client.setToken('');
                    updateState({ token: null });
                    hideLoading();
                    return;
                }

                const userData = {
                    name: userInfo.name || 'User',
                    email: userInfo.email || '',
                    picture: userInfo.picture || '',
                    avatar: userInfo.name ? userInfo.name.charAt(0).toUpperCase() : 'U'
                };

                console.log('User data prepared:', userData);

                // Update state with user data
                updateState({ user: userData });

                // Update UI
                updateUserInterface();

                console.log('Loading application data...');

                // Load data from Google Sheets with enhanced error handling
                await loadAllData();

                // Update state with loaded data
                updateState({
                    loading: false,
                    currentPage: 'kasir',
                    sessionTimestamp: Date.now()
                });

                // Ensure cart is properly initialized after login
                if (!Array.isArray(state.cart)) {
                    updateState({ cart: [] });
                }

                // Sync legacy variables after data load
                syncLegacyVariables();

                // Show main application
                showMainApplication();

                // Save comprehensive session data
                saveSessionData(userData);

                // Start session monitoring after successful login
                startSessionMonitoring();

                // Update login status
                if (loginStatus) {
                    loginStatus.textContent = 'Login berhasil!';
                    setTimeout(() => {
                        loginStatus.textContent = '';
                    }, 2000);
                }

                console.log('Login process completed successfully');

            } catch (error) {
                console.error('Error in token callback:', error);
                hideLoading();
                updateState({
                    loading: false,
                    error: 'Login gagal: ' + (error.message || 'Unknown error')
                });
                showError('Login gagal: ' + (error.message || 'Unknown error'));
            }
        };

        // Clear any existing session data to ensure fresh login
        clearSessionData();

        // Always request fresh token to ensure correct scope
        console.log('Requesting fresh access token with correct scope');
        tokenClient.requestAccessToken({ prompt: 'consent' });

    } catch (error) {
        console.error('Error initiating login:', error);
        hideLoading();
        updateState({ loading: false });
        showError('Gagal memulai proses login: ' + error.message);
    }
}

// Dapatkan info user (enhanced with better error handling)
async function getUserInfo() {
    try {
        console.log('Getting user info...');

        // Ensure token is properly set in gapi client
        if (state.token) {
            console.log('Setting token in gapi client');
            gapi.client.setToken({ access_token: state.token });
        }

        // Get token from gapi client (now it should have the correct token)
        const token = gapi.client.getToken();

        if (!token || !token.access_token) {
            throw new Error('No access token available in gapi client');
        }

        console.log('Using access token from gapi client for user info request');

        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Token expired or invalid, need re-authentication');
                showError('Token telah kedaluwarsa. Silakan login kembali.');
                // Clear the invalid token
                gapi.client.setToken('');
                updateState({ token: null });
                return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const userInfo = await response.json();
        console.log('User info retrieved successfully:', userInfo);
        return userInfo;

    } catch (error) {
        console.error('Error mendapatkan info user:', error);

        // If it's a token error, trigger re-authentication
        if (error.message.includes('401') || error.message.includes('Token')) {
            console.log('Token error detected, clearing invalid token');
            gapi.client.setToken('');
            updateState({ token: null });
            showError('Sesi login telah kedaluwarsa. Silakan login kembali.');
            return null;
        }

        showError('Gagal mendapatkan informasi pengguna: ' + error.message);
        return {
            name: 'User',
            email: 'user@example.com',
            picture: ''
        };
    }
}

// Handle Logout (enhanced with comprehensive state management)
async function handleSignout() {
    try {
        console.log('Initiating logout process...');

        const token = gapi.client.getToken();
        if (token !== null && token.access_token) {
            try {
                // Revoke token from Google
                await google.accounts.oauth2.revoke(token.access_token);
                console.log('Google token revoked successfully');
            } catch (error) {
                console.error('Error revoking Google token:', error);
                // Continue with logout even if token revocation fails
            }

            // Clear Google client token
            gapi.client.setToken('');
        }

        // Reset application state
        updateState({
            user: null,
            token: null,
            isLoggedIn: false,
            cart: [],
            currentPage: 'kasir',
            products: [],
            categories: [],
            paymentMethods: [],
            transactions: []
        });

        // Clear session data from localStorage
        clearSessionData();

        // Stop session monitoring
        stopSessionMonitoring();

        // Update UI to show login page
        if (loginPage) loginPage.classList.add('active');
        if (kasirPage) kasirPage.classList.remove('active');
        if (pengaturanPage) pengaturanPage.classList.remove('active');
        if (keranjangMobilePage) keranjangMobilePage.classList.remove('active');

        // Hide bottom navigation
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }

        // Clear user interface elements
        const avatarElements = ['user-avatar', 'user-avatar-settings', 'user-avatar-keranjang'];
        const nameElements = ['user-name', 'user-name-settings', 'user-name-keranjang'];

        avatarElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '';
        });

        nameElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '';
        });

        // Update login status
        if (loginStatus) {
            loginStatus.textContent = 'Anda telah logout.';
            setTimeout(() => {
                loginStatus.textContent = '';
            }, 3000);
        }

        console.log('Logout completed successfully');

    } catch (error) {
        console.error('Error during logout:', error);
        showError('Terjadi kesalahan saat logout: ' + error.message);
    }
}

// Load semua data dari Google Sheets (enhanced with comprehensive state management)
async function loadAllData() {
    try {
        console.log('Starting data load process...');
        updateState({ loading: true });

        // Load data from Google Sheets with individual error handling
        try {
            await loadCategories();
            console.log('Categories loaded successfully');
        } catch (error) {
            console.error('Error loading categories:', error);
            if (error.status === 401 || error.result?.error?.code === 401) {
                // If it's a session expiry error, stop loading and redirect
                throw error;
            }
            showError('Gagal memuat kategori: ' + (error.result?.error?.message || error.message));
        }

        try {
            await loadProducts();
            console.log('Products loaded successfully');
        } catch (error) {
            console.error('Error loading products:', error);
            if (error.status === 401 || error.result?.error?.code === 401) {
                // If it's a session expiry error, stop loading and redirect
                throw error;
            }
            showError('Gagal memuat produk: ' + (error.result?.error?.message || error.message));
        }

        try {
            await loadPaymentMethods();
            console.log('Payment methods loaded successfully');
        } catch (error) {
            console.error('Error loading payment methods:', error);
            if (error.status === 401 || error.result?.error?.code === 401) {
                // If it's a session expiry error, stop loading and redirect
                throw error;
            }
            showError('Gagal memuat metode pembayaran: ' + (error.result?.error?.message || error.message));
        }

        // Update state with loaded data
        syncLegacyVariables();

        // Render UI elements with error handling
        try {
            renderProducts();
            renderProductTable();
            renderCategoryTable();
            renderPaymentTable();
            populateCategorySelect();
            populatePaymentMethodSelect();
            renderPaymentMethods();
            renderCategories();
            console.log('UI elements rendered successfully');
        } catch (error) {
            console.error('Error rendering UI elements:', error);
            showError('Gagal merender elemen UI: ' + error.message);
        }

        console.log('All data loaded successfully');

    } catch (error) {
        console.error('Unexpected error loading data:', error);

        // Check if it's a session expiry error
        if (error.status === 401 || error.result?.error?.code === 401) {
            console.log('Session expired during data load - redirecting to login');
            stopSessionMonitoring(); // Stop monitoring since session is invalid
            handleAuthError();
            return; // Exit early if session expired
        }

        showError('Terjadi kesalahan saat memuat data: ' + (error.result?.error?.message || error.message));
        throw error; // Re-throw to allow calling function to handle
    } finally {
        updateState({ loading: false });
    }
}



// Load produk dari Google Sheets (enhanced with state management and error handling)
async function loadProducts() {
    try {
        console.log('Loading products from Google Sheets...');

        // Validate token before making API call
        if (!gapi.client.getToken()?.access_token) {
            throw new Error('No valid access token available');
        }

        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Produk!A2:G', // A2:G untuk menghindari header
        });

        // Check response status
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const values = response.result.values || [];
        const loadedProducts = values.map((row, index) => {
            try {
                return {
                    id: row[0] || `PRD_${Date.now()}_${index}`,
                    name: row[1] || 'Produk Tanpa Nama',
                    description: row[2] || '',
                    price: parseInt(row[3]?.replace(/[^\d]/g, '')) || 0,
                    category: row[4] || '',
                    image: row[5] || '',
                    status: row[6] || 'Aktif'
                };
            } catch (error) {
                console.error(`Error parsing product row ${index}:`, error);
                return null;
            }
        }).filter(product => product !== null);

        // Update state with loaded products
        updateState({ products: loadedProducts });
        console.log(`Loaded ${loadedProducts.length} products successfully`);

    } catch (error) {
        console.error('Error loading products:', error);

        // Enhanced error handling with comprehensive 401 detection
        if (handleApiError(error, 'memuat produk')) {
            throw error; // Re-throw to stop execution if session expired
        }

        // Set empty array as fallback for other errors
        updateState({ products: [] });
        throw error;
    }
}

// Load kategori dari Google Sheets (enhanced with state management and error handling)
async function loadCategories() {
    try {
        console.log('Loading categories from Google Sheets...');

        // Validate token before making API call
        if (!gapi.client.getToken()?.access_token) {
            throw new Error('No valid access token available');
        }

        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Kategori!A2:D', // A2:D untuk menghindari header
        });

        // Check response status
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const values = response.result.values || [];
        const loadedCategories = values.map((row, index) => {
            try {
                return {
                    id: row[0] || `CAT_${Date.now()}_${index}`,
                    name: row[1] || 'Kategori Tanpa Nama',
                    order: parseInt(row[2]) || 0,
                    status: row[3] || 'Aktif'
                };
            } catch (error) {
                console.error(`Error parsing category row ${index}:`, error);
                return null;
            }
        }).filter(category => category !== null);

        // Update state with loaded categories
        updateState({ categories: loadedCategories });
        console.log(`Loaded ${loadedCategories.length} categories successfully`);

    } catch (error) {
        console.error('Error loading categories:', error);

        // Enhanced error handling with comprehensive 401 detection
        if (handleApiError(error, 'memuat kategori')) {
            throw error; // Re-throw to stop execution if session expired
        }

        // Set empty array as fallback for other errors
        updateState({ categories: [] });
        throw error;
    }
}

// Load metode pembayaran dari Google Sheets (enhanced with state management and error handling)
async function loadPaymentMethods() {
    try {
        console.log('Loading payment methods from Google Sheets...');

        // Validate token before making API call
        if (!gapi.client.getToken()?.access_token) {
            throw new Error('No valid access token available');
        }

        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Metode_Pembayaran!A2:D', // A2:D untuk menghindari header
        });

        // Check response status
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const values = response.result.values || [];
        const loadedPaymentMethods = values.map((row, index) => {
            try {
                return {
                    id: row[0] || `PM_${Date.now()}_${index}`,
                    name: row[1] || 'Metode Tanpa Nama',
                    type: row[2] || 'Tunai',
                    status: row[3] || 'Aktif'
                };
            } catch (error) {
                console.error(`Error parsing payment method row ${index}:`, error);
                return null;
            }
        }).filter(method => method !== null);

        // Update state with loaded payment methods
        updateState({ paymentMethods: loadedPaymentMethods });
        console.log(`Loaded ${loadedPaymentMethods.length} payment methods successfully`);

    } catch (error) {
        console.error('Error loading payment methods:', error);

        // Enhanced error handling with comprehensive 401 detection
        if (handleApiError(error, 'memuat metode pembayaran')) {
            throw error; // Re-throw to stop execution if session expired
        }

        // Set empty array as fallback for other errors
        updateState({ paymentMethods: [] });
        throw error;
    }
}

// Simpan produk ke Google Sheets
async function saveProduct(product, isNew = true) {
    const values = [[
        product.id,
        product.name,
        product.description,
        product.price,
        product.category,
        product.image,
        product.status
    ]];

    if (isNew) {
        // Tambah baris baru
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Produk!A:G',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values }
        });
    } else {
        // Cari baris yang akan diupdate
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Produk!A2:G',
        });

        const rows = response.result.values || [];
        const rowIndex = rows.findIndex(row => row[0] === product.id);

        if (rowIndex !== -1) {
            // Update baris yang ada
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.spreadsheetId,
                range: `Produk!A${rowIndex + 2}:G${rowIndex + 2}`,
                valueInputOption: 'RAW',
                resource: { values }
            });
        }
    }
}

// Simpan kategori ke Google Sheets
async function saveCategory(category, isNew = true) {
    const values = [[
        category.id,
        category.name,
        category.order,
        category.status
    ]];

    if (isNew) {
        // Tambah baris baru
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Kategori!A:D',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values }
        });
    } else {
        // Cari baris yang akan diupdate
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Kategori!A2:D',
        });

        const rows = response.result.values || [];
        const rowIndex = rows.findIndex(row => row[0] === category.id);

        if (rowIndex !== -1) {
            // Update baris yang ada
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.spreadsheetId,
                range: `Kategori!A${rowIndex + 2}:D${rowIndex + 2}`,
                valueInputOption: 'RAW',
                resource: { values }
            });
        }
    }
}

// Simpan metode pembayaran ke Google Sheets
async function savePaymentMethod(method, isNew = true) {
    const values = [[
        method.id,
        method.name,
        method.type,
        method.status
    ]];

    if (isNew) {
        // Tambah baris baru
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Metode_Pembayaran!A:D',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values }
        });
    } else {
        // Cari baris yang akan diupdate
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Metode_Pembayaran!A2:D',
        });

        const rows = response.result.values || [];
        const rowIndex = rows.findIndex(row => row[0] === method.id);

        if (rowIndex !== -1) {
            // Update baris yang ada
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.spreadsheetId,
                range: `Metode_Pembayaran!A${rowIndex + 2}:D${rowIndex + 2}`,
                valueInputOption: 'RAW',
                resource: { values }
            });
        }
    }
}

// Hapus produk dari Google Sheets
async function deleteProductFromSheet(productId) {
    // Cari baris yang akan dihapus
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Produk!A2:G',
    });

    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(row => row[0] === productId);

    if (rowIndex !== -1) {
        // Hapus baris
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: await getSheetId('Produk'),
                            dimension: 'ROWS',
                            startIndex: rowIndex + 1, // +1 karena header
                            endIndex: rowIndex + 2
                        }
                    }
                }]
            }
        });
    }
}

// Hapus kategori dari Google Sheets
async function deleteCategoryFromSheet(categoryId) {
    // Cari baris yang akan dihapus
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Kategori!A2:D',
    });

    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(row => row[0] === categoryId);

    if (rowIndex !== -1) {
        // Hapus baris
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: await getSheetId('Kategori'),
                            dimension: 'ROWS',
                            startIndex: rowIndex + 1, // +1 karena header
                            endIndex: rowIndex + 2
                        }
                    }
                }]
            }
        });
    }
}

// Hapus metode pembayaran dari Google Sheets
async function deletePaymentMethodFromSheet(methodId) {
    // Cari baris yang akan dihapus
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Metode_Pembayaran!A2:D',
    });

    const rows = response.result.values || [];
    const rowIndex = rows.findIndex(row => row[0] === methodId);

    if (rowIndex !== -1) {
        // Hapus baris
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: await getSheetId('Metode_Pembayaran'),
                            dimension: 'ROWS',
                            startIndex: rowIndex + 1, // +1 karena header
                            endIndex: rowIndex + 2
                        }
                    }
                }]
            }
        });
    }
}

// Dapatkan ID sheet berdasarkan nama
async function getSheetId(sheetName) {
    const response = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.spreadsheetId,
    });

    const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
}

// Simpan transaksi ke Google Sheets
async function saveTransaction(transaction, details) {
    // Simpan header transaksi
    const transactionValues = [[
        transaction.id,
        transaction.tanggal,
        transaction.total_penjualan,
        transaction.diskon,
        transaction.subtotal,
        transaction.id_metode,
        transaction.jumlah_bayar,
        transaction.kembalian,
        transaction.nama_kasir
    ]];

    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Pos_Transaksi!A:I',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: transactionValues }
    });

    // Simpan detail transaksi
    const detailValues = details.map(detail => [
        detail.id_detail,
        transaction.id,
        detail.id_produk,
        detail.nama_produk,
        detail.harga_satuan,
        detail.kuantitas,
        detail.total_item,
        detail.catatan_item || ''
    ]);

    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Detail_Transaksi!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: detailValues }
    });
}

// Render Kategori (enhanced with null checks and state management)
function renderCategories() {
    // Safe DOM element access
    const categoryList = document.getElementById('category-list');
    if (!categoryList) {
        console.error('Category list element not found');
        return;
    }

    try {
        categoryList.innerHTML = '';

        // Tambahkan kategori "Semua"
        const allCategoryBtn = document.createElement('button');
        allCategoryBtn.className = 'category-btn active';
        allCategoryBtn.textContent = 'Semua';
        allCategoryBtn.dataset.categoryId = 'all';
        allCategoryBtn.addEventListener('click', () => filterProductsByCategory('all'));
        categoryList.appendChild(allCategoryBtn);

        // Tambahkan kategori lainnya using state data
        state.categories.forEach(category => {
            if (category.status === 'Aktif') {
                const categoryBtn = document.createElement('button');
                categoryBtn.className = 'category-btn';
                categoryBtn.textContent = category.name || 'Kategori Tanpa Nama';
                categoryBtn.dataset.categoryId = category.id;
                categoryBtn.addEventListener('click', () => filterProductsByCategory(category.id));
                categoryList.appendChild(categoryBtn);
            }
        });

        console.log(`Rendered ${state.categories.length} categories successfully`);

    } catch (error) {
        console.error('Error rendering categories:', error);
        categoryList.innerHTML = '<div class="text-center" style="padding: 20px; color: var(--danger-color);">Error memuat kategori</div>';
        showError('Gagal merender kategori: ' + error.message);
    }
}

// Filter produk berdasarkan kategori (enhanced with state management)
function filterProductsByCategory(categoryId) {
    try {
        // Ubah status aktif pada tombol kategori
        const categoryButtons = document.querySelectorAll('.category-btn');
        categoryButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.categoryId === categoryId) {
                btn.classList.add('active');
            }
        });

        // Filter produk using state data
        renderProducts(categoryId);

        console.log(`Filtered products by category: ${categoryId}`);

    } catch (error) {
        console.error('Error filtering products by category:', error);
        showError('Gagal memfilter produk: ' + error.message);
    }
}

// Render Produk (enhanced with null checks and error handling)
function renderProducts(categoryId = 'all') {
    // Safe DOM element access
    const gridElement = document.getElementById('product-grid');
    if (!gridElement) {
        console.error('Product grid element not found');
        return;
    }

    try {
        gridElement.innerHTML = '';

        // Use state products instead of global products variable
        let activeProducts = state.products.filter(product => product.status === 'Aktif');

        // Filter berdasarkan kategori jika bukan 'all'
        if (categoryId !== 'all') {
            activeProducts = activeProducts.filter(product => product.category === categoryId);
        }

        if (activeProducts.length === 0) {
            gridElement.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 20px;">Tidak ada produk yang tersedia</div>';
            return;
        }

        activeProducts.forEach(product => {
            // Find category safely
            const category = state.categories.find(cat => cat.id === product.category);

            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image">
                    <div class="product-price">${formatRupiah(product.price || 0)}</div>
                    ${product.image ?
                    `<img src="${product.image}" alt="${product.name}">` :
                    `<i class="fas fa-coffee"></i>`
                }
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name || 'Produk Tanpa Nama'}</div>
                </div>

            `;

            // Add event listener to the add-to-cart button
            const addToCartBtn = productCard.querySelector('.product-image');
            addToCartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    addToCart(product);
                } catch (error) {
                    console.error('Error adding product to cart:', error);
                    showError('Gagal menambahkan produk ke keranjang');
                }
            });

            gridElement.appendChild(productCard);
        });

        console.log(`Rendered ${activeProducts.length} products successfully`);

    } catch (error) {
        console.error('Error rendering products:', error);
        if (gridElement) {
            gridElement.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 20px; color: var(--danger-color);">Error memuat produk</div>';
        }
        showError('Gagal merender produk: ' + error.message);
    }
}

// Update tampilan keranjang mobile (moved to global scope)
function updateMobileCart() {
    if (!cartItemsMobile || !mobileCartBadge || !cartSubtotalMobile || !cartTotalMobile) {
        console.log('Mobile cart elements not found, skipping update');
        return;
    }

    try {
        cartItemsMobile.innerHTML = '';
        let subtotal = 0;
        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            cartItemsMobile.innerHTML = `
                <div class="empty-cart-message">
                    <h4>Keranjang Belanja Kosong</h4>
                    <p>Silakan tambahkan produk yang ingin Anda beli</p>
                </div>
            `;
            mobileCartBadge.textContent = '0';
            mobileCartBadge.classList.add('hidden');
            cartSubtotalMobile.textContent = formatRupiah(0);
            cartDiscountMobile.textContent = formatRupiah(0);
            cartTotalMobile.textContent = formatRupiah(0);
            return;
        }

        currentCart.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 0);
            subtotal += itemTotal;

            const cartItemMobileElement = document.createElement('div');
            cartItemMobileElement.className = 'cart-item-mobile';
            cartItemMobileElement.innerHTML = `
                <div class="cart-item-info-mobile">
                    <div class="cart-item-name-mobile">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price-mobile">${formatRupiah(item.price || 0)}</div>
                </div>
                <div class="cart-item-actions-mobile">
                    <div class="quantity-controls-mobile">
                        <button class="quantity-btn-mobile minus-mobile"
                            data-id="${item.id}" type="button"
                            onclick="decreaseQuantity('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">-</button>
                        <span class="quantity-mobile">${item.quantity || 0}</span>
                        <button class="quantity-btn-mobile plus-mobile"
                            data-id="${item.id}" type="button"
                            onclick="increaseQuantity('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">+</button>
                    </div>
                    <button class="remove-btn-mobile"
                        data-id="${item.id}" type="button"
                        onclick="removeFromCart('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItemsMobile.appendChild(cartItemMobileElement);
        });

        const discount = 0;
        const total = subtotal;
        const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

        // Update badge dengan animasi dan ukuran adaptif
        if (mobileCartBadge) {
            mobileCartBadge.textContent = totalItems;
            mobileCartBadge.classList.remove('hidden');
            mobileCartBadge.classList.toggle('wide', totalItems >= 10);
            mobileCartBadge.classList.add('updated');
            setTimeout(() => mobileCartBadge.classList.remove('updated'), 250);
        }

        cartSubtotalMobile.textContent = formatRupiah(subtotal);
        cartTotalMobile.textContent = formatRupiah(total);

        // Pastikan badge tidak lepas dari ikon keranjang
        const cartButton = document.querySelector('.bottom-nav .cart-icon');
        if (mobileCartBadge && cartButton && !cartButton.contains(mobileCartBadge)) {
            cartButton.appendChild(mobileCartBadge);
        }

        // Re-attach badge setiap kali halaman keranjang dibuka
        const currentPage = document.querySelector('.page.active');
        if (currentPage && currentPage.id === 'keranjang-mobile-page') {
            const cartButton = document.querySelector('.bottom-nav .cart-icon');
            if (mobileCartBadge && cartButton && !cartButton.contains(mobileCartBadge)) {
                cartButton.appendChild(mobileCartBadge);
            }
        }

        console.log('Mobile cart updated successfully');
    } catch (error) {
        console.error('Error updating mobile cart:', error);
    }
}

// Render Keranjang (enhanced with state management and null checks)
function renderCart() {
    try {
        console.log('Rendering cart, current state.cart:', state.cart);

        // Safe DOM element access
        const cartContainer = document.getElementById('cart-items');
        if (!cartContainer) {
            console.error('Cart items container not found');
            return;
        }

        cartContainer.innerHTML = '';

        // Use state cart data consistently
        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-cart-message">
                    <h4>Keranjang Belanja Kosong</h4>
                    <p>Tambahkan produk untuk memulai belanja</p>
                </div>
            `;

            // Update cart UI elements safely
            const cartCountElement = document.getElementById('cart-count');
            const cartSubtotalElement = document.getElementById('cart-subtotal');
            const cartDiscountElement = document.getElementById('cart-discount');
            const cartTotalElement = document.getElementById('cart-total');
            const mobileBadge = document.getElementById('mobile-cart-badge');

            if (cartCountElement) cartCountElement.textContent = '0 item';
            if (cartSubtotalElement) cartSubtotalElement.textContent = formatRupiah(0);
            if (cartDiscountElement) cartDiscountElement.textContent = formatRupiah(0);
            if (cartTotalElement) cartTotalElement.textContent = formatRupiah(0);
            if (mobileBadge) mobileBadge.textContent = '0';

            console.log('Cart rendered as empty');
            return;
        }

        let subtotal = 0;

        currentCart.forEach(item => {
            console.log('Rendering cart item:', item);

            // Validate item data
            if (!item || !item.id) {
                console.error('Invalid cart item:', item);
                return;
            }

            const itemTotal = (item.price || 0) * (item.quantity || 0);
            subtotal += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price">${formatRupiah(item.price || 0)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn decrease-btn" data-id="${item.id}" data-product-id="${item.id}">-</button>
                    <span class="quantity">${item.quantity || 0}</span>
                    <button class="quantity-btn increase-btn" data-id="${item.id}" data-product-id="${item.id}">+</button>
                    <button class="remove-btn" data-id="${item.id}" data-product-id="${item.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            cartContainer.appendChild(cartItem);
        });

        // Tidak ada diskon
        const discount = 0;
        const total = subtotal;

        const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

        // Update cart UI elements safely
        const cartCountElement = document.getElementById('cart-count');
        const cartSubtotalElement = document.getElementById('cart-subtotal');
        const cartDiscountElement = document.getElementById('cart-discount');
        const cartTotalElement = document.getElementById('cart-total');
        const mobileBadge = document.getElementById('mobile-cart-badge');

        if (cartCountElement) cartCountElement.textContent = `${totalItems} item`;
        if (cartSubtotalElement) cartSubtotalElement.textContent = formatRupiah(subtotal);
        if (cartDiscountElement) cartDiscountElement.textContent = formatRupiah(discount);
        if (cartTotalElement) cartTotalElement.textContent = formatRupiah(total);
        if (mobileBadge) mobileBadge.textContent = totalItems.toString();

        // Tambahkan event listener untuk tombol di keranjang dengan error handling
        const decreaseButtons = cartContainer.querySelectorAll('.decrease-btn');
        const increaseButtons = cartContainer.querySelectorAll('.increase-btn');
        const removeButtons = cartContainer.querySelectorAll('.remove-btn');

        decreaseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                try {
                    const id = e.target.getAttribute('data-id');
                    if (id) decreaseQuantity(id);
                } catch (error) {
                    console.error('Error in decrease button click:', error);
                }
            });
        });

        increaseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                try {
                    const id = e.target.getAttribute('data-id');
                    if (id) increaseQuantity(id);
                } catch (error) {
                    console.error('Error in increase button click:', error);
                }
            });
        });

        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    const id = e.target.getAttribute('data-id') || e.target.closest('.remove-btn')?.getAttribute('data-id');
                    console.log('Remove button clicked for product ID:', id);
                    if (id) {
                        removeFromCart(id);
                        // Re-render cart immediately after removal
                        setTimeout(() => {
                            renderCart();
                        }, 10);
                    } else {
                        console.error('No product ID found on remove button');
                    }
                } catch (error) {
                    console.error('Error in remove button click:', error);
                }
            });
        });

        console.log(`Cart rendered successfully with ${currentCart.length} items, subtotal: ${formatRupiah(subtotal)}`);

    } catch (error) {
        console.error('Error rendering cart:', error);
        const cartContainer = document.getElementById('cart-items');
        if (cartContainer) {
            cartContainer.innerHTML = '<div class="text-center" style="color: var(--danger-color);">Error memuat keranjang</div>';
        }
        showError('Gagal merender keranjang: ' + error.message);
    }
}

// Tambah ke Keranjang (enhanced with state management)
function addToCart(product) {
    try {
        // Validate product data
        if (!product || !product.id || !product.name) {
            console.error('Invalid product data:', product);
            showError('Data produk tidak valid');
            return;
        }

        console.log('Adding product to cart:', product);
        console.log('Current state.cart before:', state.cart);

        // Update state cart
        const existingItemIndex = state.cart.findIndex(item => item.id === product.id);

        let newCart;
        if (existingItemIndex >= 0) {
            // Update existing item quantity
            newCart = [...state.cart];
            newCart[existingItemIndex] = {
                ...newCart[existingItemIndex],
                quantity: newCart[existingItemIndex].quantity + 1
            };
        } else {
            // Add new item to cart
            newCart = [...state.cart, {
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            }];
        }

        // Update state directly to ensure it works
        state.cart = newCart;

        console.log('Current state.cart after:', state.cart);

        // Sync legacy variables after direct state update
        syncLegacyVariables();

        // Re-render cart UI
        renderCart();

        // Update mobile cart if mobile page is active
        updateMobileCart();

        // Save session data after cart update
        if (state.user) {
            saveSessionData();
        }

        // Animasi feedback
        const productCards = document.querySelectorAll('.product-card');
        let foundCard = null;

        productCards.forEach(card => {
            const nameElement = card.querySelector('.product-name');
            if (nameElement && nameElement.textContent === product.name) {
                foundCard = card;
            }
        });

        if (foundCard) {
            foundCard.style.transform = 'scale(0.95)';
            setTimeout(() => {
                foundCard.style.transform = '';
            }, 200);
        }

        console.log('Product added to cart successfully');

    } catch (error) {
        console.error('Error adding product to cart:', error);
        showError('Gagal menambahkan produk ke keranjang: ' + error.message);
    }
}

// Kurangi Kuantitas (enhanced with state management)
function decreaseQuantity(productId) {
    try {
        if (!productId) {
            console.error('Product ID is required');
            return;
        }

        console.log('Decreasing quantity for product:', productId);
        console.log('Current state.cart before:', state.cart);

        const itemIndex = state.cart.findIndex(item => item.id === productId);

        if (itemIndex === -1) {
            console.error('Product not found in cart:', productId);
            return;
        }

        const item = state.cart[itemIndex];
        let newCart;

        if (item.quantity > 1) {
            // Decrease quantity
            newCart = [...state.cart];
            newCart[itemIndex] = {
                ...item,
                quantity: item.quantity - 1
            };
        } else {
            // Remove item from cart
            newCart = state.cart.filter(item => item.id !== productId);
        }

        // Update state directly
        state.cart = newCart;

        console.log('Current state.cart after:', state.cart);

        // Sync legacy variables
        syncLegacyVariables();

        // Re-render cart UI
        renderCart();

        // Update mobile cart
        updateMobileCart();

        // Save session data after cart update
        if (state.user) {
            saveSessionData();
        }

        console.log('Product quantity decreased successfully');

    } catch (error) {
        console.error('Error decreasing product quantity:', error);
        showError('Gagal mengurangi jumlah produk: ' + error.message);
    }
}

// Tambah Kuantitas (enhanced with state management)
function increaseQuantity(productId) {
    try {
        if (!productId) {
            console.error('Product ID is required');
            return;
        }

        console.log('Increasing quantity for product:', productId);
        console.log('Current state.cart before:', state.cart);

        const itemIndex = state.cart.findIndex(item => item.id === productId);

        if (itemIndex === -1) {
            console.error('Product not found in cart:', productId);
            return;
        }

        // Increase quantity
        const newCart = [...state.cart];
        newCart[itemIndex] = {
            ...newCart[itemIndex],
            quantity: newCart[itemIndex].quantity + 1
        };

        // Update state directly
        state.cart = newCart;

        console.log('Current state.cart after:', state.cart);

        // Sync legacy variables
        syncLegacyVariables();

        // Re-render cart UI
        renderCart();

        // Update mobile cart
        updateMobileCart();

        // Save session data after cart update
        if (state.user) {
            saveSessionData();
        }

        console.log('Product quantity increased successfully');

    } catch (error) {
        console.error('Error increasing product quantity:', error);
        showError('Gagal menambah jumlah produk: ' + error.message);
    }
}

// Hapus dari Keranjang (enhanced with state management)
function removeFromCart(productId) {
    try {
        if (!productId) {
            console.error('Product ID is required');
            return;
        }

        console.log('Removing product from cart:', productId);
        console.log('Current state.cart before:', state.cart);

        const newCart = state.cart.filter(item => item.id !== productId);

        // Update state directly
        state.cart = newCart;

        console.log('Current state.cart after:', state.cart);

        // Sync legacy variables
        syncLegacyVariables();

        // Re-render cart UI
        renderCart();

        // Update mobile cart
        updateMobileCart();

        // Save session data after cart update
        if (state.user) {
            saveSessionData();
        }

        console.log('Product removed from cart successfully');

    } catch (error) {
        console.error('Error removing product from cart:', error);
        showError('Gagal menghapus produk dari keranjang: ' + error.message);
    }
}

// Hapus semua keranjang (clear entire cart)
function clearCart() {
    try {
        console.log('Clearing entire cart');
        console.log('Current state.cart before:', state.cart);

        // Update state to clear cart
        updateState({ cart: [] });

        console.log('Current state.cart after:', state.cart);

        // Sync legacy variables
        syncLegacyVariables();

        // Re-render cart UI
        renderCart();

        // Update mobile cart
        updateMobileCart();

        // Save session data after cart update
        if (state.user) {
            saveSessionData();
        }

        console.log('Cart cleared successfully');

    } catch (error) {
        console.error('Error clearing cart:', error);
        showError('Gagal menghapus keranjang: ' + error.message);
    }
}

// Render Tabel Produk
function renderProductTable() {
    productTableBody.innerHTML = '';

    if (products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada data produk</td></tr>';
        return;
    }

    products.forEach(product => {
        const category = categories.find(cat => cat.id === product.category);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Nama Produk">${product.name}</td>
            <td data-label="Kategori">${category ? category.name : 'Tidak ada'}</td>
            <td data-label="Harga">${formatRupiah(product.price)}</td>
            <td data-label="Status">${product.status}</td>
            <td data-label="Aksi">
                <button class="action-btn edit-btn" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" data-id="${product.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        productTableBody.appendChild(row);
    });

    // Tambahkan event listener untuk tombol edit dan hapus
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.edit-btn').getAttribute('data-id');
            editProduct(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            deleteProduct(id);
        });
    });
}

// Render Tabel Kategori
function renderCategoryTable() {
    categoryTableBody.innerHTML = '';

    if (categories.length === 0) {
        categoryTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada data kategori</td></tr>';
        return;
    }

    categories.forEach(category => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Nama Kategori">${category.name}</td>
            <td data-label="Urutan">${category.order}</td>
            <td data-label="Status">${category.status}</td>
            <td data-label="Aksi">
                <button class="action-btn edit-btn" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" data-id="${category.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        categoryTableBody.appendChild(row);
    });

    // Tambahkan event listener untuk tombol edit dan hapus
    document.querySelectorAll('#category-table-body .edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.edit-btn').getAttribute('data-id');
            editCategory(id);
        });
    });

    document.querySelectorAll('#category-table-body .delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            deleteCategory(id);
        });
    });
}

// Render Metode Pembayaran sebagai Card View
function renderPaymentTable() {
    const paymentCards = document.getElementById('payment-cards');

    if (!paymentCards) return;

    paymentCards.innerHTML = '';

    if (paymentMethods.length === 0) {
        paymentCards.innerHTML = '<div class="empty-state">Tidak ada data metode pembayaran</div>';
        return;
    }

    paymentMethods.forEach(method => {
        const card = document.createElement('div');
        card.className = 'payment-card';

        const statusClass = method.status === 'Aktif' ? 'status-active' : 'status-inactive';

        card.innerHTML = `
            <div class="payment-card-title">${method.name}</div>
            <div class="payment-card-type">${method.type}</div>
            <div class="payment-card-status ${statusClass}">${method.status}</div>
            <div class="payment-card-actions">
                <button class="edit-btn" data-id="${method.id}"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" data-id="${method.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;

        paymentCards.appendChild(card);
    });

    // Tambahkan event listener untuk tombol edit dan hapus
    document.querySelectorAll('#payment-cards .edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.edit-btn').getAttribute('data-id');
            editPaymentMethod(id);
        });
    });

    document.querySelectorAll('#payment-cards .delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            deletePaymentMethod(id);
        });
    });
}

// Isi Select Kategori
function populateCategorySelect() {
    productCategorySelect.innerHTML = '';
    const categoryButtonsContainer = document.getElementById('product-category-buttons');

    if (categoryButtonsContainer) {
        categoryButtonsContainer.innerHTML = '';
    }

    categories
        .filter(cat => cat.status === 'Aktif')
        .forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            productCategorySelect.appendChild(option);

            // Also create a button for this category
            if (categoryButtonsContainer) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'select-button';
                button.textContent = category.name;
                button.dataset.value = category.id;
                // Store category ID in a variable to ensure closure captures the right value
                const catId = category.id;
                button.addEventListener('click', function () {
                    // Remove selected class from all buttons
                    categoryButtonsContainer.querySelectorAll('.select-button').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    // Add selected class to clicked button
                    this.classList.add('selected');
                    // Update the hidden select element
                    productCategorySelect.value = catId;
                });
                categoryButtonsContainer.appendChild(button);
            }
        });

    // Reinitialize the select button system to ensure all event listeners work properly
    initializeCategoryButtons();
}

// Function to handle category button selection specifically
function initializeCategoryButtons() {
    const categoryButtons = document.querySelectorAll('#product-category-buttons .select-button');

    // Remove any existing listeners to prevent duplicates
    categoryButtons.forEach(button => {
        // Create a new button with same properties to clear event listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Add fresh event listeners to the new buttons
    const freshButtons = document.querySelectorAll('#product-category-buttons .select-button');
    freshButtons.forEach(button => {
        const catId = button.dataset.value;
        button.addEventListener('click', function () {
            // Remove selected class from all buttons
            freshButtons.forEach(btn => {
                btn.classList.remove('selected');
            });
            // Add selected class to clicked button
            this.classList.add('selected');
            // Update the hidden select element
            document.getElementById('product-category').value = catId;
        });
    });
}

// Function to update category button selection based on value
function updateCategoryButtonSelection(value) {
    const categoryButtonsContainer = document.getElementById('product-category-buttons');
    if (!categoryButtonsContainer) return;

    const allButtons = categoryButtonsContainer.querySelectorAll('.select-button');

    // Remove selected class from all buttons
    allButtons.forEach(btn => {
        btn.classList.remove('selected');
    });

    // Find and select the button with matching value
    allButtons.forEach(btn => {
        if (btn.dataset.value === value) {
            btn.classList.add('selected');
        }
    });

    // Also update the hidden select
    const productCategorySelect = document.getElementById('product-category');
    productCategorySelect.value = value;
}

// Isi Select Metode Pembayaran
function populatePaymentMethodSelect() {
    if (!paymentMethodSelect) return;
    paymentMethodSelect.innerHTML = '';

    paymentMethods
        .filter(method => method.status === 'Aktif')
        .forEach(method => {
            const option = document.createElement('option');
            option.value = method.id;
            option.textContent = method.name;
            paymentMethodSelect.appendChild(option);
        });
}

// Tambah Produk
function addProduct() {
    document.getElementById('product-modal-title').textContent = 'Tambah Produk';
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-image').value = '';
    document.getElementById('product-status').value = 'Aktif';

    // Reset button selections for the add form
    const categoryButtons = document.querySelectorAll('#product-category-buttons .select-button');
    categoryButtons.forEach(btn => btn.classList.remove('selected'));

    const productStatusButtons = document.querySelectorAll('#product-status-buttons .status-select-button');
    productStatusButtons.forEach(btn => {
        btn.classList.remove('aktif', 'nonaktif');
        if (btn.dataset.value === 'Aktif') {
            btn.classList.add('aktif');
        }
    });

    // Clear the category selection in hidden select
    document.getElementById('product-category').value = '';

    productModal.classList.add('active');
    productForm.dataset.editingId = '';
}

// Edit Produk
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-image').value = product.image || '';

    // Set status
    document.getElementById('product-status').value = product.status;

    // Update the buttons to reflect the current values
    updateButtonSelections('product', product);

    // Update category button selection specifically
    updateCategoryButtonSelection(product.category);

    // Set kategori in hidden select
    setTimeout(() => {
        document.getElementById('product-category').value = product.category;
    }, 0);

    productModal.classList.add('active');

    // Simpan ID produk yang sedang diedit
    productForm.dataset.editingId = id;
}

// Hapus Produk
async function deleteProduct(id) {
    if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
        try {
            await deleteProductFromSheet(id);
            products = products.filter(p => p.id !== id);
            renderProductTable();
            renderProducts();
            alert('Produk berhasil dihapus');
        } catch (error) {
            console.error('Error menghapus produk:', error);
            alert('Gagal menghapus produk');
        }
    }
}

// Tambah Kategori
function addCategory() {
    document.getElementById('category-modal-title').textContent = 'Tambah Kategori';
    document.getElementById('category-name').value = '';
    document.getElementById('category-order').value = '';
    document.getElementById('category-status').value = 'Aktif';

    // Reset button selections for the add form
    const categoryStatusButtons = document.querySelectorAll('#category-status-buttons .status-select-button');
    categoryStatusButtons.forEach(btn => {
        btn.classList.remove('aktif', 'nonaktif');
        if (btn.dataset.value === 'Aktif') {
            btn.classList.add('aktif');
        }
    });

    categoryModal.classList.add('active');
    categoryForm.dataset.editingId = '';
}

// Edit Kategori
function editCategory(id) {
    const category = categories.find(c => c.id === id);
    if (!category) return;

    document.getElementById('category-modal-title').textContent = 'Edit Kategori';
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-order').value = category.order;
    document.getElementById('category-status').value = category.status;

    // Update the buttons to reflect the current values
    updateButtonSelections('category', category);

    categoryModal.classList.add('active');

    // Simpan ID kategori yang sedang diedit
    categoryForm.dataset.editingId = id;
}

// Hapus Kategori
async function deleteCategory(id) {
    // Cek apakah kategori digunakan oleh produk
    const isUsed = products.some(p => p.category === id);

    if (isUsed) {
        alert('Kategori ini sedang digunakan oleh produk dan tidak dapat dihapus.');
        return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus kategori ini?')) {
        try {
            await deleteCategoryFromSheet(id);
            categories = categories.filter(c => c.id !== id);
            renderCategoryTable();
            populateCategorySelect();
            alert('Kategori berhasil dihapus');
        } catch (error) {
            console.error('Error menghapus kategori:', error);
            alert('Gagal menghapus kategori');
        }
    }
}

// Tambah Metode Pembayaran
function addPaymentMethod() {
    document.getElementById('payment-modal-title').textContent = 'Tambah Metode Pembayaran';
    document.getElementById('payment-name').value = '';
    document.getElementById('payment-type').value = 'Tunai';
    document.getElementById('payment-status').value = 'Aktif';

    // Reset button selections for the add form
    const paymentTypeButtons = document.querySelectorAll('#payment-type-buttons .select-button');
    paymentTypeButtons.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.value === 'Tunai') {
            btn.classList.add('selected');
        }
    });

    const paymentStatusButtons = document.querySelectorAll('#payment-status-buttons .status-select-button');
    paymentStatusButtons.forEach(btn => {
        btn.classList.remove('aktif', 'nonaktif');
        if (btn.dataset.value === 'Aktif') {
            btn.classList.add('aktif');
        }
    });

    paymentModal.classList.add('active');
    paymentForm.dataset.editingId = '';
}

// Edit Metode Pembayaran
function editPaymentMethod(id) {
    const method = paymentMethods.find(m => m.id === id);
    if (!method) return;

    document.getElementById('payment-modal-title').textContent = 'Edit Metode Pembayaran';
    document.getElementById('payment-name').value = method.name;
    document.getElementById('payment-type').value = method.type;
    document.getElementById('payment-status').value = method.status;

    // Update the buttons to reflect the current values
    updateButtonSelections('payment', method);

    paymentModal.classList.add('active');

    // Simpan ID metode yang sedang diedit
    paymentForm.dataset.editingId = id;
}

// Hapus Metode Pembayaran
async function deletePaymentMethod(id) {
    if (confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
        try {
            await deletePaymentMethodFromSheet(id);
            paymentMethods = paymentMethods.filter(m => m.id !== id);
            renderPaymentTable();
            populatePaymentMethodSelect();
            alert('Metode pembayaran berhasil dihapus');
        } catch (error) {
            console.error('Error menghapus metode pembayaran:', error);
            alert('Gagal menghapus metode pembayaran');
        }
    }
}

// Hitung Kembalian
function calculateChange() {
    const total = parseFloat(cartTotal.textContent.replace(/[^\d]/g, '')) || 0;
    const amountPaid = parseFloat(amountPaidInput.value) || 0;
    const change = amountPaid - total;

    changeAmountSpan.textContent = formatRupiah(change >= 0 ? change : 0);
}

// Proses Pembayaran
async function processPayment() {
    const total = parseFloat(cartTotal.textContent.replace(/[^\d]/g, '')) || 0;
    const amountPaid = parseFloat(amountPaidInput.value) || selectedPaymentAmount || 0;

    // Validate payment method
    if (!selectedPaymentMethod) {
        alert('Silakan pilih metode pembayaran!');
        return;
    }

    // Validate payment amount
    if (amountPaid <= 0) {
        alert('Silakan pilih jumlah pembayaran atau masukkan jumlah manual!');
        return;
    }

    if (amountPaid < total) {
        alert('Uang yang dibayarkan kurang dari total belanja!');
        return;
    }

    try {
        showLoading(confirmPaymentBtn, confirmPaymentText);

        // Buat transaksi
        const transactionId = 'INV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000);

        // Use selected payment method
        const paymentMethod = selectedPaymentMethod;

        // Hitung subtotal tanpa diskon
        const subtotal = state.cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

        // Simpan transaksi ke localStorage untuk Detail Transaksi
        if (typeof saveTransactionToLocalStorage === 'function' && state.cart && Array.isArray(state.cart) && state.cart.length > 0) {
            saveTransactionToLocalStorage(transactionId, total, paymentMethod, state.cart);
        }

        // Data transaksi
        const transaction = {
            id: transactionId,
            tanggal: new Date().toISOString(),
            total_penjualan: subtotal,
            diskon: 0,
            subtotal: total,
            id_metode: paymentMethod.id,
            jumlah_bayar: amountPaid,
            kembalian: amountPaid - total,
            nama_kasir: state.user.name
        };

        // Data detail transaksi
        const details = state.cart.map(item => ({
            id_detail: generateId('DET'),
            id_transaksi: transactionId,
            id_produk: item.id,
            nama_produk: item.name,
            harga_satuan: item.price,
            kuantitas: item.quantity,
            total_item: item.price * item.quantity,
            catatan_item: ''
        }));

        // Simpan transaksi ke Google Sheets
        await saveTransaction(transaction, details);

        // Create success message without change composition
        const change = amountPaid - total;
        let successMessage = `<p><strong>Transaksi ${transactionId} berhasil!</strong></p>`;
        successMessage += `<div class="success-details">`;
        successMessage += `<p>Total: ${formatRupiah(total)}</p>`;
        successMessage += `<p>Bayar: ${formatRupiah(amountPaid)}</p>`;

        if (change === 0) {
            successMessage += `<p>Kembalian: Uang Pas / Tidak Ada Kembalian</p>`;
        } else {
            successMessage += `<p>Kembalian: ${formatRupiah(change)}</p>`;
        }

        successMessage += `<p>Metode: ${paymentMethod.name}</p>`;
        successMessage += `</div>`;

        // Display success modal
        const successMessageElement = document.getElementById('success-message');
        const successModal = document.getElementById('success-modal');
        successMessageElement.innerHTML = successMessage;
        successModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Reset keranjang and update state
        updateState({ cart: [] });
        renderCart();

        // Update session data since cart has changed
        if (state.user) {
            saveSessionData();
        }

        // Tutup checkout modal
        checkoutModal.classList.remove('active');
    } catch (error) {
        console.error('Error menyimpan transaksi:', error);
        alert('Gagal menyimpan transaksi. Silakan coba lagi.');
    } finally {
        hideLoading(confirmPaymentBtn, confirmPaymentText, 'Bayar');
    }
}

// Check if user session is valid
function isSessionValid() {
    // Check if user data exists and is valid
    if (!state.user || !state.user.name) return false;

    // Check if session hasn't expired (24 hours)
    const sessionTimestamp = state.sessionTimestamp || Date.now();
    const sessionAge = Date.now() - sessionTimestamp;
    return sessionAge < SESSION_TIMEOUT;
}

// Initialize app when DOM is loaded (enhanced with comprehensive state management)
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM Content Loaded - Initializing application...');

    try {
        // Initialize Google APIs first
        if (typeof gapi !== 'undefined') {
            gapiLoaded();
        } else {
            console.log('GAPI not loaded yet');
        }

        if (typeof google !== 'undefined' && typeof google.accounts !== 'undefined') {
            gisLoaded();
        } else {
            console.log('GIS not loaded yet');
        }

        // Hide bottom navigation initially (login page)
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }

        // Set initial state
        updateState({
            currentPage: 'kasir',
            loading: false,
            error: null,
            sessionTimestamp: Date.now(),
            cart: [], // Ensure cart is initialized as empty array
            products: [],
            categories: [],
            paymentMethods: [],
            transactions: []
        });

        // Sync legacy variables after initialization
        syncLegacyVariables();

        // Login dengan Google (only add listener if button exists)
        if (loginBtn) {
            loginBtn.addEventListener('click', handleAuthClick);
        }

        console.log('Application initialization completed');

    } catch (error) {
        console.error('Error during DOM Content Loaded initialization:', error);
        showError('Terjadi kesalahan saat memuat aplikasi: ' + error.message);
    }

    // Logout
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Apakah Anda yakin ingin logout?')) {
            handleSignout();
        }
    });

    // Navigasi antar halaman
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            if (item.id === 'logout-btn') return;

            const targetPage = item.getAttribute('data-page');

            // Update navigasi aktif
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Tampilkan halaman yang sesuai
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(targetPage).classList.add('active');

            // Update user info di halaman keranjang mobile
            if (targetPage === 'keranjang-mobile-page' && currentUser) {
                userAvatarKeranjang.textContent = currentUser.avatar;
                userNameKeranjang.textContent = currentUser.name;
                // Update mobile cart with current state
                updateMobileCart();
            }

            // Always update mobile cart badge when navigating
            if (currentUser) {
                updateMobileCart();
            }

            // Special handling for pengaturan page to maintain active tab
            if (targetPage === 'pengaturan-page') {
                // Show default tab (produk) if no active tab is found
                const activeTab = document.querySelector('.tab-content.active');
                if (!activeTab) {
                    document.querySelector('.tab-content').classList.add('active');
                    document.querySelector('.tab-btn').classList.add('active');
                }
            }
        });
    });


    // Tab pengaturan - use safe DOM element access
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContentElements = document.querySelectorAll('.tab-content');

    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                // Update tab aktif
                tabButtons.forEach(tab => tab.classList.remove('active'));
                btn.classList.add('active');

                // Tampilkan konten tab yang sesuai
                tabContentElements.forEach(content => {
                    content.classList.remove('active');
                });

                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // Ensure pengaturan page remains active in bottom nav
                const navItems = document.querySelectorAll('.nav-item');
                navItems.forEach(nav => {
                    if (nav.getAttribute('data-page') === 'pengaturan-page') {
                        nav.classList.add('active');
                    } else {
                        nav.classList.remove('active');
                    }
                });
            });
        });
    }

    // Tombol tambah
    addProductBtn.addEventListener('click', addProduct);
    addCategoryBtn.addEventListener('click', addCategory);
    addPaymentBtn.addEventListener('click', addPaymentMethod);

    // Tombol checkout
    checkoutBtn.addEventListener('click', () => {
        if (!state.cart || state.cart.length === 0) {
            alert('Keranjang kosong!');
            return;
        }

        const total = parseFloat(cartTotal.textContent.replace(/[^\d]/g, '')) || 0;
        checkoutTotalSpan.textContent = cartTotal.textContent;

        // Reset payment form
        amountPaidInput.value = '';
        selectedPaymentAmount = 0;
        paymentResult.style.display = 'none';
        if (changeBreakdown) changeBreakdown.style.display = 'none';

        // Generate and render payment suggestions
        renderPaymentSuggestions(total);

        checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Mencegah scroll pada background
    });

    // Tombol checkout mobile
    checkoutBtnMobile.addEventListener('click', () => {
        if (!state.cart || state.cart.length === 0) {
            alert('Keranjang kosong!');
            return;
        }

        const total = parseFloat(cartTotal.textContent.replace(/[^\d]/g, '')) || 0;
        checkoutTotalSpan.textContent = cartTotal.textContent;

        // Reset payment form
        amountPaidInput.value = '';
        selectedPaymentAmount = 0;
        paymentResult.style.display = 'none';
        if (changeBreakdown) changeBreakdown.style.display = 'none';

        // Generate and render payment suggestions
        renderPaymentSuggestions(total);

        checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Mencegah scroll pada background
    });

    // Tombol batal (hapus keranjang)
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin menghapus semua item di keranjang?')) {
                clearCart();
            }
        });
    }

    // Tombol batal mobile (hapus keranjang)
    if (cancelBtnMobile) {
        cancelBtnMobile.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin menghapus semua item di keranjang?')) {
                clearCart();
            }
        });
    }

    // Form produk
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = parseInt(document.getElementById('product-price').value);
        const description = document.getElementById('product-description').value;
        const image = document.getElementById('product-image').value;
        const status = document.getElementById('product-status').value;

        try {
            showLoading(saveProductBtn, productSaveText);

            if (productForm.dataset.editingId) {
                // Edit produk yang ada
                const id = productForm.dataset.editingId;
                const index = products.findIndex(p => p.id === id);

                if (index !== -1) {
                    const updatedProduct = {
                        ...products[index],
                        name,
                        category,
                        price,
                        description,
                        image,
                        status
                    };

                    await saveProduct(updatedProduct, false);
                    products[index] = updatedProduct;
                }

                delete productForm.dataset.editingId;
            } else {
                // Tambah produk baru
                const newProduct = {
                    id: generateId('PRD'),
                    name,
                    category,
                    price,
                    description,
                    image,
                    status
                };

                await saveProduct(newProduct, true);
                products.push(newProduct);
            }

            renderProductTable();
            renderProducts();
            productModal.classList.remove('active');
            alert('Produk berhasil disimpan');
        } catch (error) {
            console.error('Error menyimpan produk:', error);
            alert('Gagal menyimpan produk. Silakan coba lagi.');
        } finally {
            hideLoading(saveProductBtn, productSaveText, 'Simpan');
        }
    });

    // Form kategori
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('category-name').value;
        const order = parseInt(document.getElementById('category-order').value);
        const status = document.getElementById('category-status').value;

        try {
            showLoading(saveCategoryBtn, categorySaveText);

            if (categoryForm.dataset.editingId) {
                // Edit kategori yang ada
                const id = categoryForm.dataset.editingId;
                const index = categories.findIndex(c => c.id === id);

                if (index !== -1) {
                    const updatedCategory = {
                        ...categories[index],
                        name,
                        order,
                        status
                    };

                    await saveCategory(updatedCategory, false);
                    categories[index] = updatedCategory;
                }

                delete categoryForm.dataset.editingId;
            } else {
                // Tambah kategori baru
                const newCategory = {
                    id: generateId('KAT'),
                    name,
                    order,
                    status
                };

                await saveCategory(newCategory, true);
                categories.push(newCategory);
            }

            renderCategoryTable();
            populateCategorySelect();
            categoryModal.classList.remove('active');
            alert('Kategori berhasil disimpan');
        } catch (error) {
            console.error('Error menyimpan kategori:', error);
            alert('Gagal menyimpan kategori. Silakan coba lagi.');
        } finally {
            hideLoading(saveCategoryBtn, categorySaveText, 'Simpan');
        }
    });

    // Form metode pembayaran
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('payment-name').value;
        const type = document.getElementById('payment-type').value;
        const status = document.getElementById('payment-status').value;

        try {
            showLoading(savePaymentBtn, paymentSaveText);

            if (paymentForm.dataset.editingId) {
                // Edit metode yang ada
                const id = paymentForm.dataset.editingId;
                const index = paymentMethods.findIndex(m => m.id === id);

                if (index !== -1) {
                    const updatedMethod = {
                        ...paymentMethods[index],
                        name,
                        type,
                        status
                    };

                    await savePaymentMethod(updatedMethod, false);
                    paymentMethods[index] = updatedMethod;
                }

                delete paymentForm.dataset.editingId;
            } else {
                // Tambah metode baru
                const newMethod = {
                    id: generateId('MTH'),
                    name,
                    type,
                    status
                };

                await savePaymentMethod(newMethod, true);
                paymentMethods.push(newMethod);
            }

            renderPaymentTable();
            populatePaymentMethodSelect();
            paymentModal.classList.remove('active');
            alert('Metode pembayaran berhasil disimpan');
        } catch (error) {
            console.error('Error menyimpan metode pembayaran:', error);
            alert('Gagal menyimpan metode pembayaran. Silakan coba lagi.');
        } finally {
            hideLoading(savePaymentBtn, paymentSaveText, 'Simpan');
        }
    });

    // Tutup modal
    document.getElementById('close-product-modal').addEventListener('click', () => {
        productModal.classList.remove('active');
    });

    document.getElementById('close-category-modal').addEventListener('click', () => {
        categoryModal.classList.remove('active');
    });

    document.getElementById('close-payment-modal').addEventListener('click', () => {
        paymentModal.classList.remove('active');
    });

    document.getElementById('cancel-product').addEventListener('click', () => {
        productModal.classList.remove('active');
    });

    document.getElementById('cancel-category').addEventListener('click', () => {
        categoryModal.classList.remove('active');
    });

    document.getElementById('cancel-payment').addEventListener('click', () => {
        paymentModal.classList.remove('active');
    });

    // Search functionality for settings page
    document.getElementById('product-search').addEventListener('input', (e) => {
        filterTable('product-table-body', e.target.value, ['name', 'category']);
    });

    document.getElementById('category-search').addEventListener('input', (e) => {
        filterTable('category-table-body', e.target.value, ['name']);
    });

    document.getElementById('payment-search').addEventListener('input', (e) => {
        filterTable('payment-table-body', e.target.value, ['name', 'type']);
    });

    // Payment modal event listeners
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', processPayment);
    }

    if (amountPaidInput) {
        amountPaidInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value) || 0;

            // Remove selected class from all amount options
            if (paymentAmountOptions) {
                paymentAmountOptions.querySelectorAll('.payment-amount-option').forEach(option => {
                    option.classList.remove('selected');
                });
            }

            // Reset selected payment amount
            selectedPaymentAmount = 0;

            // Calculate and display result if value is entered
            if (value > 0) {
                calculateAndDisplayPaymentResult(value);
            } else {
                // Hide payment result if no value
                if (paymentResult) {
                    paymentResult.style.display = 'none';
                }
            }
        });
    }

    // Close modal event listeners
    const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
    if (closeCheckoutModalBtn) {
        closeCheckoutModalBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    const cancelCheckoutBtn = document.getElementById('cancel-checkout');
    if (cancelCheckoutBtn) {
        cancelCheckoutBtn.addEventListener('click', () => {
            checkoutModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    // Close success modal event listener
    const closeSuccessModalBtn = document.getElementById('close-success-modal');
    if (closeSuccessModalBtn) {
        closeSuccessModalBtn.addEventListener('click', () => {
            const successModal = document.getElementById('success-modal');
            successModal?.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    // Add event listener for the back to cashier button
    const backToCashierBtn = document.getElementById('back-to-cashier-btn');

    if (backToCashierBtn) {
        backToCashierBtn.addEventListener('click', () => {
            // Return to cashier page
            const cartPage = document.getElementById('keranjang-mobile-page');
            const cashierPage = document.getElementById('kasir-page');
            const navItems = document.querySelectorAll('.nav-item');

            if (cartPage && cashierPage) {
                // Hide cart page and show cashier page
                cartPage.classList.remove('active');
                cashierPage.classList.add('active');

                // Update navigation active states
                navItems.forEach(item => {
                    if (item.getAttribute('data-page') === 'kasir-page') {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
            }
        });
    }

    // Initialize button-based selections
    initializeSelectButtons();
});

// Search filter function
function filterTable(tableBodyId, searchTerm, searchColumns) {
    const tableBody = document.getElementById(tableBodyId);
    const rows = tableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let shouldShow = false;

        searchColumns.forEach(columnIndex => {
            let cellIndex;
            if (tableBodyId === 'product-table-body') {
                cellIndex = columnIndex === 'name' ? 0 : columnIndex === 'category' ? 1 : 0;
            } else if (tableBodyId === 'category-table-body') {
                cellIndex = 0; // name column
            } else if (tableBodyId === 'payment-table-body') {
                cellIndex = columnIndex === 'name' ? 0 : columnIndex === 'type' ? 1 : 0;
            }

            if (cells[cellIndex]) {
                const cellText = cells[cellIndex].textContent.toLowerCase();
                if (cellText.includes(searchTerm.toLowerCase())) {
                    shouldShow = true;
                }
            }
        });

        row.style.display = shouldShow ? '' : 'none';
    });
}

// Function to initialize button-based selections
function initializeSelectButtons() {
    // Initialize status buttons for product modal
    const productStatusButtons = document.querySelectorAll('#product-status-buttons .status-select-button');
    productStatusButtons.forEach(button => {
        // Remove existing listeners to prevent duplication
        if (button.parentNode) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        }
    });

    // Reattach event listeners to the new buttons
    const newProductStatusButtons = document.querySelectorAll('#product-status-buttons .status-select-button');
    newProductStatusButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove selected class from all buttons
            const allButtons = document.querySelectorAll('#product-status-buttons .status-select-button');
            allButtons.forEach(btn => btn.classList.remove('aktif', 'nonaktif'));
            // Add appropriate class based on selection
            if (this.dataset.value === 'Aktif') {
                this.classList.add('aktif');
            } else {
                this.classList.add('nonaktif');
            }
            // Update the hidden select element
            document.getElementById('product-status').value = this.dataset.value;
        });
    });

    // Initialize status buttons for category modal
    const categoryStatusButtons = document.querySelectorAll('#category-status-buttons .status-select-button');
    categoryStatusButtons.forEach(button => {
        // Remove existing listeners to prevent duplication
        if (button.parentNode) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        }
    });

    // Reattach event listeners to the new buttons
    const newCategoryStatusButtons = document.querySelectorAll('#category-status-buttons .status-select-button');
    newCategoryStatusButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove selected class from all buttons
            const allButtons = document.querySelectorAll('#category-status-buttons .status-select-button');
            allButtons.forEach(btn => btn.classList.remove('aktif', 'nonaktif'));
            // Add appropriate class based on selection
            if (this.dataset.value === 'Aktif') {
                this.classList.add('aktif');
            } else {
                this.classList.add('nonaktif');
            }
            // Update the hidden select element
            document.getElementById('category-status').value = this.dataset.value;
        });
    });

    // Initialize type buttons for payment modal
    const paymentTypeButtons = document.querySelectorAll('#payment-type-buttons .select-button');
    paymentTypeButtons.forEach(button => {
        // Remove existing listeners to prevent duplication
        if (button.parentNode) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        }
    });

    // Reattach event listeners to the new buttons
    const newPaymentTypeButtons = document.querySelectorAll('#payment-type-buttons .select-button');
    newPaymentTypeButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove selected class from all buttons
            const allButtons = document.querySelectorAll('#payment-type-buttons .select-button');
            allButtons.forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked button
            this.classList.add('selected');
            // Update the hidden select element
            document.getElementById('payment-type').value = this.dataset.value;
        });
    });

    // Initialize status buttons for payment modal
    const paymentStatusButtons = document.querySelectorAll('#payment-status-buttons .status-select-button');
    paymentStatusButtons.forEach(button => {
        // Remove existing listeners to prevent duplication
        if (button.parentNode) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        }
    });

    // Reattach event listeners to the new buttons
    const newPaymentStatusButtons = document.querySelectorAll('#payment-status-buttons .status-select-button');
    newPaymentStatusButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove selected class from all buttons
            const allButtons = document.querySelectorAll('#payment-status-buttons .status-select-button');
            allButtons.forEach(btn => btn.classList.remove('aktif', 'nonaktif'));
            // Add appropriate class based on selection
            if (this.dataset.value === 'Aktif') {
                this.classList.add('aktif');
            } else {
                this.classList.add('nonaktif');
            }
            // Update the hidden select element
            document.getElementById('payment-status').value = this.dataset.value;
        });
    });
}

// Function to update button selections when loading edit forms
function updateButtonSelections(formType, data) {
    switch (formType) {
        case 'product':
            // Update category selection - use the dedicated function
            if (data.category) {
                updateCategoryButtonSelection(data.category);
            }

            // Update status selection
            const productStatusButtons = document.querySelectorAll('#product-status-buttons .status-select-button');
            productStatusButtons.forEach(button => {
                if (button.dataset.value === data.status) {
                    if (data.status === 'Aktif') {
                        button.classList.add('aktif');
                        button.classList.remove('nonaktif');
                    } else {
                        button.classList.add('nonaktif');
                        button.classList.remove('aktif');
                    }
                    document.getElementById('product-status').value = data.status;
                } else {
                    button.classList.remove('aktif', 'nonaktif');
                }
            });
            break;

        case 'category':
            // Update category status selection
            const categoryStatusButtons = document.querySelectorAll('#category-status-buttons .status-select-button');
            categoryStatusButtons.forEach(button => {
                if (button.dataset.value === data.status) {
                    if (data.status === 'Aktif') {
                        button.classList.add('aktif');
                        button.classList.remove('nonaktif');
                    } else {
                        button.classList.add('nonaktif');
                        button.classList.remove('aktif');
                    }
                    document.getElementById('category-status').value = data.status;
                } else {
                    button.classList.remove('aktif', 'nonaktif');
                }
            });
            break;

        case 'payment':
            // Update payment type selection
            const paymentTypeButtons = document.querySelectorAll('#payment-type-buttons .select-button');
            paymentTypeButtons.forEach(button => {
                if (button.dataset.value === data.type) {
                    button.classList.add('selected');
                    document.getElementById('payment-type').value = data.type;
                } else {
                    button.classList.remove('selected');
                }
            });

            // Update payment status selection
            const paymentStatusButtons = document.querySelectorAll('#payment-status-buttons .status-select-button');
            paymentStatusButtons.forEach(button => {
                if (button.dataset.value === data.status) {
                    if (data.status === 'Aktif') {
                        button.classList.add('aktif');
                        button.classList.remove('nonaktif');
                    } else {
                        button.classList.add('nonaktif');
                        button.classList.remove('aktif');
                    }
                    document.getElementById('payment-status').value = data.status;
                } else {
                    button.classList.remove('aktif', 'nonaktif');
                }
            });
            break;
    }
}

// Konfirmasi pembayaran
confirmPaymentBtn.addEventListener('click', processPayment);

// Save session data to localStorage (enhanced with comprehensive state)
function saveSessionData(userData = null) {
    try {
        const sessionData = {
            user: userData || state.user,
            token: state.token,
            sessionTimestamp: Date.now(), // Use consistent timestamp field
            timestamp: Date.now(), // Keep for backward compatibility
            cart: state.cart,
            currentPage: state.currentPage,
            isLoggedIn: state.isLoggedIn,
            // Store essential app data for quick restoration
            products: state.products,
            categories: state.categories,
            paymentMethods: state.paymentMethods,
            transactions: state.transactions
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        console.log('Session data saved successfully');
    } catch (error) {
        console.error('Error saving session data:', error);
        showError('Gagal menyimpan data sesi');
    }
}

// Load session data from localStorage (enhanced with comprehensive state restoration)
function loadSessionData() {
    try {
        const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionData) {
            const parsedData = JSON.parse(sessionData);

            // Use sessionTimestamp if available, otherwise fall back to timestamp for backward compatibility
            const timestampField = parsedData.sessionTimestamp || parsedData.timestamp || Date.now();

            // Check if session is still valid (not expired)
            if (Date.now() - timestampField < SESSION_TIMEOUT) {
                console.log('Valid session data found');
                return parsedData;
            } else {
                console.log('Session expired, removing');
                localStorage.removeItem(SESSION_STORAGE_KEY);
                return null;
            }
        }
        console.log('No session data found');
        return null;
    } catch (error) {
        console.error('Error parsing session data:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        showError('Error memuat data sesi');
        return null;
    }
}

// Clear session data from localStorage
function clearSessionData() {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        console.log('Session data cleared');
    } catch (error) {
        console.error('Error clearing session data:', error);
    }
}

// Restore session if available (enhanced with comprehensive state management)
async function restoreSession() {
    console.log('Attempting to restore session...');

    try {
        const sessionData = loadSessionData();
        if (!sessionData) {
            console.log('No session data to restore');
            return false;
        }

        // Check if Google API is ready before proceeding
        if (!state.gapiInited || !state.gisInited) {
            console.log('Google API not ready, initializing...');
            showLoading();

            // Wait for API initialization with timeout
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds timeout

            while ((!state.gapiInited || !state.gisInited) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            hideLoading();

            if (!state.gapiInited || !state.gisInited) {
                console.log('Google API still not ready after timeout');
                showError('Google API tidak siap. Silakan refresh halaman.');
                return false;
            }
        }

        // Validate session data structure
        if (!sessionData.user || !sessionData.sessionTimestamp) {
            console.log('Invalid session data structure');
            clearSessionData();
            return false;
        }

        // Check if session hasn't expired (be more lenient during restoration)
        const sessionAge = Date.now() - sessionData.sessionTimestamp;
        if (sessionAge >= SESSION_TIMEOUT) {
            console.log('Session expired, clearing data');
            clearSessionData();

            // Show session expiry message
            if (loginStatus) {
                loginStatus.textContent = 'Sesi telah kedaluwarsa. Silakan login kembali.';
                loginStatus.style.color = 'var(--danger-color)';
            }

            return false;
        }

        // For browser refresh, don't be strict about Google token
        // The token might not be loaded yet, but our session data is valid
        console.log('Valid session data found, attempting restoration...');

        // Try to restore Google token if we have one stored
        if (sessionData.token && gapi.client) {
            try {
                gapi.client.setToken({ access_token: sessionData.token });
                console.log('Google token restored from session storage');
            } catch (tokenError) {
                console.log('Could not restore Google token, will need fresh authentication');
            }
        }

        // Restore state from session data
        updateState({
            user: sessionData.user,
            token: sessionData.token,
            isLoggedIn: true,
            sessionTimestamp: sessionData.sessionTimestamp || Date.now(),
            cart: sessionData.cart || [],
            currentPage: sessionData.currentPage || 'kasir',
            products: sessionData.products || [],
            categories: sessionData.categories || [],
            paymentMethods: sessionData.paymentMethods || [],
            transactions: sessionData.transactions || []
        });

        // Ensure cart is properly initialized
        if (!Array.isArray(state.cart)) {
            updateState({ cart: [] });
        }

        // Update UI with user information
        updateUserInterface();

        try {
            // Try to refresh/validate data from Google Sheets
            console.log('Attempting to load fresh data from Google Sheets...');
            showLoading();

            // First check if we can access Google Sheets
            await loadAllData();

            hideLoading();

            // Show the main application
            showMainApplication();

            console.log('Session restored successfully with fresh data');
            return true;

        } catch (error) {
            console.error('Error loading fresh data:', error);
            hideLoading();

            // Handle different types of errors
            if (error.status === 401 || error.result?.error?.code === 401) {
                console.log('Session expired during data restore - redirecting to login');
                // Session expired, redirect to login
                handleAuthError();
                return false;
            } else if (error.status === 403) {
                console.log('Authentication error - insufficient permissions');
                showError('Izin akses tidak mencukupi. Silakan login kembali.');
                // Still show the app but user will need to login again
                showMainApplication();
                return true;
            } else if (error.status === 404) {
                console.log('Spreadsheet not found');
                showError('Spreadsheet tidak ditemukan. Periksa konfigurasi.');
                // Still show the app but with limited functionality
                showMainApplication();
                return true;
            } else {
                console.log('Other error during data load, using cached data');
                // Show the app with cached data instead of failing completely
                showMainApplication();
                return true;
            }
        }

    } catch (error) {
        console.error('Unexpected error during session restore:', error);
        hideLoading();
        showError('Terjadi kesalahan saat memulihkan sesi. Silakan login kembali.');
        clearSessionData();
        return false;
    }
}


// Update user interface elements
function updateUserInterface() {
    if (!state.user) return;

    console.log('Updating user interface with Google data:', state.user);

    // Update all user avatar and name elements
    const avatarElements = [
        'user-avatar', 'user-avatar-settings', 'user-avatar-keranjang'
    ];

    const nameElements = [
        'user-name', 'user-name-settings', 'user-name-keranjang'
    ];

    // Use simple avatar initials (no external image requests)
    const avatarInitial = state.user.avatar || state.user.name.charAt(0).toUpperCase();

    avatarElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Simple avatar display - just initials
            element.textContent = avatarInitial;
            element.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: var(--primary-color);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 1.2rem;
            `;
            console.log('Updated avatar for', id, 'with:', avatarInitial);
        }
    });

    nameElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = state.user.name;
            console.log('Updated name for', id, 'with:', state.user.name);
        }
    });

    console.log('User interface updated successfully');
}

// Show main application and hide login
function showMainApplication() {
    // Hide login page
    if (loginPage) loginPage.classList.remove('active');

    // Show appropriate page based on current state
    switch (state.currentPage) {
        case 'kasir':
            if (kasirPage) kasirPage.classList.add('active');
            break;
        case 'pengaturan':
            if (pengaturanPage) pengaturanPage.classList.add('active');
            break;
        case 'keranjang-mobile':
            if (keranjangMobilePage) keranjangMobilePage.classList.add('active');
            break;
        default:
            if (kasirPage) kasirPage.classList.add('active');
    }

    // Show bottom navigation
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'flex';
    }

    // Render cart if exists
    renderCart();

    console.log('Main application shown');
}

// Handle authentication errors and session expiry
function handleAuthError() {
    console.log('Handling authentication error/session expiry...');

    // Clear Google token
    const token = gapi.client.getToken();
    if (token && token.access_token) {
        try {
            google.accounts.oauth2.revoke(token.access_token);
            console.log('Google token revoked successfully');
        } catch (error) {
            console.error('Error revoking token:', error);
        }
        gapi.client.setToken('');
    }

    // Clear session data
    clearSessionData();

    // Reset state completely
    updateState({
        user: null,
        token: null,
        isLoggedIn: false,
        cart: [],
        products: [],
        categories: [],
        paymentMethods: [],
        transactions: [],
        currentPage: 'kasir',
        loading: false,
        error: null,
        gapiInited: false,
        gisInited: false
    });

    // Update UI immediately - show login page
    if (loginPage) loginPage.classList.add('active');
    if (kasirPage) kasirPage.classList.remove('active');
    if (pengaturanPage) pengaturanPage.classList.remove('active');
    if (keranjangMobilePage) keranjangMobilePage.classList.remove('active');

    // Hide bottom navigation
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }

    // Clear user interface elements
    const avatarElements = ['user-avatar', 'user-avatar-settings', 'user-avatar-keranjang'];
    const nameElements = ['user-name', 'user-name-settings', 'user-name-keranjang'];

    avatarElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '';
    });

    nameElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '';
    });

    // Show clear session expiry message
    if (loginStatus) {
        loginStatus.textContent = 'Sesi telah kedaluwarsa. Silakan login kembali.';
        loginStatus.style.color = 'var(--danger-color)';
        setTimeout(() => {
            loginStatus.textContent = '';
            loginStatus.style.color = '';
        }, 5000);
    }

    // Add visual feedback for session expiry
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) {
        loginContainer.style.border = '2px solid var(--danger-color)';
        loginContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
        setTimeout(() => {
            loginContainer.style.border = '';
            loginContainer.style.backgroundColor = '';
        }, 5000);
    }

    console.log('Authentication error handled - redirected to login');
}

// Enhanced API error handler with automatic session expiry detection
function handleApiError(error, operation = 'API operation') {
    console.error(`Error in ${operation}:`, error);

    // Check if it's a 401 Unauthorized error (session expired) - more comprehensive detection
    const isAuthError =
        error.status === 401 ||
        error.result?.error?.code === 401 ||
        error.result?.error?.status === 'UNAUTHENTICATED' ||
        error.result?.error?.message?.includes('Request had invalid authentication credentials') ||
        error.result?.error?.message?.includes('The caller does not have permission') ||
        error.result?.error?.message?.includes('Login Required');

    if (isAuthError) {
        console.log('Session expired or authentication error detected - redirecting to login');

        // Show user feedback with more specific message
        showError('Sesi login telah kedaluwarsa atau tidak valid. Mengarahkan ke halaman login...');

        // Immediately redirect to login (no delay needed for auth errors)
        setTimeout(() => {
            handleAuthError();
        }, 1000);

        return true; // Indicates session expiry was handled
    }

    // Handle other common API errors
    if (error.status === 403) {
        showError('Akses ditolak. Anda tidak memiliki izin untuk melakukan operasi ini.');
        return false;
    }

    if (error.status === 404) {
        showError('Data tidak ditemukan. Periksa konfigurasi spreadsheet.');
        return false;
    }

    if (error.status === 429) {
        showError('Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.');
        return false;
    }

    if (error.status >= 500) {
        showError('Terjadi kesalahan server. Silakan coba lagi nanti.');
        return false;
    }

    // For other errors, show the error message
    if (error.result?.error?.message) {
        showError(`Gagal ${operation}: ${error.result.error.message}`);
    } else if (error.message) {
        showError(`Gagal ${operation}: ${error.message}`);
    } else {
        showError(`Gagal ${operation}. Silakan coba lagi.`);
    }

    return false; // Indicates other error was handled
}

// Manual payment input
amountPaidInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value) || 0;

    // Remove selected class from all suggestion buttons
    if (paymentSuggestions) {
        paymentSuggestions.querySelectorAll('.payment-suggestion-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    // Reset selected payment amount
    selectedPaymentAmount = 0;

    // Calculate and display result if value is entered
    if (value > 0) {
        calculateAndDisplayPaymentResult(value);
    } else {
        // Hide payment result if no value
        if (paymentResult) {
            paymentResult.style.display = 'none';
        }
    }

    // Close the dropdown if it was open
    const moreOptionsContent = document.getElementById('more-options-content');
    if (moreOptionsContent) {
        moreOptionsContent.classList.remove('show');
    }
});

// Global error handler for unhandled Google API errors
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // Check if it's a Google API error
    if (event.reason && event.reason.result && event.reason.result.error) {
        const error = event.reason;
        if (error.status === 401 || error.result.error.code === 401) {
            console.log('Unhandled session expiry detected - redirecting to login');
            event.preventDefault(); // Prevent the error from being logged
            handleAuthError();
        }
    }
});

// Session monitoring and validation
let sessionCheckInterval = null;

// Function to check if current session is still valid
async function validateCurrentToken() {
    try {
        if (!gapi.client.getToken()?.access_token) {
            console.log('No access token available');
            return false;
        }

        // Make a simple API call to test if token is still valid
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.spreadsheetId
        });

        return response.status === 200;
    } catch (error) {
        console.log('Token validation failed:', error);
        return false;
    }
}

// Function to start session monitoring
function startSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }

    sessionCheckInterval = setInterval(async () => {
        if (state.isLoggedIn && state.token) {
            const isValid = await validateCurrentToken();
            if (!isValid) {
                console.log('Session expired detected by monitoring - redirecting to login');
                handleAuthError();
            }
        }
    }, 60000); // Check every minute
}

// Function to stop session monitoring
function stopSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
}