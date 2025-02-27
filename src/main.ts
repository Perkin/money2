declare var Chart: any;
declare function Toastify(options: any): any;

const api_url: string = 'https://perkin.alwaysdata.net/money/api';

let db: IDBDatabase;
let dbVersion = 4;

type User = {
    token: string;
    username: string;
    email: string;
};

let authUser: User | null;

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

openRequest.onerror = function() {
    console.error("Error", openRequest.error);
};

openRequest.onsuccess = function() {
    db = openRequest.result;

    db.onversionchange = function() {
        db.close();
        alert("Требуется обновление структуры БД. Обновите страницу для обновления.");
    };

    main().then(() => {
        console.log('Приложение успешно загружено');
    }).catch((error) => {
        console.error('Ошибка при загрузке приложения:', error);
    });
}

async function main(): Promise<void> {
    await dbCalculatePayments();
    await updatePayments();

    await initMenu();
    await initRegisterPopup();
    await initAuthPopup();
    await initAuth();
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
}

async function initAuth(): Promise<void> {
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

    (document.getElementById('logout') as HTMLElement).style.display = 'inline-block';
    (document.getElementById('open-login-popup') as HTMLElement).style.display = 'none';
    (document.getElementById('open-register-popup') as HTMLElement).style.display = 'none';

    (document.getElementById('user') as HTMLElement).innerText = authUser.username;

    await syncUpdates();
}

// Функция для выхода
async function logout(): Promise<void> {
    authUser = null;
    removeToken();

    (document.getElementById('logout') as HTMLElement).style.display = 'none';
    (document.getElementById('open-login-popup') as HTMLElement).style.display = 'inline-block';
    (document.getElementById('open-register-popup') as HTMLElement).style.display = 'inline-block';

    (document.getElementById('user') as HTMLElement).innerText = '';

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

    let total: TotalItem = {title: 'Итого', money: totalInvestedMoney};
    let totalItem = renderTotalItem(total);
    dataListElem.appendChild(totalItem);

    let totalIncome: TotalItem = {title: 'Прибыль', money: totalIncomeMoney};
    let totalIncomeItem = renderTotalItem(totalIncome);
    dataListElem.appendChild(totalIncomeItem);

    if (totalDebtMoney > 0) {
        let totalDebt: DebtItem = {title: 'Долг', money: totalDebtMoney};
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
        closeButton.title = 'Закрыть инвестицию';
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
        payedButton.title = 'Оплата произведена';
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
        toast('Заполните все поля');
        return;
    }

    let money = parseFloat(moneyValue);
    let incomeRatio = parseFloat(incomeRatioValue);
    let createdDate = new Date(createdDateValue);

    createdDate.setHours(0, 0, 0);

    let res = await dbAddInvest(money, incomeRatio, createdDate);
    if (Number.isInteger(res)) {
        (document.getElementById('add-invest-form') as HTMLFormElement).reset();
        toast('Инвестиция добавлена');
    } else {
        toastError(res);
    }

    await dbCalculatePayments();
    await updatePayments();
    await updateRemoteData();
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
                toast('Долг автоматически оплачен');
            } else {
                toastError(res);
            }
        }
    }

    let res = await dbCloseInvest(investId);
    if (Number.isInteger(res)) {
        toast('Инвестиция закрыта');
    } else {
        toastError(res);
    }

    await updatePayments();
    await updateRemoteData();
}

async function closePayment(this: HTMLButtonElement): Promise<void> {
    let paymentId = parseInt(this.getAttribute('paymentId')!);
    if (!paymentId) {
        return;
    }

    let res = await dbClosePayment(paymentId);
    if (Number.isInteger(res)) {
        toast('Долг оплачен');
    } else {
        toastError(res);
    }

    await dbCalculatePayments();
    await updatePayments();
    await updateRemoteData();
}

async function exportData(): Promise<void> {
    let invests = await dbGetInvests();
    let payments = await dbGetPayments();

    let exportString = JSON.stringify({invests: invests, payments: payments});
    try {
        await navigator.clipboard.writeText(exportString);
        toast('Данные скопированы в буфер обмена');
    } catch (err) {
        toastError('Не удалось скопировать данные в буфер обмена');
    }
}

async function importData(): Promise<void> {
    let importJson = prompt('Input JSON to import (IT WILL ERASE ALL CURRENT DATA!!)');
    if (!importJson) {
        return;
    }
    try {
        let importData = JSON.parse(importJson);
        await dbImportData(importData, true);
        toast('Импорт завершен');
        setTimeout(() => document.location.reload(), 1000);
    } catch (err) {
        toastError('Не удалось распарсить данные');
    }
}

async function userRegister(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const username = (document.getElementById("register-username") as HTMLInputElement).value.trim();
    const email    = (document.getElementById("register-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("register-password") as HTMLInputElement).value.trim();
    const confirmPassword = (document.getElementById("register-confirm-password") as HTMLInputElement).value.trim();

    if (password !== confirmPassword) {
        toastError("Пароли не совпадают!");
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

        const response = await fetch(api_url + "/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, email, password })
        });

        const result = await response.json();
        if (result.status == 'success') {
            if (!result.token) {
                toastError("Не удалось получить токен, что-то сломалось...", 5000);
                return;
            }

            toast("Регистрация успешна!");
            (document.getElementById("register-popup") as HTMLElement).style.display = "none";

            setToken(result.token);
            await initAuth();
        } else if (result.error) {
            switch (result.error) {
                case 'user_exists':
                    let errorItem = document.createElement('div');
                    errorItem.className = 'error-item';
                    errorItem.innerHTML = 'Пользователь уже существует';

                    (document.getElementById("register-email") as HTMLElement).after(errorItem);
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
            toastError("Ошибка: " + JSON.stringify(result));
        }
    } catch (error) {
        console.error("Неизвестная ошибка:", error);
        toastError("Неизвестная ошибка");
    } finally {
        spinner.style.display = "none";
        button.disabled = false;
    }
}

async function userLogin(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const email = (document.getElementById("login-email") as HTMLInputElement).value.trim();
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

        const response = await fetch(api_url + "/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (result.status == 'success') {
            if (!result.token) {
                toastError("Не удалось получить токен, что-то сломалось...", 5000);
                return;
            }

            toast("Авторизация успешна!");
            (document.getElementById("login-popup") as HTMLElement).style.display = "none";

            setToken(result.token);
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
            toastError("Неизвестная ошибка: " + JSON.stringify(result));
        }
    } catch (error) {
        console.error("Неизвестная ошибка:", error);
        toastError("Неизвестная ошибка");
    } finally {
        spinner.style.display = "none";
        button.disabled = false;
    }
}

async function syncUpdates(): Promise<void> {
    const lastSyncDate = localStorage.getItem('lastSyncDate') || '';

    const toastSyncUpdates = toast('Получаю обновления...', -1);
    const result = await sendRequest(`/updates?since=${lastSyncDate}`);
    toastSyncUpdates.hideToast();

    if (result && result.status == 'success') {
        await updateLocalData(result);
    } else {
        if (result && result.status == 'no_updates') {
            toast('Обновлений нет');
        }
        await updateRemoteData();
    }

    localStorage.setItem('lastSyncDate', new Date().toISOString());
}

async function updateLocalData(result: any): Promise<void> {
    await dbImportData(result);

    toast('Новые данные загружены');
    setTimeout(() => document.location.reload(), 1000);
}

async function updateRemoteData(): Promise<void> {
    const lastSyncDate = localStorage.getItem('lastSyncDate');

    let investFilter : InvestFilter = {};
    let paymentFilter : PaymentFilter = {};

    if (lastSyncDate) {
        investFilter = {updatedAt: new Date(lastSyncDate)};
        paymentFilter = {updatedAt: new Date(lastSyncDate)};
    }

    const invests = await dbGetInvests(investFilter);
    const payments = await dbGetPayments(paymentFilter);

    if (!invests.length && !payments.length ) {
        return;
    }
    const exportJson = {invests: invests, payments: payments};

    const toastUpdateRemoteData = toast('Отправляю данные...', -1);
    const result = await sendRequest('/update', 'POST', exportJson);
    toastUpdateRemoteData.hideToast();

    if (result && result.status == 'success') {
        toast('Новые данные успешно отправлены на сервер');
    }
}

async function sendRequest(url: string, method: string = 'GET', json: any = null): Promise<any> {
    if (!authUser) {
        throw new Error("Неавторизованный запрос, токен не найден");
    }

    try {
        const response = await fetch(api_url + url, {
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
                await logout();
                return null;
            }
            toastError(`Ошибка: ${response.statusText}`);
            console.error(`Ошибка:`, response);
            return null;
        }

        return response.json();
    } catch (error: unknown) {
        toastError(`"Неизвестная ошибка`);
        console.error("Неизвестная ошибка:", error);
    }

    return null;
}

function setToken(token: string ): void {
    localStorage.setItem('token', token);
}

function removeToken(): void {
    localStorage.removeItem('token');
}

function getToken(): string|null {
    return localStorage.getItem('token');
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

function toast(text: string, duration: number = 3000, props: object = {}): any {
    return Toastify({
        text: text,
        duration: duration,
        gravity: "top",
        position: "center",
        style: {
            background: '#4CAF50',
        },
        ...props
    }).showToast();
}

function toastError(text: string | number | undefined, duration: number = 3000, props: object = {}): any {
    return Toastify({
        text: text || 'Неизвестная ошибка',
        duration: duration,
        gravity: "top",
        position: "center",
        style: {
            background: '#AF4C50',
        },
        ...props
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
    (document.getElementById('logout') as HTMLButtonElement).addEventListener('click', logout);
    (document.getElementById('register-form') as HTMLFormElement).addEventListener('submit', userRegister);
    (document.getElementById('login-form') as HTMLFormElement).addEventListener('submit', userLogin);
});
