// Fungsi untuk menyimpan transaksi ke localStorage
function saveTransactionToLocalStorage(transactionId, total, paymentMethod, items) {
    try {
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

        const transaction = {
            id: transactionId,
            date: new Date().toISOString(),
            total: total,
            paymentMethod: paymentMethod ? paymentMethod.name : 'Tunai',
            status: 'Selesai',
            items: items && Array.isArray(items) && items.length > 0 ? items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })) : []
        };

        transactions.push(transaction);
        localStorage.setItem('transactions', JSON.stringify(transactions));
    } catch (error) {
        console.error('Error menyimpan transaksi:', error);
    }
}

// Fungsi untuk memuat transaksi
async function loadTransactions() {
    try {
        // Tampilkan loading
        const transactionTableBody = document.getElementById('transaction-table-body');
        if (transactionTableBody) {
            transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data transaksi...</td></tr>';
        }

        // Coba ambil dari Google Sheets
        if (gapi.client && gapi.client.sheets) {
            try {
                // Ambil data transaksi dari Google Sheets
                const transactionResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Pos_Transaksi!A2:I',
                });

                const transactionRows = transactionResponse.result.values || [];

                // Ambil data detail transaksi dari Google Sheets
                const detailResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Detail_Transaksi!A2:H',
                });

                const detailRows = detailResponse.result.values || [];

                // Ambil data metode pembayaran untuk mendapatkan nama metode
                const paymentResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Metode_Pembayaran!A2:D',
                });

                const paymentRows = paymentResponse.result.values || [];
                const paymentMap = {};
                paymentRows.forEach(row => {
                    if (row[0]) paymentMap[row[0]] = row[1]; // id -> name
                });

                // Format data transaksi
                const transactions = transactionRows.map(row => {
                    const transactionId = row[0];
                    const paymentMethodId = row[5];

                    // Cari detail untuk transaksi ini
                    const items = detailRows
                        .filter(detailRow => detailRow[1] === transactionId)
                        .map(detailRow => ({
                            id: detailRow[0],
                            name: detailRow[3],
                            price: parseFloat(detailRow[4]),
                            quantity: parseInt(detailRow[5]),
                            total: parseFloat(detailRow[6]),
                            note: detailRow[7] || ''
                        }));

                    return {
                        id: transactionId,
                        date: row[1],
                        total: parseFloat(row[4]),
                        paymentMethod: paymentMap[paymentMethodId] || 'Tunai',
                        status: 'Selesai',
                        items: items,
                        // Data tambahan
                        totalSales: parseFloat(row[2]),
                        discount: parseFloat(row[3]),
                        amountPaid: parseFloat(row[6]),
                        change: parseFloat(row[7]),
                        cashierName: row[8]
                    };
                });

                renderTransactions(transactions);
                return;
            } catch (error) {
                console.error('Error memuat dari Google Sheets:', error);
                // Jika gagal, gunakan data dari localStorage sebagai fallback
            }
        }

        // Fallback ke localStorage jika Google Sheets gagal
        const storedTransactions = localStorage.getItem('transactions');
        const transactions = storedTransactions ? JSON.parse(storedTransactions) : [];

        renderTransactions(transactions);
    } catch (error) {
        console.error('Error memuat transaksi:', error);
        const transactionTableBody = document.getElementById('transaction-table-body');
        if (transactionTableBody) {
            transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error memuat data transaksi</td></tr>';
        }
    }
}

// Fungsi untuk menampilkan transaksi
function renderTransactions(transactions) {
    const transactionTableBody = document.getElementById('transaction-table-body');
    if (!transactionTableBody) return;

    transactionTableBody.innerHTML = '';

    if (transactions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center">Tidak ada data transaksi</td>';
        transactionTableBody.appendChild(row);
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement('tr');

        const date = new Date(transaction.date);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${formattedDate}</td>
            <td>${formatRupiah(transaction.total)}</td>
            <td>${transaction.paymentMethod}</td>
            <td><span class="status-badge active">${transaction.status}</span></td>
            <td>
                <button class="action-btn view-btn" data-id="${transaction.id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn print-btn" data-id="${transaction.id}">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        `;

        transactionTableBody.appendChild(row);
    });

    // Event listener untuk tombol lihat detail
    function attachViewButtonListeners() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const transactionId = btn.getAttribute('data-id');
                viewTransactionDetail(transactionId);
            });
        });
    }

    // Attach listeners when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachViewButtonListeners);
    } else {
        attachViewButtonListeners();
    }

    // Event listener untuk tombol print
    function attachPrintButtonListeners() {
        document.querySelectorAll('.print-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const transactionId = btn.getAttribute('data-id');
                printTransaction(transactionId);
            });
        });
    }

    // Attach print listeners when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachPrintButtonListeners);
    } else {
        attachPrintButtonListeners();
    }
}

// Fungsi untuk melihat detail transaksi
async function viewTransactionDetail(transactionId) {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    // Debug: Log all elements that should be in the DOM
    console.log('=== DEBUG TRANSACTION DETAIL MODAL ELEMENTS ===');
    console.log('Looking for transaction detail modal elements...');

    // Tampilkan modal dengan loading
    const modal = document.getElementById('transaction-detail-modal');
    const transactionIdEl = document.getElementById('detail-transaction-id');
    const transactionDateEl = document.getElementById('detail-transaction-date');
    const paymentMethodEl = document.getElementById('detail-payment-method');
    const transactionStatusEl = document.getElementById('detail-transaction-status');
    const transactionTotalEl = document.getElementById('detail-transaction-total');
    const transactionItemsBody = document.getElementById('transaction-items-body');

    // Debug: Log what we found
    console.log('Elements found:');
    console.log('- Modal:', modal);
    console.log('- Transaction ID Element:', transactionIdEl);
    console.log('- Transaction Date Element:', transactionDateEl);
    console.log('- Payment Method Element:', paymentMethodEl);
    console.log('- Transaction Status Element:', transactionStatusEl);
    console.log('- Transaction Total Element:', transactionTotalEl);
    console.log('- Transaction Items Body:', transactionItemsBody);

    // Check if all required elements exist
    if (!modal || !transactionIdEl || !transactionDateEl || !paymentMethodEl ||
        !transactionStatusEl || !transactionTotalEl || !transactionItemsBody) {
        console.error('Required elements for transaction detail modal not found');
        console.log('DOM Ready State:', document.readyState);
        console.log('Current page URL:', window.location.href);

        // Try to find all elements with debug logging
        const allPossibleElements = [
            'transaction-detail-modal',
            'detail-transaction-id',
            'detail-transaction-date',
            'detail-payment-method',
            'detail-transaction-status',
            'detail-transaction-total',
            'transaction-items-body'
        ];

        allPossibleElements.forEach(id => {
            const el = document.getElementById(id);
            console.log(`Element '${id}':`, el ? 'FOUND' : 'NOT FOUND');
            if (el) console.log(`  - Element type:`, el.tagName);
        });

        // Try to show error in a simple alert as fallback
        alert('Terjadi kesalahan saat menampilkan detail transaksi. Silakan coba lagi.');
        return;
    }

    console.log('All elements found successfully, proceeding with transaction detail display...');

    // Process the transaction detail normally
    processTransactionDetail(modal, transactionIdEl, transactionDateEl, paymentMethodEl,
        transactionStatusEl, transactionTotalEl, transactionItemsBody, transactionId);
}



// Process transaction detail - separated to avoid duplication
async function processTransactionDetail(modal, transactionIdEl, transactionDateEl, paymentMethodEl,
    transactionStatusEl, transactionTotalEl, transactionItemsBody, transactionId) {
    // Double-check that elements still exist (in case of page navigation during async operation)
    if (!modal || !transactionIdEl || !transactionDateEl || !paymentMethodEl ||
        !transactionStatusEl || !transactionTotalEl || !transactionItemsBody) {
        console.warn('Transaction detail elements no longer available, aborting');
        return;
    }
    // Tampilkan loading
    transactionItemsBody.innerHTML = '<div class="text-center" style="padding: var(--spacing-lg); color: #6c757d;">Memuat detail transaksi...</div>';
    modal.classList.add('active');

    try {
        // Coba ambil dari Google Sheets
        if (gapi.client && gapi.client.sheets) {
            // Ambil data transaksi
            const transactionResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Pos_Transaksi!A2:I',
            });

            const transactionRows = transactionResponse.result.values || [];
            const transactionRow = transactionRows.find(row => row[0] === transactionId);

            if (transactionRow) {
                // Ambil detail transaksi
                const detailResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Detail_Transaksi!A2:H',
                });

                const detailRows = detailResponse.result.values || [];
                const transactionDetails = detailRows.filter(row => row[1] === transactionId);

                // Ambil metode pembayaran
                const paymentResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Metode_Pembayaran!A2:D',
                });

                const paymentRows = paymentResponse.result.values || [];
                const paymentMethodId = transactionRow[5];
                const paymentMethod = paymentRows.find(row => row[0] === paymentMethodId);

                // Tampilkan informasi transaksi
                transactionIdEl.textContent = transactionId;

                // Format tanggal
                const dateStr = transactionRow[1];
                let formattedDate;
                try {
                    const date = new Date(dateStr);
                    formattedDate = date.toLocaleString('id-ID');
                } catch (e) {
                    formattedDate = dateStr;
                }

                transactionDateEl.textContent = formattedDate;
                paymentMethodEl.textContent = paymentMethod ? paymentMethod[1] : 'Tunai';
                transactionStatusEl.textContent = 'Selesai';
                transactionTotalEl.textContent = formatRupiah(parseFloat(transactionRow[4]));

                // Tampilkan detail item
                if (transactionItemsBody) {
                    transactionItemsBody.innerHTML = '';
                }

                if (transactionDetails.length === 0) {
                    if (transactionItemsBody) {
                        transactionItemsBody.innerHTML = '<div class="text-center" style="padding: var(--spacing-lg); color: #6c757d;">Tidak ada detail item</div>';
                    }
                } else {
                    transactionDetails.forEach(item => {
                        if (transactionItemsBody) {
                            const itemRow = document.createElement('div');
                            itemRow.className = 'detail-item-row';
                            itemRow.innerHTML = `
                                <div class="detail-item-name">${item[3]}</div>
                                <div class="detail-item-quantity">x${item[5]}</div>
                                <div class="detail-item-price">${formatRupiah(parseFloat(item[6]))}</div>
                            `;
                            transactionItemsBody.appendChild(itemRow);
                        }
                    });
                }

                return; // Berhasil menampilkan data dari Google Sheets
            }
        }

        // Fallback ke localStorage jika Google Sheets tidak tersedia atau data tidak ditemukan
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const transaction = transactions.find(t => t.id === transactionId);

        if (!transaction) {
            transactionItemsBody.innerHTML = '<tr><td colspan="7" class="text-center">Transaksi tidak ditemukan</td></tr>';
            return;
        }

        // Tampilkan data dari localStorage
        transactionIdEl.textContent = transaction.id;
        transactionDateEl.textContent = new Date(transaction.date).toLocaleString('id-ID');
        paymentMethodEl.textContent = transaction.paymentMethod;
        transactionStatusEl.textContent = transaction.status;
        transactionTotalEl.textContent = formatRupiah(transaction.total);

        // Tampilkan item
        if (transactionItemsBody) {
            transactionItemsBody.innerHTML = '';
        }

        if (!transaction.items || transaction.items.length === 0) {
            if (transactionItemsBody) {
                transactionItemsBody.innerHTML = '<div class="text-center" style="padding: var(--spacing-lg); color: #6c757d;">Tidak ada detail item</div>';
            }
        } else {
            transaction.items.forEach((item, index) => {
                if (transactionItemsBody) {
                    const itemRow = document.createElement('div');
                    itemRow.className = 'detail-item-row';
                    itemRow.innerHTML = `
                        <div class="detail-item-name">${item.name}</div>
                        <div class="detail-item-quantity">x${item.quantity}</div>
                        <div class="detail-item-price">${formatRupiah(item.price * item.quantity)}</div>
                    `;
                    transactionItemsBody.appendChild(itemRow);
                }
            });
        }

    } catch (error) {
        console.error('Error menampilkan detail transaksi:', error);
        if (transactionItemsBody) {
            transactionItemsBody.innerHTML = '<div class="text-center" style="padding: var(--spacing-lg); color: #dc3545;">Error memuat detail transaksi</div>';
        }
    }
}

// Fungsi untuk mencetak transaksi
async function printTransaction(transactionId) {
    let transaction = null;
    let items = [];

    try {
        // Coba ambil dari Google Sheets
        if (gapi.client && gapi.client.sheets) {
            // Ambil data transaksi
            const transactionResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Pos_Transaksi!A2:I',
            });

            const transactionRows = transactionResponse.result.values || [];
            const transactionRow = transactionRows.find(row => row[0] === transactionId);

            if (transactionRow) {
                // Ambil detail transaksi
                const detailResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Detail_Transaksi!A2:H',
                });

                const detailRows = detailResponse.result.values || [];
                items = detailRows
                    .filter(row => row[1] === transactionId)
                    .map(item => ({
                        name: item[3],
                        price: parseFloat(item[4]),
                        quantity: parseInt(item[5])
                    }));

                // Ambil metode pembayaran
                const paymentResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.spreadsheetId,
                    range: 'Metode_Pembayaran!A2:D',
                });

                const paymentRows = paymentResponse.result.values || [];
                const paymentMethodId = transactionRow[5];
                const paymentMethod = paymentRows.find(row => row[0] === paymentMethodId);

                transaction = {
                    id: transactionId,
                    date: transactionRow[1],
                    total: parseFloat(transactionRow[4]),
                    paymentMethod: paymentMethod ? paymentMethod[1] : 'Tunai',
                    items: items
                };
            }
        }
    } catch (error) {
        console.error('Error mengambil data dari Google Sheets:', error);
    }

    // Fallback ke localStorage jika Google Sheets tidak tersedia atau data tidak ditemukan
    if (!transaction) {
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        transaction = transactions.find(t => t.id === transactionId);

        if (!transaction) {
            alert('Transaksi tidak ditemukan');
            return;
        }
    }

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Struk Pembayaran - ${transaction.id}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .receipt { max-width: 300px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 20px; }
                .items { margin-bottom: 20px; }
                .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .total { font-weight: bold; border-top: 1px dashed #000; padding-top: 10px; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2>Kedai Nongki</h2>
                    <p>${new Date(transaction.date).toLocaleString('id-ID')}</p>
                    <p>No. Transaksi: ${transaction.id}</p>
                </div>
                
                <div class="items">
                    ${transaction.items.map(item => `
                        <div class="item">
                            <span>${item.name} x${item.quantity}</span>
                            <span>${formatRupiah(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total">
                    <div class="item">
                        <span>Total:</span>
                        <span>${formatRupiah(transaction.total)}</span>
                    </div>
                    <div class="item">
                        <span>Metode Pembayaran:</span>
                        <span>${transaction.paymentMethod}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Terima kasih telah berbelanja di Kedai Nongki</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

// Filter transaksi berdasarkan tanggal
async function filterTransactionsByDate(date) {
    const transactionTableBody = document.getElementById('transaction-table-body');
    if (!transactionTableBody) return;

    // Tampilkan loading
    transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data transaksi...</td></tr>';

    try {
        let transactions = [];

        // Coba ambil dari Google Sheets
        if (gapi.client && gapi.client.sheets) {
            // Ambil data transaksi
            const transactionResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Pos_Transaksi!A2:I',
            });

            const transactionRows = transactionResponse.result.values || [];

            // Ambil detail transaksi
            const detailResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Detail_Transaksi!A2:H',
            });

            const detailRows = detailResponse.result.values || [];

            // Ambil metode pembayaran
            const paymentResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Metode_Pembayaran!A2:D',
            });

            const paymentRows = paymentResponse.result.values || [];
            const paymentMap = {};
            paymentRows.forEach(row => {
                if (row[0]) paymentMap[row[0]] = row[1]; // id -> name
            });

            // Format data transaksi
            transactions = transactionRows.map(row => {
                const transactionId = row[0];
                const paymentMethodId = row[5];

                return {
                    id: transactionId,
                    date: row[1],
                    total: parseFloat(row[4]),
                    paymentMethod: paymentMap[paymentMethodId] || 'Tunai',
                    status: 'Selesai'
                };
            });
        } else {
            // Fallback ke localStorage
            transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        }

        // Filter berdasarkan tanggal jika ada
        if (date) {
            const filterDate = new Date(date);
            filterDate.setHours(0, 0, 0, 0);

            transactions = transactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                transactionDate.setHours(0, 0, 0, 0);
                return transactionDate.getTime() === filterDate.getTime();
            });
        }

        renderTransactions(transactions);
    } catch (error) {
        console.error('Error memfilter transaksi:', error);
        transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error memuat data transaksi</td></tr>';

        // Fallback ke localStorage
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        let filtered = transactions;

        if (date) {
            const filterDate = new Date(date);
            filterDate.setHours(0, 0, 0, 0);

            filtered = transactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                transactionDate.setHours(0, 0, 0, 0);
                return transactionDate.getTime() === filterDate.getTime();
            });
        }

        renderTransactions(filtered);
    }
}

// Pencarian transaksi
async function searchTransactions(query) {
    const transactionTableBody = document.getElementById('transaction-table-body');
    if (!transactionTableBody) return;

    // Tampilkan loading
    transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data transaksi...</td></tr>';

    try {
        let transactions = [];

        // Coba ambil dari Google Sheets
        if (gapi.client && gapi.client.sheets) {
            // Ambil data transaksi
            const transactionResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Pos_Transaksi!A2:I',
            });

            const transactionRows = transactionResponse.result.values || [];

            // Ambil metode pembayaran
            const paymentResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.spreadsheetId,
                range: 'Metode_Pembayaran!A2:D',
            });

            const paymentRows = paymentResponse.result.values || [];
            const paymentMap = {};
            paymentRows.forEach(row => {
                if (row[0]) paymentMap[row[0]] = row[1]; // id -> name
            });

            // Format data transaksi
            transactions = transactionRows.map(row => {
                const transactionId = row[0];
                const paymentMethodId = row[5];

                return {
                    id: transactionId,
                    date: row[1],
                    total: parseFloat(row[4]),
                    paymentMethod: paymentMap[paymentMethodId] || 'Tunai',
                    status: 'Selesai'
                };
            });
        } else {
            // Fallback ke localStorage
            transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        }

        // Filter berdasarkan query jika ada
        if (query) {
            transactions = transactions.filter(transaction =>
                transaction.id.toLowerCase().includes(query.toLowerCase()) ||
                transaction.paymentMethod.toLowerCase().includes(query.toLowerCase())
            );
        }

        renderTransactions(transactions);
    } catch (error) {
        console.error('Error mencari transaksi:', error);
        transactionTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error memuat data transaksi</td></tr>';

        // Fallback ke localStorage
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        let filtered = transactions;

        if (query) {
            filtered = transactions.filter(transaction =>
                transaction.id.toLowerCase().includes(query.toLowerCase()) ||
                transaction.paymentMethod.toLowerCase().includes(query.toLowerCase())
            );
        }

        renderTransactions(filtered);
    }
}

// Inisialisasi event listener untuk filter dan pencarian
document.addEventListener('DOMContentLoaded', function () {
    const dateFilter = document.getElementById('date-filter');
    const transactionSearch = document.getElementById('transaction-search');

    if (dateFilter) {
        dateFilter.addEventListener('change', function () {
            filterTransactionsByDate(this.value);
        });
    }

    if (transactionSearch) {
        transactionSearch.addEventListener('input', function () {
            searchTransactions(this.value);
        });
    }

    // Tab pengaturan
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = this.getAttribute('data-tab');
            if (tab === 'detail_transaksi') {
                loadTransactions();
            }
        });
    });

    // Event listener untuk tombol tutup modal detail transaksi
    const closeDetailBtn = document.getElementById('close-detail-btn');
    const closeTransactionDetail = document.getElementById('close-transaction-detail');
    const transactionDetailModal = document.getElementById('transaction-detail-modal');
    const printTransactionDetail = document.getElementById('print-transaction-detail');

    // Tutup modal saat tombol tutup diklik
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            transactionDetailModal.classList.remove('active');
            document.body.style.overflow = ''; // Aktifkan kembali scroll
        });
    }

    // Tutup modal saat tombol X diklik
    if (closeTransactionDetail) {
        closeTransactionDetail.addEventListener('click', () => {
            transactionDetailModal.classList.remove('active');
            document.body.style.overflow = ''; // Aktifkan kembali scroll
        });
    }

    // Cetak detail transaksi
    if (printTransactionDetail) {
        printTransactionDetail.addEventListener('click', () => {
            const transactionId = document.getElementById('detail-transaction-id').textContent;
            printTransaction(transactionId);
        });
    }
});