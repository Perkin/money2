const defaultIncomeRatio = 0.05;

interface Invest {
    id?: number,
    money: number,
    incomeRatio: number,
    createdDate: Date,
    closedDate: Date | null,
    isActive: 1 | 0
}

interface Payment {
    id?: number,
    investId: number,
    money: number,
    paymentDate: Date,
    isPayed: 1 | 0
}

type InvestFilter = {
    filterOnlyActive?: number
}

type PaymentFilter = {
    id?: number
}

type dbResult = number | string | undefined;

async function dbGetInvestById(investId: number): Promise<Invest> {
    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    return dbDoAsync (() => invests.get(investId));
}

async function dbGetInvests(filter: InvestFilter = {}): Promise<Invest[]> {
    let filterOnlyActive = filter.filterOnlyActive;

    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    if (filterOnlyActive == 1) {
        let showAllIndex = invests.index('isActiveIdx');
        return dbDoAsync(() => showAllIndex.getAll(1));
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
    };

    return dbDoAsync(() => invests.add(invest));
}

async function dbCloseInvest(investId: number): Promise<dbResult> {
    let invest = await dbGetInvestById(investId);
    invest.isActive = 0;
    invest.closedDate = new Date();

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

    let investId = filter.id;
    if (investId != undefined) {
        let investIndex = payments.index('investIdIdx');
        return dbDoAsync(() => investIndex.getAll(investId!));
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
    }

    return dbDoAsync(() => payments.add(payment));
}

async function dbClosePayment(paymentId: number): Promise<dbResult> {
    let payment = await dbGetPaymentById(paymentId);
    payment.isPayed = 1;

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
        invest.createdDate = new Date(Date.parse(invest.createdDate));
        if (!invest.isActive && invest.closedDate) {
            invest.closedDate = new Date(Date.parse(invest.closedDate));
        }
        await dbDoAsync(() => invests.put(invest));
    }

    let payments = transaction.objectStore("payments");
    await dbDoAsync (() => payments.clear());

    for (const payment of importData.payments) {
        payment.paymentDate = new Date(Date.parse(payment.paymentDate));
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
