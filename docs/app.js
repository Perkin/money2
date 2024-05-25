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
function dbGetInvestById(investId) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction("invests");
        let invests = transaction.objectStore("invests");
        return dbDoAsync(() => invests.get(investId));
    });
}
function dbGetInvests() {
    return __awaiter(this, arguments, void 0, function* (filter = {}) {
        let filterOnlyActive = filter.filterOnlyActive;
        let transaction = db.transaction("invests");
        let invests = transaction.objectStore("invests");
        if (filterOnlyActive == 1) {
            let showAllIndex = invests.index('isActiveIdx');
            return dbDoAsync(() => showAllIndex.getAll(1));
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
        };
        return dbDoAsync(() => invests.add(invest));
    });
}
function dbCloseInvest(investId) {
    return __awaiter(this, void 0, void 0, function* () {
        let invest = yield dbGetInvestById(investId);
        invest.isActive = 0;
        invest.closedDate = new Date();
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
            yield dbAddPayment(invest.id, invest.money, invest.incomeRatio || defaultIncomeRatio, lastPaymentDate);
        }
    });
}
function dbGetPayments() {
    return __awaiter(this, arguments, void 0, function* (filter = {}) {
        let transaction = db.transaction("payments");
        let payments = transaction.objectStore("payments");
        let investId = filter.id;
        if (investId != undefined) {
            let investIndex = payments.index('investIdIdx');
            return dbDoAsync(() => investIndex.getAll(investId));
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
        };
        return dbDoAsync(() => payments.add(payment));
    });
}
function dbClosePayment(paymentId) {
    return __awaiter(this, void 0, void 0, function* () {
        let payment = yield dbGetPaymentById(paymentId);
        payment.isPayed = 1;
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
function dbImportData(importData) {
    return __awaiter(this, void 0, void 0, function* () {
        let transaction = db.transaction(["payments", "invests"], "readwrite");
        let invests = transaction.objectStore("invests");
        // Clean DB
        yield dbDoAsync(() => invests.clear());
        // Export converts date to string, so we should cast them back to Date
        for (const invest of importData.invests) {
            invest.createdDate = new Date(Date.parse(invest.createdDate));
            if (!invest.isActive && invest.closedDate) {
                invest.closedDate = new Date(Date.parse(invest.closedDate));
            }
            yield dbDoAsync(() => invests.put(invest));
        }
        let payments = transaction.objectStore("payments");
        yield dbDoAsync(() => payments.clear());
        for (const payment of importData.payments) {
            payment.paymentDate = new Date(Date.parse(payment.paymentDate));
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
let db;
let dbVersion = 2;
//delete db (for testing)
// let deleteRequest = indexedDB.deleteDatabase('money');
// deleteRequest.onsuccess = function () {
//     console.log('deleted');
//     console.log(deleteRequest);
// }
let openRequest = indexedDB.open('money', dbVersion);
openRequest.onupgradeneeded = function (event) {
    db = openRequest.result;
    switch (event.newVersion) {
        case 2:
            if (!db.objectStoreNames.contains('invests')) {
                const invests = db.createObjectStore('invests', { keyPath: 'id', autoIncrement: true });
                invests.createIndex('isActiveIdx', 'isActive', { unique: false });
            }
            if (!db.objectStoreNames.contains('payments')) {
                const payments = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                payments.createIndex('investIdIdx', 'investId', { unique: false });
            }
            break;
    }
};
openRequest.onerror = function () {
    console.error("Error", openRequest.error);
};
openRequest.onsuccess = function () {
    db = openRequest.result;
    db.onversionchange = function () {
        db.close();
        alert("Db is outdated, refresh the page");
    };
    main().then(() => {
        console.log('main completed successfully');
    }).catch((error) => {
        console.error('main failed:', error);
    });
};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield dbCalculatePayments();
            yield updatePayments();
        }
        catch (error) {
            console.error('Error occurred:', error);
        }
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
                    label: "Investments",
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
        let total = { title: 'Current invest', money: totalInvestedMoney };
        let totalItem = renderTotalItem(total);
        dataListElem.appendChild(totalItem);
        let totalIncome = { title: 'Current income', money: totalIncomeMoney };
        let totalIncomeItem = renderTotalItem(totalIncome);
        dataListElem.appendChild(totalIncomeItem);
        if (totalDebtMoney > 0) {
            let totalDebt = { title: 'Current debt', money: totalDebtMoney };
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
        closeButton.title = 'Close investment';
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
        payedButton.title = 'Approve payment';
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
            toast('Empty fields');
            return;
        }
        let money = parseFloat(moneyValue);
        let incomeRatio = parseFloat(incomeRatioValue);
        let createdDate = new Date(Date.parse(createdDateValue));
        let now = new Date();
        createdDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        let res = yield dbAddInvest(money, incomeRatio, createdDate);
        if (Number.isInteger(res)) {
            document.getElementById('add-invest-form').reset();
            toast('Invest added');
        }
        else {
            toast(res, true);
        }
        yield dbCalculatePayments();
        yield updatePayments();
    });
}
function closeInvest() {
    return __awaiter(this, void 0, void 0, function* () {
        let investId = parseInt(this.getAttribute('investId'));
        if (!investId) {
            return;
        }
        let payments = yield dbGetPayments({ id: investId });
        for (let payment of payments) {
            if (!payment.isPayed) {
                let res = yield dbClosePayment(payment.id);
                if (Number.isInteger(res)) {
                    toast('Unpdayed payment closed');
                }
                else {
                    toast(res, true);
                }
            }
        }
        let res = yield dbCloseInvest(investId);
        if (Number.isInteger(res)) {
            toast('Invest closed');
        }
        else {
            toast(res, true);
        }
        yield updatePayments();
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
            toast('Payment closed');
        }
        else {
            toast(res, true);
        }
        yield dbCalculatePayments();
        yield updatePayments();
    });
}
function exportData() {
    return __awaiter(this, void 0, void 0, function* () {
        let invests = yield dbGetInvests();
        let payments = yield dbGetPayments();
        let exportString = JSON.stringify({ invests: invests, payments: payments });
        try {
            yield navigator.clipboard.writeText(exportString);
            toast('Export data copied to clipboard');
        }
        catch (err) {
            toast('Failed to copy export data to clipboard', true);
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
            yield dbImportData(importData);
            toast('Import success');
            setTimeout(() => document.location.reload(), 1000);
        }
        catch (err) {
            toast('Failed to parse JSON', true);
        }
    });
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
function toast(text, isError = false) {
    if (text == undefined) {
        text = 'Unexpected error';
    }
    Toastify({
        text: text,
        duration: 2000,
        gravity: "top",
        position: "center",
        style: {
            background: isError ? '#AF4C50' : '#4CAF50',
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
});
