import React, { useEffect, useRef, useState } from 'react';
import * as docx from 'docx-preview';
import { resumeService } from '../../services/resume.service';
import {
  Download,
  ShieldCheck,
  AlertCircle,
  Loader2,
  FileText,
  RefreshCw,
  ExternalLink,
  Check,
  Copy,
} from 'lucide-react';

interface MasterDocumentPreviewProps {
  resumeId: string;
  originalFilename?: string | null;
  fileSha256?: string | null;
  fileType?: string | null;
  isTailored?: boolean;
  onSwitchToStructured?: () => void;
}

export const MasterDocumentPreview: React.FC<MasterDocumentPreviewProps> = ({
  resumeId,
  originalFilename,
  fileSha256,
  fileType: initialFileType,
  isTailored,
  onSwitchToStructured,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'missing' | 'forbidden' | 'unsupported' | 'integrity' | 'generic'>('generic');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<'pdf' | 'docx' | 'unsupported'>('pdf');
  const [resolvedFilename, setResolvedFilename] = useState<string>(originalFilename || 'master_resume');
  const [resolvedSha256, setResolvedSha256] = useState<string>(fileSha256 || '');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Clean up Object URL on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const loadDocument = async () => {
    if (!resumeId) {
      setError('Invalid resume identifier.');
      setErrorType('generic');
      setLoading(false);
      return;
    }

    if (isTailored) {
      setError('Original document preview is only available for master resumes. Tailored resumes are generated representations.');
      setErrorType('unsupported');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Clean previous objectUrl
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }

      const result = await resumeService.fetchOriginalMasterBlob(resumeId);
      setBlob(result.blob);
      setResolvedFilename(result.filename || originalFilename || 'master_resume');
      if (result.sha256) {
        setResolvedSha256(result.sha256);
      }

      // Determine format
      const lowerName = (result.filename || originalFilename || '').toLowerCase();
      let format: 'pdf' | 'docx' | 'unsupported' = 'pdf';
      if (result.fileType === 'docx' || lowerName.endsWith('.docx')) {
        format = 'docx';
      } else if (result.fileType === 'pdf' || lowerName.endsWith('.pdf')) {
        format = 'pdf';
      } else {
        format = 'unsupported';
      }
      setDetectedFormat(format);

      if (format === 'unsupported') {
        setError('Unsupported master resume format. Only original PDF and DOCX files are supported.');
        setErrorType('unsupported');
        setLoading(false);
        return;
      }

      // For PDF, generate a clean object URL for inline embedding
      if (format === 'pdf') {
        const url = URL.createObjectURL(result.blob);
        setObjectUrl(url);
      }
    } catch (err: any) {
      console.error('Failed to retrieve original master resume:', err);
      const msg = err.message || '';
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not available')) {
        setError('The original master document file could not be located in secure storage. It may have been removed or created manually without a file upload.');
        setErrorType('missing');
      } else if (msg.includes('403') || msg.includes('401') || msg.includes('access denied')) {
        setError('Access denied. You do not have permission to view or download this document.');
        setErrorType('forbidden');
      } else if (msg.includes('integrity') || msg.includes('mismatch') || msg.includes('SHA-256')) {
        setError('Document verification failed: Cryptographic SHA-256 integrity signature did not match the original upload. File access blocked for security.');
        setErrorType('integrity');
      } else if (msg.includes('415') || msg.includes('Unsupported')) {
        setError('Unsupported master resume format. Only original PDF and DOCX documents can be previewed.');
        setErrorType('unsupported');
      } else {
        setError(msg || 'Unable to load original document preview. Please check network connection and try again.');
        setErrorType('generic');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [resumeId]);

  // DOCX Rendering effect using docx-preview
  useEffect(() => {
    if (!loading && detectedFormat === 'docx' && blob && docxContainerRef.current) {
      const container = docxContainerRef.current;
      container.innerHTML = '';

      docx
        .renderAsync(blob, container, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        })
        .catch((renderErr: any) => {
          console.error('docx-preview rendering error:', renderErr);
          setError('Failed to render DOCX document layout in browser. You can still download the original unmodified file.');
        });
    }
  }, [loading, detectedFormat, blob]);

  const handleDownloadOriginal = async () => {
    setIsDownloading(true);
    try {
      if (blob) {
        // Direct download of the exact bytes already verified in memory
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resolvedFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        await resumeService.downloadOriginalMasterFile(resumeId);
      }
    } catch (err: any) {
      console.error('Download original failed:', err);
      alert(err.message || 'Failed to download original master resume.');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyShaToClipboard = () => {
    if (resolvedSha256) {
      navigator.clipboard.writeText(resolvedSha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Immutability & Document Integrity Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-semibold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Original Master Document
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Byte-for-Byte Unmodified
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {detectedFormat.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>File: <strong className="text-slate-700 dark:text-slate-200">{resolvedFilename}</strong></span>
              {resolvedSha256 && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    onClick={copyShaToClipboard}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    title={`Cryptographic SHA-256: ${resolvedSha256} (Click to copy)`}
                  >
                    <span>SHA-256: <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{resolvedSha256.slice(0, 10)}...{resolvedSha256.slice(-8)}</code></span>
                    {copiedSha ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Download Original Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isDownloading || loading || !!error}
            onClick={handleDownloadOriginal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Download the exact, unmodified file that was originally uploaded"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading Original...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Original ({detectedFormat.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Loading State */}
      {loading && (
        <div className="bg-slate-100 dark:bg-slate-900/60 p-12 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center min-h-[450px]">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Retrieving Original Master Document...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Validating cryptographic SHA-256 immutability signature from secure private storage.
          </p>
        </div>
      )}

      {/* 3. Error State */}
      {!loading && error && (
        <div className="bg-red-50 dark:bg-red-950/40 p-6 rounded-xl border border-red-200 dark:border-red-800 text-slate-800 dark:text-slate-200 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                {errorType === 'missing' && 'Original Document Not Found'}
                {errorType === 'forbidden' && 'Access Forbidden'}
                {errorType === 'integrity' && 'Security Alert: SHA-256 Tamper Detected'}
                {errorType === 'unsupported' && 'Unsupported Document Format'}
                {errorType === 'generic' && 'Unable to Display Document Preview'}
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                {error}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-red-200 dark:border-red-800/60">
            <button
              type="button"
              onClick={loadDocument}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>

            {blob && (
              <button
                type="button"
                onClick={handleDownloadOriginal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Unmodified File Anyway</span>
              </button>
            )}

            {onSwitchToStructured && (
              <button
                type="button"
                onClick={onSwitchToStructured}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <span>Switch to Structured Template View &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. PDF Preview Viewer */}
      {!loading && !error && detectedFormat === 'pdf' && objectUrl && (
        <div className="w-full bg-slate-200 dark:bg-slate-950 p-2 sm:p-4 rounded-xl border border-slate-300 dark:border-slate-800 flex justify-center">
          <div className="w-full max-w-[210mm] bg-white rounded-lg shadow-md overflow-hidden">
            <object
              data={`${objectUrl}#toolbar=1&navpanes=0`}
              type="application/pdf"
              className="w-full h-[850px] rounded-lg border-0"
              title={`Original PDF: ${resolvedFilename}`}
            >
              <iframe
                src={`${objectUrl}#toolbar=1&navpanes=0`}
                className="w-full h-[850px] rounded-lg border-0"
                title={`Original PDF Viewer: ${resolvedFilename}`}
              >
                <div className="p-8 text-center text-xs text-slate-500">
                  <p>Your browser does not support embedded PDF preview.</p>
                  <button
                    onClick={handleDownloadOriginal}
                    className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded text-xs"
                  >
                    Download Original PDF
                  </button>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      )}

      {/* 5. DOCX Preview Viewer */}
      {!loading && !error && detectedFormat === 'docx' && (
        <div className="w-full bg-slate-200 dark:bg-slate-950 p-2 sm:p-6 rounded-xl border border-slate-300 dark:border-slate-800 flex justify-center min-h-[500px]">
          <div className="w-full max-w-[210mm] shadow-lg rounded-sm overflow-hidden bg-white">
            <style>{`
              .docx-preview-container .docx-wrapper {
                background: transparent !important;
                padding: 1.5rem !important;
              }
              .docx-preview-container .docx-wrapper > section.docx {
                background: #ffffff !important;
                color: #0f172a !important;
                margin: 0 auto 1.5rem auto !important;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
                border-radius: 2px !important;
                padding: 2.5rem !important;
                box-sizing: border-box !important;
              }
              .docx-preview-container table {
                border-collapse: collapse !important;
                width: 100% !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              .docx-preview-container table td, .docx-preview-container table th {
                border: 1px solid #cbd5e1 !important;
                padding: 0.4rem 0.6rem !important;
              }
            `}</style>
            <div ref={docxContainerRef} className="docx-preview-container" />
          </div>
        </div>
      )}
    </div>
  );
};
