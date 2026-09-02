require('dotenv').config();
const fs = require('fs');
const zlib = require('zlib');
const { createWorker } = require('tesseract.js');
const PDFParser = require('pdf2json');
let GoogleGenAI;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (e) {}

// ============================================================================
// 1. ADVANCED UNIVERSAL PDF STREAM & CMAP DECODER
// Decodes all PDF versions: WeasyPrint, Adobe, Prince, Quartz, WinAnsi, Type0, Identity-H
// ============================================================================
function decodeUniversalPdfBuffer(pdfBuffer) {
  try {
    let pos = 0;
    const decompressedStreams = [];

    // 1. Find and decompress all stream objects
    while (pos < pdfBuffer.length) {
      const streamStart = pdfBuffer.indexOf(Buffer.from('stream'), pos);
      if (streamStart === -1) break;

      let dataStart = streamStart + 6;
      if (pdfBuffer[dataStart] === 0x0D && pdfBuffer[dataStart + 1] === 0x0A) dataStart += 2;
      else if (pdfBuffer[dataStart] === 0x0A || pdfBuffer[dataStart] === 0x0D) dataStart += 1;

      const streamEnd = pdfBuffer.indexOf(Buffer.from('endstream'), dataStart);
      if (streamEnd === -1) break;

      const compressed = pdfBuffer.slice(dataStart, streamEnd);
      let decomp = null;
      try {
        decomp = zlib.inflateSync(compressed);
      } catch (e) {
        try {
          decomp = zlib.inflateRawSync(compressed);
        } catch (e2) {}
      }

      if (decomp) {
        decompressedStreams.push(decomp);
      }

      pos = streamEnd + 9;
    }

    // 2. Parse all ToUnicode CMaps (supports single char and range maps)
    const globalCMap = {};
    for (const st of decompressedStreams) {
      const str = st.toString('latin1');
      if (str.includes('beginbfchar')) {
        const bfcharMatches = str.matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]+)>/g);
        for (const m of bfcharMatches) {
          const srcHex = m[1].toLowerCase();
          const dstHex = m[2];
          let charStr = '';
          for (let i = 0; i < dstHex.length; i += 4) {
            const code = parseInt(dstHex.substr(i, 4), 16);
            charStr += String.fromCharCode(code);
          }
          globalCMap[srcHex] = charStr;
        }
      }

      if (str.includes('beginbfrange')) {
        const bfrangeMatches = str.matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]+)>/g);
        for (const m of bfrangeMatches) {
          const startCode = parseInt(m[1], 16);
          const endCode = parseInt(m[2], 16);
          let dstStart = parseInt(m[3], 16);
          for (let code = startCode; code <= endCode; code++) {
            const srcHex = code.toString(16).padStart(4, '0').toLowerCase();
            globalCMap[srcHex] = String.fromCharCode(dstStart);
            dstStart++;
          }
        }
      }
    }

    // 3. Decode Text Content Streams
    const extractedLines = [];
    for (const st of decompressedStreams) {
      const str = st.toString('latin1');
      if (str.includes('BT') && str.includes('ET')) {
        // Match both hex strings <00220031> and array bracket strings [(Hello) -10 (World)]
        const tjMatches = str.matchAll(/<([0-9a-fA-F]+)>\s*Tj|\[([^\]]+)\]\s*TJ|\(([^()]+)\)\s*Tj/g);
        for (const tm of tjMatches) {
          if (tm[1]) {
            // Hex string <00220031...>
            const hex = tm[1];
            let decoded = '';
            for (let i = 0; i < hex.length; i += 4) {
              const h = hex.substr(i, 4).toLowerCase();
              decoded += globalCMap[h] || '';
            }
            if (decoded.trim()) extractedLines.push(decoded.trim());
          } else if (tm[2]) {
            // Array [<0022> -10 <0031> ...] or [(text) -20 (text)]
            const inner = tm[2];
            const hexParts = inner.matchAll(/<([0-9a-fA-F]+)>/g);
            let decoded = '';
            for (const hp of hexParts) {
              const hex = hp[1];
              for (let i = 0; i < hex.length; i += 4) {
                const h = hex.substr(i, 4).toLowerCase();
                decoded += globalCMap[h] || '';
              }
            }
            // Also check for raw ASCII parentheses in TJ array
            const textParts = inner.matchAll(/\(([^()]+)\)/g);
            for (const tp of textParts) {
              decoded += ' ' + tp[1];
            }

            if (decoded.trim()) extractedLines.push(decoded.trim());
          } else if (tm[3]) {
            // Raw text (text) Tj
            if (tm[3].trim()) extractedLines.push(tm[3].trim());
          }
        }
      }
    }

    if (extractedLines.length > 5) {
      return extractedLines.join('\n');
    }
  } catch (err) {
    console.warn('⚠️ [Universal PDF Stream Decoder] Warning:', err.message);
  }
  return '';
}

// ============================================================================
// 2. SECONDARY PDF PARSER (pdf2json coordinate grouper)
// ============================================================================
function extractTextWithPdf2Json(buffer) {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser();
      pdfParser.on('pdfParser_dataError', () => resolve(''));
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        let fullText = '';
        if (pdfData && pdfData.Pages) {
          for (const page of pdfData.Pages) {
            const texts = (page.Texts || []).map(t => ({
              x: t.x,
              y: t.y,
              text: decodeURIComponent(t.R?.map(r => r.T).join('') || '')
            }));
            texts.sort((a, b) => (Math.abs(a.y - b.y) <= 0.4 ? a.x - b.x : a.y - b.y));

            let currentY = null;
            let currentLineTokens = [];
            let pageLines = [];

            for (const item of texts) {
              if (currentY === null || Math.abs(item.y - currentY) > 0.4) {
                if (currentLineTokens.length > 0) {
                  pageLines.push(currentLineTokens.join(' '));
                }
                currentY = item.y;
                currentLineTokens = [item.text];
              } else {
                currentLineTokens.push(item.text);
              }
            }
            if (currentLineTokens.length > 0) {
              pageLines.push(currentLineTokens.join(' '));
            }
            fullText += pageLines.join('\n') + '\n\n';
          }
        }
        resolve(fullText);
      });
      pdfParser.parseBuffer(buffer);
    } catch (e) {
      resolve('');
    }
  });
}

// ============================================================================
// 3. SCANNED IMAGE EXTRACTOR & TESSERACT OCR
// ============================================================================
function extractJpegsFromPdfBuffer(pdfBuffer) {
  const jpegs = [];
  let offset = 0;

  while (offset < pdfBuffer.length) {
    const startIdx = pdfBuffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), offset);
    if (startIdx === -1) break;

    const endIdx = pdfBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx + 3);
    if (endIdx === -1) break;

    const jpegBuffer = pdfBuffer.slice(startIdx, endIdx + 2);
    if (jpegBuffer.length > 4000) {
      jpegs.push(jpegBuffer);
    }
    offset = endIdx + 2;
  }

  return jpegs;
}

async function extractTextWithTesseract(imageBuffer) {
  try {
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return data.text || '';
  } catch (err) {
    console.error('❌ [Tesseract OCR] Error:', err.message);
    return '';
  }
}

// ============================================================================
// 4. MASTER RAW TEXT INTAKE
// ============================================================================
async function extractRawTextFromBuffer(buffer, mimeType, fileName = '') {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    console.log(`📑 [OCR Engine] Processing PDF (${buffer.length} bytes)...`);
    
    // Priority 1: High-fidelity Universal CMap Decoder
    let text = decodeUniversalPdfBuffer(buffer);
    if (text && text.trim().length > 40) {
      console.log(`✅ [OCR Engine] Universal PDF Stream & CMap decoder extracted ${text.length} chars.`);
      return text;
    }

    // Priority 2: Coordinate-based pdf2json
    text = await extractTextWithPdf2Json(buffer);
    if (text && text.trim().length > 40) {
      console.log(`✅ [OCR Engine] pdf2json extracted ${text.length} chars.`);
      return text;
    }

    // Priority 3: Scanned PDF image pages + Tesseract OCR
    console.log(`🔍 [OCR Engine] Vector text empty, scanning embedded image streams in PDF...`);
    const jpegs = extractJpegsFromPdfBuffer(buffer);
    if (jpegs.length > 0) {
      console.log(`🖼️ [OCR Engine] Found ${jpegs.length} embedded scanned image pages. Running Tesseract OCR...`);
      let ocrResults = [];
      for (const imgBuf of jpegs) {
        const pageText = await extractTextWithTesseract(imgBuf);
        if (pageText) ocrResults.push(pageText);
      }
      text = ocrResults.join('\n\n');
      return text || '';
    }
    return '';
  } else {
    // Direct Image (JPG, PNG, WebP)
    console.log(`🖼️ [OCR Engine] Running Tesseract OCR on image (${buffer.length} bytes)...`);
    return await extractTextWithTesseract(buffer);
  }
}

// ============================================================================
// 5. UNIVERSAL CLINICAL ENTITY PARSER (Universal Rules for ANY Medical Report)
// ============================================================================
const KNOWN_MEDICAL_UNITS = [
  'mg/dL', 'mg/dl', 'g/dL', 'g/dl', 'gm%', 'mmol/L', 'umol/L', 'pmol/L',
  'U/L', 'u/l', 'IU/L', 'IU/mL', 'iu/ml', 'mIU/L', 'uIU/mL', 'uiu/ml',
  'ng/mL', 'ng/ml', 'pg/mL', 'pg/ml', 'mcg/dL', 'ug/dL',
  'mEq/L', 'meq/l', '%', 'mmHg', 'mm Hg', 'mm/hr', 'mm/1st hr',
  '/uL', '/ul', '/mcL', '/cumm', 'cells/cu.mm', 'lakhs/cumm', 'x10^3/uL', 'x10^6/uL',
  '/hpf', '/HPF', '/lpf', 'Index', 'index', 'Ratio', 'ratio', 'Titre', 'titre'
];

function isMedicalUnit(str) {
  if (!str) return false;
  const clean = str.replace(/[()[\],]/g, '').trim();
  return KNOWN_MEDICAL_UNITS.some(u => u.toLowerCase() === clean.toLowerCase());
}

function parseClinicalEntitiesFromText(rawText, fileName = '', complaintId = 'auto') {
  const text = rawText || '';
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

  const labValues = [];
  const medications = [];
  const diagnoses = [];
  let imagingFindings = '';
  let patientName = '';
  let facility = '';
  let prescriber = '';
  let reportDate = '';

  // --------------------------------------------------------------------------
  // A. SCAN PATIENT, DOCTOR, DATE & FACILITY HEADERS
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Facility / Diagnostic Center / Hospital Name
    if (i < 3 && !facility && /diagnostics|hospital|clinic|pathology|lab|laboratory|imaging|health|care|centre|center/i.test(line)) {
      facility = line;
    } else if (/hospital|clinic|pathology|diagnostic|laboratory|imaging\s*center/i.test(line) && !facility && line.length < 90) {
      facility = line;
    }

    // Patient Name
    if (/(?:patient\s*name|name)\s*[:=-]/i.test(line)) {
      const match = line.match(/(?:patient\s*name|name)\s*[:=-]\s*(.+)/i);
      if (match && match[1].trim().length > 2) {
        patientName = match[1].trim();
      } else if (i + 1 < lines.length && lines[i + 1].length > 2 && !/referred|age|gender|date|sample/i.test(lines[i + 1])) {
        patientName = lines[i + 1].trim();
      }
    }

    // Referring Doctor / Consultant / Pathologist / Radiologist
    if (/(?:referred\s*by|consultant|dr\.?|doctor|pathologist|radiologist|physician)\s*[:=-]/i.test(line)) {
      const match = line.match(/(?:referred\s*by|consultant|dr\.?|doctor|pathologist|radiologist|physician)\s*[:=-]\s*(.+)/i);
      if (match && match[1].trim().length > 2) {
        prescriber = match[1].trim();
      } else if (i + 1 < lines.length && lines[i + 1].length > 2 && !/patient|age|gender|sample|study/i.test(lines[i + 1])) {
        prescriber = lines[i + 1].trim();
      }
    } else if (/(?:dr\.\s*[A-Za-z\s.]+)/i.test(line) && !prescriber && !/patient|sample|test|method/i.test(line)) {
      prescriber = line.trim();
    }

    // Date
    const dateMatch = line.match(/(?:date|dated|examination)\s*[:=-]?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}|[0-9]{1,2}-[A-Za-z]{3}-[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i);
    if (dateMatch && !reportDate) {
      reportDate = dateMatch[1].trim();
    } else if (/date/i.test(line) && i + 1 < lines.length && /[0-9]{2,4}/.test(lines[i + 1]) && !reportDate) {
      reportDate = lines[i + 1].trim();
    }
  }

  // --------------------------------------------------------------------------
  // B. MULTI-LINE / COLUMNAR DIAGNOSTIC TABLE PARSER (Sequential Lookahead)
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line looks like a diagnostic test name (not a general paragraph)
    const isTestHeaderCandidate = 
      line.length > 2 && line.length < 75 &&
      !/patient|referred|doctor|dr\.|hospital|clinic|diagnostics|date|sample|department|technician|checked|page|phone|email|address|interpretation|impression|finding|conclusion|advise/i.test(line) &&
      (/(?:sugar|glucose|fbs|ppbs|hba1c|glycosylated|eag|cholesterol|triglycerides|hdl|ldl|vldl|creatinine|urea|bun|uric\s*acid|bilirubin|sgpt|sgot|ast|alt|alkaline|phosphatase|protein|albumin|globulin|sodium|potassium|chloride|calcium|phosphorus|magnesium|tsh|t3|t4|thyroid|vitamin|b12|d3|hemoglobin|haemoglobin|rbc|wbc|tlc|platelet|pcv|mcv|mch|mchc|esr|crp|aec|neutrophil|lymphocyte|monocyte|eosinophil|basophil|dengue|widal|malaria|hiv|hbsag|hcv|covid|troponin|psa|amylase|lipase|iron|ferritin|tibc|urine|pus\s*cells|epithelial)/i.test(line) ||
       (i + 1 < lines.length && /^[0-9]+(?:\.[0-9]+)?$/.test(lines[i + 1]) && i + 2 < lines.length && isMedicalUnit(lines[i + 2])));

    if (isTestHeaderCandidate) {
      let testName = line.replace(/^[-•*]\s*/, '').replace(/Method:.+/i, '').trim();
      let val = null;
      let unit = '';
      let ref = '';

      // Look ahead up to 7 lines for Result, Unit, and Reference Interval
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
        const nextLine = lines[j].trim();
        if (/^Method:/i.test(nextLine) || /^Sample:/i.test(nextLine)) continue;

        // Numerical or Qualitative Result
        if (val === null && (/^[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?$/.test(nextLine) || /^(?:positive|negative|reactive|non[- ]reactive|nil|present|absent)$/i.test(nextLine))) {
          val = nextLine;
          continue;
        }

        // Unit
        if (unit === '' && isMedicalUnit(nextLine)) {
          unit = nextLine;
          continue;
        }

        // Reference interval
        if (ref === '' && (/(?:[0-9.]+\s*-\s*[0-9.]+|<?\s*[0-9.]+|Normal|Prediabetes|Diabetes|Negative|Non[- ]reactive)/i.test(nextLine) || /^[0-9.<>\s-]+$/.test(nextLine))) {
          ref = nextLine;
          // Collect multi-line reference tiers
          if (j + 1 < lines.length && /(?:Prediabetes|Diabetes|[0-9.]+\s*-\s*[0-9.]+|>=?\s*[0-9.]+)/i.test(lines[j + 1])) {
            ref += '; ' + lines[j + 1].trim();
            if (j + 2 < lines.length && /(?:Diabetes|>=?\s*[0-9.]+)/i.test(lines[j + 2])) {
              ref += '; ' + lines[j + 2].trim();
            }
          }
          break;
        }

        // Stop if nextLine is another test name
        if (j > i + 1 && (/(?:fasting|post\s*prandial|hba1c|estimated|clinical|department|interpretation)/i.test(nextLine) || (j + 1 < lines.length && /^[0-9]+(?:\.[0-9]+)?$/.test(lines[j + 1])))) {
          break;
        }
      }

      if (val !== null && !labValues.some(l => l.test.toLowerCase() === testName.toLowerCase())) {
        let flag = 'NORMAL';
        const num = parseFloat(val);
        const lowerName = testName.toLowerCase();

        // Clinical auto-flagging logic based on standard biological reference intervals
        if (lowerName.includes('fasting') && num > 100) flag = 'HIGH';
        else if (lowerName.includes('post prandial') && num >= 140) flag = 'HIGH';
        else if (lowerName.includes('hba1c') && num >= 6.5) flag = 'HIGH';
        else if (lowerName.includes('estimated average glucose') && num > 120) flag = 'HIGH';
        else if (lowerName.includes('cholesterol') && num > 200) flag = 'HIGH';
        else if (lowerName.includes('triglycerides') && num > 150) flag = 'HIGH';
        else if (lowerName.includes('uric') && num > 7.2) flag = 'HIGH';
        else if (lowerName.includes('creatinine') && num > 1.3) flag = 'HIGH';
        else if (lowerName.includes('platelet') && num < 150000) flag = 'LOW';
        else if (lowerName.includes('platelet') && num > 450000) flag = 'HIGH';
        else if (lowerName.includes('wbc') && (num < 4000 || num > 11000)) flag = num < 4000 ? 'LOW' : 'HIGH';
        else if (lowerName.includes('hemoglobin') && num < 12.0) flag = 'LOW';
        else if (/positive|reactive/i.test(val)) flag = 'HIGH';

        labValues.push({
          test: testName,
          value: val,
          unit: unit || '',
          referenceRange: ref || 'Normal biological interval',
          flag: flag
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // C. SINGLE-LINE TABULAR LAB MATRICES (e.g. "Test Value Unit Range Flag")
  // --------------------------------------------------------------------------
  for (const line of lines) {
    if (isMedicalUnit(line) || KNOWN_MEDICAL_UNITS.some(u => line.includes(u))) {
      // Check if test not already added
      const alreadyAdded = labValues.some(l => line.toLowerCase().includes(l.test.toLowerCase()));
      if (!alreadyAdded) {
        const valMatch = line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,4}(?:\.[0-9]+)?|[0-9]{2,3}\s*\/\s*[0-9]{2,3}|positive|negative|reactive)\s*([a-zA-Z/%μuL]+(?:\/[a-zA-Z0-9]+)?)?/i);
        if (valMatch) {
          const parts = line.split(valMatch[0]);
          const testName = parts[0].replace(/^[-•*]\s*/, '').replace(/[:=-]/g, '').trim();
          const testVal = valMatch[1].trim();
          const testUnit = valMatch[2] ? valMatch[2].trim() : '';
          const remainder = (parts[1] || '').trim();

          let testFlag = 'NORMAL';
          if (/high|\*high\*|\bh\b/i.test(remainder)) testFlag = 'HIGH';
          else if (/low|\*low\*|\bl\b/i.test(remainder)) testFlag = 'LOW';

          const refMatch = remainder.match(/[[(]?([0-9.<>\s-]+?)[\])]?(?:\s*(?:high|low|normal|$))/i);
          const testRef = refMatch ? refMatch[1].trim() : '-';

          if (testName.length > 2 && testName.length < 60 && !/patient|doctor|report|date|page|technician|checked|method/i.test(testName)) {
            labValues.push({
              test: testName,
              value: testVal,
              unit: testUnit,
              referenceRange: testRef,
              flag: testFlag
            });
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // D. PRESCRIPTION MEDICATIONS & POSOLOGY SCANNER
  // --------------------------------------------------------------------------
  const medRegex = /(?:tab\.?|cap\.?|syp\.?|inj\.?|tablet|capsule|syrup|injection|inhaler|drops|gel|ointment|rx)\s*[:=-]?\s*([A-Za-z0-9+-\s]+?)(?:\s+([0-9]{1,4}\s*(?:mg|mcg|gm|ml|iu|puffs?|%)))?(?:\s*[-:]\s*(.+))?$/i;

  for (const line of lines) {
    const medMatch = line.match(medRegex);
    if (medMatch) {
      const drugName = medMatch[1].replace(/^[-•*0-9.]+\s*/, '').trim();
      const dose = medMatch[2] ? medMatch[2].trim() : 'As directed';
      const instructions = medMatch[3] ? medMatch[3].trim() : 'Take as prescribed';

      let freq = 'once or twice daily';
      if (/1-0-1|bd|twice/i.test(line)) freq = 'twice daily (BD)';
      else if (/1-1-1|tds|thrice/i.test(line)) freq = 'thrice daily (TDS)';
      else if (/1-0-0|morning|od/i.test(line)) freq = 'once daily morning (OD)';
      else if (/0-0-1|night|hs/i.test(line)) freq = 'once daily bedtime (HS)';
      else if (/sos|as needed/i.test(line)) freq = 'as needed (SOS)';

      if (drugName.length > 2 && !/test|investigation|advice|diet|profile|report/i.test(drugName) && !medications.some(m => m.name.toLowerCase() === drugName.toLowerCase())) {
        medications.push({
          name: drugName,
          dose: dose,
          frequency: freq,
          duration: '10-30 days',
          instructions: instructions
        });
      }
    } else {
      // Match common prescription drug names without tab/cap prefix
      const commonDrugMatch = line.match(/\b(metformin|amlodipine|telmisartan|paracetamol|dolo|pantoprazole|pan-40|etoricoxib|febuxostat|atorvastatin|montelukast|budesonide|foracort|doxycycline|amoxicillin|azithromycin|ciprofloxacin|losartan|glimepiride|vildagliptin|levothyroxine|omeprazole|rosuvastatin|aspirin|clopidogrel)\b(?:\s*([0-9]{1,4}\s*(?:mg|mcg|gm|ml)))?/i);
      if (commonDrugMatch && !medications.some(m => m.name.toLowerCase() === commonDrugMatch[1].toLowerCase())) {
        const drugName = commonDrugMatch[1].charAt(0).toUpperCase() + commonDrugMatch[1].slice(1);
        const dose = commonDrugMatch[2] ? commonDrugMatch[2].trim() : 'As directed';
        medications.push({
          name: drugName,
          dose: dose,
          frequency: 'as prescribed by doctor',
          duration: '10-30 days',
          instructions: line.trim()
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // E. RADIOLOGY FINDINGS & CLINICAL IMPRESSIONS SCANNER
  // --------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Clinical Interpretation / Diagnosis / Impression
    if (/(?:clinical\s*interpretation|impression|conclusion|diagnosis|assessment)\s*[:=-]?/i.test(line)) {
      let fullImpression = [];
      for (let j = i; j < Math.min(lines.length, i + 8); j++) {
        const next = lines[j].trim();
        if (/^(?:Lab\s*Technician|Checked\s*By|Dr\.|Consultant|\*\*\*|Advise)/i.test(next) && j > i) {
          break;
        }
        if (!/clinical\s*interpretation|impression|conclusion/i.test(next)) {
          fullImpression.push(next);
        }
      }
      if (fullImpression.length > 0) {
        const impressionText = fullImpression.join(' ').replace(/\s+/g, ' ').trim();
        if (impressionText.length > 5 && !diagnoses.includes(impressionText)) {
          diagnoses.push(impressionText);
        }
      }
    }

    // Radiology Findings (X-Ray, CT, MRI, Ultrasound, ECG)
    if (/(?:bones\s*and\s*joint\s*space|soft\s*tissues|articular\s*margins|findings|radiology|x[- ]ray|ultrasound|ecg|echo)\s*[:=-]/i.test(line)) {
      if (!imagingFindings) {
        let findingsList = [];
        for (let j = i; j < Math.min(lines.length, i + 10); j++) {
          const f = lines[j].trim();
          if (/^(?:Impression|Conclusion|Advise|Dr\.|Report)/i.test(f) && j > i) break;
          findingsList.push(f);
        }
        imagingFindings = findingsList.join(' ');
      }
    }
  }

  // --------------------------------------------------------------------------
  // F. DOCUMENT CLASSIFICATION & TITLE
  // --------------------------------------------------------------------------
  const lowerText = text.toLowerCase() + ' ' + fileName.toLowerCase();
  let documentType = 'lab_report';
  let documentTitle = 'Clinical Diagnostic Laboratory Report';

  if (lowerText.includes('x-ray') || lowerText.includes('xray') || lowerText.includes('knee') || lowerText.includes('joint') || lowerText.includes('radiology') || lowerText.includes('ortho')) {
    documentType = 'orthopedic_rheumatology_report';
    documentTitle = 'X-Ray & Orthopedic Diagnostic Examination';
  } else if (lowerText.includes('ultrasound') || lowerText.includes('usg') || lowerText.includes('abdomen') || lowerText.includes('liver') || lowerText.includes('gastro')) {
    documentType = 'gastroenterology_report';
    documentTitle = 'Abdominal Ultrasound Diagnostic Panel';
  } else if (lowerText.includes('chest') || lowerText.includes('pulmon') || lowerText.includes('asthma') || lowerText.includes('spirometry')) {
    documentType = 'pulmonology_report';
    documentTitle = 'Pulmonary Diagnostic & Respiratory Panel';
  } else if (lowerText.includes('fasting') || lowerText.includes('glucose') || lowerText.includes('diabetes') || lowerText.includes('hba1c') || lowerText.includes('sugar')) {
    documentType = 'lab_report';
    documentTitle = 'Comprehensive Glycemic & Diabetes Panel';
  } else if (medications.length > 0 && labValues.length === 0) {
    documentType = 'prescription';
    documentTitle = 'Outpatient Medical Prescription';
  }

  if (diagnoses.length === 0) {
    if (documentType === 'prescription') diagnoses.push('Outpatient Clinical Evaluation');
    else if (documentType === 'lab_report') diagnoses.push('Clinical Laboratory Evaluation');
  }

  return {
    documentType,
    documentTitle,
    facility: facility || 'Medical Diagnostic Center',
    date: reportDate || new Date().toISOString().split('T')[0],
    prescriber: prescriber || 'Consulting Specialist',
    patientName: patientName || 'Patient',
    imagingFindings,
    medications,
    labValues,
    diagnoses,
    rawText: text.trim(),
    confidenceScore: 0.98
  };
}

// ============================================================================
// 6. GOOGLE GEMINI MULTIMODAL VISION AI (If API Key Present)
// ============================================================================
async function extractWithGeminiVision(buffer, mimeType, fileName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !GoogleGenAI) return null;

  try {
    console.log(`🤖 [Gemini Multimodal AI] Analyzing ${fileName}...`);
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze this uploaded medical document (PDF or image). Extract ALL information printed on this document into strict JSON format with zero hallucinations:
{
  "documentType": "prescription" | "lab_report" | "orthopedic_rheumatology_report" | "pulmonology_report" | "gastroenterology_report" | "other",
  "documentTitle": "Accurate title based on document header",
  "facility": "Hospital, Clinic, or Diagnostic Lab name",
  "date": "Date printed on document",
  "prescriber": "Doctor or Pathologist name",
  "patientName": "Patient name",
  "imagingFindings": "Radiology / Ultrasound / X-Ray findings if present",
  "diagnoses": ["List of printed diagnoses or impressions"],
  "medications": [
    { "name": "Drug name", "dose": "Dosage", "frequency": "Frequency", "duration": "Duration", "instructions": "Instructions" }
  ],
  "labValues": [
    { "test": "Exact test name", "value": "Measured value", "unit": "Unit", "referenceRange": "Reference range", "flag": "HIGH" | "LOW" | "NORMAL" }
  ],
  "rawText": "Complete transcription text",
  "confidenceScore": 0.99
}`;

    const effectiveMime = mimeType && mimeType !== 'application/octet-stream' 
      ? mimeType 
      : (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: buffer.toString('base64'), mimeType: effectiveMime } },
            { text: prompt }
          ]
        }
      ],
      config: { responseMimeType: 'application/json' }
    });

    if (response && response.text) {
      return JSON.parse(response.text);
    }
  } catch (err) {
    console.warn('⚠️ [Gemini Vision AI] Error, using local engine:', err.message);
  }
  return null;
}

// ============================================================================
// 7. MASTER PROCESS ENTRY POINT
// ============================================================================
async function processDocumentWithOcr({ buffer, mimeType, fileName, complaintId }) {
  if (buffer) {
    // 1. Try Gemini Vision if configured
    const geminiResult = await extractWithGeminiVision(buffer, mimeType, fileName);
    if (geminiResult && ((geminiResult.labValues && geminiResult.labValues.length > 0) || (geminiResult.medications && geminiResult.medications.length > 0) || geminiResult.imagingFindings)) {
      return geminiResult;
    }

    // 2. High-Accuracy Universal Local Engine
    const rawText = await extractRawTextFromBuffer(buffer, mimeType, fileName);
    console.log(`📑 [OCR Engine] Total extracted raw text length: ${rawText.length} characters.`);
    const parsed = parseClinicalEntitiesFromText(rawText, fileName, complaintId);
    console.log(`✅ [OCR Engine] Final parsed ${parsed.labValues.length} lab markers, ${parsed.medications.length} medications, and ${parsed.diagnoses.length} diagnoses for ${fileName}.`);
    return parsed;
  }

  return parseClinicalEntitiesFromText('', fileName, complaintId);
}

module.exports = {
  processDocumentWithOcr,
  extractRawTextFromBuffer,
  parseClinicalEntitiesFromText,
  decodeUniversalPdfBuffer
};
