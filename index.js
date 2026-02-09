import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== LOGGING UTILITIES ====================
const log = {
  info: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : "");
  },
  success: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : "");
  },
  error: (msg, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${msg}`, error?.message || error || "");
    if (error?.stack) console.error(error.stack);
  },
  warn: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : "");
  },
  payment: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 💳 ${msg}`, data ? JSON.stringify(data, null, 2) : "");
  },
  email: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📧 ${msg}`, data ? JSON.stringify(data, null, 2) : "");
  },
};

// ==================== STARTUP LOGGING ====================
log.info("=".repeat(60));
log.info("TravelGuru Server Starting...");
log.info("=".repeat(60));
log.info("Environment Check:", {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: PORT,
  RESEND_API_KEY: process.env.RESEND_API_KEY ? "✓ Set" : "✗ Missing",
  EMAIL_FROM: process.env.EMAIL_FROM || "onboarding@resend.dev",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? "✓ Set" : "✗ Missing",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? "✓ Set" : "✗ Missing",
  SUPABASE_URL: process.env.SUPABASE_URL ? "✓ Set" : "✗ Missing",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://travelguroo.com",
});

// Middleware
app.use(cors());

// Stripe webhook needs raw body (only if Stripe is configured)
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Initialize services
// Stripe is optional - only initialize if API key is provided
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Initialize Resend for email
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (resend) {
  log.success("Resend email service initialized");
} else {
  log.warn("RESEND_API_KEY not set - email sending will not work");
}

// Default from email (use verified domain or Resend's test address)
const EMAIL_FROM = process.env.EMAIL_FROM || "TravelGuru <onboarding@resend.dev>";

// Helper: Format money
const formatMoney = (amountMinor, currency = "aed") => {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(major);
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const formatList = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
};

// Helper: Generate booking confirmation email HTML
const generateBookingEmailHTML = (booking, service, packageInfo, userName) => {
  const serviceName = service?.service_name || service?.name || "Your Booking";
  const location = service?.location || "";
  const packageName = packageInfo?.name || "";
  const amount = formatMoney(booking.amount, booking.currency);
  const serviceDescription = service?.service_description || "";
  const serviceType = service?.service_type || "";
  const packageDuration = packageInfo?.duration || "";
  const packageIncludes = formatList(packageInfo?.includes);
  const packageExcludes = formatList(packageInfo?.excludes);
  const packagePrice =
    typeof packageInfo?.price === "number"
      ? formatMoney(packageInfo.price, booking.currency)
      : "";
  const bookingTime = booking.departure_arrival_time || "";
  const bookingAddress = booking.address || "";
  const bookingType = booking.type || "";
  const paymentRef = booking.payment_intent_id
    ? booking.payment_intent_id.slice(-8).toUpperCase()
    : "";
  const greeting = userName
    ? `Dear ${escapeHtml(userName)},`
    : "Dear Customer,";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF621F 0%, #ff8533 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">TravelGuru</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Your Adventure Awaits!</p>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 40px 30px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #4CAF50; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 40px; line-height: 80px;">✓</span>
              </div>
              <h2 style="color: #1a1a1a; margin: 20px 0 10px; font-size: 24px;">Booking Confirmed!</h2>
              <p style="color: #666; margin: 0 0 10px; font-size: 16px;">${greeting}</p>
              <p style="color: #666; margin: 0; font-size: 16px;">Thank you for choosing TravelGuroo</p>
            </td>
          </tr>
          
          <!-- Booking Details -->
          <tr>
            <td style="padding: 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #1a1a1a; margin: 0 0 20px; font-size: 18px; border-bottom: 2px solid #FF621F; padding-bottom: 10px;">Booking Details</h3>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Booking ID</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">#${
                          booking.id
                        }</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Service</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(
                          serviceName,
                        )}</td>
                      </tr>
                      ${
                        location
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Location</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          location,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        serviceType
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Service Type</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          serviceType,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Date</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${
                          booking.booking_date
                        }</td>
                      </tr>
                      ${
                        bookingTime
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Time</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          bookingTime,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        bookingType
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Booking Type</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          bookingType,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        bookingAddress
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Address</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          bookingAddress,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        packageName
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Package</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          packageName,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        packageDuration
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Package Duration</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          packageDuration,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        packagePrice
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 14px;">Package Price</td>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: right;">${escapeHtml(
                          packagePrice,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td colspan="2" style="padding: 16px 0 8px;">
                          <hr style="border: none; border-top: 1px solid #ddd; margin: 0;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #1a1a1a; font-size: 16px; font-weight: 700;">Total Paid</td>
                        <td style="padding: 8px 0; color: #FF621F; font-size: 20px; font-weight: 700; text-align: right;">${amount}</td>
                      </tr>
                      ${
                        paymentRef
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 12px;">Payment Reference</td>
                        <td style="padding: 8px 0; color: #888; font-size: 12px; text-align: right; font-family: monospace;">${escapeHtml(
                          paymentRef,
                        )}</td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            serviceDescription || packageIncludes || packageExcludes
              ? `
          <!-- Service Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff7f2; border-radius: 8px; padding: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="color: #1a1a1a; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid #FF621F; padding-bottom: 10px;">Service Details</h3>
                    ${
                      serviceDescription
                        ? `<p style="color: #444; margin: 0 0 12px; font-size: 14px; line-height: 1.5;">${escapeHtml(
                            serviceDescription,
                          )}</p>`
                        : ""
                    }
                    ${
                      packageIncludes
                        ? `<p style="color: #444; margin: 0 0 8px; font-size: 14px;"><strong>Includes:</strong> ${escapeHtml(
                            packageIncludes,
                          )}</p>`
                        : ""
                    }
                    ${
                      packageExcludes
                        ? `<p style="color: #444; margin: 0; font-size: 14px;"><strong>Excludes:</strong> ${escapeHtml(
                            packageExcludes,
                          )}</p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Important Information -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 8px; border-left: 4px solid #4CAF50;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <h4 style="color: #2e7d32; margin: 0 0 10px; font-size: 14px; font-weight: 700;">📋 Important Information</h4>
                    <ul style="color: #333; margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8;">
                      <li>Please arrive 15 minutes before your scheduled time</li>
                      <li>Bring a valid ID or passport for verification</li>
                      <li>Keep this confirmation email for your records</li>
                      <li>For any changes, contact us at least 24 hours in advance</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Status Badge -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <span style="display: inline-block; background-color: #4CAF50; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                ✓ Payment Successful
              </span>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <a href="${
                process.env.FRONTEND_URL || "https://travelguroo.com"
              }/bookings" 
                 style="display: inline-block; background: linear-gradient(135deg, #FF621F 0%, #ff8533 100%); color: white; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-size: 16px; font-weight: 600;">
                View My Bookings
              </a>
            </td>
          </tr>
          
          <!-- Contact Information -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 20px; text-align: center;">
                    <p style="color: #666; margin: 0 0 8px; font-size: 13px; font-weight: 600;">Need Help?</p>
                    <p style="color: #333; margin: 0; font-size: 14px;">
                      📞 <a href="tel:+971123456789" style="color: #FF621F; text-decoration: none;">+971 12 345 6789</a>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      💬 <a href="https://wa.me/971123456789" style="color: #25d366; text-decoration: none;">WhatsApp</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <p style="color: rgba(255,255,255,0.9); margin: 0 0 10px; font-size: 14px;">
                Questions? Contact us at <a href="mailto:support@travelguroo.com" style="color: #FF621F;">support@travelguroo.com</a>
              </p>
              <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} TravelGuru. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Send booking confirmation email
const sendBookingConfirmationEmail = async (bookingId) => {
  log.email(`Starting email send for booking #${bookingId}`);
  
  try {
    // Step 1: Fetch booking with related data
    log.email(`Fetching booking data for #${bookingId}...`);
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id, 
        booking_date, 
        departure_arrival_time,
        address,
        type,
        payment_status, 
        amount, 
        currency, 
        service_id, 
        package_id,
        user_id,
        payment_intent_id,
        services(service_name, location, service_description, service_type),
        packages(name, duration, includes, excludes, price)
      `,
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      log.error(`Failed to fetch booking #${bookingId}`, bookingError);
      throw bookingError;
    }
    if (!booking) {
      log.error(`Booking #${bookingId} not found in database`);
      throw new Error("Booking not found");
    }

    log.email(`Booking found:`, {
      id: booking.id,
      user_id: booking.user_id,
      service_id: booking.service_id,
      payment_status: booking.payment_status,
      amount: booking.amount,
    });

    // Step 2: Get user email
    log.email(`Fetching user data for user_id: ${booking.user_id}...`);
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(booking.user_id);

    if (userError) {
      log.error(`Failed to fetch user ${booking.user_id}`, userError);
      throw userError;
    }
    if (!userData?.user?.email) {
      log.error(`User ${booking.user_id} has no email address`);
      throw new Error("User email not found");
    }

    const userEmail = userData.user.email;
    const userName =
      userData.user.user_metadata?.full_name ||
      userData.user.email.split("@")[0];

    log.email(`User found:`, { email: userEmail, name: userName });

    // Normalize service and package data
    const service = Array.isArray(booking.services)
      ? booking.services[0]
      : booking.services;

    const packageInfo = Array.isArray(booking.packages)
      ? booking.packages[0]
      : booking.packages;

    const serviceName = service?.service_name || "Your Booking";

    log.email(`Service: ${serviceName}, Package: ${packageInfo?.name || "None"}`);

    // Check if Resend is configured
    if (!resend) {
      log.error("Resend is not configured - cannot send email");
      throw new Error("Email service not configured. Set RESEND_API_KEY.");
    }

    // Step 3: Generate email HTML
    log.email("Generating email HTML...");
    const html = generateBookingEmailHTML(
      booking,
      service,
      packageInfo,
      userName,
    );

    // Step 4: Send email to customer using Resend
    log.email(`Sending confirmation email to ${userEmail}...`);
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: `✅ Booking Confirmed: ${serviceName} - #${booking.id}`,
      html: html,
    });

    if (emailError) {
      log.error(`Resend API error`, emailError);
      throw new Error(emailError.message || "Failed to send email via Resend");
    }

    log.success(`Confirmation email SENT to ${userEmail} for booking #${bookingId}`);
    log.email(`Resend Email ID: ${emailData?.id}`);

    // Step 5: Notify admin (optional)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      log.email(`Sending admin notification to ${adminEmail}...`);
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
          <h2 style="margin: 0 0 12px;">New booking placed</h2>
          <p style="margin: 0 0 8px;">A new booking has been created with the following details:</p>
          <ul style="margin: 0; padding-left: 18px;">
            <li><strong>Booking ID:</strong> #${booking.id}</li>
            <li><strong>Customer:</strong> ${escapeHtml(
              userName || userEmail,
            )} (${escapeHtml(userEmail)})</li>
            <li><strong>Service:</strong> ${escapeHtml(serviceName)}</li>
            <li><strong>Date:</strong> ${escapeHtml(booking.booking_date)}</li>
            ${
              booking.departure_arrival_time
                ? `<li><strong>Time:</strong> ${escapeHtml(
                    booking.departure_arrival_time,
                  )}</li>`
                : ""
            }
            ${
              packageInfo?.name
                ? `<li><strong>Package:</strong> ${escapeHtml(
                    packageInfo.name,
                  )}</li>`
                : ""
            }
            <li><strong>Amount:</strong> ${escapeHtml(
              formatMoney(booking.amount, booking.currency),
            )}</li>
            <li><strong>Payment Status:</strong> ${escapeHtml(
              booking.payment_status,
            )}</li>
          </ul>
        </div>
      `;

      const { error: adminEmailError } = await resend.emails.send({
        from: EMAIL_FROM,
        to: adminEmail,
        subject: `🧾 New Booking Notification - #${booking.id}`,
        html: adminHtml,
      });
      
      if (adminEmailError) {
        log.warn(`Failed to send admin notification`, adminEmailError);
      } else {
        log.success(`Admin notification SENT for booking #${bookingId}`);
      }
    }

    return { success: true, emailId: emailData?.id };
  } catch (error) {
    log.error(`FAILED to send email for booking #${bookingId}`, error);
    return { success: false, error: error.message };
  }
};

// API Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Diagnostic endpoint to check email and payment configuration
app.get("/api/diagnostics", async (req, res) => {
  log.info("=".repeat(50));
  log.info("Diagnostics endpoint called");

  const diagnostics = {
    timestamp: new Date().toISOString(),
    email: {
      provider: "Resend",
      apiKey: process.env.RESEND_API_KEY ? "configured" : "MISSING",
      from: EMAIL_FROM,
      status: resend ? "ready" : "NOT_CONFIGURED",
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ? "configured" : "MISSING",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? "configured" : "MISSING",
    },
    supabase: {
      url: process.env.SUPABASE_URL ? "configured" : "MISSING",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "MISSING",
    },
    frontend: {
      url: process.env.FRONTEND_URL || "https://travelguroo.com",
    },
    adminEmail: process.env.ADMIN_EMAIL || "not set (admin notifications disabled)",
  };

  log.info("Diagnostics result:", diagnostics);
  log.info("=".repeat(50));

  res.json(diagnostics);
});

// Test email endpoint (sends a test email to verify Resend works)
app.post("/api/test-email", async (req, res) => {
  log.email("=".repeat(50));
  log.email("Test email endpoint called");

  const { to } = req.body;

  if (!to) {
    log.error("No email address provided for test");
    return res.status(400).json({ error: "Please provide 'to' email address in request body." });
  }

  if (!resend) {
    log.error("Resend is not configured");
    return res.status(500).json({ error: "Email service not configured. Set RESEND_API_KEY." });
  }

  try {
    log.email(`Sending test email to ${to}...`);

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: to,
      subject: "TravelGuru Email Test - " + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #FF621F;">✅ TravelGuru Email Test Successful!</h2>
          <p>This is a test email sent at: <strong>${new Date().toLocaleString()}</strong></p>
          <p>If you received this email, your Resend configuration is working correctly.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Email Provider: Resend</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message || "Resend API error");
    }

    log.success(`Test email SENT to ${to}`, { emailId: data?.id });
    log.email("=".repeat(50));

    res.json({
      success: true,
      message: `Test email sent to ${to}`,
      emailId: data?.id,
    });
  } catch (error) {
    log.error(`Test email FAILED to ${to}`, error);
    log.email("=".repeat(50));

    res.status(500).json({
      success: false,
      error: error.message,
      hint: getResendErrorHint(error),
    });
  }
});

// Helper to provide user-friendly hints for common Resend errors
const getResendErrorHint = (error) => {
  const msg = error.message?.toLowerCase() || "";
  
  if (msg.includes("api key") || msg.includes("unauthorized") || msg.includes("401")) {
    return "Invalid API key. Check RESEND_API_KEY is correct.";
  }
  if (msg.includes("domain") || msg.includes("not verified")) {
    return "Email domain not verified. Use 'onboarding@resend.dev' for testing or verify your domain in Resend dashboard.";
  }
  if (msg.includes("rate") || msg.includes("limit")) {
    return "Rate limit reached. Wait before sending more emails.";
  }
  return "Check Resend dashboard for more details: https://resend.com/emails";
};

// Manual send booking confirmation (for testing or resending)
app.post("/api/send-booking-confirmation", async (req, res) => {
  log.email("=".repeat(50));
  log.email("Manual email request received");

  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      log.error("Missing booking_id in request body");
      return res.status(400).json({ error: "booking_id is required" });
    }

    log.email(`Processing request for booking #${booking_id}`);
    const result = await sendBookingConfirmationEmail(booking_id);

    if (result.success) {
      log.success(`Manual email request completed for booking #${booking_id}`);
      res.json({ success: true, messageId: result.messageId });
    } else {
      log.error(`Manual email request failed for booking #${booking_id}`, result.error);
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    log.error("Unexpected error in send-booking-confirmation", error);
    res.status(500).json({ error: error.message });
  }

  log.email("=".repeat(50));
});

// Stripe webhook - automatically sends email on payment success (only if Stripe is configured)
app.post("/api/stripe-webhook", async (req, res) => {
  log.payment("=".repeat(50));
  log.payment("Stripe Webhook received");

  if (!stripe) {
    log.error("Stripe is not configured - webhook cannot be processed");
    return res.status(501).send("Stripe is not configured");
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    log.error("Missing STRIPE_WEBHOOK_SECRET environment variable");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    log.payment(`Webhook verified - Event type: ${event.type}`);
  } catch (err) {
    log.error("Webhook signature verification FAILED", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      log.payment(`Payment SUCCEEDED`, {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        bookingIdFromMetadata: bookingId || "not provided",
        userId: paymentIntent.metadata?.user_id || "not provided",
      });

      if (bookingId) {
        // Update booking status in database
        log.payment(`Updating booking #${bookingId} status...`);
        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            payment_status: "succeeded",
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          })
          .eq("id", parseInt(bookingId));

        if (updateError) {
          log.error(`Failed to update booking #${bookingId}`, updateError);
        } else {
          log.success(`Booking #${bookingId} status updated to succeeded`);

          // Send confirmation email
          log.email(`Triggering confirmation email for booking #${bookingId}...`);
          const emailResult = await sendBookingConfirmationEmail(
            parseInt(bookingId),
          );

          if (emailResult.success) {
            log.success(`Confirmation email sent for booking #${bookingId}`);
          } else {
            log.error(`Failed to send email for booking #${bookingId}`, emailResult.error);
          }
        }
      } else {
        // Try to find booking by payment_intent_id
        log.payment(`No booking_id in metadata, searching by payment_intent_id: ${paymentIntent.id}`);
        const { data: booking, error: findError } = await supabase
          .from("bookings")
          .select("id")
          .eq("payment_intent_id", paymentIntent.id)
          .maybeSingle();

        if (findError) {
          log.error("Error finding booking by payment_intent_id", findError);
        } else if (booking) {
          log.payment(`Found booking #${booking.id} by payment_intent_id`);
          
          const { error: updateError } = await supabase
            .from("bookings")
            .update({
              payment_status: "succeeded",
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
            })
            .eq("id", booking.id);

          if (updateError) {
            log.error(`Failed to update booking #${booking.id}`, updateError);
          } else {
            log.success(`Booking #${booking.id} status updated to succeeded`);

            // Send confirmation email
            log.email(`Triggering confirmation email for booking #${booking.id}...`);
            const emailResult = await sendBookingConfirmationEmail(booking.id);
            
            if (emailResult.success) {
              log.success(`Confirmation email sent for booking #${booking.id}`);
            } else {
              log.error(`Failed to send email for booking #${booking.id}`, emailResult.error);
            }
          }
        } else {
          log.warn(`No booking found for payment_intent_id: ${paymentIntent.id}`);
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;
      const failureMessage = paymentIntent.last_payment_error?.message || "Unknown error";
      const failureCode = paymentIntent.last_payment_error?.code || "unknown";

      log.payment(`Payment FAILED`, {
        paymentIntentId: paymentIntent.id,
        bookingId: bookingId || "not provided",
        failureCode,
        failureMessage,
      });

      if (bookingId) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ payment_status: "failed" })
          .eq("id", parseInt(bookingId));
        
        if (updateError) {
          log.error(`Failed to update booking #${bookingId} status to failed`, updateError);
        } else {
          log.info(`Booking #${bookingId} status updated to failed`);
        }
      }
      break;
    }

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      log.payment(`Payment CANCELED`, {
        paymentIntentId: paymentIntent.id,
        bookingId: bookingId || "not provided",
        cancellationReason: paymentIntent.cancellation_reason || "not provided",
      });

      if (bookingId) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ payment_status: "canceled" })
          .eq("id", parseInt(bookingId));
        
        if (updateError) {
          log.error(`Failed to update booking #${bookingId} status to canceled`, updateError);
        } else {
          log.info(`Booking #${bookingId} status updated to canceled`);
        }
      }
      break;
    }

    default:
      log.info(`Unhandled webhook event type: ${event.type}`);
  }

  log.payment("Webhook processing complete");
  log.payment("=".repeat(50));
  res.json({ received: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TravelGuru API server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
});
