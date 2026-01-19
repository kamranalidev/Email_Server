import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP connection error:", error.message);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

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
  try {
    // Fetch booking with related data
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

    if (bookingError) throw bookingError;
    if (!booking) throw new Error("Booking not found");

    // Get user email
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(booking.user_id);

    if (userError) throw userError;
    if (!userData?.user?.email) throw new Error("User email not found");

    const userEmail = userData.user.email;
    const userName =
      userData.user.user_metadata?.full_name ||
      userData.user.email.split("@")[0];

    // Normalize service and package data
    const service = Array.isArray(booking.services)
      ? booking.services[0]
      : booking.services;

    const packageInfo = Array.isArray(booking.packages)
      ? booking.packages[0]
      : booking.packages;

    const serviceName = service?.service_name || "Your Booking";

    // Generate email HTML with user name
    const html = generateBookingEmailHTML(
      booking,
      service,
      packageInfo,
      userName,
    );

    const adminEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

    // Send email to customer
    const mailOptions = {
      from: `"TravelGuru" <${adminEmail}>`,
      to: userEmail,
      subject: `✅ Booking Confirmed: ${serviceName} - #${booking.id}`,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(
      `✅ Confirmation email sent to ${userEmail} for booking #${bookingId}`,
    );
    console.log(`   Message ID: ${info.messageId}`);

    // Notify admin using the same sender email
    if (adminEmail) {
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

      await transporter.sendMail({
        from: `"TravelGuru" <${adminEmail}>`,
        to: adminEmail,
        subject: `🧾 New Booking Notification - #${booking.id}`,
        html: adminHtml,
      });
      console.log(`🔔 Admin notification sent for booking #${bookingId}`);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `❌ Failed to send email for booking #${bookingId}:`,
      error.message,
    );
    return { success: false, error: error.message };
  }
};

// API Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Manual send booking confirmation (for testing or resending)
app.post("/api/send-booking-confirmation", async (req, res) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: "booking_id is required" });
    }

    const result = await sendBookingConfirmationEmail(booking_id);

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Send confirmation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook - automatically sends email on payment success (only if Stripe is configured)
app.post("/api/stripe-webhook", async (req, res) => {
  if (!stripe) {
    return res.status(501).send("Stripe is not configured");
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log(
        `💳 Payment succeeded for PaymentIntent: ${paymentIntent.id}`,
      );

      if (bookingId) {
        // Update booking status in database
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
          console.error("Failed to update booking:", updateError);
        } else {
          console.log(`📝 Updated booking #${bookingId} status to succeeded`);

          // Send confirmation email
          const emailResult = await sendBookingConfirmationEmail(
            parseInt(bookingId),
          );

          if (emailResult.success) {
            console.log(`📧 Confirmation email sent for booking #${bookingId}`);
          }
        }
      } else {
        // Try to find booking by payment_intent_id
        const { data: booking } = await supabase
          .from("bookings")
          .select("id")
          .eq("payment_intent_id", paymentIntent.id)
          .maybeSingle();

        if (booking) {
          await supabase
            .from("bookings")
            .update({
              payment_status: "succeeded",
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
            })
            .eq("id", booking.id);

          // Send confirmation email
          await sendBookingConfirmationEmail(booking.id);
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log(`❌ Payment failed for PaymentIntent: ${paymentIntent.id}`);

      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ payment_status: "failed" })
          .eq("id", parseInt(bookingId));
      }
      break;
    }

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.booking_id;

      console.log(`🚫 Payment canceled for PaymentIntent: ${paymentIntent.id}`);

      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ payment_status: "canceled" })
          .eq("id", parseInt(bookingId));
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TravelGuru API server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
});
