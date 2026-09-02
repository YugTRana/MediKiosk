import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, Sparkles, SwitchCamera } from 'lucide-react';

export default function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  mode = 'document', // 'document' | 'face'
  title = 'Scan Document with Camera'
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState(mode === 'face' ? 'user' : 'environment');
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);

  // Start Camera Stream
  const startCamera = async (facing = facingMode) => {
    setIsLoadingCamera(true);
    setHasCameraError(false);
    setCameraErrorMsg('');

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsLoadingCamera(false);
    } catch (err) {
      console.warn('Primary camera constraints failed, attempting basic video:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
        setIsLoadingCamera(false);
      } catch (fallbackErr) {
        console.error('Camera access denied or unavailable:', fallbackErr);
        setHasCameraError(true);
        setCameraErrorMsg('Camera access is not permitted or no camera device was detected. Please check browser permissions.');
        setIsLoadingCamera(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCapturedBlob(null);
      startCamera(mode === 'face' ? 'user' : 'environment');
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, mode]);

  // Flip Camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture Snapshot from Video Stream
  const handleSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // If front camera, flip horizontally for natural mirror feel
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);

    // Convert to Blob for upload
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const fileObj = new File([blob], `kiosk_cam_capture_${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          setCapturedBlob(fileObj);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (onCapture && (capturedBlob || capturedImage)) {
      onCapture({
        file: capturedBlob,
        dataUrl: capturedImage,
        fileName: capturedBlob?.name || `kiosk_capture_${Date.now()}.jpg`
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">
                {mode === 'face'
                  ? 'Align patient face in the frame'
                  : 'Hold prescription or report clearly in view'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative flex-1 bg-black min-h-[360px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
          {isLoadingCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300 z-10">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-semibold">Initializing Kiosk High-Resolution Camera...</span>
            </div>
          )}

          {hasCameraError && (
            <div className="p-6 text-center max-w-md flex flex-col items-center gap-3 text-rose-300">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-sm font-semibold">{cameraErrorMsg}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Retry Camera
              </button>
            </div>
          )}

          {!hasCameraError && !capturedImage && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Viewfinder Target Guides */}
              {mode === 'document' ? (
                <div className="absolute inset-8 sm:inset-12 border-2 border-emerald-400/70 rounded-2xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex flex-col justify-between p-4">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                  </div>
                  <div className="text-center bg-black/60 backdrop-blur-sm text-emerald-300 text-xs font-bold py-1 px-3 rounded-full self-center border border-emerald-500/30">
                    Align document text clearly inside box
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-80 border-4 border-emerald-400/80 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-300 bg-black/60 px-3 py-1 rounded-full border border-emerald-500/30">
                      Position Face Here
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Captured Preview */}
          {capturedImage && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured Snapshot"
                className="max-h-[420px] w-auto object-contain rounded-xl border border-slate-700 shadow-2xl"
              />
              <div className="absolute top-4 left-4 bg-emerald-600/90 text-white text-xs font-extrabold px-3 py-1 rounded-full backdrop-blur-sm shadow flex items-center gap-1.5 border border-emerald-400/40">
                <Sparkles className="w-3.5 h-3.5" /> Photo Captured
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Controls */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          {!capturedImage ? (
            <>
              <button
                type="button"
                onClick={toggleFacingMode}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer transition-all"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>

              <button
                type="button"
                onClick={handleSnap}
                disabled={hasCameraError || isLoadingCamera}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-900/40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                Capture Snapshot
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Retake Photo
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Check className="w-5 h-5" /> Use Photo & Scan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
