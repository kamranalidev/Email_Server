# TravelGuru Backend Server

Express.js API server with Resend for sending booking confirmation emails.

## Features

- 📧 **Resend Email Integration** - Send beautiful HTML emails when bookings are confirmed
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

# Resend Email (https://resend.com)
RESEND_API_KEY=re_...
EMAIL_FROM=TravelGuru <onboarding@resend.dev>
ADMIN_EMAIL=admin@yourcompany.com  # Optional: receive booking notifications

# Frontend URL
FRONTEND_URL=https://travelguroo.com
```

### 3. Resend Setup

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. For testing, use `onboarding@resend.dev` as the from address
4. For production, verify your domain to send from your own email address

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

### Diagnostics (Check Configuration)

```
GET /api/diagnostics
```

Returns the status of SMTP, Stripe, and Supabase configuration. Useful for debugging.

**Example Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "configured",
    "pass": "configured",
    "connection": "OK"
  },
  "stripe": {
    "secretKey": "configured",
    "webhookSecret": "configured"
  },
  "supabase": {
    "url": "configured",
    "serviceRoleKey": "configured"
  }
}
```

### Test Email

```
POST /api/test-email
Body: { "to": "test@example.com" }  // Optional, defaults to SMTP_USER
```

Sends a test email to verify SMTP configuration is working.

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
