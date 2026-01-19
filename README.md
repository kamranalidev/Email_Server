# TravelGuru Backend Server

Express.js API server with Nodemailer for sending booking confirmation emails.

## Features

- 📧 **Nodemailer Integration** - Send beautiful HTML emails when bookings are confirmed
- 💳 **Stripe Webhook Handler** - Automatically triggers email on successful payment
- 🔒 **Supabase Integration** - Fetches booking and user data securely

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SMTP (Gmail Example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=TravelGuru <your_email@gmail.com>

# Frontend URL
FRONTEND_URL=https://travelguroo.com
```

### 3. Gmail Setup (App Password)

If using Gmail:

1. Enable 2-Factor Authentication on your Google Account
2. Go to Google Account → Security → App Passwords
3. Create a new App Password for "Mail"
4. Use this password as `SMTP_PASS`

### 4. Run the Server

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

## API Endpoints

### Health Check

```
GET /api/health
```

### Send Booking Confirmation (Manual/Resend)

```
POST /api/send-booking-confirmation
Body: { "booking_id": 123 }
```

### Stripe Webhook

```
POST /api/stripe-webhook
```

Configure this URL in your Stripe Dashboard → Webhooks.

## Stripe Webhook Setup

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-server-url/api/stripe-webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start index.js --name travelguru-api
pm2 save
```

### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```
