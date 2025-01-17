"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const defaultIncomeRatio = 0.05;
function dbUpgrade(event) {
    const db = event.target.result;
    // Текущая транзакция обновления
    const transaction = openRequest.transaction;
    if (!transaction) {
        console.error("Transaction is null during onupgradeneeded.");
        return;
    }
    // Invests db
    let invests;
    if (!db.objectStoreNames.contains('invests')) {
        invests = db.createObjectStore('invests', { keyPath: 'id', autoIncrement: true });
        invests.createIndex('isActiveIdx', 'isActive', { unique: false });
    }
    else {
        invests = transaction.objectStore("invests");
    }
    if (!invests.indexNames.contains('updatedAtIdx')) {
        invests.createIndex('updatedAtIdx', 'updatedAt', { unique: false });
    }
    // Payments db
    let payments;
    if (!db.objectStoreNames.contains('payments')) {
        payments = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
        payments.createIndex('investIdIdx', 'investId', { unique: false });
    }
    else {
        payments = transaction.objectStore("payments");
    }
    if (!payments.indexNames.contains('updatedAtIdx')) {
        payments.createIndex('updatedAtIdx', 'updatedAt', { unique: false });
    }
}
function dbGetInvestById(investId) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction("invests");
        let invests = transaction.objectStore("invests");
        return dbDoAsync(() => invests.get(investId));
    });
}
function dbGetInvests() {
    return __awaiter(this, arguments, void 0, function* (filter = {}) {
        let transaction = db.transaction("invests");
        let invests = transaction.objectStore("invests");
        if (filter.filterOnlyActive == 1) {
            let showAllIndex = invests.index('isActiveIdx');
            return dbDoAsync(() => showAllIndex.getAll(1));
        }
        else if (filter.updatedAt != undefined) {
            let updatedAtIndex = invests.index('updatedAtIdx');
            let range = IDBKeyRange.lowerBound(filter.updatedAt);
            return dbDoAsync(() => updatedAtIndex.getAll(range));
        }
        else {
            return dbDoAsync(() => invests.getAll());
        }
    });
}
function dbAddInvest(money, incomeRatio, createdDate) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction("invests", "readwrite");
        let invests = transaction.objectStore("invests");
        let invest = {
            money: money,
            incomeRatio: incomeRatio,
            createdDate: createdDate,
            closedDate: null,
            isActive: 1,
            updatedAt: new Date()
        };
        return dbDoAsync(() => invests.add(invest));
    });
}
function dbCloseInvest(investId) {
    return __awaiter(this, void 0, void 0, function* () {
        let invest = yield dbGetInvestById(investId);
        invest.isActive = 0;
        invest.closedDate = new Date();
        invest.updatedAt = new Date();
        let transaction = db.transaction("invests", "readwrite");
        let invests = transaction.objectStore("invests");
        return dbDoAsync(() => invests.put(invest));
    });
}
function dbCalculatePayments() {
    return __awaiter(this, void 0, void 0, function* () {
        let invests = yield dbGetInvests({ filterOnlyActive: 1 });
        if (!invests) {
            return;
        }
        for (const invest of invests) {
            let lastPaymentDate = invest.createdDate;
            let payments = yield dbGetPayments({ id: invest.id });
            let lastPayment = payments.pop();
            // Keep the last unpayed row active
            if (lastPayment && !lastPayment.isPayed) {
                continue;
            }
            if (lastPayment) {
                lastPaymentDate = lastPayment.paymentDate;
            }
            lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);
            lastPaymentDate.setHours(0, 0, 0);
            yield dbAddPayment(invest.id, invest.money, invest.incomeRatio || defaultIncomeRatio, lastPaymentDate);
        }
    });
}
function dbGetPayments() {
    return __awaiter(this, arguments, void 0, function* (filter = {}) {
        let transaction = db.transaction("payments");
        let payments = transaction.objectStore("payments");
        if (filter.id != undefined) {
            let investIndex = payments.index('investIdIdx');
            return dbDoAsync(() => investIndex.getAll(filter.id));
        }
        else if (filter.updatedAt != undefined) {
            let updatedAtIndex = payments.index('updatedAtIdx');
            let range = IDBKeyRange.lowerBound(filter.updatedAt);
            return dbDoAsync(() => updatedAtIndex.getAll(range));
        }
        else {
            return dbDoAsync(() => payments.getAll());
        }
    });
}
function dbAddPayment(investId, investMoney, incomeRatio, paymentDate) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction("payments", "readwrite");
        let payments = transaction.objectStore("payments");
        let payment = {
            investId: investId,
            money: Math.round(investMoney * incomeRatio),
            paymentDate: paymentDate,
            isPayed: 0,
            updatedAt: new Date()
        };
        return dbDoAsync(() => payments.add(payment));
    });
}
function dbClosePayment(paymentId) {
    return __awaiter(this, void 0, void 0, function* () {
        let payment = yield dbGetPaymentById(paymentId);
        payment.isPayed = 1;
        payment.updatedAt = new Date();
        let transaction = db.transaction("payments", "readwrite");
        let payments = transaction.objectStore("payments");
        return dbDoAsync(() => payments.put(payment));
    });
}
function dbGetPaymentById(paymentId) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction("payments");
        let payments = transaction.objectStore("payments");
        return dbDoAsync(() => payments.get(paymentId));
    });
}
function dbImportData(importData_1) {
    return __awaiter(this, arguments, void 0, function* (importData, cleanImport = false) {
        let transaction = db.transaction(["payments", "invests"], "readwrite");
        let invests = transaction.objectStore("invests");
        if (cleanImport) {
            yield dbDoAsync(() => invests.clear());
        }
        // Export converts date to string, so we should cast them back to Date
        for (const invest of importData.invests) {
            invest.createdDate = new Date(invest.createdDate);
            invest.updatedAt = new Date(invest.updatedAt);
            if (!invest.isActive && invest.closedDate) {
                invest.closedDate = new Date(invest.closedDate);
            }
            yield dbDoAsync(() => invests.put(invest));
        }
        let payments = transaction.objectStore("payments");
        if (cleanImport) {
            yield dbDoAsync(() => payments.clear());
        }
        for (const payment of importData.payments) {
            payment.paymentDate = new Date(payment.paymentDate);
            payment.updatedAt = new Date(payment.updatedAt);
            yield dbDoAsync(() => payments.put(payment));
        }
    });
}
function dbDoAsync(callback) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            let request = callback();
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                let caller = (new Error()).stack.split("\n")[4].trim().split(" ")[1];
                console.log(`${caller}: failed`, request.error);
                reject(request.error);
            };
        });
    });
}
const api_url = 'https://perkin.alwaysdata.net/money/api';
let db;
let dbVersion = 4;
let authUser;
//delete db (for testing)
// let deleteRequest = indexedDB.deleteDatabase('money');
// deleteRequest.onsuccess = function () {
//     console.log('deleted');
//     console.log(deleteRequest);
// }
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/money2/service-worker.js').then(registration => {
        console.log('Service Worker зарегистрирован с областью:', registration.scope);
    }).catch(error => {
        console.error('Ошибка регистрации Service Worker:', error);
    });
}
let openRequest = indexedDB.open('money', dbVersion);
openRequest.onupgradeneeded = function (event) {
    db = openRequest.result;
    dbUpgrade(event);
};
openRequest.onerror = function () {
    console.error("Error", openRequest.error);
};
openRequest.onsuccess = function () {
    db = openRequest.result;
    db.onversionchange = function () {
        db.close();
        alert("Требуется обновление структуры БД. Обновите страницу для обновления.");
    };
    main().then(() => {
        console.log('Приложение успешно загружено');
    }).catch((error) => {
        console.error('Ошибка при загрузке приложения:', error);
    });
};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbCalculatePayments();
        yield updatePayments();
        yield initMenu();
        yield initRegisterPopup();
        yield initAuthPopup();
        yield initAuth();
    });
}
function initMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        const menuButton = document.getElementById('menu-button');
        const dropdownContent = document.getElementById('menu-dropdown-content');
        menuButton.addEventListener('click', (event) => {
            dropdownContent.classList.toggle('show');
            event.stopPropagation();
        });
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!dropdownContent.contains(target) && target !== menuButton) {
                dropdownContent.classList.remove('show');
            }
        });
    });
}
function initRegisterPopup() {
    return __awaiter(this, void 0, void 0, function* () {
        const openPopupButton = document.getElementById('open-register-popup');
        const closePopupButton = document.getElementById('close-register-popup');
        const registerPopup = document.getElementById('register-popup');
        openPopupButton.addEventListener('click', () => {
            registerPopup.classList.add('show');
        });
        closePopupButton.addEventListener('click', () => {
            registerPopup.classList.remove('show');
        });
        document.addEventListener('click', (event) => {
            if (event.target === registerPopup) {
                registerPopup.classList.remove('show');
            }
        });
    });
}
function initAuthPopup() {
    return __awaiter(this, void 0, void 0, function* () {
        const openPopupButton = document.getElementById('open-login-popup');
        const closePopupButton = document.getElementById('close-login-popup');
        const loginPopup = document.getElementById('login-popup');
        openPopupButton.addEventListener('click', () => {
            loginPopup.classList.add('show');
        });
        closePopupButton.addEventListener('click', () => {
            loginPopup.classList.remove('show');
        });
        document.addEventListener('click', (event) => {
            if (event.target === loginPopup) {
                loginPopup.classList.remove('show');
            }
        });
    });
}
function initAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        const token = getToken();
        if (!token) {
            return;
        }
        const tokenData = parseJWT(token);
        authUser = {
            token: token,
            username: tokenData.username,
            email: tokenData.email
        };
        document.getElementById('logout').style.display = 'inline-block';
        document.getElementById('open-login-popup').style.display = 'none';
        document.getElementById('open-register-popup').style.display = 'none';
        document.getElementById('user').innerText = authUser.username;
        yield syncUpdates();
    });
}
// Функция для выхода
function logout() {
    return __awaiter(this, void 0, void 0, function* () {
        authUser = null;
        removeToken();
        document.getElementById('logout').style.display = 'none';
        document.getElementById('open-login-popup').style.display = 'inline-block';
        document.getElementById('open-register-popup').style.display = 'inline-block';
        document.getElementById('user').innerText = '';
        const dropdownContent = document.getElementById('menu-dropdown-content');
        dropdownContent.classList.remove('show');
        toast("Вы успешно вышли!");
    });
}
function showChart() {
    return __awaiter(this, void 0, void 0, function* () {
        let ctx = document.getElementById('chart-ctx');
        if (!ctx) {
            ctx = document.createElement('canvas');
            ctx.id = 'chart-ctx';
            document.getElementById('chart-container').appendChild(ctx);
            Chart.defaults.color = '#fff';
            new Chart(ctx, yield getChartData());
        }
        document.getElementById('chart-container').style.display = 'block';
    });
}
function closeChart() {
    return __awaiter(this, void 0, void 0, function* () {
        document.getElementById('chart-container').style.display = 'none';
    });
}
function getChartData() {
    return __awaiter(this, void 0, void 0, function* () {
        let invests = yield dbGetInvests();
        let investData = [];
        for (const invest of invests) {
            investData.push({ date: invest.createdDate, money: invest.money });
            if (invest.isActive == 0) {
                investData.push({ date: invest.closedDate, money: -invest.money });
            }
        }
        investData.sort((a, b) => {
            return a.date.getTime() - b.date.getTime();
        });
        let total = 0.00;
        let labels = [];
        let data1 = [];
        for (const invest of investData) {
            total += invest.money;
            labels.push(invest.date);
            data1.push(total);
        }
        let data = {
            "labels": labels,
            "datasets": [
                {
                    label: "Инвестиции",
                    data: data1,
                    backgroundColor: "rgba(76, 175, 80, 0.2)",
                    borderColor: "rgba(76, 175, 80)",
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    hitRadius: 5,
                }
            ]
        };
        return {
            type: "line",
            data: data,
            options: {
                responsive: true,
                layout: {
                    padding: 10
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'yyyy-MM-dd HH:mm'
                        },
                        grid: {
                            color: "rgba(76, 175, 80, 0.2)"
                        }
                    },
                    y: {
                        grid: {
                            color: "rgba(76, 175, 80, 0.2)"
                        }
                    }
                },
                plugins: {
                    zoom: {
                        zoom: {
                            mode: 'x',
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            }
                        },
                        pan: {
                            enabled: true,
                            mode: 'x'
                        }
                    }
                }
            }
        };
    });
}
function updatePayments() {
    return __awaiter(this, void 0, void 0, function* () {
        let filterOnlyActive = document.getElementById('filter-show-all').checked ? 0 : 1;
        let filterShowPayed = document.getElementById('filter-show-payed').checked;
        let invests = yield dbGetInvests({ filterOnlyActive: filterOnlyActive });
        invests.sort((a, b) => {
            let dayA = a.createdDate.getDate();
            let dayB = b.createdDate.getDate();
            return dayA - dayB;
        });
        let dataListElem = document.getElementById('data-list');
        dataListElem.innerHTML = '';
        if (!invests) {
            return;
        }
        const today = new Date();
        let totalInvestedMoney = 0;
        let totalDebtMoney = 0;
        let totalIncomeMoney = 0;
        let i = 0;
        let curDateLineDrawn = false;
        for (const invest of invests) {
            i++;
            if (invest.isActive) {
                totalInvestedMoney += invest.money;
                totalIncomeMoney += invest.money * (invest.incomeRatio || defaultIncomeRatio);
            }
            if (!curDateLineDrawn && today.getDate() < invest.createdDate.getDate()) {
                curDateLineDrawn = true;
                dataListElem.appendChild(renderCurDateLine());
            }
            let investItem = renderInvestItem(invest, i);
            dataListElem.appendChild(investItem);
            let payments = yield dbGetPayments({ id: invest.id });
            for (let payment of payments) {
                let isDebt = false;
                if (!filterShowPayed && payment.isPayed) {
                    continue;
                }
                if (!payment.isPayed && payment.paymentDate < today) {
                    isDebt = true;
                    totalDebtMoney += payment.money;
                }
                let paymentItem = renderPaymentItem(payment, isDebt, i);
                dataListElem.appendChild(paymentItem);
            }
        }
        if (!curDateLineDrawn) {
            dataListElem.appendChild(renderCurDateLine());
        }
        let total = { title: 'Итого', money: totalInvestedMoney };
        let totalItem = renderTotalItem(total);
        dataListElem.appendChild(totalItem);
        let totalIncome = { title: 'Прибыль', money: totalIncomeMoney };
        let totalIncomeItem = renderTotalItem(totalIncome);
        dataListElem.appendChild(totalIncomeItem);
        if (totalDebtMoney > 0) {
            let totalDebt = { title: 'Долг', money: totalDebtMoney };
            let totalDebtItem = renderDebtItem(totalDebt);
            dataListElem.appendChild(totalDebtItem);
        }
    });
}
function renderCurDateLine() {
    let dataItem = document.createElement('div');
    dataItem.className = 'cur-date-item';
    return dataItem;
}
function renderInvestItem(invest, index) {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item invest-item';
    if (index % 2) {
        dataItem.classList.add('odd');
    }
    let dataItemCreatedDate = document.createElement('div');
    dataItemCreatedDate.className = 'item-date';
    dataItemCreatedDate.innerHTML = formatDate(invest.createdDate);
    dataItem.appendChild(dataItemCreatedDate);
    let dataItemClosedDate = document.createElement('div');
    dataItemClosedDate.className = 'item-date';
    dataItemClosedDate.innerHTML = formatDate(invest.closedDate);
    dataItem.appendChild(dataItemClosedDate);
    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(invest.money);
    dataItemMoney.innerHTML += ' (' + (100 * (invest.incomeRatio || defaultIncomeRatio)) + '%)';
    dataItem.appendChild(dataItemMoney);
    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';
    if (invest.isActive == 1) {
        let closeButton = document.createElement('button');
        closeButton.className = 'invest-close-button';
        closeButton.innerHTML = 'X';
        closeButton.title = 'Закрыть инвестицию';
        closeButton.setAttribute('investId', invest.id + "");
        closeButton.addEventListener('click', closeInvest);
        dataItemClose.appendChild(closeButton);
    }
    else if (invest.closedDate) {
        dataItem.classList.add('closed');
    }
    dataItem.appendChild(dataItemClose);
    return dataItem;
}
function renderPaymentItem(payment, isDebt, index) {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item payment-item';
    if (isDebt) {
        dataItem.classList.add('debt');
    }
    if (index % 2) {
        dataItem.classList.add('odd');
    }
    let dataItemFiller = document.createElement('div');
    dataItemFiller.innerHTML = '&nbsp;';
    dataItem.appendChild(dataItemFiller);
    let dataItemPaymentDate = document.createElement('div');
    dataItemPaymentDate.className = 'item-date';
    dataItemPaymentDate.innerHTML = formatDate(payment.paymentDate);
    dataItem.appendChild(dataItemPaymentDate);
    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(payment.money);
    dataItem.appendChild(dataItemMoney);
    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';
    if (payment.isPayed == 0) {
        let payedButton = document.createElement('button');
        payedButton.className = 'payment-close-button';
        payedButton.innerHTML = '✓';
        payedButton.title = 'Оплата произведена';
        payedButton.setAttribute('paymentId', payment.id + '');
        payedButton.addEventListener('click', closePayment);
        dataItemClose.appendChild(payedButton);
    }
    else {
        dataItem.classList.add("payed");
    }
    dataItem.appendChild(dataItemClose);
    return dataItem;
}
function renderTotalItem(total) {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item invest-item';
    let dataItemTitle = document.createElement('div');
    dataItemTitle.innerHTML = formatDate(total.title);
    dataItem.appendChild(dataItemTitle);
    let dataItemFiller = document.createElement('div');
    dataItem.appendChild(dataItemFiller);
    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(total.money);
    dataItem.appendChild(dataItemMoney);
    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';
    dataItem.appendChild(dataItemClose);
    return dataItem;
}
function renderDebtItem(debt) {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item payment-item';
    dataItem.classList.add('debt');
    dataItem.classList.add("payed");
    let dataItemFiller = document.createElement('div');
    dataItem.appendChild(dataItemFiller);
    let dataItemTitle = document.createElement('div');
    dataItemTitle.innerHTML = formatDate(debt.title);
    dataItem.appendChild(dataItemTitle);
    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(debt.money);
    dataItem.appendChild(dataItemMoney);
    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';
    dataItem.appendChild(dataItemClose);
    return dataItem;
}
function addInvest(e) {
    return __awaiter(this, void 0, void 0, function* () {
        if (e.preventDefault)
            e.preventDefault();
        let moneyValue = document.getElementById('add-invest-money').value;
        let incomeRatioValue = document.getElementById('add-invest-income-ratio').value;
        let createdDateValue = document.getElementById('add-invest-date').value;
        if (!moneyValue || !incomeRatioValue || !createdDateValue) {
            toast('Заполните все поля');
            return;
        }
        let money = parseFloat(moneyValue);
        let incomeRatio = parseFloat(incomeRatioValue);
        let createdDate = new Date(createdDateValue);
        createdDate.setHours(0, 0, 0);
        let res = yield dbAddInvest(money, incomeRatio, createdDate);
        if (Number.isInteger(res)) {
            document.getElementById('add-invest-form').reset();
            toast('Инвестиция добавлена');
        }
        else {
            toastError(res);
        }
        yield dbCalculatePayments();
        yield updatePayments();
        yield updateRemoteData();
    });
}
function closeInvest() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!confirm('Точно закрыть?')) {
            return;
        }
        let investId = parseInt(this.getAttribute('investId'));
        if (!investId) {
            return;
        }
        let payments = yield dbGetPayments({ id: investId });
        for (let payment of payments) {
            if (!payment.isPayed) {
                let res = yield dbClosePayment(payment.id);
                if (Number.isInteger(res)) {
                    toast('Долг автоматически оплачен');
                }
                else {
                    toastError(res);
                }
            }
        }
        let res = yield dbCloseInvest(investId);
        if (Number.isInteger(res)) {
            toast('Инвестиция закрыта');
        }
        else {
            toastError(res);
        }
        yield updatePayments();
        yield updateRemoteData();
    });
}
function closePayment() {
    return __awaiter(this, void 0, void 0, function* () {
        let paymentId = parseInt(this.getAttribute('paymentId'));
        if (!paymentId) {
            return;
        }
        let res = yield dbClosePayment(paymentId);
        if (Number.isInteger(res)) {
            toast('Долг оплачен');
        }
        else {
            toastError(res);
        }
        yield dbCalculatePayments();
        yield updatePayments();
        yield updateRemoteData();
    });
}
function exportData() {
    return __awaiter(this, void 0, void 0, function* () {
        let invests = yield dbGetInvests();
        let payments = yield dbGetPayments();
        let exportString = JSON.stringify({ invests: invests, payments: payments });
        try {
            yield navigator.clipboard.writeText(exportString);
            toast('Данные скопированы в буфер обмена');
        }
        catch (err) {
            toastError('Не удалось скопировать данные в буфер обмена');
        }
    });
}
function importData() {
    return __awaiter(this, void 0, void 0, function* () {
        let importJson = prompt('Input JSON to import (IT WILL ERASE ALL CURRENT DATA!!)');
        if (!importJson) {
            return;
        }
        try {
            let importData = JSON.parse(importJson);
            yield dbImportData(importData, true);
            toast('Импорт завершен');
            setTimeout(() => document.location.reload(), 1000);
        }
        catch (err) {
            toastError('Не удалось распарсить данные');
        }
    });
}
function userRegister(event) {
    return __awaiter(this, void 0, void 0, function* () {
        event.preventDefault();
        const username = document.getElementById("register-username").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value.trim();
        const confirmPassword = document.getElementById("register-confirm-password").value.trim();
        if (password !== confirmPassword) {
            toastError("Пароли не совпадают!");
            return;
        }
        const button = document.getElementById("register-button");
        const spinner = document.getElementById("register-spinner");
        button.disabled = true;
        spinner.style.display = "block";
        try {
            const elements = document.getElementsByClassName('error-item');
            for (let element of elements) {
                element.style.display = 'none';
            }
            const response = yield fetch(api_url + "/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, email, password })
            });
            const result = yield response.json();
            if (result.status == 'success') {
                if (!result.token) {
                    toastError("Не удалось получить токен, что-то сломалось...", 5000);
                    return;
                }
                toast("Регистрация успешна!");
                document.getElementById("register-popup").style.display = "none";
                setToken(result.token);
                yield initAuth();
            }
            else if (result.error) {
                switch (result.error) {
                    case 'user_exists':
                        let errorItem = document.createElement('div');
                        errorItem.className = 'error-item';
                        errorItem.innerHTML = 'Пользователь уже существует';
                        document.getElementById("register-email").after(errorItem);
                        break;
                    case 'validation_errors':
                        let errors = result.errors || {};
                        for (const key in errors) {
                            let errorItem = document.createElement('div');
                            errorItem.className = 'error-item';
                            errorItem.innerHTML = errors[key];
                            document.getElementById("register-" + key).after(errorItem);
                        }
                        break;
                }
            }
            else {
                toastError("Ошибка: " + JSON.stringify(result));
            }
        }
        catch (error) {
            console.error("Неизвестная ошибка:", error);
            toastError("Неизвестная ошибка");
        }
        finally {
            spinner.style.display = "none";
            button.disabled = false;
        }
    });
}
function userLogin(event) {
    return __awaiter(this, void 0, void 0, function* () {
        event.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();
        const button = document.getElementById("login-button");
        const spinner = document.getElementById("login-spinner");
        button.disabled = true;
        spinner.style.display = "block";
        try {
            const elements = document.getElementsByClassName('error-item');
            for (let element of elements) {
                element.style.display = 'none';
            }
            const response = yield fetch(api_url + "/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });
            const result = yield response.json();
            if (result.status == 'success') {
                if (!result.token) {
                    toastError("Не удалось получить токен, что-то сломалось...", 5000);
                    return;
                }
                toast("Авторизация успешна!");
                document.getElementById("login-popup").style.display = "none";
                setToken(result.token);
                yield initAuth();
            }
            else if (result.error) {
                switch (result.error) {
                    case 'invalid_credentials':
                        let errorItem = document.createElement('div');
                        errorItem.className = 'error-item';
                        errorItem.innerHTML = 'Логин или пароль неверны';
                        document.getElementById("login-password").after(errorItem);
                        break;
                    case 'validation_errors':
                        let errors = result.errors || {};
                        for (const key in errors) {
                            let errorItem = document.createElement('div');
                            errorItem.className = 'error-item';
                            errorItem.innerHTML = errors[key];
                            document.getElementById("login-" + key).after(errorItem);
                        }
                        break;
                }
            }
            else {
                toastError("Неизвестная ошибка: " + JSON.stringify(result));
            }
        }
        catch (error) {
            console.error("Неизвестная ошибка:", error);
            toastError("Неизвестная ошибка");
        }
        finally {
            spinner.style.display = "none";
            button.disabled = false;
        }
    });
}
function syncUpdates() {
    return __awaiter(this, void 0, void 0, function* () {
        const lastSyncDate = localStorage.getItem('lastSyncDate') || '';
        const result = yield sendRequest(`/updates?since=${lastSyncDate}`);
        if (result && result.status == 'success') {
            yield updateLocalData(result);
        }
        else {
            if (result && result.status == 'no_updates') {
                toast('Обновлений нет');
            }
            yield updateRemoteData();
        }
        localStorage.setItem('lastSyncDate', new Date().toISOString());
    });
}
function updateLocalData(result) {
    return __awaiter(this, void 0, void 0, function* () {
        yield dbImportData(result);
        toast('Новые данные загружены');
        setTimeout(() => document.location.reload(), 1000);
    });
}
function updateRemoteData() {
    return __awaiter(this, void 0, void 0, function* () {
        const lastSyncDate = localStorage.getItem('lastSyncDate');
        let investFilter = {};
        let paymentFilter = {};
        if (lastSyncDate) {
            investFilter = { updatedAt: new Date(lastSyncDate) };
            paymentFilter = { updatedAt: new Date(lastSyncDate) };
        }
        const invests = yield dbGetInvests(investFilter);
        const payments = yield dbGetPayments(paymentFilter);
        if (!invests.length && !payments.length) {
            return;
        }
        const exportJson = { invests: invests, payments: payments };
        const result = yield sendRequest('/update', 'POST', exportJson);
        if (result && result.status == 'success') {
            toast('Новые данные успешно отправлены на сервер');
        }
    });
}
function sendRequest(url_1) {
    return __awaiter(this, arguments, void 0, function* (url, method = 'GET', json = null) {
        if (!authUser) {
            throw new Error("Неавторизованный запрос, токен не найден");
        }
        try {
            const response = yield fetch(api_url + url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authUser.token}`
                },
                body: json ? JSON.stringify(json) : null
            });
            if (!response.ok) {
                if (response.status == 401) {
                    toastError('Неавторизованный запрос, возможно истекло время токена, просто авторизуйтесь снова', 7000);
                    yield logout();
                    return null;
                }
                toastError(`Ошибка: ${response.statusText}`);
                console.error(`Ошибка:`, response);
                return null;
            }
            return response.json();
        }
        catch (error) {
            toastError(`"Неизвестная ошибка`);
            console.error("Неизвестная ошибка:", error);
        }
        return null;
    });
}
function setToken(token) {
    localStorage.setItem('token', token);
}
function removeToken() {
    localStorage.removeItem('token');
}
function getToken() {
    return localStorage.getItem('token');
}
function parseJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Некорректный токен');
    }
    // Декодируем полезную нагрузку (вторая часть токена)
    const payload = parts[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}
function formatDate(date) {
    if (!date) {
        return '&nbsp;';
    }
    if (!(date instanceof Date)) {
        return date;
    }
    let year = date.getFullYear() + '';
    let month = date.toLocaleString('default', { month: 'short' }).replace('.', '');
    let day = date.getDate() + '';
    if (date.getDate() < 10)
        day = '0' + day;
    return `${year}-${month}-${day}`;
}
let moneyFormatter = new Intl.NumberFormat('default', {
    style: 'currency',
    currency: 'RUB',
    useGrouping: true,
    maximumSignificantDigits: 9,
});
function formatMoney(money) {
    return moneyFormatter.format(money);
}
function toast(text, duration = 3000) {
    Toastify({
        text: text,
        duration: duration,
        gravity: "top",
        position: "center",
        style: {
            background: '#4CAF50',
        }
    }).showToast();
}
function toastError(text, duration = 3000) {
    Toastify({
        text: text || 'Неизвестная ошибка',
        duration: duration,
        gravity: "top",
        position: "center",
        style: {
            background: '#AF4C50',
        }
    }).showToast();
}
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('filter-show-all').addEventListener("click", updatePayments);
    document.getElementById('filter-show-payed').addEventListener("click", updatePayments);
    document.getElementById('add-invest-form').addEventListener('submit', addInvest);
    document.getElementById('show-chart').addEventListener("click", showChart);
    document.getElementById('close-chart').addEventListener("click", closeChart);
    document.getElementById('invest-export').addEventListener('click', exportData);
    document.getElementById('invest-import').addEventListener('click', importData);
    document.getElementById('logout').addEventListener('click', logout);
    document.getElementById('register-form').addEventListener('submit', userRegister);
    document.getElementById('login-form').addEventListener('submit', userLogin);
});
