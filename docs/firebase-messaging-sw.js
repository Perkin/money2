// Используем importScripts для загрузки Firebase в Service Worker
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js');

// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyChibkvDRX-jFeAwM83yNniWzCh1Et4fGg",
    authDomain: "money-credit-js.firebaseapp.com",
    projectId: "money-credit-js",
    storageBucket: "money-credit-js.appspot.com",
    messagingSenderId: "439781336506",
    appId: "1:439781336506:web:a3c98594b6a6f4d5df2983"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Инициализация Firebase Messaging
const messaging = firebase.messaging();

// Обработка фонового уведомления
messaging.onBackgroundMessage((payload) => {
    console.log('Фоновое сообщение получено:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
