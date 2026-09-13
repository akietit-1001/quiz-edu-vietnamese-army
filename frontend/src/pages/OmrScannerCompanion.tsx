import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAppSocket } from '../utils/socket';
import { processOmrSheet, type OmrRecognitionResult } from '../utils/omrEngine';
import { Camera, Lightning, ArrowLeft, Check, WarningCircle } from '../icons';

interface OmrScannerCompanionProps {
  sessionCode?: string;
  onNavigateBack: () => void;
}

export const OmrScannerCompanion: React.FC<OmrScannerCompanionProps> = ({
  sessionCode: initialSessionCode = '',
  onNavigateBack
}) => {
  const [sessionCode, setSessionCode] = useState(initialSessionCode);
  const [isJoined, setIsJoined] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Scanning loop state
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScannedResult, setLastScannedResult] = useState<any>(null);
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const isProcessingRef = useRef(false);

  // Web Audio Context for Beep sound
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Ignore audio error if blocked by browser policy
    }
  };

  // 1. Tải thông tin phiên chấm
  const joinSession = async (codeToJoin: string) => {
    if (!codeToJoin.trim()) {
      setErrorMsg('Vui lòng nhập Mã phiên chấm / Mã phòng thi');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`/api/omr/session/${codeToJoin.trim().toUpperCase()}`);
      setSessionInfo(res.data);
      setIsJoined(true);
      setSessionCode(codeToJoin.trim().toUpperCase());
      setScanCount(res.data.existingAttempts?.length || 0);

      // Kết nối socket vào kênh OMR
      const socket = getAppSocket();
      socket.connect();
      socket.emit('joinOmrSession', { sessionCode: codeToJoin.trim().toUpperCase() });

      startCamera();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Không tìm thấy phiên chấm hoặc phòng thi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Nếu có sessionCode truyền qua props hoặc URL params -> tự join
    const urlParams = new URLSearchParams(window.location.search);
    const paramCode = urlParams.get('session') || initialSessionCode;
    if (paramCode) {
      setSessionCode(paramCode);
      joinSession(paramCode);
    }
  }, []);

  // 2. Khởi động Camera điện thoại
  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraActive(true);
      setIsScanning(true);

      // Check flash/torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (capabilities && capabilities.torch) {
        setHasTorch(true);
      }
    } catch (err: any) {
      console.error('Lỗi truy cập camera:', err);
      setErrorMsg('Không thể mở Camera: ' + (err.message || 'Vui lòng cấp quyền truy cập Camera'));
    }
  };

  // Toggle Flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.error('Lỗi bật đèn flash:', e);
      }
    }
  };

  // Cleanup camera khi unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const socket = getAppSocket();
      if (sessionCode) {
        socket.emit('leaveOmrSession', { sessionCode });
      }
    };
  }, [sessionCode]);

  // 3. Vòng lặp quét OMR thời gian thực (Scan loop)
  useEffect(() => {
    if (!cameraActive || !isScanning) return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        isProcessingRef.current = true;
        const totalQ = sessionInfo?.quiz?.totalQuestions || 40;
        const result: OmrRecognitionResult = await processOmrSheet(canvas, totalQ);

        // Nếu nhận diện thành công mã QR đề thi hoặc phát hiện đầy đủ câu trả lời
        if (result.success && result.detectedAnswers && result.detectedAnswers.length > 0) {
          const filledAnswersCount = result.detectedAnswers.filter(a => a.selectedOption).length;

          // Điều kiện nhận diện: Điền tối thiểu 1 câu hoặc phát hiện QR đề thi
          if (filledAnswersCount > 0 || result.qrPayload) {
            // Rung phản hồi & Phát tiếng bíp
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            playBeep();

            // Gửi dữ liệu bài chấm lên server
            const payload = {
              sessionCode,
              roomId: sessionInfo?.room?._id || null,
              quizId: sessionInfo?.quiz?._id || result.qrPayload?.qId,
              sbd: result.sbd || '',
              examCode: result.examCode || '101',
              detectedAnswers: result.detectedAnswers,
              scannedImageUrl: result.warpedImageBase64
            };

            const submitRes = await axios.post('/api/omr/submit-scan', payload);
            setLastScannedResult(submitRes.data.attempt);
            setScanCount(prev => prev + 1);

            setShowScanSuccess(true);
            setTimeout(() => setShowScanSuccess(false), 1200);

            // Tạm dừng 1.5 giây để tránh quét trùng 1 bài 2 lần
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      } catch (err) {
        // Tiếp tục quét ở frame tiếp theo
      } finally {
        isProcessingRef.current = false;
      }
    }, 450);

    return () => clearInterval(interval);
  }, [cameraActive, isScanning, sessionInfo, sessionCode]);

  // Xử lý chụp thủ công / tải ảnh từ bộ sưu tập
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;
        offCtx.drawImage(img, 0, 0);

        try {
          const totalQ = sessionInfo?.quiz?.totalQuestions || 40;
          const result = await processOmrSheet(offCanvas, totalQ);

          if (result.success) {
            playBeep();
            const payload = {
              sessionCode,
              roomId: sessionInfo?.room?._id || null,
              quizId: sessionInfo?.quiz?._id || result.qrPayload?.qId,
              sbd: result.sbd || '',
              examCode: result.examCode || '101',
              detectedAnswers: result.detectedAnswers,
              scannedImageUrl: result.warpedImageBase64
            };

            const submitRes = await axios.post('/api/omr/submit-scan', payload);
            setLastScannedResult(submitRes.data.attempt);
            setScanCount(prev => prev + 1);
            setShowScanSuccess(true);
            setTimeout(() => setShowScanSuccess(false), 1500);
          }
        } catch (err: any) {
          alert('Không thể nhận diện phiếu thi từ ảnh này: ' + err.message);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Ẩn Canvas phụ dùng để phân tích */}
      <canvas ref={canvasRef} className="hidden" />

      {/* MÀN HÌNH NHẬP MÃ PHIÊN (NẾU CHƯA JOIN) */}
      {!isJoined ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-vpa-dark max-w-md mx-auto w-full">
          <div className="w-16 h-16 bg-vpa-gold/20 border-2 border-vpa-gold rounded-full flex items-center justify-center mb-4">
            <Camera size={32} weight="bold" className="text-vpa-gold" />
          </div>

          <h1 className="text-lg font-black uppercase text-center text-vpa-gold tracking-wider mb-2">
            MÁY QUÉT OMR DI ĐỘNG
          </h1>
          <p className="text-xs text-gray-400 text-center mb-6">
            Biến điện thoại thành thiết bị quét phiếu thi không dây. Kết quả sẽ tự động đồng bộ thời gian thực về máy tính!
          </p>

          <div className="w-full space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Mã Phiên Chấm / Mã Phòng Thi</label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="VD: PHONG01 hoặc MÃ_PHIÊN"
                className="w-full px-4 py-3 bg-black/50 border-2 border-vpa-olive-light/50 rounded-lg text-center font-mono font-bold text-xl uppercase tracking-widest text-vpa-gold focus:border-vpa-gold outline-none"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-900/50 border border-red-500 rounded text-xs text-red-200 flex items-center gap-2">
                <WarningCircle size={16} weight="bold" className="shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={() => joinSession(sessionCode)}
              disabled={loading}
              className="w-full py-3 bg-vpa-gold hover:bg-yellow-500 text-vpa-dark font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-vpa-dark border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Bắt đầu quét bài</span>
              )}
            </button>

            <button
              onClick={onNavigateBack}
              className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Quay lại Trang chủ
            </button>
          </div>
        </div>
      ) : (
        /* MÀN HÌNH CAMERA QUÉT BÀI THI */
        <div className="relative flex-1 flex flex-col bg-black overflow-hidden">
          {/* Top Bar Header */}
          <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 flex items-center justify-between">
            <button
              onClick={() => {
                if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
                setIsJoined(false);
              }}
              className="p-2 bg-black/60 backdrop-blur rounded-full text-white active:scale-90"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>

            <div className="text-center">
              <span className="text-[10px] font-mono text-vpa-gold uppercase font-bold tracking-widest block">
                PHIÊN: {sessionCode}
              </span>
              <span className="text-xs font-bold text-white line-clamp-1 max-w-[200px]">
                {sessionInfo?.quiz?.title || 'Đề kiểm tra'}
              </span>
            </div>

            {hasTorch ? (
              <button
                onClick={toggleTorch}
                className={`p-2 backdrop-blur rounded-full transition-all ${
                  torchEnabled ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/50' : 'bg-black/60 text-white'
                }`}
              >
                <Lightning size={20} weight="bold" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>

          {/* Video Camera Stream */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Khung ngắm định vị 4 góc phiếu thi (Guide Overlay) */}
            <div className="absolute inset-x-8 inset-y-20 border-2 border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-3 animate-pulse">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-4 border-l-4 border-vpa-gold rounded-tl-md" />
                <div className="w-8 h-8 border-t-4 border-r-4 border-vpa-gold rounded-tr-md" />
              </div>
              <div className="text-center text-[11px] font-mono font-bold bg-black/60 backdrop-blur px-3 py-1 rounded-full text-white/90 self-center">
                CĂN 4 GÓC ĐEN VÀO KHUNG
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-4 border-l-4 border-vpa-gold rounded-bl-md" />
                <div className="w-8 h-8 border-b-4 border-r-4 border-vpa-gold rounded-br-md" />
              </div>
            </div>

            {/* Flash thông báo quét thành công */}
            {showScanSuccess && (
              <div className="absolute inset-0 z-40 bg-green-500/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in text-white p-6">
                <div className="w-20 h-20 bg-white text-green-600 rounded-full flex items-center justify-center mb-3 shadow-2xl">
                  <Check size={48} weight="bold" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wider">ĐÃ CHẤM XONG!</h3>
                <p className="text-sm font-bold mt-1">
                  SBD: {lastScannedResult?.candidateInfo?.sbd || '---'} • Điểm: {lastScannedResult?.score}/{lastScannedResult?.totalQuestions}
                </p>
                <span className="text-xs opacity-80 mt-2">Dữ liệu đã gửi thẳng về Máy tính</span>
              </div>
            )}
          </div>

          {/* Bottom Controls Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-5 flex flex-col items-center">
            {/* Thống kê nhanh */}
            <div className="flex items-center justify-between w-full max-w-xs mb-3 text-xs">
              <span className="text-gray-400 font-bold">Số bài đã quét:</span>
              <span className="font-mono font-black text-vpa-gold text-base bg-vpa-gold/10 px-2.5 py-0.5 rounded border border-vpa-gold/30">
                {scanCount} bài
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 w-full">
              {/* Tải ảnh từ thư viện */}
              <label className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full cursor-pointer text-xs flex flex-col items-center justify-center transition-all">
                <Camera size={20} weight="bold" />
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              {/* Nút chỉ báo quét liên tục */}
              <div className="flex items-center space-x-2 bg-vpa-gold text-vpa-dark px-6 py-2.5 rounded-full font-bold text-xs shadow-lg animate-bounce">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>Đang tự động nhận diện bài thi...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OmrScannerCompanion;
