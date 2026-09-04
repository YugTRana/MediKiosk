// ============================================================================
// MediKiosk Intelligent Document AI Service
// Real OCR Engine Interface - Zero Simulated Numbers
// ============================================================================

// ============================================================================
// MediKiosk Intelligent Document AI Service
// Real OCR Engine Interface - Zero Simulated Numbers
// ============================================================================

export async function extractDocumentWithDocAI({ fileName, documentType = 'auto', complaintId = 'auto', file = null }) {
  try {
    let bodyData;
    let headers = {};

    if (file) {
      const formData = new FormData();
      formData.append('documentFile', file);
      formData.append('fileName', fileName || file.name || 'scanned_document.jpg');
      formData.append('documentType', documentType);
      formData.append('complaintId', complaintId);
      bodyData = formData;
    } else {
      headers = { 'Content-Type': 'application/json' };
      bodyData = JSON.stringify({
        fileName: fileName || 'scanned_document.jpg',
        documentType,
        complaintId
      });
    }

    const res = await fetch('http://localhost:3000/api/docai/extract', {
      method: 'POST',
      headers,
      body: bodyData
    });

    if (res.ok) {
      const data = await res.json();
      return data.extractedData;
    }
    throw new Error(`Server responded with ${res.status}`);
  } catch (err) {
    console.error('[DocAIService] OCR extraction error:', err);
    throw err;
  }
}

export function getLabFlagBadgeClass(flag) {
  switch (flag) {
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-300 font-extrabold px-2 py-0.5 rounded text-xs border';
    case 'LOW':
      return 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold px-2 py-0.5 rounded text-xs border';
    case 'NORMAL':
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold px-2 py-0.5 rounded text-xs border';
  }
}
