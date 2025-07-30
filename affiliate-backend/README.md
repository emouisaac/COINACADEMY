# CoinAcademia Affiliate Backend

## Features
- User registration/login with JWT
- Unique affiliate code generation
- Referral tracking and commission storage
- API endpoints for dashboard, commission, and withdrawals
- MongoDB for persistent storage

## Setup
1. Install dependencies:
   ```
   npm install
   ```
2. Set up MongoDB (local or Atlas) and update `.env` if needed.
3. Start the server:
   ```
   npm start
   ```

## API Endpoints
- `POST /api/auth/register` — Register user (optionally with `referredBy` code)
- `POST /api/auth/login` — Login
- `GET /api/affiliate/dashboard` — Get affiliate stats (auth required)
- `POST /api/affiliate/commission` — Add commission to affiliate (called after payment)
- `POST /api/affiliate/withdraw` — Withdraw commissions (auth required)

## Integration
- On user registration, pass `referredBy` if a referral code is present in the URL.
- After a successful course payment, call `/api/affiliate/commission` with the affiliate code and amount.
- Use JWT tokens for authenticated dashboard and withdrawal actions.

---
This backend is ready for production use with further enhancements (email verification, admin panel, etc.) as needed.
