import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { validateDropzoneFile } from '../../utils/validators';

interface DropzoneProps {
  onFileSelect: (file: File, base64: string) => void;
  accept?: string;
  maxSizeBytes?: number;
  previewUrl?: string | null;
  onClear?: () => void;
  title?: string;
  subtitle?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  accept = 'image/png, image/jpeg, image/webp, application/pdf',
  previewUrl,
  onClear,
  title = 'Kéo thả ảnh hóa đơn chuyển khoản hoặc VietQR vào đây',
  subtitle = 'Hỗ trợ PNG, JPG, WEBP, PDF tối đa 10MB'
}) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setErrorMessage(null);
    const validation = validateDropzoneFile({
      name: file.name,
      sizeBytes: file.size,
      type: file.type
    });

    if (!validation.accepted) {
      setErrorMessage(validation.error || 'Tệp không hợp lệ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onFileSelect(file, base64);
    };
    reader.onerror = () => {
      setErrorMessage('Lỗi khi đọc dữ liệu tệp');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      {previewUrl ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900/60 dark:border-slate-700 dark:bg-slate-900/60 light:border-slate-200 light:bg-slate-50 p-2 flex flex-col items-center">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-64 object-contain rounded-xl shadow-lg"
          />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-950/80 text-slate-300 hover:text-white hover:bg-red-600 transition shadow-lg dark:bg-slate-950/80 dark:text-slate-300 light:bg-white/90 light:text-slate-700 light:hover:text-white light:shadow-md"
              title="Xóa ảnh"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99] dark:bg-indigo-500/10 light:bg-indigo-50/50'
              : 'border-slate-700 hover:border-indigo-500/60 hover:bg-slate-800/40 bg-slate-900/30 dark:border-slate-700 dark:hover:bg-slate-800/40 dark:bg-slate-900/30 light:border-slate-300 light:hover:border-indigo-400 light:hover:bg-slate-100/70 light:bg-slate-50/80'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 light:bg-indigo-50 light:text-indigo-600 light:border-indigo-200 mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h4 className="text-sm font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800">{title}</h4>
          <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 mt-1 max-w-sm">{subtitle}</p>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-indigo-400 font-medium bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20 light:text-indigo-700 light:bg-indigo-50 light:border-indigo-200">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Hoặc nhấn để chọn tệp từ máy tính</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 light:bg-red-50 light:border-red-200 light:text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
