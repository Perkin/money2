const defaultIncomeRatio = 0.05;

interface Invest {
    id?: number,
    money: number,
    incomeRatio: number,
    createdDate: Date,
    closedDate: Date | null,
    isActive: 1 | 0,
    updatedAt: Date
}

interface Payment {
    id?: number,
    investId: number,
    money: number,
    paymentDate: Date,
    isPayed: 1 | 0,
    updatedAt: Date
}

type InvestFilter = {
    filterOnlyActive?: number,
    updatedAt?: Date
}

type PaymentFilter = {
    id?: number,
    updatedAt?: Date
}

type dbResult = number | string | undefined;

function dbUpgrade(event: IDBVersionChangeEvent): void {
    const db = (event.target as IDBOpenDBRequest).result;

    // Текущая транзакция обновления
    const transaction = openRequest.transaction;
    if (!transaction) {
        console.error("Transaction is null during onupgradeneeded.");
        return;
    }

    // Invests db
    let invests;
    if (!db.objectStoreNames.contains('invests')) {
        invests = db.createObjectStore('invests', {keyPath: 'id', autoIncrement: true});
        invests.createIndex('isActiveIdx', 'isActive', {unique: false});
    } else {
        invests = transaction.objectStore("invests");
    }

    if (!invests.indexNames.contains('updatedAtIdx')) {
        invests.createIndex('updatedAtIdx', 'updatedAt', { unique: false });
    }

    // Payments db
    let payments;
    if (!db.objectStoreNames.contains('payments')) {
        payments = db.createObjectStore('payments', {keyPath: 'id', autoIncrement: true});
        payments.createIndex('investIdIdx', 'investId', {unique: false});
    } else {
        payments = transaction.objectStore("payments");
    }

    if (!payments.indexNames.contains('updatedAtIdx')) {
        payments.createIndex('updatedAtIdx', 'updatedAt', { unique: false });
    }
}

async function dbGetInvestById(investId: number): Promise<Invest> {
    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    return dbDoAsync (() => invests.get(investId));
}

async function dbGetInvests(filter: InvestFilter = {}): Promise<Invest[]> {
    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    if (filter.filterOnlyActive) {
        let showAllIndex = invests.index('isActiveIdx');

        return dbDoAsync(() => showAllIndex.getAll(1));
    } else if (filter.updatedAt) {
        let updatedAtIndex = invests.index('updatedAtIdx');
        let range = IDBKeyRange.lowerBound(filter.updatedAt);

        return dbDoAsync(() => updatedAtIndex.getAll(range));
    } else {
        return dbDoAsync (() => invests.getAll());
    }
}

async function dbAddInvest(money: number, incomeRatio: number, createdDate: Date): Promise<dbResult> {
    let transaction = db.transaction("invests", "readwrite");

    let invests = transaction.objectStore("invests");
    let invest: Invest = {
        money: money,
        incomeRatio: incomeRatio,
        createdDate: createdDate,
        closedDate: null,
        isActive: 1,
        updatedAt: createdDate
    };

    return dbDoAsync(() => invests.add(invest));
}

async function dbCloseInvest(investId: number): Promise<dbResult> {
    let invest = await dbGetInvestById(investId);
    invest.isActive = 0;
    invest.closedDate = new Date();
    invest.updatedAt = invest.closedDate;

    let transaction = db.transaction("invests", "readwrite");
    let invests = transaction.objectStore("invests");

    return dbDoAsync(() => invests.put(invest));
}

async function dbCalculatePayments(): Promise<void> {
    let invests = await dbGetInvests({filterOnlyActive: 1});
    if (!invests) {
        return;
    }

    for(const invest of invests) {
        let lastPaymentDate = invest.createdDate;

        let payments = await dbGetPayments({id: invest.id});
        let lastPayment = payments.pop();

        // Keep the last unpayed row active
        if (lastPayment && !lastPayment.isPayed) {
            continue;
        }

        if (lastPayment) {
            lastPaymentDate = lastPayment.paymentDate;
        }

        lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);
        lastPaymentDate.setHours(0);
        lastPaymentDate.setMinutes(0);
        lastPaymentDate.setSeconds(0);

        await dbAddPayment(invest.id!, invest.money, invest.incomeRatio || defaultIncomeRatio, lastPaymentDate);
    }
}

async function dbGetPayments(filter: PaymentFilter = {}): Promise<Payment[]> {
    let transaction = db.transaction("payments");
    let payments = transaction.objectStore("payments");

    if (filter.id) {
        let investIndex = payments.index('investIdIdx');

        return dbDoAsync(() => investIndex.getAll(filter.id));
    } else if (filter.updatedAt) {
        let updatedAtIndex = payments.index('updatedAtIdx');
        let range = IDBKeyRange.lowerBound(filter.updatedAt);

        return dbDoAsync(() => updatedAtIndex.getAll(range));
    } else {
        return dbDoAsync (() => payments.getAll());
    }
}

async function dbAddPayment(investId: number, investMoney: number, incomeRatio: number, paymentDate: Date): Promise<dbResult> {
    let transaction = db.transaction("payments", "readwrite");
    let payments = transaction.objectStore("payments");

    let payment: Payment = {
        investId: investId,
        money: Math.round(investMoney * incomeRatio),
        paymentDate: paymentDate,
        isPayed: 0,
        updatedAt: new Date()
    }

    return dbDoAsync(() => payments.add(payment));
}

async function dbClosePayment(paymentId: number): Promise<dbResult> {
    let payment = await dbGetPaymentById(paymentId);
    payment.isPayed = 1;
    payment.updatedAt = new Date();

    let transaction = db.transaction("payments", "readwrite");
    let payments = transaction.objectStore("payments");

    return dbDoAsync(() => payments.put(payment));
}

async function dbGetPaymentById(paymentId: number): Promise<Payment> {
    let transaction = db.transaction("payments");
    let payments = transaction.objectStore("payments");

    return dbDoAsync (() => payments.get(paymentId));
}

async function dbImportData(importData: any): Promise<void> {
    let transaction = db.transaction(["payments", "invests"], "readwrite");

    let invests = transaction.objectStore("invests");
    // Clean DB
    await dbDoAsync (() => invests.clear());

    // Export converts date to string, so we should cast them back to Date
    for (const invest of importData.invests) {
        invest.createdDate = new Date(invest.createdDate);
        invest.updatedAt = new Date(invest.updatedAt);
        if (!invest.isActive && invest.closedDate) {
            invest.closedDate = new Date(invest.closedDate);
        }
        await dbDoAsync(() => invests.put(invest));
    }

    let payments = transaction.objectStore("payments");
    await dbDoAsync (() => payments.clear());

    for (const payment of importData.payments) {
        payment.paymentDate = new Date(payment.paymentDate);
        payment.updatedAt = new Date(payment.updatedAt);
        await dbDoAsync(() => payments.put(payment));
    }
}

async function dbDoAsync(callback: () => IDBRequest): Promise<any> {
    return new Promise((resolve, reject) => {
        let request = callback();

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            let caller = (new Error()).stack!.split("\n")[4].trim().split(" ")[1];
            console.log(`${caller}: failed`, request.error);
            reject(request.error);
        };
    });
}
