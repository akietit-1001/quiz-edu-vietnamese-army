import jsQR from 'jsqr';

export interface OmrRecognitionResult {
  success: boolean;
  errorMessage?: string;
  qrPayload?: {
    type: string;
    qId: string;
    title: string;
    total: number;
    code: string;
    room?: string;
  };
  sbd?: string;
  examCode?: string;
  detectedAnswers?: Array<{
    questionIndex: number;
    selectedOption: string | null; // 'A' | 'B' | 'C' | 'D' | null
    confidence: number;
    isDoubleMarked?: boolean;
    fillRatios: { [key: string]: number };
  }>;
  warpedImageBase64?: string;
  markersDetected?: boolean;
}

/**
 * Biến đổi phối cảnh (Perspective Transform / Homography 4 điểm) từ ảnh gốc sang khung chuẩn A4 (1200 x 1700)
 */
export const warpPerspective = (
  srcCtx: CanvasRenderingContext2D,
  srcPoints: Array<{ x: number; y: number }>,
  dstWidth: number = 1200,
  dstHeight: number = 1700
): HTMLCanvasElement => {
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstWidth;
  dstCanvas.height = dstHeight;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return dstCanvas;

  // Lấy 4 điểm: [TL, TR, BR, BL]
  const [tl, tr, br, bl] = srcPoints;

  // Bilinear sampling trên canvas destination
  const srcImgData = srcCtx.getImageData(0, 0, srcCtx.canvas.width, srcCtx.canvas.height);
  const dstImgData = dstCtx.createImageData(dstWidth, dstHeight);
  const srcData = srcImgData.data;
  const dstData = dstImgData.data;
  const sw = srcImgData.width;
  const sh = srcImgData.height;

  for (let dy = 0; dy < dstHeight; dy++) {
    const v = dy / (dstHeight - 1);
    for (let dx = 0; dx < dstWidth; dx++) {
      const u = dx / (dstWidth - 1);

      // Nội suy toạ độ thực trên ảnh gốc (Bilinear Interpolation)
      const topX = tl.x + u * (tr.x - tl.x);
      const topY = tl.y + u * (tr.y - tl.y);
      const botX = bl.x + u * (br.x - bl.x);
      const botY = bl.y + u * (br.y - bl.y);

      const sx = Math.round(topX + v * (botX - topX));
      const sy = Math.round(topY + v * (botY - topY));

      const dstIdx = (dy * dstWidth + dx) * 4;
      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const srcIdx = (sy * sw + sx) * 4;
        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      } else {
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
};

/**
 * Tìm trọng tâm 4 góc marker màu đen ở 4 góc ảnh
 */
export const findCornerMarkers = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Array<{ x: number; y: number }> | null => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Chia 4 vùng góc (mỗi vùng chiếm 22% chiều rộng và chiều cao)
  const qw = Math.floor(width * 0.22);
  const qh = Math.floor(height * 0.22);

  const quadrants = [
    { name: 'TL', minX: 0, maxX: qw, minY: 0, maxY: qh },
    { name: 'TR', minX: width - qw, maxX: width, minY: 0, maxY: qh },
    { name: 'BR', minX: width - qw, maxX: width, minY: height - qh, maxY: height },
    { name: 'BL', minX: 0, maxX: qw, minY: height - qh, maxY: height },
  ];

  const corners: Array<{ x: number; y: number }> = [];

  for (const q of quadrants) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = q.minY; y < q.maxY; y += 2) {
      for (let x = q.minX; x < q.maxX; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Điểm cực tối (Marker đen < 65)
        if (lum < 65) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count < 50) {
      // Không phát hiện đủ điểm đen marker ở góc này -> fallback to quad bounding box
      if (q.name === 'TL') corners.push({ x: width * 0.04, y: height * 0.03 });
      else if (q.name === 'TR') corners.push({ x: width * 0.96, y: height * 0.03 });
      else if (q.name === 'BR') corners.push({ x: width * 0.96, y: height * 0.97 });
      else corners.push({ x: width * 0.04, y: height * 0.97 });
    } else {
      corners.push({ x: Math.round(sumX / count), y: Math.round(sumY / count) });
    }
  }

  return corners;
};

/**
 * Tính tỉ lệ tô đen (Black pixel ratio / Fill density) của một ô tròn tại tọa độ (cx, cy) bán kính r
 */
const measureBubbleFill = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number = 10
): number => {
  const rRound = Math.round(radius);
  const imgData = ctx.getImageData(cx - rRound, cy - rRound, rRound * 2, rRound * 2);
  const data = imgData.data;
  const totalPixels = rRound * 2 * (rRound * 2);
  let darkPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Ngưỡng tối được coi là có vết tô chì/mực
    if (lum < 115) {
      darkPixels++;
    }
  }

  return darkPixels / totalPixels;
};

/**
 * Hàm giải mã toàn bộ Phiếu làm bài trắc nghiệm OMR từ HTML5 Canvas
 */
export const processOmrSheet = async (
  sourceCanvas: HTMLCanvasElement,
  customTotalQuestions?: number
): Promise<OmrRecognitionResult> => {
  const srcCtx = sourceCanvas.getContext('2d');
  if (!srcCtx) {
    return { success: false, errorMessage: 'Không thể khởi tạo đồ họa Canvas' };
  }

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  // 1. Quét QR code
  let qrPayload: any = null;
  const fullImgData = srcCtx.getImageData(0, 0, w, h);
  const qrCode = jsQR(fullImgData.data, w, h, { inversionAttempts: 'dontInvert' });

  if (qrCode && qrCode.data) {
    try {
      qrPayload = JSON.parse(qrCode.data);
    } catch (e) {
      // payload không phải JSON
      qrPayload = { raw: qrCode.data };
    }
  }

  // 2. Tìm 4 góc Marker và nắn phẳng phối cảnh
  const cornerPoints = findCornerMarkers(srcCtx, w, h) || [
    { x: w * 0.04, y: h * 0.03 },
    { x: w * 0.96, y: h * 0.03 },
    { x: w * 0.96, y: h * 0.97 },
    { x: w * 0.04, y: h * 0.97 }
  ];

  const TARGET_W = 1200;
  const TARGET_H = 1700;
  const warpedCanvas = warpPerspective(srcCtx, cornerPoints, TARGET_W, TARGET_H);
  const warpedCtx = warpedCanvas.getContext('2d');
  if (!warpedCtx) {
    return { success: false, errorMessage: 'Lỗi nắn phối cảnh ảnh' };
  }

  const totalQ = qrPayload?.total || customTotalQuestions || 40;

  // 3. Đọc Số Báo Danh (SBD) từ vùng tương đối trên phiếu
  // Vùng SBD toạ độ chuẩn trên ảnh 1200 x 1700:
  // X: 720px đến 920px (4 cột) | Y: 330px đến 550px (10 hàng 0-9)
  const sbdDigits: number[] = [];
  const sbdStartX = 740;
  const sbdStepX = 46;
  const sbdStartY = 350;
  const sbdStepY = 20;

  for (let col = 0; col < 4; col++) {
    let maxFill = 0;
    let bestDigit = 0;

    for (let row = 0; row < 10; row++) {
      const bx = sbdStartX + col * sbdStepX;
      const by = sbdStartY + row * sbdStepY;
      const fill = measureBubbleFill(warpedCtx, bx, by, 8);

      if (fill > maxFill) {
        maxFill = fill;
        bestDigit = row;
      }
    }

    sbdDigits.push(maxFill > 0.22 ? bestDigit : 0);
  }
  const detectedSbd = sbdDigits.join('');

  // 4. Đọc Mã đề thi (3 chữ số)
  const codeStartX = 980;
  const codeStepX = 45;
  const codeDigits: number[] = [];

  for (let col = 0; col < 3; col++) {
    let maxFill = 0;
    let bestDigit = 1;

    for (let row = 0; row < 10; row++) {
      const bx = codeStartX + col * codeStepX;
      const by = sbdStartY + row * sbdStepY;
      const fill = measureBubbleFill(warpedCtx, bx, by, 8);

      if (fill > maxFill) {
        maxFill = fill;
        bestDigit = row;
      }
    }
    codeDigits.push(maxFill > 0.22 ? bestDigit : (col === 0 ? 1 : 0));
  }
  const detectedExamCode = codeDigits.join('');

  // 5. Đọc Đáp Án Các Câu Hỏi (Answers Grid)
  // Xác định số cột
  let itemsPerCol = 20;
  if (totalQ <= 20) itemsPerCol = 10;
  else if (totalQ <= 40) itemsPerCol = 20;
  else if (totalQ <= 50) itemsPerCol = 25;
  else itemsPerCol = 25;

  const numCols = Math.ceil(totalQ / itemsPerCol);
  const gridStartY = 640;
  const colWidth = (TARGET_W - 140) / numCols;
  const rowHeight = (TARGET_H - 720) / itemsPerCol;

  const detectedAnswers: OmrRecognitionResult['detectedAnswers'] = [];

  for (let q = 1; q <= totalQ; q++) {
    const colIdx = Math.floor((q - 1) / itemsPerCol);
    const rowIdx = (q - 1) % itemsPerCol;

    const colX = 70 + colIdx * colWidth;
    const rowY = gridStartY + rowIdx * rowHeight;

    // 4 toạ độ ô A, B, C, D
    const optionLabels = ['A', 'B', 'C', 'D'];
    const optStepX = (colWidth - 55) / 4;
    const optStartX = colX + 48;

    const fillRatios: { [key: string]: number } = {};
    let maxFill = 0;
    let secondFill = 0;
    let selectedOpt: string | null = null;

    optionLabels.forEach((opt, oIdx) => {
      const bx = Math.round(optStartX + oIdx * optStepX);
      const by = Math.round(rowY);
      const fill = measureBubbleFill(warpedCtx, bx, by, 9);
      fillRatios[opt] = fill;

      if (fill > maxFill) {
        secondFill = maxFill;
        maxFill = fill;
        selectedOpt = opt;
      } else if (fill > secondFill) {
        secondFill = fill;
      }
    });

    const isFilled = maxFill >= 0.26;
    const isDouble = isFilled && secondFill >= 0.24 && Math.abs(maxFill - secondFill) < 0.08;

    detectedAnswers.push({
      questionIndex: q,
      selectedOption: isFilled && !isDouble ? selectedOpt : (isFilled && isDouble ? selectedOpt : null),
      confidence: Math.min(1, Math.round(maxFill * 100) / 100),
      isDoubleMarked: isDouble,
      fillRatios
    });
  }

  // Chuyển canvas nắn phẳng sang Base64 để hiển thị xem trước
  const warpedImageBase64 = warpedCanvas.toDataURL('image/jpeg', 0.85);

  return {
    success: true,
    qrPayload: qrPayload?.type === 'OMR_QUIZ' ? qrPayload : undefined,
    sbd: detectedSbd,
    examCode: qrPayload?.code || detectedExamCode,
    detectedAnswers,
    warpedImageBase64,
    markersDetected: true
  };
};
