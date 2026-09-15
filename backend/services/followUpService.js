const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Transporter for NodeMailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send Email Helper
async function sendFollowUpEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`⚠️ [FollowUpService] SMTP not configured. Skipping email to ${to}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MediKiosk Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ [FollowUpService] Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ [FollowUpService] Failed to send email to ${to}:`, error.message);
  }
}

// Send SMS Helper (Twilio fallback to console)
async function sendFollowUpSMS(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn(`⚠️ [FollowUpService] Twilio not configured. Would have sent SMS to ${to}: "${body}"`);
    return;
  }
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // In trial mode, Twilio only sends to verified numbers.
    await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${to.replace('+91', '').trim()}`
    });
    console.log(`✅ [FollowUpService] SMS sent to ${to}`);
  } catch (error) {
    console.error(`❌ [FollowUpService] Failed to send SMS to ${to}:`, error.message);
  }
}

// Immediately notify upon scheduling
async function notifyScheduledFollowUp(patient, followUpDate, illnessSeverity) {
  if (!patient) return;
  const dateStr = new Date(followUpDate).toLocaleDateString();
  const severityStr = illnessSeverity ? `(Severity: ${illnessSeverity})` : '';
  
  const targetEmail = patient.email || process.env.SMTP_USER;
  if (targetEmail) {
    await sendFollowUpEmail(
      targetEmail, 
      "Your Follow-Up Appointment is Scheduled",
      `<h3>Hello ${patient.name},</h3>
       <p>Your doctor has scheduled a follow-up appointment for you on <b>${dateStr}</b> ${severityStr}.</p>
       <p>Please visit the clinic on this date.</p>
       <p><i>(Note: This was sent to the fallback email for demo purposes because the patient had no email registered)</i></p>
       <p>Regards,<br>MediKiosk Team</p>`
    );
  }
  if (patient.mobile) {
    await sendFollowUpSMS(
      patient.mobile,
      `Hello ${patient.name}, your follow-up appointment is scheduled for ${dateStr}. Please visit the clinic on this date. - MediKiosk`
    );
  }
}

async function runFollowUpChecksNow() {
  console.log('⏰ [Cron/Manual] Running Follow-Up Appointment Checks...');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfNextDay = new Date(startOfTomorrow);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  try {
    // 1. Upcoming Appointments (Tomorrow)
    const upcomingSessions = await prisma.session.findMany({
      where: {
        followUpDate: {
          gte: startOfTomorrow,
          lt: startOfNextDay
        },
        followUpNotified: false
      },
      include: { patient: true }
    });

    for (const session of upcomingSessions) {
      if (!session.patient) continue;
      console.log(`🔔 [Cron] Sending Reminder to ${session.patient.name}`);
      const dateStr = new Date(session.followUpDate).toLocaleDateString();
      
      const targetEmail = session.patient.email || process.env.SMTP_USER;
      if (targetEmail) {
        await sendFollowUpEmail(
          targetEmail, 
          "Reminder: Upcoming Follow-Up Appointment",
          `<h3>Hello ${session.patient.name},</h3>
           <p>This is a reminder that you have a follow-up appointment scheduled for tomorrow, <b>${dateStr}</b>.</p>
           <p>Regards,<br>MediKiosk Team</p>`
        );
      }
      if (session.patient.mobile) {
        await sendFollowUpSMS(
          session.patient.mobile,
          `Reminder: ${session.patient.name}, you have a follow-up appointment scheduled for tomorrow, ${dateStr}. - MediKiosk`
        );
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { followUpNotified: true }
      });
    }

    // 2. Missed Appointments (Yesterday or earlier, not completed)
    const missedSessions = await prisma.session.findMany({
      where: {
        followUpDate: {
          lt: startOfToday
        },
        followUpMissedNotified: false
      },
      include: { patient: true }
    });

    for (const session of missedSessions) {
      if (!session.patient) continue;
      
      const recentSession = await prisma.session.findFirst({
        where: {
          patientId: session.patientId,
          submittedAt: {
            gte: new Date(new Date(session.followUpDate).setHours(0,0,0,0))
          }
        }
      });

      if (!recentSession) {
        console.log(`🚨 [Cron] Sending Missed Appointment Alert to ${session.patient.name}`);
        const dateStr = new Date(session.followUpDate).toLocaleDateString();
        
        const targetEmail = session.patient.email || process.env.SMTP_USER;
        if (targetEmail) {
          await sendFollowUpEmail(
            targetEmail, 
            "Missed Follow-Up Appointment",
            `<h3>Hello ${session.patient.name},</h3>
             <p>Our records indicate that you missed your follow-up appointment scheduled for <b>${dateStr}</b>.</p>
             <p>Please contact the clinic to reschedule as soon as possible, as your health is important to us.</p>
             <p>Regards,<br>MediKiosk Team</p>`
          );
        }
        if (session.patient.mobile) {
          await sendFollowUpSMS(
            session.patient.mobile,
            `Alert: ${session.patient.name}, you missed your follow-up on ${dateStr}. Please visit the clinic ASAP to reschedule. - MediKiosk`
          );
        }
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { followUpMissedNotified: true }
      });
    }
  } catch (err) {
    console.error('❌ [Cron] Error running follow-up checks:', err);
  }
}

// Cron Job to check daily
function startFollowUpCronJob() {
  // Run at 09:00 AM every day.
  cron.schedule('0 9 * * *', runFollowUpChecksNow);
  console.log('✅ [FollowUpService] Cron job scheduled (Daily at 09:00 AM).');
}

module.exports = {
  notifyScheduledFollowUp,
  startFollowUpCronJob,
  runFollowUpChecksNow
};
