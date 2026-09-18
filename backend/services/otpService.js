const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Configure NodeMailer using environment variables
// Ensure these are set in .env (e.g. SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // e.g. your_email@gmail.com
    pass: process.env.SMTP_PASS, // e.g. app_password
  },
});

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send an OTP to the provided email address.
 * Stores the OTP in the database with a 5-minute expiration.
 */
async function sendOtp(email) {
  if (!email) throw new Error("Email address is required to send OTP.");

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

  // Upsert the OTP session for the email
  await prisma.otpSession.upsert({
    where: { email },
    update: { otp, expiresAt },
    create: { email, otp, expiresAt }
  });

  const mailOptions = {
    from: `"MediKiosk Auth" <${process.env.SMTP_USER || 'no-reply@medikiosk.local'}>`,
    to: email,
    subject: 'Your MediKiosk Verification Code',
    text: `Your OTP for MediKiosk login/registration is: ${otp}. It is valid for 1 minute. Do not share this code with anyone.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>MediKiosk Verification Code</h2>
        <p>Your one-time password (OTP) for login/registration is:</p>
        <h1 style="color: #047857; letter-spacing: 5px;">${otp}</h1>
        <p>This code is valid for 1 minute. Please do not share this code with anyone.</p>
      </div>
    `
  };

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️  [OTP Service] SMTP credentials not found in .env!');
      console.warn(`⚠️  [OTP Service] SIMULATED EMAIL TO: ${email}`);
      console.warn(`⚠️  [OTP Service] YOUR OTP IS: === ${otp} ===`);
      return { success: true, message: 'OTP sent successfully (Simulated).' };
    }

    await transporter.sendMail(mailOptions);
    console.log(`📧 [OTP Service] OTP sent to ${email}`);
    return { success: true, message: 'OTP sent successfully.' };
  } catch (error) {
    console.error("Failed to send OTP via NodeMailer:", error);
    throw new Error("Failed to send OTP email. Please check your SMTP configuration.");
  }
}

/**
 * Verify the provided OTP against the database for the given email.
 */
async function verifyOtp(email, otp) {
  if (!email || !otp) throw new Error("Email and OTP are required.");

  const session = await prisma.otpSession.findUnique({
    where: { email }
  });

  if (!session) {
    throw new Error("No active OTP session found for this email. Please request a new OTP.");
  }

  if (new Date() > session.expiresAt) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  if (session.otp !== otp.trim()) {
    throw new Error("Invalid OTP. Please try again.");
  }

  // Once verified successfully, delete the OTP session to prevent reuse
  await prisma.otpSession.delete({
    where: { email }
  });

  console.log(`✅ [OTP Service] OTP verified for ${email}`);
  return { success: true };
}

module.exports = {
  sendOtp,
  verifyOtp
};
