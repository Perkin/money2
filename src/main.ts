declare var Chart: any;
declare function Toastify(options: any): any;

const api_url: string = 'https://money-7won.onrender.com';

let authToken: string | null;
let authUser: string | null;

let db: IDBDatabase;
let dbVersion = 4;

interface TotalItem {
    title: string,
    money: number,
}

interface DebtItem {
    title: string,
    money: number,
}

//delete db (for testing)

// let deleteRequest = indexedDB.deleteDatabase('money');
// deleteRequest.onsuccess = function () {
//     console.log('deleted');
//     console.log(deleteRequest);
// }

let openRequest = indexedDB.open('money', dbVersion);

openRequest.onupgradeneeded = function (event) {
    db = openRequest.result;

    dbUpgrade(event);
};

openRequest.onerror = function() {
    console.error("Error", openRequest.error);
};

openRequest.onsuccess = function() {
    db = openRequest.result;

    db.onversionchange = function() {
        db.close();
        alert("Db is outdated, refresh the page");
    };

    main().then(() => {
        console.log('main completed successfully');
    }).catch((error) => {
        console.error('main failed:', error);
    });
}

async function main(): Promise<void> {
    await initMenu();
    await initRegisterPopup();
    await initAuthPopup();
    await initAuth();
    try {
        await dbCalculatePayments();
        await updatePayments();
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

async function initMenu(): Promise<void> {
    const menuButton = (document.getElementById('menu-button') as HTMLButtonElement);
    const dropdownContent = (document.getElementById('menu-dropdown-content') as HTMLElement);

    menuButton.addEventListener('click', (event: MouseEvent) => {
        dropdownContent.classList.toggle('show');
        event.stopPropagation();
    });

    document.addEventListener('click', (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!dropdownContent.contains(target) && target !== menuButton) {
            dropdownContent.classList.remove('show');
        }
    });
}

async function initRegisterPopup(): Promise<void> {
    const openPopupButton = (document.getElementById('open-register-popup') as HTMLButtonElement);
    const closePopupButton = (document.getElementById('close-register-popup') as HTMLButtonElement);
    const registerPopup = (document.getElementById('register-popup') as HTMLButtonElement);

    openPopupButton.addEventListener('click', () => {
        registerPopup.classList.add('show');
    });

    closePopupButton.addEventListener('click', () => {
        registerPopup.classList.remove('show');
    });

    document.addEventListener('click', (event: MouseEvent) => {
        if (event.target === registerPopup) {
            registerPopup.classList.remove('show');
        }
    });
}

async function initAuthPopup(): Promise<void> {
    const openPopupButton = (document.getElementById('open-login-popup') as HTMLButtonElement);
    const closePopupButton = (document.getElementById('close-login-popup') as HTMLButtonElement);
    const loginPopup = (document.getElementById('login-popup') as HTMLButtonElement);

    openPopupButton.addEventListener('click', () => {
        loginPopup.classList.add('show');
    });

    closePopupButton.addEventListener('click', () => {
        loginPopup.classList.remove('show');
    });

    document.addEventListener('click', (event: MouseEvent) => {
        if (event.target === loginPopup) {
            loginPopup.classList.remove('show');
        }
    });
}

async function initAuth(): Promise<void> {
    authToken = getTokenFromCookie();
    if (!authToken) {
        return;
    }
    authUser = getUser(authToken);

    (document.getElementById('logout') as HTMLElement).style.display = 'inline-block';
    (document.getElementById('open-login-popup') as HTMLElement).style.display = 'none';
    (document.getElementById('open-register-popup') as HTMLElement).style.display = 'none';

    (document.getElementById('user') as HTMLElement).innerText = authUser;
}

// Функция для выхода
async function logout(): Promise<void> {
    authUser = null;
    authToken = null;

    (document.getElementById('logout') as HTMLElement).style.display = 'none';
    (document.getElementById('open-login-popup') as HTMLElement).style.display = 'inline-block';
    (document.getElementById('open-register-popup') as HTMLElement).style.display = 'inline-block';

    (document.getElementById('user') as HTMLElement).innerText = '';

    document.cookie = 'token=; Max-Age=0; path=/;';

    const dropdownContent = (document.getElementById('menu-dropdown-content') as HTMLElement);
    dropdownContent.classList.remove('show');

    toast("Вы успешно вышли!");
}

async function showChart(): Promise<void> {
    let ctx = document.getElementById('chart-ctx');
    if (!ctx) {
        ctx = document.createElement('canvas');
        ctx.id = 'chart-ctx';

        document.getElementById('chart-container')!.appendChild(ctx);

        Chart.defaults.color = '#fff';
        new Chart(ctx, await getChartData());
    }
    document.getElementById('chart-container')!.style.display = 'block';
}

async function closeChart(): Promise<void> {
    document.getElementById('chart-container')!.style.display = 'none';
}

async function getChartData(): Promise<object> {
    let invests = await dbGetInvests();
    let investData = [];
    for (const invest of invests) {
        investData.push({date: invest.createdDate, money: invest.money});
        if (invest.isActive == 0) {
            investData.push({date: invest.closedDate, money: -invest.money});
        }
    }

    investData.sort((a, b) => {
        return a.date!.getTime() - b.date!.getTime();
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
}

async function updatePayments(): Promise<void> {
    let filterOnlyActive = (document.getElementById('filter-show-all') as HTMLInputElement).checked ? 0 : 1;
    let filterShowPayed = (document.getElementById('filter-show-payed') as HTMLInputElement).checked;
    let invests = await dbGetInvests({filterOnlyActive: filterOnlyActive});

    invests.sort((a, b) => {
        let dayA = a.createdDate.getDate();
        let dayB = b.createdDate.getDate();

        return dayA - dayB;
    });

    let dataListElem = (document.getElementById('data-list') as HTMLDivElement);
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

        let payments = await dbGetPayments({id: invest.id});
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

    let total: TotalItem = {title: 'Current invest', money: totalInvestedMoney};
    let totalItem = renderTotalItem(total);
    dataListElem.appendChild(totalItem);

    let totalIncome: TotalItem = {title: 'Current income', money: totalIncomeMoney};
    let totalIncomeItem = renderTotalItem(totalIncome);
    dataListElem.appendChild(totalIncomeItem);

    if (totalDebtMoney > 0) {
        let totalDebt: DebtItem = {title: 'Current debt', money: totalDebtMoney};
        let totalDebtItem = renderDebtItem(totalDebt);
        dataListElem.appendChild(totalDebtItem);
    }
}

function renderCurDateLine(): HTMLDivElement {
    let dataItem = document.createElement('div');
    dataItem.className = 'cur-date-item';

    return dataItem;
}

function renderInvestItem(invest: Invest, index: number): HTMLDivElement {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item invest-item';
    if (index % 2) {
        dataItem.classList.add('odd')
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
        closeButton.addEventListener('click', closeInvest)
        dataItemClose.appendChild(closeButton);
    } else if (invest.closedDate) {
        dataItem.classList.add('closed');
    }

    dataItem.appendChild(dataItemClose);

    return dataItem;
}

function renderPaymentItem(payment: Payment, isDebt: boolean, index: number): HTMLDivElement {
    let dataItem = document.createElement('div');
    dataItem.className = 'data-item payment-item';

    if (isDebt) {
        dataItem.classList.add('debt');
    }

    if (index % 2) {
        dataItem.classList.add('odd')
    }

    let dataItemFiller = document.createElement('div');
    dataItemFiller.innerHTML = '&nbsp;'
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
        payedButton.addEventListener('click', closePayment)
        dataItemClose.appendChild(payedButton);
    } else {
        dataItem.classList.add("payed");
    }

    dataItem.appendChild(dataItemClose);

    return dataItem;
}

function renderTotalItem(total: TotalItem): HTMLDivElement {
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

function renderDebtItem(debt: DebtItem): HTMLDivElement {
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

async function addInvest(e: Event): Promise<void> {
    if (e.preventDefault) e.preventDefault();

    let moneyValue = (document.getElementById('add-invest-money') as HTMLInputElement).value;
    let incomeRatioValue = (document.getElementById('add-invest-income-ratio') as HTMLInputElement).value;
    let createdDateValue = (document.getElementById('add-invest-date') as HTMLInputElement).value;

    if (!moneyValue || !incomeRatioValue || !createdDateValue) {
        toast('Empty fields');
        return;
    }

    let money = parseFloat(moneyValue);
    let incomeRatio = parseFloat(incomeRatioValue);
    let createdDate = new Date(Date.parse(createdDateValue));

    let now = new Date();
    createdDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    let res = await dbAddInvest(money, incomeRatio, createdDate);
    if (Number.isInteger(res)) {
        (document.getElementById('add-invest-form') as HTMLFormElement).reset();
        toast('Invest added');
    } else {
        toast(res, true);
    }

    await dbCalculatePayments();
    await updatePayments();
}

async function closeInvest(this: HTMLButtonElement): Promise<void> {
    if (!confirm('Точно закрыть?')) {
        return;
    }

    let investId = parseInt(this.getAttribute('investId')!);
    if (!investId) {
        return;
    }

    let payments = await dbGetPayments({id: investId});
    for (let payment of payments) {
        if (!payment.isPayed) {
            let res = await dbClosePayment(payment.id!);
            if (Number.isInteger(res)) {
                toast('Unpdayed payment closed');
            } else {
                toast(res, true);
            }
        }
    }

    let res = await dbCloseInvest(investId);
    if (Number.isInteger(res)) {
        toast('Invest closed');
    } else {
        toast(res, true);
    }

    await updatePayments();
}

async function closePayment(this: HTMLButtonElement): Promise<void> {
    let paymentId = parseInt(this.getAttribute('paymentId')!);
    if (!paymentId) {
        return;
    }

    let res = await dbClosePayment(paymentId);
    if (Number.isInteger(res)) {
        toast('Payment closed');
    } else {
        toast(res, true);
    }

    await dbCalculatePayments();
    await updatePayments();
}

async function exportData(): Promise<void> {
    let invests = await dbGetInvests();
    let payments = await dbGetPayments();

    let exportString = JSON.stringify({invests: invests, payments: payments});
    try {
        await navigator.clipboard.writeText(exportString);
        toast('Export data copied to clipboard');
    } catch (err) {
        toast('Failed to copy export data to clipboard', true);
    }
}

async function importData(): Promise<void> {
    let importJson = prompt('Input JSON to import (IT WILL ERASE ALL CURRENT DATA!!)');
    if (!importJson) {
        return;
    }
    try {
        let importData = JSON.parse(importJson);
        await dbImportData(importData);
        toast('Import success');
        setTimeout(() => document.location.reload(), 1000);
    } catch (err) {
        toast('Failed to parse JSON', true);
    }
}

async function userRegister(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const username = (document.getElementById("register-username") as HTMLInputElement).value.trim();
    const password = (document.getElementById("register-password") as HTMLInputElement).value.trim();
    const confirmPassword = (document.getElementById("register-confirm-password") as HTMLInputElement).value.trim();

    if (password !== confirmPassword) {
        toast("Пароли не совпадают!", true);
        return;
    }

    const button = (document.getElementById("register-button") as HTMLInputElement);
    const spinner = (document.getElementById("register-spinner") as HTMLSpanElement);

    button.disabled = true;
    spinner.style.display = "block";

    try {
        const elements = document.getElementsByClassName('error-item');
        for (let element of elements) {
            (element as HTMLElement).style.display = 'none';
        }

        const response = await fetch(api_url + "/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        if (result.status == 'success') {
            if (!result.token) {
                toast("Не удалось получить токен", true);
                return;
            }

            toast("Регистрация успешна!");
            (document.getElementById("register-popup") as HTMLElement).style.display = "none";

            setTokenToCookie(result.token);
            await initAuth();
        } else if (result.error) {
            switch (result.error) {
                case 'user_exists':
                    let errorItem = document.createElement('div');
                    errorItem.className = 'error-item';
                    errorItem.innerHTML = 'Пользователь уже существует';

                    (document.getElementById("register-username") as HTMLElement).after(errorItem);
                    break;
                case 'validation_errors':
                    let errors = result.errors || {};

                    for (const key in errors) {
                        let errorItem = document.createElement('div');
                        errorItem.className = 'error-item';
                        errorItem.innerHTML = errors[key];

                        (document.getElementById("register-" + key) as HTMLElement).after(errorItem);
                    }

                    break;
            }
        } else {
            toast("Unknown error: " + JSON.stringify(result), true);
        }
    } catch (error) {
        console.error("Неизвестная ошибка:", error);
        toast("Неизвестная ошибка", true);
    } finally {
        spinner.style.display = "none";
        button.disabled = false;
    }
}

async function userLogin(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const username = (document.getElementById("login-username") as HTMLInputElement).value.trim();
    const password = (document.getElementById("login-password") as HTMLInputElement).value.trim();

    const button = (document.getElementById("login-button") as HTMLInputElement);
    const spinner = (document.getElementById("login-spinner") as HTMLSpanElement);

    button.disabled = true;
    spinner.style.display = "block";

    try {
        const elements = document.getElementsByClassName('error-item');
        for (let element of elements) {
            (element as HTMLElement).style.display = 'none';
        }

        const response = await fetch(api_url + "/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        if (result.status == 'success') {
            if (!result.token) {
                toast("Не удалось получить токен", true);
                return;
            }

            toast("Авторизация успешна!");
            (document.getElementById("login-popup") as HTMLElement).style.display = "none";

            setTokenToCookie(result.token);
            await initAuth();
        } else if (result.error) {
            switch (result.error) {
                case 'invalid_credentials':
                    let errorItem = document.createElement('div');
                    errorItem.className = 'error-item';
                    errorItem.innerHTML = 'Логин или пароль неверны';

                    (document.getElementById("login-password") as HTMLElement).after(errorItem);
                    break;
                case 'validation_errors':
                    let errors = result.errors || {};

                    for (const key in errors) {
                        let errorItem = document.createElement('div');
                        errorItem.className = 'error-item';
                        errorItem.innerHTML = errors[key];

                        (document.getElementById("login-" + key) as HTMLElement).after(errorItem);
                    }

                    break;
            }
        } else {
            toast("Unknown error: " + JSON.stringify(result), true);
        }
    } catch (error) {
        console.error("Неизвестная ошибка:", error);
        toast("Неизвестная ошибка", true);
    } finally {
        spinner.style.display = "none";
        button.disabled = false;
    }
}

function setTokenToCookie(token: string ): void {
    const tokenData = parseJWT(token);

    document.cookie = `token=${token}; max-age=${tokenData.exp}; Secure; SameSite=Strict; path=/`;
}

function getTokenFromCookie(): string|null {
    const nameEQ = "token=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function getUser(token: string): string {
    const tokenData = parseJWT(token);

    return tokenData.username;
}

function parseJWT(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Некорректный токен');
    }

    // Декодируем полезную нагрузку (вторая часть токена)
    const payload = parts[1];

    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

function formatDate(date: Date | string | null | undefined) {
    if (!date) {
        return '&nbsp;';
    }

    if (!(date instanceof Date)) {
        return date;
    }

    let year = date.getFullYear() + '';
    let month = date.toLocaleString('default', { month: 'short' }).replace('.', '');
    let day = date.getDate() + '';
    if (date.getDate() < 10) day = '0' + day;

    return `${year}-${month}-${day}`;
}

let moneyFormatter = new Intl.NumberFormat('default', {
    style: 'currency',
    currency: 'RUB',
    useGrouping: true,
    maximumSignificantDigits: 9,
});

function formatMoney(money: number): string {
    return moneyFormatter.format(money);
}

function toast(text: string | number | undefined, isError: boolean = false): void {
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
    (document.getElementById('filter-show-all') as HTMLInputElement).addEventListener("click", updatePayments);
    (document.getElementById('filter-show-payed') as HTMLInputElement).addEventListener("click", updatePayments);
    (document.getElementById('add-invest-form') as HTMLFormElement).addEventListener('submit', addInvest);
    (document.getElementById('show-chart') as HTMLInputElement).addEventListener("click", showChart);
    (document.getElementById('close-chart') as HTMLButtonElement).addEventListener("click", closeChart);
    (document.getElementById('invest-export') as HTMLButtonElement).addEventListener('click', exportData);
    (document.getElementById('invest-import') as HTMLButtonElement).addEventListener('click', importData);
    (document.getElementById('register-form') as HTMLFormElement).addEventListener('submit', userRegister);
    (document.getElementById('logout') as HTMLButtonElement).addEventListener('click', logout);
    (document.getElementById('login-form') as HTMLFormElement).addEventListener('submit', userLogin);
});
