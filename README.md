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
EMAIL_FROM=TravelGuru <noreply@travelguroo.com>
ADMIN_NOTIFICATION_EMAIL=admin@travelguroo.com

# Frontend URL
FRONTEND_URL=https://travelguroo.com
```

### 3. Resend Setup

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain (travelguroo.com) in Resend dashboard
4. Add the DNS records (SPF, DKIM, DMARC) to your domain
5. Once verified, you can send from `noreply@travelguroo.com`

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
Body: { "to": "test@example.com" }
```

Sends a test email to verify Resend configuration is working.

### Send Booking Confirmation (Manual/Resend)

```
POST /api/send-booking-confirmation
Body: { "booking_id": 123 }
```

Generates a voucher code (if not exists) and sends voucher email to customer + admin notification.

---

## 🎫 Voucher System API

### Lookup Voucher

```
GET /api/voucher/:code
```

Returns voucher status and booking details. Auto-expires if booking date has passed.

**Response:**
```json
{
  "valid": true,
  "code": "TG-ABC12345",
  "status": "active",
  "booking": {
    "id": 123,
    "date": "2024-02-15",
    "time": "10:00 AM",
    "service": "Desert Safari",
    "location": "Dubai",
    "package": "Premium Package",
    "amount": "AED 500.00",
    "paymentStatus": "succeeded"
  },
  "verifiedAt": null
}
```

### Verify/Redeem Voucher (Admin)

```
POST /api/voucher/verify
Body: { "code": "TG-ABC12345", "admin_id": "optional-admin-uuid" }
```

Marks the voucher as used. Returns error if already used, expired, or cancelled.

**Success Response:**
```json
{
  "success": true,
  "message": "Voucher verified successfully!",
  "code": "TG-ABC12345",
  "booking": { ... },
  "verifiedAt": "2024-02-15T10:30:00.000Z"
}
```

### List All Vouchers (Admin Dashboard)

```
GET /api/vouchers?status=active&date=2024-02-15&limit=50
```

**Query Parameters:**
- `status` - Filter by status: `active`, `used`, `expired`, `cancelled`
- `date` - Filter by booking date
- `limit` - Max results (default: 50)

### Resend Voucher Email

```
POST /api/voucher/resend
Body: { "code": "TG-ABC12345" }  // OR { "booking_id": 123 }
```

Resends the voucher email to the customer.

### Cancel Voucher (Admin)

```
POST /api/voucher/cancel
Body: { "code": "TG-ABC12345", "reason": "Customer requested refund", "admin_id": "optional" }
```

Cancels an active voucher. Cannot cancel already used vouchers.

---

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
