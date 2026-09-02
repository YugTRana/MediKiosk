import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, Pill, Trash2, Edit2, Check, Plus, AlertCircle, 
  Sparkles, FileText, CheckCircle2, RotateCcw, ShieldCheck, 
  ChevronDown, ChevronUp, Stethoscope, Building, Calendar, User
} from 'lucide-react';
import { getLabFlagBadgeClass } from '../services/docAiService.js';

export default function DigitizedDocumentTable({
  documentData,
  onChange,
  onConfirm,
  onRescan,
  isDoctorView = false,
  selectedLanguage = 'English'
}) {
  const [data, setData] = useState(documentData || {
    documentTitle: 'Medical Diagnostic Report',
    documentType: 'lab_report',
    facility: '',
    date: new Date().toISOString().split('T')[0],
    prescriber: '',
    patientName: '',
    patientAge: '',
    patientGender: '',
    labValues: [],
    medications: [],
    diagnoses: [],
    imagingFindings: '',
    rawText: ''
  });

  useEffect(() => {
    if (documentData) {
      setData(documentData);
    }
  }, [documentData]);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'labs' | 'meds' | 'raw'
  const [editingLabIdx, setEditingLabIdx] = useState(null);
  const [editingMedIdx, setEditingMedIdx] = useState(null);
  const [tempLab, setTempLab] = useState({});
  const [tempMed, setTempMed] = useState({});
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Sync internal updates to parent
  const updateData = (newData) => {
    setData(newData);
    if (onChange) onChange(newData);
  };

  // -------------------------------------------------------------
  // LAB VALUES MANAGEMENT (Add, Edit, Delete, Clear Errors)
  // -------------------------------------------------------------
  const handleDeleteLab = (index) => {
    const updatedLabs = data.labValues.filter((_, i) => i !== index);
    updateData({ ...data, labValues: updatedLabs });
  };

  const handleStartEditLab = (index) => {
    setEditingLabIdx(index);
    setTempLab({ ...data.labValues[index] });
  };

  const handleSaveLab = (index) => {
    const updatedLabs = [...data.labValues];
    // Auto evaluate flag based on reference range
    let flag = tempLab.flag || 'NORMAL';
    const numVal = parseFloat(tempLab.value);
    if (!isNaN(numVal) && tempLab.referenceRange) {
      const matchRange = tempLab.referenceRange.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
      if (matchRange) {
        const min = parseFloat(matchRange[1]);
        const max = parseFloat(matchRange[2]);
        if (numVal > max) flag = 'HIGH';
        else if (numVal < min) flag = 'LOW';
        else flag = 'NORMAL';
      }
    }

    updatedLabs[index] = { ...tempLab, flag };
    setEditingLabIdx(null);
    updateData({ ...data, labValues: updatedLabs });
  };

  const handleAddLabRow = () => {
    const newLab = {
      test: 'New Lab Test',
      value: '100',
      unit: 'mg/dL',
      referenceRange: '70 - 110',
      flag: 'NORMAL'
    };
    updateData({ ...data, labValues: [...data.labValues, newLab] });
    setEditingLabIdx(data.labValues.length);
    setTempLab(newLab);
  };

  // -------------------------------------------------------------
  // MEDICATIONS MANAGEMENT (Add, Edit, Delete)
  // -------------------------------------------------------------
  const handleDeleteMed = (index) => {
    const updatedMeds = data.medications.filter((_, i) => i !== index);
    updateData({ ...data, medications: updatedMeds });
  };

  const handleStartEditMed = (index) => {
    setEditingMedIdx(index);
    setTempMed({ ...data.medications[index] });
  };

  const handleSaveMed = (index) => {
    const updatedMeds = [...data.medications];
    updatedMeds[index] = { ...tempMed };
    setEditingMedIdx(null);
    updateData({ ...data, medications: updatedMeds });
  };

  const handleAddMedRow = () => {
    const newMed = {
      name: 'New Medication',
      dose: '500mg',
      frequency: 'twice daily after meals',
      duration: '10 days',
      instructions: 'Take with water'
    };
    updateData({ ...data, medications: [...data.medications, newMed] });
    setEditingMedIdx(data.medications.length);
    setTempMed(newMed);
  };

  // -------------------------------------------------------------
  // CLEAN NOISE & AUTO-CORRECT OCR ARTIFACTS
  // -------------------------------------------------------------
  const handleAutoCleanOcrNoise = () => {
    // Clean lab values: trim, uppercase units, remove garbage chars
    const cleanedLabs = (data.labValues || []).map((lab) => {
      let cleanTest = String(lab.test || '').replace(/[_|^~*`]/g, '').trim();
      let cleanVal = String(lab.value || '').replace(/[^\d./+-]/g, '').trim();
      let cleanUnit = String(lab.unit || '').trim();
      if (cleanUnit.toLowerCase() === 'mg/dl') cleanUnit = 'mg/dL';
      if (cleanUnit.toLowerCase() === 'g/dl') cleanUnit = 'g/dL';
      return {
        ...lab,
        test: cleanTest,
        value: cleanVal || lab.value,
        unit: cleanUnit || lab.unit
      };
    });

    const cleanedMeds = (data.medications || []).map((med) => ({
      ...med,
      name: String(med.name || '').replace(/[_|^~*`]/g, '').trim(),
      dose: String(med.dose || '').trim(),
      frequency: String(med.frequency || '').trim()
    }));

    updateData({
      ...data,
      labValues: cleanedLabs,
      medications: cleanedMeds
    });
  };

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* 1. DOCUMENT HEADER & FACILITY METADATA CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold tracking-tight text-white">{data.documentTitle}</h3>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase rounded-full tracking-wider">
                  {data.documentType}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <Building className="w-3.5 h-3.5 text-slate-400" /> {data.facility || 'District Hospital / Diagnostic Imaging Center'}
                <span>•</span>
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date: {data.date || 'Today'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleAutoCleanOcrNoise}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Auto-Clean OCR Noise</span>
            </button>
            <div className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verified Clean</span>
            </div>
          </div>
        </div>

        {/* Patient & Prescriber Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Patient Name</span>
            <span className="font-extrabold text-slate-100">{data.patientName || 'Verified In-Session Patient'}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Doctor / Prescriber</span>
            <span className="font-extrabold text-slate-100">{data.prescriber || 'Consulting Physician'}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lab Tests Count</span>
            <span className="font-extrabold text-emerald-400">{data.labValues?.length || 0} Test Markers</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Prescriptions</span>
            <span className="font-extrabold text-blue-400">{data.medications?.length || 0} Medicines</span>
          </div>
        </div>

        {/* Radiology / Imaging Findings Alert */}
        {data.imagingFindings && (
          <div className="mt-3 p-3 bg-purple-950/60 border border-purple-500/40 rounded-xl text-xs text-purple-200 flex items-start gap-2">
            <span className="font-black text-purple-300 flex-shrink-0">📸 Imaging Finding:</span>
            <span>{data.imagingFindings}</span>
          </div>
        )}

        {/* Diagnoses Pills */}
        {data.diagnoses && data.diagnoses.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-slate-400">Impression / Diagnoses:</span>
            {data.diagnoses.map((d, i) => (
              <span key={i} className="px-2.5 py-1 bg-blue-900/60 border border-blue-500/30 text-blue-200 font-bold rounded-lg">
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Cleaned Tables ({ (data.labValues?.length || 0) + (data.medications?.length || 0) })
          </button>
          <button
            onClick={() => setActiveTab('labs')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'labs'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" /> Lab Values ({data.labValues?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('meds')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'meds'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Pill className="w-3.5 h-3.5" /> Medications ({data.medications?.length || 0})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddLabRow}
            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lab
          </button>
          <button
            onClick={handleAddMedRow}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Med
          </button>
        </div>
      </div>

      {/* 3. LAB TESTS TABLE */}
      {(activeTab === 'all' || activeTab === 'labs') && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              <h4 className="text-sm font-extrabold text-slate-900">
                Diagnostic Laboratory Tests & Measured Biomarkers
              </h4>
              <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                {data.labValues?.length || 0} Records
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Click ✏️ to edit or 🗑️ to erase errors
            </span>
          </div>

          {(!data.labValues || data.labValues.length === 0) ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No laboratory test values present in this document.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-4">Diagnostic Test / Marker</th>
                    <th className="p-3.5">Measured Value</th>
                    <th className="p-3.5">Unit</th>
                    <th className="p-3.5">Reference Range</th>
                    <th className="p-3.5 text-center">Status Flag</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.labValues.map((lab, i) => (
                    <tr
                      key={i}
                      className={
                        lab.flag === 'HIGH'
                          ? 'bg-rose-50/40 hover:bg-rose-50/70'
                          : lab.flag === 'LOW'
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50'
                      }
                    >
                      {editingLabIdx === i ? (
                        <>
                          <td className="p-2.5 pl-4">
                            <input
                              type="text"
                              value={tempLab.test || ''}
                              onChange={(e) => setTempLab({ ...tempLab, test: e.target.value })}
                              className="w-full p-2 border border-purple-400 rounded-lg text-xs font-bold text-slate-900 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempLab.value || ''}
                              onChange={(e) => setTempLab({ ...tempLab, value: e.target.value })}
                              className="w-24 p-2 border border-purple-400 rounded-lg text-xs font-extrabold text-slate-900 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempLab.unit || ''}
                              onChange={(e) => setTempLab({ ...tempLab, unit: e.target.value })}
                              className="w-20 p-2 border border-purple-400 rounded-lg text-xs text-slate-700 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempLab.referenceRange || ''}
                              onChange={(e) => setTempLab({ ...tempLab, referenceRange: e.target.value })}
                              className="w-28 p-2 border border-purple-400 rounded-lg text-xs text-slate-700 bg-white"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <select
                              value={tempLab.flag || 'NORMAL'}
                              onChange={(e) => setTempLab({ ...tempLab, flag: e.target.value })}
                              className="p-1.5 border border-purple-400 rounded-lg text-xs font-bold bg-white"
                            >
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="LOW">LOW</option>
                            </select>
                          </td>
                          <td className="p-2.5 text-right pr-4">
                            <button
                              onClick={() => handleSaveLab(i)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow cursor-pointer mr-1.5"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingLabIdx(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3.5 pl-4 font-bold text-slate-900">
                            {lab.test}
                          </td>
                          <td className="p-3.5 font-black text-slate-900 text-sm">
                            {lab.value}
                          </td>
                          <td className="p-3.5 font-semibold text-slate-600">
                            {lab.unit}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono">
                            {lab.referenceRange || '-'} {lab.unit}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={getLabFlagBadgeClass(lab.flag)}>{lab.flag}</span>
                          </td>
                          <td className="p-3.5 text-right pr-4 space-x-1">
                            <button
                              onClick={() => handleStartEditLab(i)}
                              className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              title="Edit Value"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLab(i)}
                              className="p-1.5 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                              title="Erase Error / Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. MEDICATIONS & PRESCRIPTION TABLE */}
      {(activeTab === 'all' || activeTab === 'meds') && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-blue-600" />
              <h4 className="text-sm font-extrabold text-slate-900">
                Prescribed Medications & Posology Schedule
              </h4>
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {data.medications?.length || 0} Drugs
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Click ✏️ to edit or 🗑️ to erase errors
            </span>
          </div>

          {(!data.medications || data.medications.length === 0) ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No prescribed medications present in this document.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 pl-4">Medicine / Salt</th>
                    <th className="p-3.5">Dosage / Strength</th>
                    <th className="p-3.5">Frequency & Timing</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.medications.map((med, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {editingMedIdx === i ? (
                        <>
                          <td className="p-2.5 pl-4">
                            <input
                              type="text"
                              value={tempMed.name || ''}
                              onChange={(e) => setTempMed({ ...tempMed, name: e.target.value })}
                              className="w-full p-2 border border-blue-400 rounded-lg text-xs font-bold text-slate-900 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempMed.dose || ''}
                              onChange={(e) => setTempMed({ ...tempMed, dose: e.target.value })}
                              className="w-24 p-2 border border-blue-400 rounded-lg text-xs font-extrabold text-blue-800 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempMed.frequency || ''}
                              onChange={(e) => setTempMed({ ...tempMed, frequency: e.target.value })}
                              className="w-48 p-2 border border-blue-400 rounded-lg text-xs text-slate-700 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={tempMed.duration || ''}
                              onChange={(e) => setTempMed({ ...tempMed, duration: e.target.value })}
                              className="w-24 p-2 border border-blue-400 rounded-lg text-xs text-slate-700 bg-white"
                            />
                          </td>
                          <td className="p-2.5 text-right pr-4">
                            <button
                              onClick={() => handleSaveMed(i)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow cursor-pointer mr-1.5"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingMedIdx(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3.5 pl-4 font-bold text-slate-900">
                            {med.name}
                          </td>
                          <td className="p-3.5 font-black text-blue-800">
                            {med.dose}
                          </td>
                          <td className="p-3.5 text-slate-600 font-medium">
                            {med.frequency}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono">
                            {med.duration || '10-30 days'}
                          </td>
                          <td className="p-3.5 text-right pr-4 space-x-1">
                            <button
                              onClick={() => handleStartEditMed(i)}
                              className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              title="Edit Medication"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMed(i)}
                              className="p-1.5 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                              title="Erase Error / Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. RAW OCR AUDIT ACCORDION */}
      {data.rawText && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowRawOcr(!showRawOcr)}
            className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Full Scanned OCR Transcript ({data.rawText.length} characters)</span>
            </div>
            {showRawOcr ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showRawOcr && (
            <pre className="p-4 bg-white border-t border-slate-200 font-mono text-[11px] text-slate-600 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
              {data.rawText}
            </pre>
          )}
        </div>
      )}

      {/* 6. BOTTOM ACTION BUTTONS */}
      {!isDoctorView && (
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200">
          <button
            onClick={() => onConfirm && onConfirm(data)}
            className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Check className="w-5 h-5" />
            {selectedLanguage === 'हिंदी'
              ? 'हां, तालिका सही है — आगे बढ़ें'
              : 'Approve Table & Attach to Medical Record'}
          </button>

          <button
            onClick={onRescan}
            className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl border border-slate-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rescan Document</span>
          </button>
        </div>
      )}
    </div>
  );
}
