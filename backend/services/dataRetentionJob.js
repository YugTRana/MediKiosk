// Data Retention & Automated Purge Service (Module D - DPDP Act 2023 Compliance)
// Permanently purges raw session data (voice transcripts, raw document texts, unredacted fields)
// after a configurable retention window post-HIS push, retaining strictly the finalized FHIR summary.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS_POST_PUSH || '24', 10);

/**
 * Permanently purge sensitive raw intake data for sessions that have been pushed to EMR
 * and have passed their retention window.
 * 
 * @param {number} retentionHours - Hours after HIS push before raw data is purged
 * @returns {Object} Purge summary report
 */
async function purgeExpiredSessionData(retentionHours = DEFAULT_RETENTION_HOURS) {
  const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
  console.log(`\n🧹 [DATA RETENTION] Checking sessions completed & pushed before ${cutoffDate.toISOString()} (${retentionHours}h retention window)...`);

  try {
    // Find all sessions pushed to HIS prior to the cutoff date
    const expiredSessions = await prisma.session.findMany({
      where: {
        OR: [
          { status: 'COMPLETED', hisPush: { pushedAt: { lt: cutoffDate } } },
          { status: 'CONSENT_REVOKED' }
        ]
      },
      include: {
        hisPush: true,
        digitizedDocument: true
      }
    });

    let purgedCount = 0;

    for (const session of expiredSessions) {
      // 1. Purge raw text and sensitive fields from DigitizedDocument
      if (session.digitizedDocument) {
        await prisma.digitizedDocument.update({
          where: { id: session.digitizedDocument.id },
          data: {
            rawText: '[PURGED_PER_DPDP_RETENTION_POLICY]',
            imagingFindings: session.digitizedDocument.imagingFindings ? '[REDACTED_POST_RETENTION]' : null
          }
        });
      }

      // 2. Redact raw conversational answers, retaining structured findings
      let parsedAnswers = [];
      try {
        parsedAnswers = JSON.parse(session.answers || '[]');
      } catch (e) {}

      // Strip freeform voice transcripts, keeping only normalized category labels
      const redactedAnswers = parsedAnswers.map(ans => ({
        questionId: ans.questionId,
        dimension: ans.dimension,
        selectedOption: ans.selectedOption ? {
          value: ans.selectedOption.value,
          labelEn: ans.selectedOption.labelEn,
          labelHi: ans.selectedOption.labelHi
        } : undefined,
        customVoiceText: ans.customVoiceText ? '[VOICE_TRANSCRIPT_PURGED]' : undefined
      }));

      await prisma.session.update({
        where: { id: session.id },
        data: {
          answers: JSON.stringify(redactedAnswers)
        }
      });

      purgedCount++;
    }

    console.log(`✅ [DATA RETENTION] Purged sensitive raw data for ${purgedCount} expired/revoked sessions.`);
    return {
      success: true,
      purgedCount,
      cutoffDate,
      retentionHours
    };
  } catch (err) {
    console.error('❌ [DATA RETENTION ERROR]:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Start periodic background retention job (runs every 6 hours)
 */
function startScheduledRetentionJob() {
  console.log(`⏱️ [DATA RETENTION] Scheduled periodic purge job initialized (Retention window: ${DEFAULT_RETENTION_HOURS}h).`);
  
  // Run on startup
  purgeExpiredSessionData().catch(() => {});

  // Run every 6 hours
  setInterval(() => {
    purgeExpiredSessionData().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

module.exports = {
  purgeExpiredSessionData,
  startScheduledRetentionJob
};
