# 🎯 Multiplayer Bingo App

A real-time 5×5 Bingo mobile application built with **React Native** and **Socket.io**.  
This project demonstrates full-stack mobile development with a focus on real-time
bidirectional communication, room-based matchmaking, and cloud deployment.

---

## 🚀 Features

- 🎲 **Classic 5×5 Gameplay** – Randomized board generation for every new match
- 👥 **Real-Time Multiplayer** – Instant synchronization between players using WebSockets
- 🤖 **Play vs Computer** – Fully functional single-player mode against an AI opponent
- 🔐 **Room-Code Matchmaking** – Private rooms for playing with friends
- 🔄 **Server-Authoritative Logic** – Turn enforcement and win validation handled by backend
- 📱 **Expo Optimized** – Easy testing and usage on Android devices via Expo Go

---

## 🛠 Tech Stack

### Frontend
- **Framework:** React Native (Expo)
- **Language:** JavaScript
- **Real-Time Communication:** Socket.io Client

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **WebSockets:** Socket.io
- **Deployment:** Render (Cloud Hosting)

---

## 🌍 Deployment Note

> This is a **mobile-first application**.  
> The backend is deployed on Render as a Socket.io server and does not serve a web UI.
> Opening the backend URL in a browser will show no webpage, which is expected behavior.

---

## ▶️ Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/SiriC-D/bingo-multiplayer.git
cd bingo-multiplayer
````

### 2. Setup Backend

```bash
cd backend
npm install
node server.js
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code using the **Expo Go** app on your Android device.

---

## 🧪 Testing Status

* [x] **Single-player:** AI gameplay and board completion verified
* [x] **Multiplayer:** Real-time synchronization tested across two devices
* [x] **Backend:** Cloud server handling concurrent socket connections successfully

---

## ✨ Author

**Siri Chandana**
Computer Science Student
GitHub: [https://github.com/SiriC-D](https://github.com/SiriC-D)

My First hands-on project using React Native and Socket.io.
