// Konfigurasi Aplikasi
const CONFIG = {
    // Ganti dengan Client ID dari Google Cloud Console
    clientId: '883588123458-kc7p924f89q7dtg4ape0u8lslqjqvmrt.apps.googleusercontent.com',
    // Ganti dengan ID Google Sheet Anda
    spreadsheetId: '1gd1JcYiuUsPXO1xbwKHJomnLxMdK7s7xfJ60l3p7WKw',
    // Konfigurasi standar untuk Google API
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    scope: 'https://www.googleapis.com/auth/spreadsheets',
};

// Data Aplikasi
let products = [];
let categories = [];
let paymentMethods = [];
let cart = [];
let currentUser = null;
let gapiInited = false;
let gisInited = false;
let tokenClient;

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
const checkoutBtn = document.getElementById('checkout-btn');
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

// Tampilkan status loading
function showLoading(button, textElement) {
    button.disabled = true;
    textElement.innerHTML = '<div class="loading"></div>';
}

// Sembunyikan status loading
function hideLoading(button, textElement, text) {
    button.disabled = false;
    textElement.textContent = text;
}

// Inisialisasi Google API
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: '',
        discoveryDocs: CONFIG.discoveryDocs,
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.clientId,
        scope: CONFIG.scope,
        callback: '', // Akan diatur nanti
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        loginBtn.disabled = false;
        loginStatus.textContent = 'Aplikasi siap. Silakan login.';
    }
}

// Handle Login
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw resp;
        }

        loginStatus.textContent = 'Login berhasil! Memuat data...';

        // Set user info
        const userInfo = await getUserInfo();
        currentUser = {
            name: userInfo.name,
            email: userInfo.email,
            avatar: userInfo.name.charAt(0).toUpperCase()
        };

        userAvatar.textContent = currentUser.avatar;
        userName.textContent = currentUser.name;
        userAvatarSettings.textContent = currentUser.avatar;
        userNameSettings.textContent = currentUser.name;

        // Load data dari Google Sheets
        await loadAllData();

        // Render kategori produk
        renderCategories();

        // Tampilkan halaman kasir
        loginPage.classList.remove('active');
        kasirPage.classList.add('active');

        // Tampilkan navbar setelah login berhasil
        document.querySelector('.bottom-nav').style.display = 'flex';

        loginStatus.textContent = '';
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Dapatkan info user
async function getUserInfo() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error mendapatkan info user:', error);
        return { name: 'User', email: 'user@example.com' };
    }
}

// Handle Logout
function handleSignout() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        currentUser = null;
        cart = [];
        renderCart();

        kasirPage.classList.remove('active');
        pengaturanPage.classList.remove('active');
        keranjangMobilePage.classList.remove('active');
        loginPage.classList.add('active');

        // Sembunyikan navbar di halaman login
        document.querySelector('.bottom-nav').style.display = 'none';

        loginStatus.textContent = 'Anda telah logout.';
    }
}

// Load semua data dari Google Sheets
async function loadAllData() {
    try {
        // Ambil data dari Google Sheets
        await loadCategories();
        await loadProducts();
        await loadPaymentMethods();

        // Render elemen-elemen statis yang tidak butuh halaman kasir aktif
        renderProducts();
        renderProductTable();
        renderCategoryTable();
        renderPaymentTable();
        populateCategorySelect();
        populatePaymentMethodSelect();
        renderPaymentMethods();
        renderCategories();

        // ⚠️ Jangan panggil renderCart() di sini
        // (akan dipanggil setelah kasir-page aktif di handleAuthClick)
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Gagal memuat data dari Google Sheets. Periksa koneksi dan izin.');
    }
}



// Load produk dari Google Sheets
async function loadProducts() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Produk!A2:G', // A2:G untuk menghindari header
    });

    const values = response.result.values || [];
    products = values.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        description: row[2] || '',
        price: parseInt(row[3]?.replace(/[^\d]/g, '')) || 0,
        category: row[4] || '',
        image: row[5] || '',
        status: row[6] || 'Aktif'
    }));
}

// Load kategori dari Google Sheets
async function loadCategories() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Kategori!A2:D', // A2:D untuk menghindari header
    });

    const values = response.result.values || [];
    categories = values.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        order: parseInt(row[2]) || 0,
        status: row[3] || 'Aktif'
    }));
}

// Load metode pembayaran dari Google Sheets
async function loadPaymentMethods() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.spreadsheetId,
        range: 'Metode_Pembayaran!A2:D', // A2:D untuk menghindari header
    });

    const values = response.result.values || [];
    paymentMethods = values.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        type: row[2] || '',
        status: row[3] || 'Aktif'
    }));
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

// Render Kategori
function renderCategories() {
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';

    // Tambahkan kategori "Semua"
    const allCategoryBtn = document.createElement('button');
    allCategoryBtn.className = 'category-btn active';
    allCategoryBtn.textContent = 'Semua';
    allCategoryBtn.dataset.categoryId = 'all';
    allCategoryBtn.addEventListener('click', () => filterProductsByCategory('all'));
    categoryList.appendChild(allCategoryBtn);

    // Tambahkan kategori lainnya
    categories.forEach(category => {
        const categoryBtn = document.createElement('button');
        categoryBtn.className = 'category-btn';
        categoryBtn.textContent = category.name;
        categoryBtn.dataset.categoryId = category.id;
        categoryBtn.addEventListener('click', () => filterProductsByCategory(category.id));
        categoryList.appendChild(categoryBtn);
    });
}

// Filter produk berdasarkan kategori
function filterProductsByCategory(categoryId) {
    // Ubah status aktif pada tombol kategori
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.categoryId === categoryId) {
            btn.classList.add('active');
        }
    });

    // Filter produk
    renderProducts(categoryId);
}

// Render Produk
function renderProducts(categoryId = 'all') {
    productGrid.innerHTML = '';
    let activeProducts = products.filter(product => product.status === 'Aktif');

    // Filter berdasarkan kategori jika bukan 'all'
    if (categoryId !== 'all') {
        activeProducts = activeProducts.filter(product => product.category === categoryId);
    }

    if (activeProducts.length === 0) {
        productGrid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 20px;">Tidak ada produk yang tersedia</div>';
        return;
    }

    activeProducts.forEach(product => {
        const category = categories.find(cat => cat.id === product.category);
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image">
                ${product.image ?
                `<img src="${product.image}" alt="${product.name}">` :
                `<i class="fas fa-coffee"></i>`
            }
                <div class="add-to-cart">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${formatRupiah(product.price)}</div>
            </div>
        `;
        productCard.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(productCard);
    });
}

// Render Keranjang
function renderCart() {
    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="text-center">Keranjang kosong</div>';
        cartCount.textContent = '0 item';
        cartSubtotal.textContent = formatRupiah(0);
        if (cartDiscount) cartDiscount.textContent = formatRupiah(0);
        cartTotal.textContent = formatRupiah(0);

        // Update mobile cart badge when cart is empty
        if (mobileCartBadge) {
            mobileCartBadge.textContent = '0';
        }
        return;
    }

    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${formatRupiah(item.price)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                <button class="remove-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cartItems.appendChild(cartItem);
    });

    // Tidak ada diskon
    const discount = 0;
    const total = subtotal;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = `${totalItems} item`;
    cartSubtotal.textContent = formatRupiah(subtotal);
    if (cartDiscount) cartDiscount.textContent = formatRupiah(discount);
    cartTotal.textContent = formatRupiah(total);

    // Update mobile cart badge
    if (mobileCartBadge) {
        mobileCartBadge.textContent = totalItems;
    }

    // Tambahkan event listener untuk tombol di keranjang
    document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            decreaseQuantity(id);
        });
    });

    document.querySelectorAll('.increase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            increaseQuantity(id);
        });
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.remove-btn').getAttribute('data-id');
            removeFromCart(id);
        });
    });
}

// Tambah ke Keranjang
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    renderCart();

    // Animasi feedback
    // Menggunakan metode alternatif untuk menemukan kartu produk
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
}

// Kurangi Kuantitas
function decreaseQuantity(productId) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        if (item.quantity > 1) {
            item.quantity -= 1;
        } else {
            cart = cart.filter(item => item.id !== productId);
        }
        renderCart();
    }
}

// Tambah Kuantitas
function increaseQuantity(productId) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += 1;
        renderCart();
    }
}

// Hapus dari Keranjang
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
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

    categories
        .filter(cat => cat.status === 'Aktif')
        .forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            productCategorySelect.appendChild(option);
        });
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
    document.getElementById('product-status').value = product.status;

    // Set kategori
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
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Simpan transaksi ke localStorage untuk Detail Transaksi
        if (typeof saveTransactionToLocalStorage === 'function' && cart && Array.isArray(cart) && cart.length > 0) {
            saveTransactionToLocalStorage(transactionId, total, paymentMethod, cart);
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
            nama_kasir: currentUser.name
        };

        // Data detail transaksi
        const details = cart.map(item => ({
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

        // Reset keranjang
        cart = [];
        renderCart();

        // Tutup checkout modal
        checkoutModal.classList.remove('active');
    } catch (error) {
        console.error('Error menyimpan transaksi:', error);
        alert('Gagal menyimpan transaksi. Silakan coba lagi.');
    } finally {
        hideLoading(confirmPaymentBtn, confirmPaymentText, 'Bayar');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Sembunyikan bottom navigation saat pertama kali dimuat (login page)
    document.querySelector('.bottom-nav').style.display = 'none';

    // Inisialisasi Google API
    gapiLoaded();
    gisLoaded();

    // Login dengan Google
    loginBtn.addEventListener('click', handleAuthClick);

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
                updateMobileCart();
            }
        });
    });

    // Fungsi untuk memperbarui tampilan keranjang mobile
    function updateMobileCart() {
        cartItemsMobile.innerHTML = '';
        let subtotal = 0;

        if (cart.length === 0) {
            cartItemsMobile.innerHTML = '<div class="empty-cart">Keranjang kosong</div>';
            mobileCartBadge.textContent = '0';
            cartSubtotalMobile.textContent = formatRupiah(0);
            if (cartDiscountMobile) cartDiscountMobile.textContent = formatRupiah(0);
            cartTotalMobile.textContent = formatRupiah(0);
            return;
        }

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            // Tampilan keranjang mobile
            const cartItemMobileElement = document.createElement('div');
            cartItemMobileElement.className = 'cart-item';
            cartItemMobileElement.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${formatRupiah(item.price)}</p>
                </div>
                <div class="cart-item-actions">
                    <button class="quantity-btn minus-mobile" data-id="${item.id}">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn plus-mobile" data-id="${item.id}">+</button>
                </div>
            `;
            cartItemsMobile.appendChild(cartItemMobileElement);
        });

        // Update summary - tanpa diskon
        const discount = 0;
        const total = subtotal;

        // Update mobile - menampilkan jumlah total item di keranjang
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        mobileCartBadge.textContent = totalItems;
        cartSubtotalMobile.textContent = formatRupiah(subtotal);
        if (cartDiscountMobile) cartDiscountMobile.textContent = formatRupiah(discount);
        cartTotalMobile.textContent = formatRupiah(total);

        // Tambahkan event listener untuk tombol quantity di mobile
        document.querySelectorAll('.quantity-btn.minus-mobile').forEach(btn => {
            btn.addEventListener('click', () => {
                decreaseQuantity(btn.getAttribute('data-id'));
                updateMobileCart(); // Update tampilan mobile setelah perubahan
            });
        });

        document.querySelectorAll('.quantity-btn.plus-mobile').forEach(btn => {
            btn.addEventListener('click', () => {
                increaseQuantity(btn.getAttribute('data-id'));
                updateMobileCart(); // Update tampilan mobile setelah perubahan
            });
        });
    }

    // Tab pengaturan
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Update tab aktif
            tabBtns.forEach(tab => tab.classList.remove('active'));
            btn.classList.add('active');

            // Tampilkan konten tab yang sesuai
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });

    // Tombol tambah
    addProductBtn.addEventListener('click', addProduct);
    addCategoryBtn.addEventListener('click', addCategory);
    addPaymentBtn.addEventListener('click', addPaymentMethod);

    // Tombol checkout
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
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
        if (cart.length === 0) {
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

// Konfirmasi pembayaran
confirmPaymentBtn.addEventListener('click', processPayment);

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