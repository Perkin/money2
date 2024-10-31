import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-sw.js";

const firebaseConfig = {
    apiKey: "AIzaSyChibkvDRX-jFeAwM83yNniWzCh1Et4fGg",
    authDomain: "money-credit-js.firebaseapp.com",
    projectId: "money-credit-js",
    storageBucket: "money-credit-js.appspot.com",
    messagingSenderId: "439781336506",
    appId: "1:439781336506:web:a3c98594b6a6f4d5df2983"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Обработка фонового уведомления
onBackgroundMessage(messaging, (payload) => {
    console.log('Фоновое сообщение получено:', payload);
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: payload.notification.icon
    });
});
