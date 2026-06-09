import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Converts a .doc buffer to a .docx buffer.
 * Tries LibreOffice soffice first. If it fails and the platform is Windows,
 * tries Microsoft Word COM automation via PowerShell.
 * 
 * @param {Buffer} docBuffer - The legacy .doc file content
 * @returns {Promise<Buffer>} - The converted .docx file content
 */
export const convertDocToDocx = async (docBuffer) => {
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const randomId = `conv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const docPath = path.join(tempDir, `${randomId}.doc`);
  const docxPath = path.join(tempDir, `${randomId}.docx`);
  const psScriptPath = path.join(tempDir, `${randomId}.ps1`);

  // Write original doc buffer to temp file
  fs.writeFileSync(docPath, docBuffer);

  let conversionSuccess = false;

  // 1. Try LibreOffice (soffice) first (works on Windows/Linux if LibreOffice is installed)
  try {
    // Escape paths for safety
    await execPromise(`soffice --headless --convert-to docx --outdir "${tempDir}" "${docPath}"`);
    if (fs.existsSync(docxPath)) {
      conversionSuccess = true;
      console.log(`[docConverter] converted ${randomId}.doc to docx using LibreOffice`);
    }
  } catch (err) {
    console.warn('[docConverter] LibreOffice conversion failed or is not installed. Error:', err.message);
  }

  // 2. Try MS Word COM automation via PowerShell if LibreOffice failed and platform is Windows
  if (!conversionSuccess && process.platform === 'win32') {
    console.log('[docConverter] Trying MS Word COM automation via PowerShell...');
    
    // Create PowerShell script content
    const psScriptContent = `
$ErrorActionPreference = "Stop"
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open("${docPath.replace(/\\/g, '\\\\')}", $false, $true)
    $doc.SaveAs("${docxPath.replace(/\\/g, '\\\\')}", 16)
    $doc.Close()
    $word.Quit()
    exit 0
} catch {
    if ($word) { $word.Quit() }
    Write-Error $_.Exception.Message
    exit 1
}
`;

    try {
      fs.writeFileSync(psScriptPath, psScriptContent, 'utf-8');
      await execPromise(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`);
      if (fs.existsSync(docxPath)) {
        conversionSuccess = true;
        console.log(`[docConverter] converted ${randomId}.doc to docx using MS Word COM`);
      }
    } catch (err) {
      console.error('[docConverter] MS Word COM conversion failed. Error:', err.message);
    }
  }

  // Read the converted file, clean up all temp files, and return
  try {
    if (conversionSuccess && fs.existsSync(docxPath)) {
      const docxBuffer = fs.readFileSync(docxPath);
      return docxBuffer;
    } else {
      throw new Error(
        'Không thể chuyển đổi file .doc sang .docx. Hệ thống yêu cầu máy chủ phải cài đặt LibreOffice hoặc Microsoft Word (trên Windows) để tự động chuyển đổi.'
      );
    }
  } finally {
    // Clean up files safely
    if (fs.existsSync(docPath)) fs.unlinkSync(docPath);
    if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
    if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);
  }
};
