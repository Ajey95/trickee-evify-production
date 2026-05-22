importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('Background message received:', payload);
    const notification = payload.notification || {};
    const title = notification.title || 'Trickee Alert';
    const options = {
      body: notification.body || 'New EV intelligence alert',
      icon: '/trickee-logo.svg',
      ...notification,
    };
    self.registration.showNotification(title, options);
  });
} else {
  console.warn('Firebase Messaging SW: projectId query parameter is missing, background messages disabled.');
}
