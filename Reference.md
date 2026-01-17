FocusAI/
│
├── main.js                # Electron main process
├── preload.js             # Preload script for renderer IPC
├── package.json
│
├── backend/               # All backend logic
│   ├── database/
│   │   ├── connection.js
│   │   └── repositories/
│   │       └── userRepository.js
│   ├── services/
│   │   └── authService.js
│   │   └── screenMonitor.js     
│   └── utils/
│       └── validators.js
│
├── frontend/              # All frontend assets
│   ├── pages/
│   │   ├── auth.html
│   │   └── dashboard.html
│   ├── js/
│   │   ├── auth.js
│   │   └── dashboard.js
│   └── css/
│       ├── global.css
│       ├── auth.css
│       └── dashboard.css
└── data/                  # SQLite database
    └── focusai.db
