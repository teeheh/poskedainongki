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
    gisInited: false,
    // Enhanced settings state
    settingsStats: {
        totalProducts: 0,
        totalCategories: 0,
        totalPaymentMethods: 0,
        totalTransactions: 0,
        totalRevenue: 0,
        todayTransactions: 0,
        todayRevenue: 0
    },
    settingsFilters: {
        produk: { search: '', status: 'all', category: 'all' },
        kategori: { search: '' },
        pembayaran: { search: '' },
        transaksi: { search: '', dateFrom: '', dateTo: '', status: 'all' }
    },
    settingsPagination: {
        produk: { page: 1, perPage: 10, total: 0 },
        kategori: { page: 1, perPage: 10, total: 0 },
        pembayaran: { page: 1, perPage: 10, total: 0 },
        transaksi: { page: 1, perPage: 10, total: 0 }
    },
    settingsSorting: {
        produk: { column: 'name', direction: 'asc' },
        kategori: { column: 'name', direction: 'asc' },
        pembayaran: { column: 'name', direction: 'asc' },
        transaksi: { column: 'date', direction: 'desc' }
    },
    bulkSelections: {
        produk: [],
        kategori: [],
        pembayaran: [],
        transaksi: []
    }
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

// Enhanced Cart Management System
const CartManager = {
    // Debounced render function to prevent excessive re-renders
    renderTimeout: null,

    // Initialize cart manager
    init() {
        this.setupEventListeners();
        this.setupStateWatchers();
        console.log('CartManager initialized');
    },

    // Setup global event listeners for cart actions
    setupEventListeners() {
        // Centralized event delegation for better performance
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Handle quantity decrease buttons
            if (target.matches('.minus-btn, .quantity-btn-mobile.minus-mobile') || target.closest('.minus-btn, .quantity-btn-mobile.minus-mobile')) {
                e.preventDefault();
                e.stopPropagation();
                const id = target.getAttribute('data-id') || target.closest('[data-id]')?.getAttribute('data-id');
                if (id) this.decreaseQuantity(id);
            }

            // Handle quantity increase buttons
            if (target.matches('.plus-btn, .quantity-btn-mobile.plus-mobile') || target.closest('.plus-btn, .quantity-btn-mobile.plus-mobile')) {
                e.preventDefault();
                e.stopPropagation();
                const id = target.getAttribute('data-id') || target.closest('[data-id]')?.getAttribute('data-id');
                if (id) this.increaseQuantity(id);
            }

            // Handle remove buttons
            if (target.matches('.remove-btn, .remove-btn-mobile') || target.closest('.remove-btn, .remove-btn-mobile')) {
                e.preventDefault();
                e.stopPropagation();
                const id = target.getAttribute('data-id') || target.closest('[data-id]')?.getAttribute('data-id');
                if (id) this.removeFromCart(id);
            }
        });
    },

    // Setup state watchers for automatic UI updates
    setupStateWatchers() {
        // Watch for cart changes and trigger debounced render
        const originalUpdateState = updateState;
        updateState = function (newState) {
            const prevCart = state.cart;
            originalUpdateState(newState);

            // Check if cart has changed
            if (JSON.stringify(prevCart) !== JSON.stringify(state.cart)) {
                CartManager.onCartChange();
            }
        };
    },

    // Handle cart state changes
    onCartChange() {
        // Clear existing timeout
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }

        // Debounce render to prevent excessive updates
        this.renderTimeout = setTimeout(() => {
            this.renderAllCartInterfaces();
            this.saveCartToSession();
        }, 50);
    },

    // Unified cart rendering for all interfaces
    renderAllCartInterfaces() {
        try {
            this.renderMainCart();
            this.renderMobileCart();
            this.renderCartPage();
            this.updateCartCount();
            this.updateCartTotals();
        } catch (error) {
            console.error('Error rendering cart interfaces:', error);
            showError('Gagal memperbarui tampilan keranjang');
        }
    },

    // Render main cart panel
    renderMainCart() {
        const cartItemsContainer = document.getElementById('cartItems');
        if (!cartItemsContainer) return;

        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-state" id="emptyCartMessage">
                    <div class="empty-cart-icon">
                        <span class="material-symbols-outlined !text-4xl text-slate-400">shopping_cart</span>
                    </div>
                    <h3>Keranjang Kosong</h3>
                    <p>Belum ada produk yang ditambahkan ke keranjang</p>
                </div>
            `;
            return;
        }

        cartItemsContainer.innerHTML = '';

        currentCart.forEach(item => {
            if (!item || !item.id) return;

            const itemTotal = (item.price || 0) * (item.quantity || 0);
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item-card';

            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price">Rp ${(item.price || 0).toLocaleString()}</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn minus-btn" data-id="${item.id}">-</button>
                        <span class="quantity">${item.quantity || 0}</span>
                        <button class="quantity-btn plus-btn" data-id="${item.id}">+</button>
                    </div>
                    <button class="remove-btn" data-id="${item.id}" title="Hapus Item">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;

            cartItemsContainer.appendChild(cartItem);
        });
    },

    // Render mobile cart
    renderMobileCart() {
        const cartItemsContainer = document.getElementById('cart-items-mobile');
        if (!cartItemsContainer) return;

        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-cart-message">
                    <h4>Keranjang Belanja Kosong</h4>
                    <p>Silakan tambahkan produk yang ingin Anda beli</p>
                </div>
            `;
            return;
        }

        cartItemsContainer.innerHTML = '';

        currentCart.forEach(item => {
            if (!item || !item.id) return;

            const itemTotal = (item.price || 0) * (item.quantity || 0);
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item-mobile bg-white dark:bg-slate-800 rounded-lg p-3 mb-2 shadow-sm';

            cartItem.innerHTML = `
                <div class="cart-item-info-mobile">
                    <div class="cart-item-name-mobile font-medium text-slate-800 dark:text-slate-200">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price-mobile text-primary font-semibold">Rp ${(item.price || 0).toLocaleString()}</div>
                </div>
                <div class="cart-item-actions-mobile">
                    <div class="quantity-controls-mobile">
                        <button class="quantity-btn-mobile minus-mobile bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600" data-id="${item.id}" type="button" title="Kurangi">-</button>
                        <span class="quantity-mobile font-medium">${item.quantity || 0}</span>
                        <button class="quantity-btn-mobile plus-mobile bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600" data-id="${item.id}" type="button" title="Tambah">+</button>
                    </div>
                    <button class="remove-btn-mobile" data-id="${item.id}" type="button" title="Hapus Item">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            `;

            cartItemsContainer.appendChild(cartItem);
        });
    },

    // Render cart page
    renderCartPage() {
        const cartItemsContainer = document.getElementById('cart-items-page');
        const cartTotalItems = document.getElementById('cart-total-items');
        const cartSubtotalPage = document.getElementById('cart-subtotal-page');
        const cartTotalPage = document.getElementById('cart-total-page');
        const cartActions = document.getElementById('cart-actions');
        const emptyCartPage = document.querySelector('.empty-cart-page');

        if (!cartItemsContainer) return;

        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            if (emptyCartPage) emptyCartPage.style.display = 'block';
            if (cartActions) cartActions.style.display = 'none';
            cartItemsContainer.innerHTML = '';
            if (cartTotalItems) cartTotalItems.textContent = '0';
            if (cartSubtotalPage) cartSubtotalPage.textContent = 'Rp 0';
            if (cartTotalPage) cartTotalPage.textContent = 'Rp 0';
            return;
        }

        // Hide empty cart message and show actions
        if (emptyCartPage) emptyCartPage.style.display = 'none';
        if (cartActions) cartActions.style.display = 'flex';

        let subtotal = 0;
        cartItemsContainer.innerHTML = '';

        currentCart.forEach(item => {
            if (!item || !item.id) return;

            const itemTotal = (item.price || 0) * (item.quantity || 0);
            subtotal += itemTotal;

            const cartItemCard = document.createElement('div');
            cartItemCard.className = 'cart-item-card';
            cartItemCard.innerHTML = `
                <img src="${item.image || ''}" alt="${item.name}" class="cart-item-image" onerror="this.style.display='none'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price">${formatRupiah(item.price || 0)}</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="CartManager.decreaseQuantity('${item.id}'); setTimeout(() => CartManager.renderCartPage(), 10);">-</button>
                        <span class="quantity">${item.quantity || 0}</span>
                        <button class="quantity-btn" onclick="CartManager.increaseQuantity('${item.id}'); setTimeout(() => CartManager.renderCartPage(), 10);">+</button>
                    </div>
                    <button class="remove-btn" onclick="CartManager.removeFromCart('${item.id}'); setTimeout(() => CartManager.renderCartPage(), 10);" title="Hapus Item">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItemCard);
        });

        const total = subtotal;
        const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

        if (cartTotalItems) cartTotalItems.textContent = totalItems.toString();
        if (cartSubtotalPage) cartSubtotalPage.textContent = `Rp ${subtotal.toLocaleString()}`;
        if (cartTotalPage) cartTotalPage.textContent = `Rp ${total.toLocaleString()}`;
    },

    // Update cart count badge
    updateCartCount() {
        const currentCart = state.cart || [];
        const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

        const cartCountElements = [
            document.getElementById('cartCount'),
            document.getElementById('mobile-cart-badge')
        ];

        cartCountElements.forEach(element => {
            if (element) {
                element.textContent = totalItems.toString();
                element.style.display = totalItems > 0 ? 'flex' : 'none';
            }
        });
    },

    // Update cart totals
    updateCartTotals() {
        const currentCart = state.cart || [];
        const subtotal = currentCart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        const discount = 0;
        const total = subtotal;

        const subtotalElements = [
            document.getElementById('subtotal'),
            document.getElementById('cart-subtotal'),
            document.getElementById('cart-subtotal-mobile')
        ];

        const totalElements = [
            document.getElementById('total'),
            document.getElementById('cart-total'),
            document.getElementById('cart-total-mobile')
        ];

        subtotalElements.forEach(element => {
            if (element) element.textContent = `Rp ${subtotal.toLocaleString()}`;
        });

        totalElements.forEach(element => {
            if (element) element.textContent = `Rp ${total.toLocaleString()}`;
        });
    },

    // Add product to cart
    addToCart(product) {
        try {
            if (!product || !product.id || !product.name) {
                throw new Error('Data produk tidak valid');
            }

            const existingItemIndex = state.cart.findIndex(item => item.id === product.id);

            if (existingItemIndex >= 0) {
                state.cart[existingItemIndex] = {
                    ...state.cart[existingItemIndex],
                    quantity: state.cart[existingItemIndex].quantity + 1
                };
            } else {
                state.cart = [...state.cart, {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                    image: product.image || ''
                }];
            }

            // Trigger UI updates
            this.onCartChange();

            // Save to session
            if (state.user) {
                saveSessionData();
            }

            // Visual feedback
            this.showAddToCartFeedback(product);

        } catch (error) {
            console.error('Error adding product to cart:', error);
            showError('Gagal menambahkan produk ke keranjang: ' + error.message);
        }
    },

    // Decrease quantity
    decreaseQuantity(productId) {
        try {
            if (!productId) return;

            const itemIndex = state.cart.findIndex(item => item.id === productId);
            if (itemIndex === -1) return;

            const item = state.cart[itemIndex];

            if (item.quantity > 1) {
                state.cart[itemIndex] = { ...item, quantity: item.quantity - 1 };
            } else {
                state.cart = state.cart.filter(item => item.id !== productId);
            }

            this.onCartChange();
            if (state.user) saveSessionData();

        } catch (error) {
            console.error('Error decreasing quantity:', error);
            showError('Gagal mengurangi jumlah produk');
        }
    },

    // Increase quantity
    increaseQuantity(productId) {
        try {
            if (!productId) return;

            const itemIndex = state.cart.findIndex(item => item.id === productId);
            if (itemIndex === -1) return;

            state.cart[itemIndex] = {
                ...state.cart[itemIndex],
                quantity: state.cart[itemIndex].quantity + 1
            };

            this.onCartChange();
            if (state.user) saveSessionData();

        } catch (error) {
            console.error('Error increasing quantity:', error);
            showError('Gagal menambah jumlah produk');
        }
    },

    // Remove from cart
    removeFromCart(productId) {
        try {
            if (!productId) return;

            state.cart = state.cart.filter(item => item.id !== productId);
            this.onCartChange();
            if (state.user) saveSessionData();

        } catch (error) {
            console.error('Error removing from cart:', error);
            showError('Gagal menghapus produk dari keranjang');
        }
    },

    // Clear cart
    clearCart() {
        if (confirm('Apakah Anda yakin ingin mengosongkan keranjang?')) {
            state.cart = [];
            this.renderAllCartInterfaces();
            if (state.user) saveSessionData();
        }
    },

    // Save cart to session
    saveCartToSession() {
        if (state.user) {
            saveSessionData();
        }
    },

    // Show visual feedback when adding to cart
    showAddToCartFeedback(product) {
        const productCards = document.querySelectorAll('.product-card');
        const foundCard = Array.from(productCards).find(card => {
            return card.getAttribute('data-id') === product.id;
        });

        if (foundCard) {
            foundCard.style.transform = 'scale(0.95)';
            setTimeout(() => {
                foundCard.style.transform = '';
            }, 200);
        }
    }
};

// Enhanced State Management Functions
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

    // Debug logging (only in development)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('Legacy variables synced:', {
            products: products.length,
            categories: categories.length,
            paymentMethods: paymentMethods.length,
            cart: cart.length,
            currentUser: currentUser ? currentUser.name : null
        });
    }
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
const cartDiscountMobile = document.getElementById('cart-discount-mobile');
const cartTotalMobile = document.getElementById('cart-total-mobile');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutBtnMobile = document.getElementById('checkout-btn-mobile');
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

// Checkout processing flag to prevent infinite loops
window.isProcessingCheckout = false;
window.cartPanelInitialized = false;

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

    // Add event listeners to payment method buttons with proper error handling
    const methodBtns = paymentMethodsContainer.querySelectorAll('.payment-method-btn');
    methodBtns.forEach(btn => {
        // Remove existing listeners to prevent duplicates
        btn.removeEventListener('click', handlePaymentMethodClick);
        // Add fresh listener
        btn.addEventListener('click', handlePaymentMethodClick);
    });

    console.log(`Rendered ${methodBtns.length} payment method buttons`);
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

    // Show all options in grid (simplified)
    paymentAmountOptions.innerHTML = suggestions.map(suggestion => `
        <div class="payment-amount-option ${suggestion.class}"
             data-value="${suggestion.value}"
             data-type="${suggestion.type}">
            ${suggestion.label}
        </div>
    `).join('');

    // Add event listeners to payment amount options with proper error handling
    const allAmountOptions = paymentAmountOptions.querySelectorAll('.payment-amount-option');
    allAmountOptions.forEach(option => {
        // Remove existing listeners to prevent duplicates
        option.removeEventListener('click', handlePaymentAmountOptionClick);
        // Add fresh listener
        option.addEventListener('click', handlePaymentAmountOptionClick);
    });

    console.log(`Rendered ${allAmountOptions.length} payment amount options for total: ${total}`);
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
    console.log('Enabling login button');

    // Use safe DOM element access
    const loginButton = document.getElementById('login-btn');
    const statusElement = document.getElementById('login-status');

    if (loginButton) {
        loginButton.disabled = false;
        // Ensure button is clickable by removing any CSS interference
        loginButton.style.pointerEvents = 'auto';
        loginButton.style.cursor = 'pointer';
        loginButton.style.zIndex = '9999'; // High z-index to ensure it's clickable
        loginButton.style.position = 'relative'; // Ensure proper positioning
        loginButton.style.opacity = '1';

        // Remove any existing click event listeners to prevent conflicts
        loginButton.removeEventListener('click', handleAuthClick);

        // Add a direct click handler as backup
        loginButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Login button clicked from maybeEnableButtons - initiating authentication...');

            // Visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);

            // Call the authentication handler
            if (typeof handleAuthClick === 'function') {
                handleAuthClick();
            } else {
                console.error('handleAuthClick function not found');
            }
        });

        // Make sure the button is visible and clickable
        loginButton.style.display = 'flex';
        loginButton.classList.remove('hidden');

        console.log('Login button enabled and event listener attached');
    }

    if (statusElement) {
        statusElement.textContent = 'Aplikasi siap. Silakan login.';
    }

    // Check for saved session after a delay
    setTimeout(() => {
        restoreSession();
    }, 500); // Small delay to ensure everything is ready
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

        // Update UI to show login page and hide all other pages
        if (loginPage) {
            loginPage.style.display = 'block';
            loginPage.classList.add('active');
        }
        if (kasirPage) {
            kasirPage.style.display = 'none';
            kasirPage.classList.remove('active');
        }
        if (pengaturanPage) {
            pengaturanPage.style.display = 'none';
            pengaturanPage.classList.remove('active');
        }
        if (keranjangMobilePage) {
            keranjangMobilePage.style.display = 'none';
            keranjangMobilePage.classList.remove('active');
        }

        // Also hide the new cart page
        const keranjangPageElement = document.getElementById('keranjang-page');
        if (keranjangPageElement) {
            keranjangPageElement.style.display = 'none';
        }

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

        // Session status indicator removed as requested

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
        const allCategoryBtn = document.createElement('a');
        allCategoryBtn.className = 'py-3 px-1 border-b-2 border-primary text-primary font-semibold category-btn active';
        allCategoryBtn.href = '#';
        allCategoryBtn.textContent = 'Semua';
        allCategoryBtn.setAttribute('data-category', 'all');
        allCategoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            filterProductsByCategory('all');
        });
        categoryList.appendChild(allCategoryBtn);

        // Tambahkan kategori lainnya using state data
        state.categories.forEach(category => {
            if (category.status === 'Aktif') {
                const categoryBtn = document.createElement('a');
                categoryBtn.className = 'py-3 px-1 border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary category-btn';
                categoryBtn.href = '#';
                categoryBtn.textContent = category.name || 'Kategori Tanpa Nama';
                categoryBtn.setAttribute('data-category', category.id);
                categoryBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    filterProductsByCategory(category.id);
                });
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
            if (btn.getAttribute('data-category') === categoryId) {
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
            productCard.className = 'product-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col cursor-pointer';
            productCard.setAttribute('data-category', product.category || 'all');
            productCard.setAttribute('data-id', product.id);
            productCard.setAttribute('data-name', product.name || 'Produk Tanpa Nama');
            productCard.setAttribute('data-price', product.price || 0);
            productCard.innerHTML = `
                <div class="w-full h-32 bg-cover bg-center flex items-center justify-center bg-slate-100 dark:bg-slate-800 relative" style='background-image: url("${product.image || ''}")'>
                    <div class="absolute top-2 right-2 bg-white/80 dark:bg-slate-900/80 rounded-full w-6 h-6 flex items-center justify-center z-10">
                        <span class="material-symbols-outlined text-xs text-slate-600">add</span>
                    </div>
                    ${product.image ?
                    `<img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.style.backgroundImage='none'; this.parentElement.innerHTML='<span class=text-slate-500>${product.name}</span>';">
                    ` :
                    `<span class="text-slate-500">${product.name}</span>`
                }
                </div>
                <div class="p-3 flex flex-col flex-1">
                    <h3 class="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">${product.name || 'Produk Tanpa Nama'}</h3>
                    <p class="text-primary font-semibold text-sm">Rp ${(product.price || 0).toLocaleString()}</p>
                </div>
            `;

            // Add error handling for click event
            productCard.addEventListener('click', () => {
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

// Legacy function - now handled by CartManager
function updateMobileCart() {
    CartManager.renderMobileCart();
    CartManager.updateCartCount();
    CartManager.updateCartTotals();
}

// Legacy function - now handled by CartManager
function updateCartPage() {
    CartManager.renderCartPage();
}

// Legacy function - now handled by CartManager
function clearCart() {
    CartManager.clearCart();
}

// Show Main Application Page
function showMainAppPage(page) {
    updateState({ currentPage: page });

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });

    // Show target page
    const targetElement = document.getElementById(page + '-page') || document.getElementById('main-app');
    if (targetElement) {
        targetElement.style.display = 'flex';
    }

    // Update navigation active states
    document.querySelectorAll('[data-page]').forEach(item => {
        if (item.getAttribute('data-page') === page + '-page' || (page === 'kasir' && item.getAttribute('data-page') === 'kasir-page')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update cart page if cart page is shown
    if (page === 'keranjang') {
        updateCartPage();
    }
}

// Update tampilan keranjang mobile (moved to global scope)
function updateMobileCartOld() {
    // Check if mobile cart elements exist before updating
    if (!cartItemsMobile || !mobileCartBadge || !cartSubtotalMobile || !cartTotalMobile) {
        console.log('Mobile cart elements not found, skipping update');
        return;
    }

    try {
        cartItemsMobile.innerHTML = '';
        let subtotal = 0;

        // Use state.cart instead of legacy cart variable
        const currentCart = state.cart || [];

        if (currentCart.length === 0) {
            cartItemsMobile.innerHTML = `
                <div class="empty-cart-message">
                    <h4>Keranjang Belanja Kosong</h4>
                    <p>Silakan tambahkan produk yang ingin Anda beli</p>
                </div>
            `;
            if (mobileCartBadge) mobileCartBadge.textContent = '0';
            if (cartSubtotalMobile) cartSubtotalMobile.textContent = formatRupiah(0);
            if (cartDiscountMobile) cartDiscountMobile.textContent = formatRupiah(0);
            if (cartTotalMobile) cartTotalMobile.textContent = formatRupiah(0);
            return;
        }

        currentCart.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 0);
            subtotal += itemTotal;

            // Tampilan keranjang mobile dengan desain yang lebih baik
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
                                data-id="${item.id}"
                                type="button"
                                onclick="decreaseQuantity('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">-</button>
                        <span class="quantity-mobile">${item.quantity || 0}</span>
                        <button class="quantity-btn-mobile plus-mobile"
                                data-id="${item.id}"
                                type="button"
                                onclick="increaseQuantity('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">+</button>
                    </div>
                    <button class="remove-btn-mobile"
                            data-id="${item.id}"
                            type="button"
                            onclick="removeFromCart('${item.id}'); setTimeout(() => { updateMobileCart(); renderCart(); }, 10);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItemsMobile.appendChild(cartItemMobileElement);
        });

        // Update summary dengan styling yang lebih baik
        const discount = 0;
        const total = subtotal;

        // Update mobile - menampilkan jumlah total item di keranjang dengan badge yang lebih menarik
        const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

        // Update mobile cart badge dengan animasi
        if (mobileCartBadge) {
            mobileCartBadge.textContent = totalItems;
            mobileCartBadge.className = 'cart-count-badge';
        }

        // Update mobile cart totals dengan styling yang konsisten
        if (cartSubtotalMobile) {
            cartSubtotalMobile.textContent = formatRupiah(subtotal);
            cartSubtotalMobile.className = 'summary-value-mobile';
        }
        if (cartDiscountMobile) {
            cartDiscountMobile.textContent = formatRupiah(discount);
            cartDiscountMobile.className = 'summary-value-mobile';
        }
        if (cartTotalMobile) {
            cartTotalMobile.textContent = formatRupiah(total);
            cartTotalMobile.className = 'summary-total-mobile';
        }

        // Mobile cart buttons now use inline onclick attributes for better reliability

        // Mobile cart buttons now use inline onclick attributes for better reliability

        console.log('Mobile cart updated successfully');

    } catch (error) {
        console.error('Error updating mobile cart:', error);
    }
}

// Legacy function - now handled by CartManager
function renderCart() {
    CartManager.renderAllCartInterfaces();
}

// Render cart items for a specific container
function renderCartItems(container) {
    if (!container) {
        console.error('Cart container not found');
        return;
    }

    const currentCart = state.cart || [];

    if (currentCart.length === 0) {
        // Show empty cart message
        container.innerHTML = `
            <div class="text-center text-slate-500 dark:text-slate-400 py-10">
                Keranjang kosong. Pilih produk untuk menambahkan.
            </div>
        `;
        return;
    }

    let subtotal = 0;
    container.innerHTML = '';

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
        cartItem.className = 'flex items-center justify-between py-3 px-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0';

        // Different layout for different containers
        const isMainCart = container.id === 'cartItems';
        const isMobileCart = container.id === 'cart-items-mobile';

        if (isMainCart) {
            // Main cart layout (sidebar panel)
            cartItem.innerHTML = `
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">${item.name || 'Produk Tanpa Nama'}</h3>
                    <p class="text-primary font-semibold text-xs">Rp ${(item.price || 0).toLocaleString()}</p>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <button class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center minus-btn hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors" data-id="${item.id}" title="Kurangi">
                        <span class="material-symbols-outlined text-xs">remove</span>
                    </button>
                    <span class="w-8 text-center text-sm font-medium">${item.quantity || 0}</span>
                    <button class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center plus-btn hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors" data-id="${item.id}" title="Tambah">
                        <span class="material-symbols-outlined text-xs">add</span>
                    </button>
                    <button class="ml-2 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded remove-btn transition-colors" data-id="${item.id}" title="Hapus">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            `;
        } else if (isMobileCart) {
            // Mobile cart layout
            cartItem.className = 'cart-item-mobile bg-white dark:bg-slate-800 rounded-lg p-3 mb-2 shadow-sm';
            cartItem.innerHTML = `
                <div class="cart-item-info-mobile">
                    <div class="cart-item-name-mobile font-medium text-slate-800 dark:text-slate-200">${item.name || 'Produk Tanpa Nama'}</div>
                    <div class="cart-item-price-mobile text-primary font-semibold">Rp ${(item.price || 0).toLocaleString()}</div>
                </div>
                <div class="cart-item-actions-mobile">
                    <div class="quantity-controls-mobile">
                        <button class="quantity-btn-mobile minus-mobile bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                                data-id="${item.id}" type="button" title="Kurangi">-</button>
                        <span class="quantity-mobile font-medium">${item.quantity || 0}</span>
                        <button class="quantity-btn-mobile plus-mobile bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                                data-id="${item.id}" type="button" title="Tambah">+</button>
                    </div>
                    <button class="remove-btn-mobile text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded"
                            data-id="${item.id}" type="button" title="Hapus">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            `;
        }

        container.appendChild(cartItem);
    });

    // Add event listeners for the new cart items
    addCartEventListeners(container);

    // Update cart totals
    updateCartTotals(subtotal);
}

// Add event listeners for cart item buttons
function addCartEventListeners(container) {
    if (!container) return;

    // Decrease quantity buttons
    const decreaseButtons = container.querySelectorAll('.minus-btn, .quantity-btn-mobile.minus-mobile');
    decreaseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]')?.getAttribute('data-id');
                console.log('Decrease button clicked for product ID:', id);
                if (id) {
                    decreaseQuantity(id);
                    // Re-render after a short delay to allow state update
                    setTimeout(() => {
                        renderCart();
                    }, 10);
                }
            } catch (error) {
                console.error('Error in decrease button click:', error);
            }
        });
    });

    // Increase quantity buttons
    const increaseButtons = container.querySelectorAll('.plus-btn, .quantity-btn-mobile.plus-mobile');
    increaseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]')?.getAttribute('data-id');
                console.log('Increase button clicked for product ID:', id);
                if (id) {
                    increaseQuantity(id);
                    // Re-render after a short delay to allow state update
                    setTimeout(() => {
                        renderCart();
                    }, 10);
                }
            } catch (error) {
                console.error('Error in increase button click:', error);
            }
        });
    });

    // Remove buttons
    const removeButtons = container.querySelectorAll('.remove-btn, .remove-btn-mobile');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]')?.getAttribute('data-id');
                console.log('Remove button clicked for product ID:', id);
                if (id) {
                    removeFromCart(id);
                    // Re-render after a short delay to allow state update
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
}

// Update cart count badge
function updateCartCount() {
    const currentCart = state.cart || [];
    const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

    // Update cart count badge
    const cartCountElements = [
        document.getElementById('cartCount'),
        document.getElementById('mobile-cart-badge')
    ];

    cartCountElements.forEach(element => {
        if (element) {
            element.textContent = totalItems.toString();
            if (totalItems > 0) {
                element.style.display = 'flex';
            } else {
                element.style.display = 'none';
            }
        }
    });
}

// Update cart totals
function updateCartTotals(subtotal) {
    const discount = 0; // No discount for now
    const total = subtotal;

    // Update total elements
    const subtotalElements = [
        document.getElementById('subtotal'),
        document.getElementById('cart-subtotal'),
        document.getElementById('cart-subtotal-mobile')
    ];

    const totalElements = [
        document.getElementById('total'),
        document.getElementById('cart-total'),
        document.getElementById('cart-total-mobile')
    ];

    subtotalElements.forEach(element => {
        if (element) element.textContent = `Rp ${subtotal.toLocaleString()}`;
    });

    totalElements.forEach(element => {
        if (element) element.textContent = `Rp ${total.toLocaleString()}`;
    });
}

// Legacy function - now handled by CartManager
function addToCart(product) {
    CartManager.addToCart(product);
}

// Legacy functions - now handled by CartManager
function decreaseQuantity(productId) {
    CartManager.decreaseQuantity(productId);
}

function increaseQuantity(productId) {
    CartManager.increaseQuantity(productId);
}

function removeFromCart(productId) {
    CartManager.removeFromCart(productId);
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
    const amountPaid = parseFloat(amountPaidInput.value.replace(/[^\d]/g, '')) || 0;
    const change = amountPaid - total;

    changeAmountSpan.textContent = formatRupiah(change >= 0 ? change : 0);
}

// Proses Pembayaran
async function processPayment() {
    const total = parseFloat(cartTotal.textContent.replace(/[^\d]/g, '')) || 0;
    const amountPaid = parseFloat(amountPaidInput.value.replace(/[^\d]/g, '')) || selectedPaymentAmount || 0;

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
            successMessage += `<p>Kembalian: <strong>Uang Pas / Tidak Ada Kembalian</strong></p>`;
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

        // Reset processing flag since modal is closed
        window.isProcessingCheckout = false;
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

// Enhanced Design Functionality
function initializeEnhancedDesign() {
    console.log('Initializing enhanced design functionality...');

    // Initialize dark mode toggle
    initializeDarkMode();

    // Initialize mobile menu
    initializeMobileMenu();

    // Initialize cart panel
    initializeCartPanel();

    // Initialize navigation
    initializeNavigation();

    // Initialize search functionality
    initializeSearch();

    // Initialize category filtering
    initializeCategoryFiltering();

    // Initialize modal enhancements (disabled for cleaner implementation)
    // initializeModalEnhancements();

    console.log('Enhanced design functionality initialized');
}

// Dark mode functionality
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeToggleSettings = document.getElementById('darkModeToggle-settings');

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function () {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', document.body.classList.contains('dark'));
        });
    }

    if (darkModeToggleSettings) {
        darkModeToggleSettings.addEventListener('click', function () {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', document.body.classList.contains('dark'));
        });
    }

    // Initialize dark mode from localStorage
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
    }
}

// Mobile menu functionality
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarSettings = document.getElementById('sidebar-settings');

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', function () {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', function (e) {
        if (sidebar && !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
        if (sidebarSettings && !sidebarSettings.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
            sidebarSettings.classList.remove('open');
        }
    });
}

// Cart panel functionality
function initializeCartPanel() {
    // Prevent duplicate initialization
    if (window.cartPanelInitialized) {
        console.log('Cart panel already initialized, skipping duplicate initialization');
        return;
    }

    const cartButton = document.getElementById('cartButton');
    const cartPanel = document.getElementById('cartPanel');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartOverlay = document.getElementById('cartOverlay');

    // Mark as initialized
    window.cartPanelInitialized = true;

    // Ensure closed state on init
    if (cartPanel) {
        cartPanel.classList.remove('open');
        cartPanel.style.display = 'none';
        cartPanel.style.zIndex = '';
    }
    if (cartOverlay) {
        cartOverlay.classList.remove('active');
    }
    // Ensure body scroll is enabled initially
    document.body.style.overflow = 'auto';

    if (cartButton && cartPanel) {
        cartButton.addEventListener('click', function () {
            console.log('Cart button clicked, toggling cart panel');
            const isOpening = !cartPanel.classList.contains('open');

            cartPanel.classList.toggle('open');
            if (cartOverlay) {
                cartOverlay.classList.toggle('active');
            }

            // Ensure proper display state
            if (isOpening) {
                console.log('Cart panel opened, rendering cart items');
                cartPanel.style.display = 'flex';
                cartPanel.style.zIndex = '1000';
                document.body.style.overflow = 'hidden';

                setTimeout(() => {
                    renderCart();
                }, 100); // Small delay to ensure panel is visible
            } else {
                console.log('Cart panel closed');
                cartPanel.style.zIndex = '';
                document.body.style.overflow = 'auto';
            }
        });
    }

    if (closeCartBtn && cartPanel) {
        closeCartBtn.addEventListener('click', function () {
            console.log('Close cart button clicked');
            cartPanel.classList.remove('open');
            if (cartOverlay) {
                cartOverlay.classList.remove('active');
            }

            // Ensure proper hiding
            cartPanel.style.display = 'none';
            cartPanel.style.zIndex = '';
            document.body.style.overflow = 'auto';
        });
    }

    // Add checkout button functionality for cart panel (only once)
    const cartPanelCheckoutBtn = cartPanel ? cartPanel.querySelector('#checkoutBtn') : null;
    if (cartPanelCheckoutBtn) {
        // Remove existing listeners to prevent duplicates
        cartPanelCheckoutBtn.replaceWith(cartPanelCheckoutBtn.cloneNode(true));
        const newCheckoutBtn = cartPanel.querySelector('#checkoutBtn');

        newCheckoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Cart panel checkout button clicked');

            // Prevent multiple rapid clicks
            if (window.isProcessingCheckout) {
                console.log('Checkout already in progress, ignoring duplicate click');
                return;
            }

            window.isProcessingCheckout = true;

            // Close cart panel first
            cartPanel.classList.remove('open');
            if (cartOverlay) {
                cartOverlay.classList.remove('active');
            }

            // Ensure proper hiding
            cartPanel.style.display = 'none';
            cartPanel.style.zIndex = '';
            document.body.style.overflow = 'auto';

            // Use a more reliable method to trigger checkout
            setTimeout(() => {
                handleCheckoutFromCart();
            }, 100);
        });
    }

    // Global checkout handler function
    function handleCheckoutFromCart() {
        try {
            // Double-check processing flag
            if (window.isProcessingCheckout) {
                console.log('Checkout already in progress, exiting');
                return;
            }

            // Check if user is logged in
            if (!state.isLoggedIn) {
                alert('Silakan login terlebih dahulu untuk melanjutkan pembayaran.');
                window.isProcessingCheckout = false;
                return;
            }

            // Check if cart has items
            if (!state.cart || state.cart.length === 0) {
                alert('Keranjang kosong!');
                window.isProcessingCheckout = false;
                return;
            }

            // Get total from cart
            let totalValue = (state.cart || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

            if (checkoutTotalSpan) {
                checkoutTotalSpan.textContent = `Rp ${totalValue.toLocaleString()}`;
            }

            // Reset payment form
            if (amountPaidInput) amountPaidInput.value = '';
            if (typeof selectedPaymentAmount !== 'undefined') selectedPaymentAmount = 0;
            if (paymentResult) paymentResult.style.display = 'none';

            // Setup payment interface only once
            if (typeof renderPaymentSuggestions === 'function') {
                renderPaymentSuggestions(totalValue);
            }

            if (typeof setupPaymentInterface === 'function') {
                setupPaymentInterface(totalValue);
            }

            // Show checkout modal
            if (checkoutModal) {
                checkoutModal.classList.add('active');
                document.body.style.overflow = 'hidden';
                window.paymentListenersAttached = false;
                console.log('Checkout modal opened successfully - checkout process completed');
            } else {
                console.log('Checkout triggered. Total:', totalValue);
                alert('Proses pembayaran belum memiliki modal di desain baru.');
            }

            // Reset processing flag since modal is open and process is in progress
            window.isProcessingCheckout = false;
        } catch (error) {
            console.error('Error in handleCheckoutFromCart:', error);
            alert('Terjadi kesalahan saat memproses checkout. Silakan coba lagi.');
        }
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', function () {
            console.log('Cart overlay clicked, closing cart panel');
            cartPanel.classList.remove('open');
            cartOverlay.classList.remove('active');

            // Ensure proper hiding
            cartPanel.style.display = 'none';
            cartPanel.style.zIndex = '';
            document.body.style.overflow = 'auto';
        });
    }

    console.log('Cart panel initialized successfully');
}

// Navigation functionality
function initializeNavigation() {
    const navItems = document.querySelectorAll('[data-page]');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            if (item.id === 'logout-btn' || item.id === 'logout-btn-settings') return;

            const targetPage = item.getAttribute('data-page');

            // Update navigation active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show/hide pages
            document.querySelectorAll('.page').forEach(page => {
                page.style.display = 'none';
            });

            const targetElement = document.getElementById(targetPage);
            if (targetElement) {
                targetElement.style.display = 'block';
            }

            // Special handling for settings page
            if (targetPage === 'pengaturan-page') {
                const activeTab = document.querySelector('.tab-content.active');
                if (!activeTab) {
                    const firstTab = document.querySelector('.tab-content');
                    const firstTabBtn = document.querySelector('.tab-btn');
                    if (firstTab) firstTab.classList.add('active');
                    if (firstTabBtn) firstTabBtn.classList.add('active');
                }
            }

            // Special handling for produk page (main app)
            if (targetPage === 'produk' || targetPage === 'produk-page') {
                // Ensure main app is visible with products (kasir page)
                const mainAppElement = document.getElementById('main-app');
                if (mainAppElement) {
                    mainAppElement.style.display = 'block';
                    mainAppElement.style.visibility = 'visible';
                    console.log('Main app (kasir page) shown for produk navigation');

                    // Also update state to kasir/produk
                    updateState({ currentPage: 'produk' });
                }
            }
        });
    });
}

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const productCards = document.querySelectorAll('.product-card');

            productCards.forEach(card => {
                const name = card.getAttribute('data-name') || '';
                if (name.toLowerCase().includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
}

// Category filtering functionality
function initializeCategoryFiltering() {
    const categoryBtns = document.querySelectorAll('.category-btn');

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();

            // Update active class
            categoryBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const category = this.getAttribute('data-category');
            const productCards = document.querySelectorAll('.product-card');

            productCards.forEach(card => {
                if (category === 'all' || card.getAttribute('data-category') === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
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

        // Initialize enhanced design functionality
        initializeEnhancedDesign();

        // Initialize CartManager for unified cart management
        CartManager.init();

        // Initialize cart panel only once
        if (!window.cartPanelInitialized) {
            initializeCartPanel();
        }

        // Ensure login page is properly initialized
        initializeLoginPage();

        // Payment interface will be setup when needed during checkout
        // No need to pre-attach listeners on initialization

        // Initialize login page properly
        function initializeLoginPage() {
            console.log('Initializing login page...');

            // Ensure login page is visible by default
            const loginPageElement = document.getElementById('login-page');
            if (loginPageElement) {
                loginPageElement.style.display = 'block';
                loginPageElement.classList.add('active');
            }

            // Hide all other pages initially
            const mainAppElement = document.getElementById('main-app');
            const pengaturanPageElement = document.getElementById('pengaturan-page');
            const keranjangPageElement = document.getElementById('keranjang-page');

            if (mainAppElement) {
                mainAppElement.style.display = 'none';
            }

            if (pengaturanPageElement) {
                pengaturanPageElement.style.display = 'none';
            }

            if (keranjangPageElement) {
                keranjangPageElement.style.display = 'none';
            }

            // Hide bottom navigation initially
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) {
                bottomNav.style.display = 'none';
            }

            // Ensure cart panel is hidden initially
            const cartPanel = document.getElementById('cartPanel');
            const cartOverlay = document.getElementById('cartOverlay');
            if (cartPanel) {
                cartPanel.classList.remove('open');
                cartPanel.style.display = 'none';
            }
            if (cartOverlay) {
                cartOverlay.classList.remove('active');
                cartOverlay.style.display = 'none';
            }

            console.log('Login page initialized');
        }

        // Login dengan Google (only add listener if button exists)
        if (loginBtn) {
            // Ensure login button is properly set up and enabled
            loginBtn.disabled = false;
            loginBtn.style.pointerEvents = 'auto';
            loginBtn.style.cursor = 'pointer';
            loginBtn.style.opacity = '1';
            loginBtn.style.zIndex = '9999'; // Ensure it's above other elements
            loginBtn.style.display = 'flex';
            loginBtn.classList.remove('hidden');

            // Remove existing event listeners to prevent duplicates
            loginBtn.removeEventListener('click', handleAuthClick);

            // Add fresh event listener with error handling
            loginBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                console.log('Login button clicked - initiating authentication...');

                // Visual feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);

                // Call the authentication handler
                handleAuthClick();
            });

            console.log('Login button event listener attached successfully');
        }

        console.log('Application initialization completed');

    } catch (error) {
        console.error('Error during DOM Content Loaded initialization:', error);
        showError('Terjadi kesalahan saat memuat aplikasi: ' + error.message);
    }

    // Logout functionality for both logout buttons
    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnSettings = document.getElementById('logout-btn-settings');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin logout?')) {
                handleSignout();
            }
        });
    }

    if (logoutBtnSettings) {
        logoutBtnSettings.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin logout?')) {
                handleSignout();
            }
        });
    }

    // Navigation is now handled by the enhanced design functionality


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
    if (addProductBtn) {
        addProductBtn.addEventListener('click', addProduct);
    }
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', addCategory);
    }
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', addPaymentMethod);
    }

    // Tombol checkout - Enhanced with better error handling and duplicate prevention
    if (typeof checkoutBtn !== 'undefined' && checkoutBtn) {
        // Remove existing listeners to prevent duplicates
        checkoutBtn.replaceWith(checkoutBtn.cloneNode(true));
        const newCheckoutBtn = document.getElementById('checkoutBtn');

        newCheckoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Main checkout button clicked');

            // Prevent checkout if already in progress
            if (window.isProcessingCheckout) {
                console.log('Checkout already in progress, ignoring duplicate click');
                return;
            }

            if (!state.isLoggedIn) {
                alert('Silakan login terlebih dahulu untuk melanjutkan pembayaran.');
                return;
            }

            if (!state.cart || state.cart.length === 0) {
                alert('Keranjang kosong!');
                return;
            }

            // Get total from cart with better calculation
            let totalValue = (state.cart || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

            if (totalValue <= 0) {
                alert('Total pembayaran tidak valid!');
                return;
            }

            console.log('Checkout started for total:', totalValue);

            if (checkoutTotalSpan) {
                checkoutTotalSpan.textContent = `Rp ${totalValue.toLocaleString()}`;
            }

            // Reset payment form
            if (amountPaidInput) amountPaidInput.value = '';
            if (typeof selectedPaymentAmount !== 'undefined') selectedPaymentAmount = 0;
            if (paymentResult) paymentResult.style.display = 'none';

            // Generate and render payment suggestions
            if (typeof renderPaymentSuggestions === 'function') {
                renderPaymentSuggestions(totalValue);
            }

            // Setup payment interface with proper error handling
            if (typeof setupPaymentInterface === 'function') {
                try {
                    setupPaymentInterface(totalValue);
                } catch (error) {
                    console.error('Error setting up payment interface:', error);
                }
            }

            // Show checkout modal
            if (checkoutModal) {
                checkoutModal.classList.add('active');
                document.body.style.overflow = 'hidden';

                // Reset payment listeners flag when modal opens
                window.paymentListenersAttached = false;
                window.paymentMethodsRendered = false;
                window.paymentAmountOptionsRendered = false;

                console.log('Checkout modal opened successfully');
            } else {
                console.error('Checkout modal not found');
                alert('Modal checkout tidak ditemukan. Silakan refresh halaman.');
            }

            // Reset processing flag since modal is open and process is in progress
            window.isProcessingCheckout = false;
        });
    } else {
        console.warn('Main checkout button (checkoutBtn) not found in DOM');
    }

    // Tombol checkout mobile - Enhanced with better error handling
    if (typeof checkoutBtnMobile !== 'undefined' && checkoutBtnMobile) {
        // Remove existing listeners to prevent duplicates
        checkoutBtnMobile.replaceWith(checkoutBtnMobile.cloneNode(true));
        const newCheckoutBtnMobile = document.getElementById('checkout-btn-mobile');

        newCheckoutBtnMobile.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Mobile checkout button clicked');

            // Prevent checkout if already in progress
            if (window.isProcessingCheckout) {
                console.log('Checkout already in progress, ignoring duplicate click');
                return;
            }

            if (!state.isLoggedIn) {
                alert('Silakan login terlebih dahulu untuk melanjutkan pembayaran.');
                return;
            }

            if (!state.cart || state.cart.length === 0) {
                alert('Keranjang kosong!');
                return;
            }

            // Get total from cart with better calculation
            let totalValue = (state.cart || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

            if (totalValue <= 0) {
                alert('Total pembayaran tidak valid!');
                return;
            }

            console.log('Mobile checkout started for total:', totalValue);

            if (checkoutTotalSpan) {
                checkoutTotalSpan.textContent = `Rp ${totalValue.toLocaleString()}`;
            }

            // Reset payment form
            if (amountPaidInput) amountPaidInput.value = '';
            if (typeof selectedPaymentAmount !== 'undefined') selectedPaymentAmount = 0;
            if (paymentResult) paymentResult.style.display = 'none';

            // Generate and render payment suggestions
            if (typeof renderPaymentSuggestions === 'function') {
                renderPaymentSuggestions(totalValue);
            }

            // Show checkout modal
            if (checkoutModal) {
                checkoutModal.classList.add('active');
                document.body.style.overflow = 'hidden';

                // Reset payment listeners flag when modal opens
                window.paymentListenersAttached = false;
                window.paymentMethodsRendered = false;
                window.paymentAmountOptionsRendered = false;

                // Setup payment interface for mobile checkout with error handling
                if (typeof setupPaymentInterface === 'function') {
                    try {
                        setupPaymentInterface(totalValue);
                    } catch (error) {
                        console.error('Error setting up payment interface for mobile:', error);
                    }
                }

                console.log('Mobile checkout modal opened successfully');
            } else {
                console.error('Checkout modal not found for mobile');
                alert('Modal checkout tidak ditemukan. Silakan refresh halaman.');
            }

            // Reset processing flag since modal is open and process is in progress
            window.isProcessingCheckout = false;
        });
    } else {
        console.warn('Mobile checkout button (checkoutBtnMobile) not found in DOM');
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

    // Payment modal event listeners - Enhanced with duplicate prevention
    if (confirmPaymentBtn) {
        // Remove existing listeners to prevent duplicates
        confirmPaymentBtn.replaceWith(confirmPaymentBtn.cloneNode(true));
        const newConfirmPaymentBtn = document.getElementById('confirm-payment');

        newConfirmPaymentBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Confirm payment button clicked');

            // Prevent multiple rapid clicks
            if (window.isProcessingCheckout) {
                console.log('Payment processing already in progress');
                return;
            }

            if (typeof processPayment === 'function') {
                processPayment();
            } else {
                console.error('processPayment function not found');
                alert('Fungsi pembayaran tidak tersedia');
            }
        });
    } else {
        console.warn('Confirm payment button not found in DOM');
    }

    if (amountPaidInput) {
        amountPaidInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;

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

    // Close modal event listeners with proper error handling and duplicate prevention
    const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
    if (closeCheckoutModalBtn) {
        // Remove existing listeners to prevent duplicates
        closeCheckoutModalBtn.replaceWith(closeCheckoutModalBtn.cloneNode(true));
        const newCloseBtn = document.getElementById('close-checkout-modal');
        newCloseBtn.addEventListener('click', () => {
            if (checkoutModal) {
                checkoutModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
            console.log('Checkout modal closed');
        });
    }

    const cancelCheckoutBtn = document.getElementById('cancel-checkout');
    if (cancelCheckoutBtn) {
        // Remove existing listeners to prevent duplicates
        cancelCheckoutBtn.replaceWith(cancelCheckoutBtn.cloneNode(true));
        const newCancelBtn = document.getElementById('cancel-checkout');
        newCancelBtn.addEventListener('click', () => {
            if (checkoutModal) {
                checkoutModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
            console.log('Checkout cancelled');
        });
    }

    // Close success modal event listener with proper error handling
    const closeSuccessModalBtn = document.getElementById('close-success-modal');
    if (closeSuccessModalBtn) {
        // Remove existing listeners to prevent duplicates
        closeSuccessModalBtn.replaceWith(closeSuccessModalBtn.cloneNode(true));
        const newCloseSuccessBtn = document.getElementById('close-success-modal');
        newCloseSuccessBtn.addEventListener('click', () => {
            const successModal = document.getElementById('success-modal');
            if (successModal) {
                successModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
            console.log('Success modal closed');
        });
    }

    // Also fix the OK button in success modal
    const closeSuccessModalOkBtn = document.getElementById('close-success-modal-btn');
    if (closeSuccessModalOkBtn) {
        // Remove existing listeners to prevent duplicates
        closeSuccessModalOkBtn.replaceWith(closeSuccessModalOkBtn.cloneNode(true));
        const newCloseSuccessOkBtn = document.getElementById('close-success-modal-btn');
        newCloseSuccessOkBtn.addEventListener('click', () => {
            const successModal = document.getElementById('success-modal');
            if (successModal) {
                successModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
            console.log('Success modal OK button clicked');
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

    // Cart page specific event listeners
    const checkoutFromCartBtn = document.getElementById('checkout-from-cart-btn');
    if (checkoutFromCartBtn) {
        checkoutFromCartBtn.addEventListener('click', () => {
            console.log('Checkout from cart page button clicked');

            // Switch to produk page for checkout
            showMainAppPage('produk');

            // Trigger checkout process using the global handler
            setTimeout(() => {
                if (typeof handleCheckoutFromCart === 'function') {
                    handleCheckoutFromCart();
                } else {
                    console.error('Checkout handler not available');
                    // Fallback: show alert
                    alert('Proses checkout tidak tersedia. Silakan gunakan tombol checkout di halaman utama.');
                }
            }, 100);
        });
    }

    // Cart page logout button
    const logoutBtnKeranjang = document.getElementById('logout-btn-keranjang');
    if (logoutBtnKeranjang) {
        logoutBtnKeranjang.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin logout?')) {
                handleSignout();
            }
        });
    }

    // Cart page dark mode toggle
    const darkModeToggleKeranjang = document.getElementById('darkModeToggle-keranjang');
    if (darkModeToggleKeranjang) {
        darkModeToggleKeranjang.addEventListener('click', function () {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', document.body.classList.contains('dark'));
        });
    }
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

// Konfirmasi pembayaran - Already handled above in DOMContentLoaded

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
    const loginPage = document.getElementById('login-page');
    if (loginPage) {
        loginPage.style.display = 'none';
        loginPage.classList.remove('active');
    }

    // Ensure cart panel is properly closed when showing main app
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartPanel) {
        cartPanel.classList.remove('open');
    }
    if (cartOverlay) {
        cartOverlay.classList.remove('active');
    }

    // Show appropriate page based on current state
    switch (state.currentPage) {
        case 'kasir':
        case 'produk':
            // Show main app (kasir/produk page)
            console.log('Showing produk/kasir page, setting main-app display to block');
            const mainApp = document.getElementById('main-app');
            if (mainApp) {
                mainApp.style.display = 'block';
                mainApp.style.visibility = 'visible';
                console.log('Main app (kasir page) display set to block');
            }
            const pengaturanPage = document.getElementById('pengaturan-page');
            if (pengaturanPage) pengaturanPage.style.display = 'none';
            const keranjangPage = document.getElementById('keranjang-page');
            if (keranjangPage) keranjangPage.style.display = 'none';
            break;

        case 'pengaturan':
            const pengaturanPageShow = document.getElementById('pengaturan-page');
            if (pengaturanPageShow) {
                pengaturanPageShow.style.display = 'block';
            }
            const mainAppHide = document.getElementById('main-app');
            if (mainAppHide) mainAppHide.style.display = 'none';
            const keranjangPageHide = document.getElementById('keranjang-page');
            if (keranjangPageHide) keranjangPageHide.style.display = 'none';
            break;

        case 'keranjang':
            const keranjangPageShow = document.getElementById('keranjang-page');
            if (keranjangPageShow) {
                keranjangPageShow.style.display = 'block';
            }
            const mainAppHide2 = document.getElementById('main-app');
            if (mainAppHide2) mainAppHide2.style.display = 'none';
            const pengaturanPageHide = document.getElementById('pengaturan-page');
            if (pengaturanPageHide) pengaturanPageHide.style.display = 'none';
            break;

        default:
            // Default to kasir (main app)
            const mainAppDefault = document.getElementById('main-app');
            if (mainAppDefault) {
                mainAppDefault.style.display = 'block';
            }
    }

    // Show bottom navigation
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'flex';
    }

    // Session status indicator removed as requested

    // Render cart if exists
    renderCart();

    // Update cart page if on cart page
    if (state.currentPage === 'keranjang') {
        updateCartPage();
    }

    console.log('Main application shown');
}

// Session status indicator removed as requested

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

    // Force show login page and hide all other pages
    const loginPageElement = document.getElementById('login-page');
    const mainAppElement = document.getElementById('main-app');
    const pengaturanPageElement = document.getElementById('pengaturan-page');
    const keranjangPageElement = document.getElementById('keranjang-page');

    if (loginPageElement) {
        loginPageElement.style.display = 'block';
        loginPageElement.classList.add('active');
        loginPageElement.style.zIndex = '1';
    }

    if (mainAppElement) {
        mainAppElement.style.display = 'none';
    }

    if (pengaturanPageElement) {
        pengaturanPageElement.style.display = 'none';
    }

    if (keranjangPageElement) {
        keranjangPageElement.style.display = 'none';
    }

    // Hide bottom navigation
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }

    // Ensure cart panel is properly closed and hidden
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartPanel) {
        cartPanel.classList.remove('open');
        cartPanel.style.display = 'none';
    }
    if (cartOverlay) {
        cartOverlay.classList.remove('active');
        cartOverlay.style.display = 'none';
    }

    // Hide any other UI elements that might interfere
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
    }

    // Clear user interface elements
    const avatarElements = ['user-avatar', 'user-avatar-settings', 'user-avatar-keranjang', 'user-name', 'user-name-settings', 'user-name-keranjang'];
    avatarElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '';
    });

    // Show clear session expiry message
    const loginStatusElement = document.getElementById('login-status');
    if (loginStatusElement) {
        loginStatusElement.textContent = 'Sesi telah kedaluwarsa. Silakan login kembali.';
        loginStatusElement.style.color = '#dc3545';
        setTimeout(() => {
            loginStatusElement.textContent = '';
            loginStatusElement.style.color = '';
        }, 5000);
    }

    // Add visual feedback for session expiry
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) {
        loginContainer.style.border = '2px solid #dc3545';
        loginContainer.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
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
    const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;

    // Remove selected class from all options
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

// Enhanced Settings Page Functions

// Initialize Enhanced Settings Page
function initializeEnhancedSettings() {
    console.log('Initializing enhanced settings page...');

    // Initialize tab functionality
    initializeEnhancedTabs();

    // Initialize search functionality
    initializeEnhancedSearch();

    // Initialize filter functionality
    initializeEnhancedFilters();

    // Initialize bulk operations
    initializeBulkOperations();

    // Initialize statistics
    initializeSettingsStatistics();

    // Initialize export functionality
    initializeExportFunctionality();

    // Initialize FAB menu
    initializeEnhancedFAB();

    // Initialize table sorting
    initializeTableSorting();

    // Initialize refresh functionality
    initializeRefreshFunctionality();

    // Load initial data
    loadSettingsData();

    console.log('Enhanced settings page initialized');
}

// Initialize Refresh Functionality
function initializeRefreshFunctionality() {
    const refreshBtn = document.getElementById('settings-refresh-btn');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            this.classList.add('rotating');

            loadSettingsData().then(() => {
                this.classList.remove('rotating');

                // Show success feedback
                showNotification('Data berhasil diperbarui', 'success');
            }).catch(error => {
                this.classList.remove('rotating');
                showNotification('Gagal memperbarui data', 'error');
            });
        });
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon material-symbols-outlined">
            ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
        </span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#dbeafe'};
        color: ${type === 'success' ? '#166534' : type === 'error' ? '#991b1b' : '#1e40af'};
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 3000;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.25rem;
        transition: background-color 0.2s ease;
    `;

    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);

    document.body.appendChild(notification);

    // Add animation keyframes if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Table Action Functions
function filterProdukTable() {
    displayProdukTable();
}

function filterKategoriTable() {
    displayKategoriTable();
}

function filterPembayaranTable() {
    displayPembayaranTable();
}

function filterTransaksiTable() {
    displayTransaksiTable();
}

function sortAndDisplayTableData(tabName) {
    switch (tabName) {
        case 'produk':
            displayProdukTable();
            break;
        case 'kategori':
            displayKategoriTable();
            break;
        case 'pembayaran':
            displayPembayaranTable();
            break;
        case 'transaksi':
            displayTransaksiTable();
            break;
    }
}

// Enhanced Modal Functions
function showTransactionDetail(transactionId) {
    const transaction = state.transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    // Populate modal data
    document.getElementById('detail-transaction-id-display').textContent = transaction.id;
    document.getElementById('detail-transaction-date').textContent =
        formatDate(transaction.tanggal) + ' ' + formatTime(transaction.tanggal);
    document.getElementById('detail-payment-method').textContent =
        getPaymentMethodName(transaction.id_metode);
    document.getElementById('detail-transaction-status').textContent = 'Berhasil';
    document.getElementById('detail-transaction-total').textContent =
        formatRupiah(transaction.total_penjualan || 0);

    // Show modal
    const modal = document.getElementById('transaction-detail-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Keyboard Navigation
function initializeKeyboardNavigation() {
    document.addEventListener('keydown', function (e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            const activeModals = document.querySelectorAll('.modal.active');
            activeModals.forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
            });

            const fabMenu = document.getElementById('fab-menu');
            if (fabMenu && fabMenu.classList.contains('active')) {
                fabMenu.classList.remove('active');
            }
        }

        // Ctrl/Cmd + R refreshes data
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            const refreshBtn = document.getElementById('settings-refresh-btn');
            if (refreshBtn) {
                refreshBtn.click();
            }
        }
    });
}

// Performance Optimization
function initializePerformanceOptimizations() {
    // Lazy load images in tables
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Debounce scroll events for better performance
    let scrollTimeout;
    window.addEventListener('scroll', function () {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(function () {
            // Handle scroll-based optimizations if needed
        }, 100);
    });
}

// Enhanced Error Handling
function handleSettingsError(error, operation) {
    console.error(`Settings error in ${operation}:`, error);

    let message = 'Terjadi kesalahan';
    if (error.message) {
        message = error.message;
    } else if (error.result?.error?.message) {
        message = error.result.error.message;
    }

    showNotification(`Gagal ${operation}: ${message}`, 'error');
}

// Initialize Everything When Settings Page is Shown
function showEnhancedSettingsPage() {
    // Hide other pages
    document.querySelectorAll('.page').forEach(page => {
        if (page.id !== 'pengaturan-page') {
            page.style.display = 'none';
        }
    });

    // Show settings page
    const pengaturanPage = document.getElementById('pengaturan-page');
    if (pengaturanPage) {
        pengaturanPage.style.display = 'block';
    }

    // Initialize enhanced settings if not already initialized
    if (!pengaturanPage.classList.contains('enhanced-initialized')) {
        initializeEnhancedSettings();
        initializeKeyboardNavigation();
        initializePerformanceOptimizations();
        pengaturanPage.classList.add('enhanced-initialized');
    }

    // Update statistics
    calculateSettingsStatistics();
    displaySettingsStatistics();

    // Ensure transaction data is loaded for the Settings page
    if (typeof loadTransactions === 'function') {
        loadTransactions().then(() => {
            // Update state with loaded transaction data
            updateState({ transactions: state.transactions || [] });
        }).catch(error => {
            console.error('Error loading transactions for Settings page:', error);
        });
    }
}

// Update existing navigation to use enhanced settings
function updateNavigationForEnhancedSettings() {
    // Override the existing navigation click handler for settings
    const settingsNavItems = document.querySelectorAll('[data-page="pengaturan-page"]');

    settingsNavItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            showEnhancedSettingsPage();
        });
    });
}

// Call this function during app initialization
document.addEventListener('DOMContentLoaded', function () {
    // ... existing initialization code ...

    // Update navigation after a delay to ensure all elements are loaded
    setTimeout(() => {
        updateNavigationForEnhancedSettings();
    }, 1000);
});

// Initialize Enhanced Tab Navigation
function initializeEnhancedTabs() {
    const tabButtons = document.querySelectorAll('.enhanced-tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');

            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Show target tab content
            const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(targetTab + '-tab').classList.add('active');

            // Update URL hash
            window.location.hash = targetTab;

            // Load tab-specific data
            loadTabData(targetTab);

            // Reset filters and pagination for new tab
            resetTabState(targetTab);
        });
    });

    // Handle browser back/forward navigation
    window.addEventListener('hashchange', function () {
        const hash = window.location.hash.substring(1);
        if (hash && ['produk', 'kategori', 'pembayaran', 'detail_transaksi'].includes(hash)) {
            const tabButton = document.querySelector(`[data-tab="${hash}"]`);
            if (tabButton) {
                tabButton.click();
            }
        }
    });

    // Activate tab based on URL hash on page load
    if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const tabButton = document.querySelector(`[data-tab="${hash}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }
}

// Initialize Enhanced Search Functionality
function initializeEnhancedSearch() {
    // Product search
    const productSearch = document.getElementById('product-search');
    const productSearchClear = document.getElementById('product-search-clear');

    if (productSearch) {
        productSearch.addEventListener('input', debounce(function () {
            state.settingsFilters.produk.search = this.value;
            filterProdukTable();
            updateSearchClearButton('product-search-clear', this.value);
        }, 300));
    }

    if (productSearchClear) {
        productSearchClear.addEventListener('click', function () {
            productSearch.value = '';
            state.settingsFilters.produk.search = '';
            filterProdukTable();
            updateSearchClearButton('product-search-clear', '');
        });
    }

    // Category search
    const categorySearch = document.getElementById('category-search');
    const categorySearchClear = document.getElementById('category-search-clear');

    if (categorySearch) {
        categorySearch.addEventListener('input', debounce(function () {
            state.settingsFilters.kategori.search = this.value;
            filterKategoriTable();
            updateSearchClearButton('category-search-clear', this.value);
        }, 300));
    }

    if (categorySearchClear) {
        categorySearchClear.addEventListener('click', function () {
            categorySearch.value = '';
            state.settingsFilters.kategori.search = '';
            filterKategoriTable();
            updateSearchClearButton('category-search-clear', '');
        });
    }

    // Payment search
    const paymentSearch = document.getElementById('payment-search');
    const paymentSearchClear = document.getElementById('payment-search-clear');

    if (paymentSearch) {
        paymentSearch.addEventListener('input', debounce(function () {
            state.settingsFilters.pembayaran.search = this.value;
            filterPembayaranTable();
            updateSearchClearButton('payment-search-clear', this.value);
        }, 300));
    }

    if (paymentSearchClear) {
        paymentSearchClear.addEventListener('click', function () {
            paymentSearch.value = '';
            state.settingsFilters.pembayaran.search = '';
            filterPembayaranTable();
            updateSearchClearButton('payment-search-clear', '');
        });
    }

    // Transaction search
    const transactionSearch = document.getElementById('transaction-search');
    const transactionSearchClear = document.getElementById('transaction-search-clear');

    if (transactionSearch) {
        transactionSearch.addEventListener('input', debounce(function () {
            state.settingsFilters.transaksi.search = this.value;
            filterTransaksiTable();
            updateSearchClearButton('transaction-search-clear', this.value);
        }, 300));
    }

    if (transactionSearchClear) {
        transactionSearchClear.addEventListener('click', function () {
            transactionSearch.value = '';
            state.settingsFilters.transaksi.search = '';
            filterTransaksiTable();
            updateSearchClearButton('transaction-search-clear', '');
        });
    }
}

// Initialize Enhanced Filter Functionality
function initializeEnhancedFilters() {
    // Product filters
    const productStatusFilter = document.getElementById('product-status-filter');
    const productCategoryFilter = document.getElementById('product-category-filter');

    if (productStatusFilter) {
        productStatusFilter.addEventListener('change', function () {
            state.settingsFilters.produk.status = this.value;
            filterProdukTable();
        });
    }

    if (productCategoryFilter) {
        productCategoryFilter.addEventListener('change', function () {
            state.settingsFilters.produk.category = this.value;
            filterProdukTable();
        });

        // Populate category filter options
        populateCategoryFilterOptions();
    }

    // Transaction filters
    const dateFilterFrom = document.getElementById('date-filter-from');
    const dateFilterTo = document.getElementById('date-filter-to');
    const transactionStatusFilter = document.getElementById('transaction-status-filter');

    if (dateFilterFrom) {
        dateFilterFrom.addEventListener('change', function () {
            state.settingsFilters.transaksi.dateFrom = this.value;
            filterTransaksiTable();
        });
    }

    if (dateFilterTo) {
        dateFilterTo.addEventListener('change', function () {
            state.settingsFilters.transaksi.dateTo = this.value;
            filterTransaksiTable();
        });
    }

    if (transactionStatusFilter) {
        transactionStatusFilter.addEventListener('change', function () {
            state.settingsFilters.transaksi.status = this.value;
            filterTransaksiTable();
        });
    }
}

// Initialize Bulk Operations
function initializeBulkOperations() {
    // Select all checkboxes
    const selectAllCheckboxes = document.querySelectorAll('.select-all');

    selectAllCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const tabName = this.id.replace('select-all-', '');
            const table = document.getElementById(tabName + '-table');
            const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');

            checkboxes.forEach(cb => {
                cb.checked = this.checked;
                toggleRowSelection(tabName, cb.value, this.checked);
            });

            updateBulkActionsVisibility(tabName);
        });
    });

    // Individual row checkboxes
    document.addEventListener('change', function (e) {
        if (e.target.type === 'checkbox' && e.target.classList.contains('row-checkbox')) {
            const tabName = e.target.closest('table').id.replace('-table', '');
            toggleRowSelection(tabName, e.target.value, e.target.checked);
            updateSelectAllState(tabName);
            updateBulkActionsVisibility(tabName);
        }
    });
}

// Initialize Settings Statistics
function initializeSettingsStatistics() {
    calculateSettingsStatistics();
    displaySettingsStatistics();
}

// Initialize Export Functionality
function initializeExportFunctionality() {
    const exportBtn = document.getElementById('export-data-btn');
    const exportTransactionsBtn = document.getElementById('export-transactions-btn');

    if (exportBtn) {
        exportBtn.addEventListener('click', function () {
            exportSettingsData();
        });
    }

    if (exportTransactionsBtn) {
        exportTransactionsBtn.addEventListener('click', function () {
            exportTransactionData();
        });
    }
}

// Initialize Enhanced FAB Menu
function initializeEnhancedFAB() {
    const mainFab = document.getElementById('main-fab');
    const fabMenu = document.getElementById('fab-menu');

    if (mainFab && fabMenu) {
        mainFab.addEventListener('click', function () {
            fabMenu.classList.toggle('active');
        });

        // Close FAB menu when clicking outside
        document.addEventListener('click', function (e) {
            if (!mainFab.contains(e.target) && !fabMenu.contains(e.target)) {
                fabMenu.classList.remove('active');
            }
        });

        // FAB action buttons
        const fabAddProduct = document.getElementById('fab-add-product');
        const fabAddCategory = document.getElementById('fab-add-category');
        const fabAddPayment = document.getElementById('fab-add-payment');

        if (fabAddProduct) {
            fabAddProduct.addEventListener('click', function () {
                addProduct();
                fabMenu.classList.remove('active');
            });
        }

        if (fabAddCategory) {
            fabAddCategory.addEventListener('click', function () {
                addCategory();
                fabMenu.classList.remove('active');
            });
        }

        if (fabAddPayment) {
            fabAddPayment.addEventListener('click', function () {
                addPaymentMethod();
                fabMenu.classList.remove('active');
            });
        }
    }
}

// Initialize Table Sorting
function initializeTableSorting() {
    const sortableHeaders = document.querySelectorAll('th.sortable');

    sortableHeaders.forEach(header => {
        header.addEventListener('click', function () {
            const tableId = this.closest('table').id;
            const tabName = tableId.replace('-table', '');
            const column = this.getAttribute('data-sort');

            // Update sort direction
            const currentSort = state.settingsSorting[tabName];
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            // Update sort indicators
            updateSortIndicators(tabName);

            // Sort and display data
            sortAndDisplayTableData(tabName);
        });
    });
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateSearchClearButton(buttonId, searchValue) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.classList.toggle('visible', searchValue.length > 0);
    }
}

function toggleRowSelection(tabName, id, selected) {
    const selections = state.bulkSelections[tabName];
    if (selected) {
        if (!selections.includes(id)) {
            selections.push(id);
        }
    } else {
        const index = selections.indexOf(id);
        if (index > -1) {
            selections.splice(index, 1);
        }
    }
}

function updateSelectAllState(tabName) {
    const table = document.getElementById(tabName + '-table');
    const selectAllCheckbox = document.getElementById('select-all-' + tabName);
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');

    if (checkboxes.length === 0) return;

    const checkedCount = table.querySelectorAll('tbody input[type="checkbox"]:checked').length;
    selectAllCheckbox.checked = checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function updateBulkActionsVisibility(tabName) {
    const selections = state.bulkSelections[tabName];
    // Update UI to show/hide bulk action buttons based on selections
    console.log(`${tabName} bulk selections:`, selections);
}

// Statistics Functions
function calculateSettingsStatistics() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    state.settingsStats.totalProducts = state.products.length;
    state.settingsStats.totalCategories = state.categories.length;
    state.settingsStats.totalPaymentMethods = state.paymentMethods.length;
    state.settingsStats.totalTransactions = state.transactions.length;

    // Calculate revenue statistics
    state.settingsStats.totalRevenue = state.transactions.reduce((sum, trans) => {
        return sum + (parseFloat(trans.total_penjualan) || 0);
    }, 0);

    state.settingsStats.todayTransactions = state.transactions.filter(trans => {
        return trans.tanggal && trans.tanggal.startsWith(today);
    }).length;

    state.settingsStats.todayRevenue = state.transactions.filter(trans => {
        return trans.tanggal && trans.tanggal.startsWith(today);
    }).reduce((sum, trans) => {
        return sum + (parseFloat(trans.total_penjualan) || 0);
    }, 0);
}

function displaySettingsStatistics() {
    const statsContainer = document.getElementById('settings-stats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon primary">
                <span class="material-symbols-outlined">inventory_2</span>
            </div>
            <div>
                <div class="stat-value">${state.settingsStats.totalProducts}</div>
                <div class="stat-label">Total Produk</div>
                <div class="stat-change positive">Produk Aktif: ${state.products.filter(p => p.status === 'Aktif').length}</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon success">
                <span class="material-symbols-outlined">category</span>
            </div>
            <div>
                <div class="stat-value">${state.settingsStats.totalCategories}</div>
                <div class="stat-label">Total Kategori</div>
                <div class="stat-change positive">Kategori Aktif: ${state.categories.filter(c => c.status === 'Aktif').length}</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon info">
                <span class="material-symbols-outlined">payment</span>
            </div>
            <div>
                <div class="stat-value">${state.settingsStats.totalPaymentMethods}</div>
                <div class="stat-label">Metode Pembayaran</div>
                <div class="stat-change positive">Aktif: ${state.paymentMethods.filter(m => m.status === 'Aktif').length}</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon warning">
                <span class="material-symbols-outlined">receipt_long</span>
            </div>
            <div>
                <div class="stat-value">${state.settingsStats.totalTransactions}</div>
                <div class="stat-label">Total Transaksi</div>
                <div class="stat-change positive">Hari Ini: ${state.settingsStats.todayTransactions}</div>
            </div>
        </div>
    `;

    // Update tab badges
    updateTabBadges();
}

function updateTabBadges() {
    const produkCount = document.getElementById('produk-count');
    const kategoriCount = document.getElementById('kategori-count');
    const pembayaranCount = document.getElementById('pembayaran-count');
    const transaksiCount = document.getElementById('transaksi-count');

    if (produkCount) produkCount.textContent = state.products.length;
    if (kategoriCount) kategoriCount.textContent = state.categories.length;
    if (pembayaranCount) pembayaranCount.textContent = state.paymentMethods.length;
    if (transaksiCount) transaksiCount.textContent = state.transactions.length;
}

// Load Settings Data
function loadSettingsData() {
    console.log('Loading settings data...');
    showSettingsLoading();

    // Load all data for statistics
    Promise.all([
        loadProducts(),
        loadCategories(),
        loadPaymentMethods(),
        loadTransactions()
    ]).then(() => {
        calculateSettingsStatistics();
        displaySettingsStatistics();

        // Load data for active tab
        const activeTab = document.querySelector('.enhanced-tab-btn.active')?.getAttribute('data-tab') || 'produk';
        loadTabData(activeTab);

        hideSettingsLoading();
        console.log('Settings data loaded successfully');
    }).catch(error => {
        console.error('Error loading settings data:', error);
        hideSettingsLoading();
        showError('Gagal memuat data pengaturan');
    });
}

// Load Tab-Specific Data
function loadTabData(tabName) {
    switch (tabName) {
        case 'produk':
            displayProdukTable();
            populateCategoryFilterOptions();
            break;
        case 'kategori':
            displayKategoriTable();
            break;
        case 'pembayaran':
            displayPembayaranTable();
            break;
        case 'detail_transaksi':
            displayTransaksiTable();
            break;
    }
}

// Reset Tab State
function resetTabState(tabName) {
    // Reset filters
    state.settingsFilters[tabName] = {
        search: '',
        status: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: ''
    };

    // Reset pagination
    state.settingsPagination[tabName] = {
        page: 1,
        perPage: 10,
        total: 0
    };

    // Reset sorting
    state.settingsSorting[tabName] = {
        column: getDefaultSortColumn(tabName),
        direction: 'asc'
    };

    // Clear bulk selections
    state.bulkSelections[tabName] = [];

    // Clear search inputs
    const searchInput = document.getElementById(tabName + '-search');
    if (searchInput) {
        searchInput.value = '';
    }

    // Reset filter selects
    const statusFilter = document.getElementById(tabName + '-status-filter');
    if (statusFilter) {
        statusFilter.value = 'all';
    }
}

function getDefaultSortColumn(tabName) {
    switch (tabName) {
        case 'produk': return 'name';
        case 'kategori': return 'name';
        case 'pembayaran': return 'name';
        case 'transaksi': return 'date';
        default: return 'name';
    }
}

// Table Display Functions
function displayProdukTable() {
    const tbody = document.getElementById('product-table-body');
    if (!tbody) return;

    showTableLoading('produk-table');

    // Filter and sort data
    let filteredData = filterProdukData();
    filteredData = sortTableData(filteredData, 'produk');

    // Update pagination info
    state.settingsPagination.produk.total = filteredData.length;
    updatePaginationInfo('produk');

    // Paginate data
    const paginatedData = paginateData(filteredData, 'produk');

    tbody.innerHTML = '';

    if (paginatedData.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7" class="text-center py-8">
                    <div class="empty-state">
                        <span class="material-symbols-outlined empty-icon">inventory_2</span>
                        <p>Tidak ada produk ditemukan</p>
                    </div>
                </td>
            </tr>
        `;
        hideTableLoading('produk-table');
        return;
    }

    paginatedData.forEach((product, index) => {
        const category = state.categories.find(cat => cat.id === product.category);
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="checkbox-col">
                <input type="checkbox" class="row-checkbox" value="${product.id}">
            </td>
            <td class="image-col">
                <div class="product-image-thumb">
                    ${product.image ?
                `<img src="${product.image}" alt="${product.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
                `<span class="material-symbols-outlined">image</span>`
            }
                </div>
            </td>
            <td class="name-col">
                <div class="product-name-cell">
                    <span class="product-name">${product.name}</span>
                    ${product.description ? `<span class="product-desc">${product.description}</span>` : ''}
                </div>
            </td>
            <td class="category-col">
                <span class="category-badge">${category ? category.name : 'Tidak ada kategori'}</span>
            </td>
            <td class="price-col">
                <span class="price-value">${formatRupiah(product.price)}</span>
            </td>
            <td class="status-col">
                <span class="status-badge ${product.status === 'Aktif' ? 'success' : 'danger'}">${product.status}</span>
            </td>
            <td class="actions-col">
                <button class="action-btn edit-btn" data-id="${product.id}" title="Edit">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="action-btn delete-btn" data-id="${product.id}" title="Hapus">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Add event listeners
    addProdukTableEventListeners();

    hideTableLoading('produk-table');
}

function displayKategoriTable() {
    const tbody = document.getElementById('category-table-body');
    if (!tbody) return;

    showTableLoading('kategori-table');

    // Filter and sort data
    let filteredData = filterKategoriData();
    filteredData = sortTableData(filteredData, 'kategori');

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4" class="text-center py-8">
                    <div class="empty-state">
                        <span class="material-symbols-outlined empty-icon">category</span>
                        <p>Tidak ada kategori ditemukan</p>
                    </div>
                </td>
            </tr>
        `;
        hideTableLoading('kategori-table');
        return;
    }

    filteredData.forEach(category => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="name-col">${category.name}</td>
            <td class="order-col">${category.order || 0}</td>
            <td class="status-col">
                <span class="status-badge ${category.status === 'Aktif' ? 'success' : 'danger'}">${category.status}</span>
            </td>
            <td class="actions-col">
                <button class="action-btn edit-btn" data-id="${category.id}" title="Edit">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="action-btn delete-btn" data-id="${category.id}" title="Hapus">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Add event listeners
    addKategoriTableEventListeners();

    hideTableLoading('kategori-table');
}

function displayPembayaranTable() {
    const container = document.getElementById('payment-cards');
    if (!container) return;

    showCardsLoading();

    // Filter data
    let filteredData = filterPembayaranData();

    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">payment</span>
                <p>Tidak ada metode pembayaran ditemukan</p>
            </div>
        `;
        hideCardsLoading();
        return;
    }

    filteredData.forEach(method => {
        const card = document.createElement('div');
        card.className = 'payment-card';
        card.innerHTML = `
            <div class="payment-card-header">
                <h4 class="payment-card-title">${method.name}</h4>
                <span class="payment-card-status status-badge ${method.status === 'Aktif' ? 'success' : 'danger'}">${method.status}</span>
            </div>
            <div class="payment-card-body">
                <div class="payment-card-type">
                    <span class="material-symbols-outlined">category</span>
                    ${method.type}
                </div>
            </div>
            <div class="payment-card-actions">
                <button class="action-btn edit-btn" data-id="${method.id}" title="Edit">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="action-btn delete-btn" data-id="${method.id}" title="Hapus">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Add event listeners
    addPembayaranTableEventListeners();

    hideCardsLoading();
}

function displayTransaksiTable() {
    const tbody = document.getElementById('transaction-table-body');
    if (!tbody) return;

    showTableLoading('transaksi-table');

    // Filter and sort data
    let filteredData = filterTransaksiData();
    filteredData = sortTableData(filteredData, 'transaksi');

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6" class="text-center py-8">
                    <div class="empty-state">
                        <span class="material-symbols-outlined empty-icon">receipt_long</span>
                        <p>Tidak ada transaksi ditemukan</p>
                    </div>
                </td>
            </tr>
        `;
        hideTableLoading('transaksi-table');
        return;
    }

    filteredData.forEach(transaction => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="id-col">
                <span class="transaction-id">${transaction.id}</span>
            </td>
            <td class="date-col">
                <div class="date-cell">
                    <span class="date-value">${formatDate(transaction.tanggal)}</span>
                    <span class="time-value">${formatTime(transaction.tanggal)}</span>
                </div>
            </td>
            <td class="amount-col">
                <span class="amount-value">${formatRupiah(transaction.total_penjualan || 0)}</span>
            </td>
            <td class="method-col">
                <span class="method-badge">${getPaymentMethodName(transaction.id_metode)}</span>
            </td>
            <td class="status-col">
                <span class="status-badge success">Berhasil</span>
            </td>
            <td class="actions-col">
                <button class="action-btn detail-btn" data-id="${transaction.id}" title="Detail">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
                <button class="action-btn print-btn" data-id="${transaction.id}" title="Cetak">
                    <span class="material-symbols-outlined">print</span>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Add event listeners
    addTransaksiTableEventListeners();

    hideTableLoading('transaksi-table');
}

// Filter Functions
function filterProdukData() {
    const filters = state.settingsFilters.produk;
    let data = [...state.products];

    // Search filter
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        data = data.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }

    // Status filter
    if (filters.status !== 'all') {
        data = data.filter(product => product.status === filters.status);
    }

    // Category filter
    if (filters.category !== 'all') {
        data = data.filter(product => product.category === filters.category);
    }

    return data;
}

function filterKategoriData() {
    const filters = state.settingsFilters.kategori;
    let data = [...state.categories];

    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        data = data.filter(category =>
            category.name.toLowerCase().includes(searchTerm)
        );
    }

    return data;
}

function filterPembayaranData() {
    const filters = state.settingsFilters.pembayaran;
    let data = [...state.paymentMethods];

    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        data = data.filter(method =>
            method.name.toLowerCase().includes(searchTerm) ||
            method.type.toLowerCase().includes(searchTerm)
        );
    }

    return data;
}

function filterTransaksiData() {
    const filters = state.settingsFilters.transaksi;
    let data = [...state.transactions];

    // Search filter
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        data = data.filter(transaction =>
            transaction.id.toLowerCase().includes(searchTerm) ||
            (transaction.nama_kasir && transaction.nama_kasir.toLowerCase().includes(searchTerm))
        );
    }

    // Date filters
    if (filters.dateFrom) {
        data = data.filter(transaction => transaction.tanggal >= filters.dateFrom);
    }

    if (filters.dateTo) {
        data = data.filter(transaction => transaction.tanggal <= filters.dateTo + 'T23:59:59');
    }

    return data;
}

// Sort Functions
function sortTableData(data, tabName) {
    const sortConfig = state.settingsSorting[tabName];

    return data.sort((a, b) => {
        let valueA = a[sortConfig.column];
        let valueB = b[sortConfig.column];

        // Handle different data types
        if (sortConfig.column === 'price' || sortConfig.column === 'total_penjualan') {
            valueA = parseFloat(valueA) || 0;
            valueB = parseFloat(valueB) || 0;
        } else if (sortConfig.column === 'date') {
            valueA = new Date(valueA);
            valueB = new Date(valueB);
        } else {
            valueA = (valueA || '').toString().toLowerCase();
            valueB = (valueB || '').toString().toLowerCase();
        }

        if (valueA < valueB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

function updateSortIndicators(tabName) {
    const sortConfig = state.settingsSorting[tabName];
    const table = document.getElementById(tabName + '-table');

    if (table) {
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            const column = header.getAttribute('data-sort');
            const indicator = header.querySelector('.sort-indicator');

            if (column === sortConfig.column) {
                indicator.textContent = sortConfig.direction === 'asc' ? '↑' : '↓';
                indicator.style.opacity = '1';
            } else {
                indicator.textContent = '';
                indicator.style.opacity = '0.5';
            }
        });
    }
}

// Pagination Functions
function paginateData(data, tabName) {
    const pagination = state.settingsPagination[tabName];
    const startIndex = (pagination.page - 1) * pagination.perPage;
    const endIndex = startIndex + pagination.perPage;

    return data.slice(startIndex, endIndex);
}

function updatePaginationInfo(tabName) {
    const pagination = state.settingsPagination[tabName];
    const info = document.getElementById(tabName + '-pagination-info');

    if (info) {
        const start = pagination.total > 0 ? (pagination.page - 1) * pagination.perPage + 1 : 0;
        const end = Math.min(pagination.page * pagination.perPage, pagination.total);

        info.textContent = `Menampilkan ${start}-${end} dari ${pagination.total} item`;
    }
}

// Loading State Functions
function showSettingsLoading() {
    const statsContainer = document.getElementById('settings-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="loading-skeleton" style="grid-column: 1/-1;">
                <div class="loading-shimmer"></div>
            </div>
        `;
    }
}

function hideSettingsLoading() {
    // Loading will be hidden when statistics are displayed
}

function showTableLoading(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.classList.add('loading');
    }
}

function hideTableLoading(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.classList.remove('loading');
    }
}

function showCardsLoading() {
    const container = document.getElementById('payment-cards');
    if (container) {
        container.classList.add('loading');
    }
}

function hideCardsLoading() {
    const container = document.getElementById('payment-cards');
    if (container) {
        container.classList.remove('loading');
    }
}

// Utility Functions for Enhanced Features
function populateCategoryFilterOptions() {
    const filter = document.getElementById('product-category-filter');
    if (!filter) return;

    filter.innerHTML = '<option value="all">Semua Kategori</option>';

    state.categories.filter(cat => cat.status === 'Aktif').forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        filter.appendChild(option);
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPaymentMethodName(methodId) {
    const method = state.paymentMethods.find(m => m.id === methodId);
    return method ? method.name : 'Tidak diketahui';
}

// Event Listeners for Table Actions
function addProdukTableEventListeners() {
    // Edit buttons
    document.querySelectorAll('#produk-table .edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            editProduct(id);
        });
    });

    // Delete buttons
    document.querySelectorAll('#produk-table .delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            deleteProduct(id);
        });
    });
}

function addKategoriTableEventListeners() {
    // Edit buttons
    document.querySelectorAll('#kategori-table .edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            editCategory(id);
        });
    });

    // Delete buttons
    document.querySelectorAll('#kategori-table .delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            deleteCategory(id);
        });
    });
}

function addPembayaranTableEventListeners() {
    // Edit buttons
    document.querySelectorAll('#payment-cards .edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            editPaymentMethod(id);
        });
    });

    // Delete buttons
    document.querySelectorAll('#payment-cards .delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            deletePaymentMethod(id);
        });
    });
}

function addTransaksiTableEventListeners() {
    // Detail buttons
    document.querySelectorAll('#transaksi-table .detail-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            showTransactionDetail(id);
        });
    });

    // Print buttons
    document.querySelectorAll('#transaksi-table .print-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            printTransaction(id);
        });
    });

    // Ensure modal event listeners are attached (for Settings page context)
    ensureTransactionModalListeners();
}

// Export Functions
function exportSettingsData() {
    const data = {
        products: state.products,
        categories: state.categories,
        paymentMethods: state.paymentMethods,
        exportedAt: new Date().toISOString(),
        exportedBy: state.user?.name || 'Unknown'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportTransactionData() {
    const filteredData = filterTransaksiData();
    const data = {
        transactions: filteredData,
        exportedAt: new Date().toISOString(),
        exportedBy: state.user?.name || 'Unknown',
        totalTransactions: filteredData.length
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-transactions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

// Ensure transaction modal listeners are properly attached (for Settings page context)
function ensureTransactionModalListeners() {
    // Close modal buttons
    const closeDetailBtn = document.getElementById('close-detail-btn');
    const closeTransactionDetail = document.getElementById('close-transaction-detail');
    const transactionDetailModal = document.getElementById('transaction-detail-modal');
    const printTransactionDetail = document.getElementById('print-transaction-detail');

    // Remove existing listeners to prevent duplicates
    if (closeDetailBtn) {
        closeDetailBtn.replaceWith(closeDetailBtn.cloneNode(true));
    }
    if (closeTransactionDetail) {
        closeTransactionDetail.replaceWith(closeTransactionDetail.cloneNode(true));
    }
    if (printTransactionDetail) {
        printTransactionDetail.replaceWith(printTransactionDetail.cloneNode(true));
    }

    // Reattach fresh listeners
    const newCloseDetailBtn = document.getElementById('close-detail-btn');
    const newCloseTransactionDetail = document.getElementById('close-transaction-detail');
    const newTransactionDetailModal = document.getElementById('transaction-detail-modal');
    const newPrintTransactionDetail = document.getElementById('print-transaction-detail');

    if (newCloseDetailBtn && newTransactionDetailModal) {
        newCloseDetailBtn.addEventListener('click', () => {
            newTransactionDetailModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (newCloseTransactionDetail && newTransactionDetailModal) {
        newCloseTransactionDetail.addEventListener('click', () => {
            newTransactionDetailModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (newPrintTransactionDetail) {
        newPrintTransactionDetail.addEventListener('click', () => {
            const transactionId = document.getElementById('detail-transaction-id').textContent;
            if (typeof printTransaction === 'function') {
                printTransaction(transactionId);
            }
        });
    }
}

// Simplified Modal Management - Removed enhanced features for cleaner implementation

// Removed enhanced modal focus management for cleaner implementation

// Removed enhanced modal keyboard navigation for cleaner implementation

// Removed enhanced modal backdrop click for cleaner implementation

// Removed enhanced modal state management for cleaner implementation

// Removed enhanced modal animations for cleaner implementation

// Removed enhanced modal accessibility for cleaner implementation

// Debounce mechanism for payment interface setup
let paymentInterfaceSetupTimeout = null;

// Function to setup payment interface with debouncing
function setupPaymentInterface(totalValue) {
    // Clear existing timeout to prevent multiple rapid calls
    if (paymentInterfaceSetupTimeout) {
        clearTimeout(paymentInterfaceSetupTimeout);
    }

    // Setup payment interface after a short delay to ensure DOM is ready
    paymentInterfaceSetupTimeout = setTimeout(() => {
        console.log('Setting up payment interface for total:', totalValue);

        // Render payment methods if function exists (only once per setup)
        if (typeof renderPaymentMethods === 'function' && !window.paymentMethodsRendered) {
            renderPaymentMethods();
            window.paymentMethodsRendered = true;
        }

        // Render payment amount options if function exists (only once per setup)
        if (typeof renderPaymentAmountOptions === 'function' && !window.paymentAmountOptionsRendered) {
            renderPaymentAmountOptions(totalValue);
            window.paymentAmountOptionsRendered = true;
        }

        // Ensure all event listeners are properly attached (only once)
        ensurePaymentEventListeners();

        console.log('Payment interface setup completed');
        paymentInterfaceSetupTimeout = null;
    }, 150); // Increased delay for better stability
}

// Function to ensure all payment event listeners are properly attached (optimized)
function ensurePaymentEventListeners() {
    console.log('Ensuring payment event listeners are properly attached...');

    // Use a flag to prevent duplicate attachment
    if (window.paymentListenersAttached) {
        console.log('Payment listeners already attached, skipping duplicate attachment');
        return;
    }

    // Re-attach payment method button listeners
    if (paymentMethodsContainer) {
        const methodBtns = paymentMethodsContainer.querySelectorAll('.payment-method-btn');
        methodBtns.forEach(btn => {
            // Clone and replace to remove all existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', handlePaymentMethodClick);
        });
        console.log(`Attached ${methodBtns.length} payment method listeners`);
    }

    // Re-attach payment amount option listeners
    if (paymentAmountOptions) {
        const amountBtns = paymentAmountOptions.querySelectorAll('.payment-amount-option');
        amountBtns.forEach(btn => {
            // Clone and replace to remove all existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', handlePaymentAmountOptionClick);
        });
        console.log(`Attached ${amountBtns.length} payment amount listeners`);
    }

    // Re-attach modal close listeners
    const closeBtns = [
        { id: 'close-checkout-modal', modalId: 'checkout-modal' },
        { id: 'cancel-checkout', modalId: 'checkout-modal' },
        { id: 'close-success-modal', modalId: 'success-modal' },
        { id: 'close-success-modal-btn', modalId: 'success-modal' }
    ];

    closeBtns.forEach(({ id, modalId }) => {
        const btn = document.getElementById(id);
        if (btn) {
            // Clone and replace to remove all existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            const modal = document.getElementById(modalId);
            if (modal) {
                newBtn.addEventListener('click', () => handleModalClose(modal));
            }
        }
    });

    // Set flag to prevent duplicate attachment
    window.paymentListenersAttached = true;
    console.log('All payment event listeners attached');
}

// Handle modal close with proper cleanup
function handleModalClose(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';

        // Reset payment listeners flag when checkout modal is closed
        // This allows fresh listener attachment on next modal open
        if (modal.id === 'checkout-modal') {
            window.paymentListenersAttached = false;
            window.paymentMethodsRendered = false;
            window.paymentAmountOptionsRendered = false;
            window.isProcessingCheckout = false;
            console.log('Payment interface flags reset for next checkout');
        }

        console.log('Modal closed:', modal.id);
    }
}

// Simplified modal management - basic functionality retained