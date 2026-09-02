import React, { useState } from 'react';
import { 
  Calendar, FileText, FlaskConical, Pill, Activity, 
  ChevronRight, AlertTriangle, Building2, User, Clock, 
  ArrowUpDown, CheckCircle2, ShieldAlert
} from 'lucide-react';

/**
 * Chronological Document Timeline Component (Module B - Phase 6)
 * Sorts all patient digitized documents by EXTRACTED document date (not upload date).
 * Renders an interactive clinical journey timeline across patient visits.
 */
export default function DocumentTimeline({
  documents = [],
  selectedDocId = null,
  onSelectDocument = () => {}
}) {
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc' (oldest first)

  if (!documents || documents.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-3">
        <FileText className="w-10 h-10 text-slate-300" />
        <span className="text-sm font-bold text-slate-600">No Historical Documents Digitized</span>
        <p className="text-xs text-slate-400 max-w-sm">
          Upload medical reports or prescriptions at the kiosk or scan camera to populate the patient's chronological timeline.
        </p>
      </div>
    );
  }

  // Parse and sort documents by extracted date
  const parseDocDate = (doc) => {
    if (!doc.date) return new Date(doc.createdAt || 0);
    // Parse formats like DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, or 15-Jan-2024
    const dStr = String(doc.date).trim();
    const dParts = dStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dParts) {
      const day = parseInt(dParts[1], 10);
      const month = parseInt(dParts[2], 10) - 1;
      let year = parseInt(dParts[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date(doc.createdAt || 0) : parsed;
  };

  const sortedDocs = [...documents].sort((a, b) => {
    const timeA = parseDocDate(a).getTime();
    const timeB = parseDocDate(b).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const getDocTypeIcon = (type) => {
    switch (type) {
      case 'prescription':
        return <Pill className="w-4 h-4 text-blue-600" />;
      case 'orthopedic_rheumatology_report':
        return <Activity className="w-4 h-4 text-emerald-600" />;
      case 'lab_report':
      default:
        return <FlaskConical className="w-4 h-4 text-purple-600" />;
    }
  };

  const getDocTypeBadge = (type) => {
    switch (type) {
      case 'prescription':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'orthopedic_rheumatology_report':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'lab_report':
      default:
        return 'bg-purple-50 text-purple-800 border-purple-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
      {/* Timeline Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-700" />
          <h3 className="text-sm font-black text-slate-900">
            Patient Longitudinal Record Timeline
          </h3>
          <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
            {documents.length} Records
          </span>
        </div>

        <button
          onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-1 text-xs font-extrabold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          title="Toggle chronological order"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{sortOrder === 'desc' ? 'Newest to Oldest' : 'Oldest to Newest'}</span>
        </button>
      </div>

      {/* Visual Vertical Timeline */}
      <div className="relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 flex flex-col gap-4">
        {sortedDocs.map((doc, idx) => {
          const docDateObj = parseDocDate(doc);
          const formattedDate = docDateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });

          // Check abnormal lab counts
          const labList = Array.isArray(doc.labValues) 
            ? doc.labValues 
            : (typeof doc.labValues === 'string' ? JSON.parse(doc.labValues || '[]') : []);
          const abnormalLabs = labList.filter(l => l.flag === 'HIGH' || l.flag === 'LOW');

          const medList = Array.isArray(doc.medications) 
            ? doc.medications 
            : (typeof doc.medications === 'string' ? JSON.parse(doc.medications || '[]') : []);

          const isSelected = selectedDocId === (doc.id || idx);
          const isLowConfidence = doc.confidenceFlag === 'LOW' || (doc.confidenceScore && doc.confidenceScore < 0.65);

          return (
            <div key={doc.id || idx} className="relative group">
              {/* Timeline Pin Indicator */}
              <div className={`absolute -left-[27px] top-4 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                isSelected
                  ? 'bg-blue-600 border-white ring-4 ring-blue-100 shadow-sm'
                  : 'bg-white border-slate-400 group-hover:border-blue-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />
              </div>

              {/* Timeline Card */}
              <div
                onClick={() => onSelectDocument(doc)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 relative ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                {/* Top Row: Extracted Document Date & Category */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs px-2.5 py-1 rounded-md bg-slate-900 text-white flex items-center gap-1.5 shadow-xs">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      {formattedDate}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${getDocTypeBadge(doc.documentType)}`}>
                      {getDocTypeIcon(doc.documentType)}
                      {doc.documentType?.replace(/_/g, ' ') || 'Record'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isLowConfidence && (
                      <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-700" /> Low OCR Confidence
                      </span>
                    )}
                    {doc.drugInteractions && doc.drugInteractions.length > 0 && (
                      <span className="text-[10px] font-black bg-red-100 text-red-900 border border-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-red-700" /> {doc.drugInteractions.length} Drug Interactions
                      </span>
                    )}
                  </div>
                </div>

                {/* Document Title & Clinic */}
                <div className="flex flex-col">
                  <h4 className="text-xs font-extrabold text-slate-900">
                    {doc.documentTitle || doc.fileName || 'Diagnostic Report'}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                    {doc.facility && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> {doc.facility}
                      </span>
                    )}
                    {doc.prescriber && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> {doc.prescriber}
                      </span>
                    )}
                    {doc.createdAt && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" /> Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Extracted Clinical Metrics Summary */}
                <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                  {labList.length > 0 && (
                    <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {labList.length} Labs
                    </span>
                  )}
                  {abnormalLabs.length > 0 && (
                    <span className="text-[11px] font-black text-red-800 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-600" /> {abnormalLabs.length} Abnormal Values
                    </span>
                  )}
                  {medList.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                      {medList.length} Medications
                    </span>
                  )}
                  {doc.imagingFindings && (
                    <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                      📸 Radiology Available
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
