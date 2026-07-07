# freeze-frame

## Overview

A monorepo for cross-functional development with:
- **Frontend**: TypeScript + React (Vite)
- **Backend**: Node.js + Express (TypeScript)

## Project Structure

```
freeze-frame/
├── frontend/          # React + TypeScript web application
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── backend/           # Node.js + Express API server
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── README.md
└── LICENSE
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AdamLampingTR/freeze-frame.git
cd freeze-frame
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
```

### Running Locally

**Frontend Development Server:**
```bash
cd frontend
npm run dev
```

**Backend Development Server:**
```bash
cd backend
npm run dev
```

## Development

- **Frontend**: Uses Vite for fast HMR (Hot Module Replacement)
- **Backend**: Uses nodemon with ts-node for auto-restart on changes

## License

MIT - See LICENSE file for details

---

Created: 2026-07-07
