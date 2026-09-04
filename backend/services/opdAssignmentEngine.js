/**
 * OPD Assignment Engine for MediKiosk
 * 
 * Rules:
 * 1. Determine department from chief complaint (deterministic mapping).
 * 2. Find AVAILABLE doctors in that specialization.
 * 3. Pick doctor with smallest number of active patients (WAITING, CALLED, IN_CONSULTATION).
 * 4. If tied, pick doctor assigned least recently (round-robin via lastAssignedAt).
 * 5. Fallback to AVAILABLE General Medicine doctor if no specialist is available.
 */

// Mapping of complaint IDs / titles to medical specializations
const COMPLAINT_SPECIALIZATION_MAP = {
  chest_pain: 'Cardiology',
  cardiac: 'Cardiology',
  heart: 'Cardiology',
  palpitations: 'Cardiology',

  joint_pain: 'Orthopedics',
  fracture: 'Orthopedics',
  ortho: 'Orthopedics',
  bone_pain: 'Orthopedics',
  arthritis: 'Orthopedics',

  ayush_consultation: 'AYUSH & Integrated Medicine',
  ayush: 'AYUSH & Integrated Medicine',

  pediatric: 'Pediatrics',
  child_fever: 'Pediatrics',

  fever: 'General Medicine',
  cough: 'General Medicine',
  cold: 'General Medicine',
  headache: 'General Medicine',
  stomach_ache: 'General Medicine',
  general: 'General Medicine'
};

/**
 * Determine target department from complaint ID or Title
 */
function mapComplaintToDepartment(complaintId, complaintTitle = '') {
  if (!complaintId && !complaintTitle) return 'General Medicine';

  const normalizedId = String(complaintId || '').toLowerCase().trim();
  const normalizedTitle = String(complaintTitle || '').toLowerCase().trim();

  if (COMPLAINT_SPECIALIZATION_MAP[normalizedId]) {
    return COMPLAINT_SPECIALIZATION_MAP[normalizedId];
  }

  if (normalizedTitle.includes('chest') || normalizedTitle.includes('heart') || normalizedTitle.includes('cardiac')) {
    return 'Cardiology';
  }
  if (normalizedTitle.includes('joint') || normalizedTitle.includes('bone') || normalizedTitle.includes('arthritis') || normalizedTitle.includes('ortho')) {
    return 'Orthopedics';
  }
  if (normalizedTitle.includes('ayush') || normalizedTitle.includes('ayurveda') || normalizedTitle.includes('dosha')) {
    return 'AYUSH & Integrated Medicine';
  }
  if (normalizedTitle.includes('child') || normalizedTitle.includes('pediatric')) {
    return 'Pediatrics';
  }

  return 'General Medicine';
}

/**
 * Normalizes specialization strings for comparison
 * e.g., "General Medicine" vs "General & Integrated Medicine"
 */
function isSpecializationMatch(doctorSpec, targetSpec) {
  if (!doctorSpec || !targetSpec) return false;
  const d = doctorSpec.toLowerCase().trim();
  const t = targetSpec.toLowerCase().trim();

  if (d === t) return true;
  if (d.includes('general') && t.includes('general')) return true;
  if (d.includes('cardio') && t.includes('cardio')) return true;
  if (d.includes('ortho') && t.includes('ortho')) return true;
  if (d.includes('ayush') && t.includes('ayush')) return true;

  return false;
}

/**
 * Active session statuses for queue load calculation
 */
const ACTIVE_STATUSES = ['WAITING', 'WAITING_OPD', 'TRIAGE_URGENT', 'CALLED', 'IN_CONSULTATION'];

/**
 * Find optimal available doctor and assign to OPD session
 * Considers ONLY Dr. Rajesh Gupta (dr.rajesh) and Dr. Asha Sharma (doctor1)
 * 
 * @param {Object} params
 * @param {string} params.complaintId
 * @param {string} params.complaintTitle
 * @param {Object} prismaClient - Prisma client or active transaction
 */
async function findAndAssignOptimalDoctor({ complaintId, complaintTitle, prismaClient }) {
  const prisma = prismaClient;
  const targetDepartment = mapComplaintToDepartment(complaintId, complaintTitle);

  // 1. Fetch all doctors in the database
  const allDoctors = await prisma.staffUser.findMany({
    where: { role: 'DOCTOR' },
    include: {
      assignedSessions: {
        where: {
          status: { in: ACTIVE_STATUSES }
        },
        select: { id: true, status: true }
      }
    }
  });

  // Filter candidates exclusively to Dr. Rajesh Gupta and Dr. Asha Sharma
  const validUsernames = ['dr.rajesh', 'doctor1'];
  const validNames = ['dr. rajesh gupta', 'dr. asha sharma'];
  const candidateDoctors = (allDoctors || []).filter(doc => 
    doc.role === 'DOCTOR' && (
      validUsernames.includes(String(doc.username || '').toLowerCase().trim()) ||
      validNames.some(n => String(doc.name || '').toLowerCase().includes(n))
    )
  );

  if (candidateDoctors.length === 0) {
    return {
      assignedDoctorId: null,
      department: targetDepartment,
      doctorName: 'Unassigned',
      specialization: targetDepartment,
      roomNumber: '104'
    };
  }

  // Helper to score and select optimal doctor from candidate list
  function pickBestDoctor(candidates) {
    if (!candidates || candidates.length === 0) return null;

    // Map candidate with active queue count
    const scored = candidates.map(doc => ({
      doctor: doc,
      activeCount: doc.assignedSessions ? doc.assignedSessions.length : 0,
      lastAssignedAt: doc.lastAssignedAt ? new Date(doc.lastAssignedAt).getTime() : 0
    }));

    // Sort: 1st by activeCount (ascending), 2nd by lastAssignedAt (ascending - least recently assigned)
    scored.sort((a, b) => {
      if (a.activeCount !== b.activeCount) {
        return a.activeCount - b.activeCount;
      }
      return a.lastAssignedAt - b.lastAssignedAt;
    });

    return scored[0].doctor;
  }

  // 2. Prefer AVAILABLE candidate matching required specialization
  const availableSpecialists = candidateDoctors.filter(
    doc => doc.availabilityStatus === 'AVAILABLE' && isSpecializationMatch(doc.specialization, targetDepartment)
  );

  let selectedDoctor = pickBestDoctor(availableSpecialists);

  // 3. If no specialist available, prefer AVAILABLE candidate regardless of specialization
  if (!selectedDoctor) {
    const availableAny = candidateDoctors.filter(doc => doc.availabilityStatus === 'AVAILABLE');
    selectedDoctor = pickBestDoctor(availableAny);
  }

  // 4. Fallback: If ALL doctors are BUSY/OFFLINE, pick candidate doctor with lightest load
  if (!selectedDoctor) {
    selectedDoctor = pickBestDoctor(candidateDoctors);
  }

  // 5. Update doctor's lastAssignedAt
  if (selectedDoctor) {
    await prisma.staffUser.update({
      where: { id: selectedDoctor.id },
      data: { lastAssignedAt: new Date() }
    }).catch(err => console.warn('[OPD Assignment] Failed to update doctor lastAssignedAt:', err.message));
  }

  return {
    assignedDoctorId: selectedDoctor ? selectedDoctor.id : null,
    department: targetDepartment,
    doctorName: selectedDoctor ? selectedDoctor.name : 'Duty Physician',
    specialization: selectedDoctor ? selectedDoctor.specialization : targetDepartment,
    roomNumber: selectedDoctor ? selectedDoctor.roomNumber : '104'
  };
}

/**
 * Backfill existing unassigned active OPD sessions to either Dr. Rajesh Gupta or Dr. Asha Sharma
 */
async function backfillUnassignedSessions(prisma) {
  try {
    const validDoctors = await prisma.staffUser.findMany({
      where: {
        role: 'DOCTOR',
        OR: [
          { username: 'dr.rajesh' },
          { username: 'doctor1' }
        ]
      }
    });
    const validIds = validDoctors.map(d => d.id);
    if (validIds.length === 0) return;

    const orphanSessions = await prisma.session.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          { assignedDoctorId: null },
          { assignedDoctorId: { notIn: validIds } }
        ]
      }
    });

    for (const session of orphanSessions) {
      const assignment = await findAndAssignOptimalDoctor({
        complaintId: session.complaintId,
        complaintTitle: session.complaintTitle,
        prismaClient: prisma
      });
      if (assignment.assignedDoctorId) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            assignedDoctorId: assignment.assignedDoctorId,
            department: assignment.department || session.department
          }
        });
      }
    }
  } catch (err) {
    console.warn('[OPD Backfill] Warning backfilling sessions:', err.message);
  }
}

module.exports = {
  mapComplaintToDepartment,
  isSpecializationMatch,
  findAndAssignOptimalDoctor,
  backfillUnassignedSessions,
  ACTIVE_STATUSES
};
