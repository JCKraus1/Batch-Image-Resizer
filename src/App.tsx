/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Version: 1.0.1 - Triggering GitHub Sync
import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, X, Image as ImageIcon, CheckCircle2, AlertCircle, Settings2, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface FileStatus {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  compressedBlob?: Blob;
  error?: string;
  originalSize: number;
  compressedSize?: number;
}

export default function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxSizeMB, setMaxSizeMB] = useState(1);
  const [maxWidthOrHeight, setMaxWidthOrHeight] = useState(1920);
  const [quality, setQuality] = useState(0.8);
  const [outputFormat, setOutputFormat] = useState<string>('original');
  const [preserveExif, setPreserveExif] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(file => {
      const isImage = file.type.startsWith('image/');
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      return isImage || isHeic;
    });
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const newFileStatuses: FileStatus[] = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'pending',
      originalSize: file.size,
    }));
    setFiles(prev => [...prev, ...newFileStatuses]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = (Array.from(e.target.files) as File[]).filter(file => {
        const isImage = file.type.startsWith('image/');
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        return isImage || isHeic;
      });
      addFiles(selectedFiles);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const processFiles = async () => {
    setIsProcessing(true);
    
    const options = {
      maxSizeMB,
      maxWidthOrHeight,
      initialQuality: quality,
      useWebWorker: true,
      preserveExif,
      fileType: outputFormat === 'original' ? undefined : outputFormat,
      onProgress: (progress: number) => {
        // This progress is per file, we'll handle it inside the loop
      },
    };

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === 'completed') continue;

      try {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
        
        const compressedFile = await imageCompression(updatedFiles[i].file, {
          ...options,
          onProgress: (progress) => {
            setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
          }
        });

        setFiles(prev => prev.map((f, idx) => idx === i ? { 
          ...f, 
          status: 'completed', 
          progress: 100, 
          compressedBlob: compressedFile,
          compressedSize: compressedFile.size
        } : f));
      } catch (error) {
        console.error('Compression error:', error);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Failed to compress' } : f));
      }
    }

    setIsProcessing(false);
  };

  const getNewFilename = (originalName: string, blob: Blob) => {
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const extension = blob.type.split('/')[1] || 'jpg';
    // Map common mime subtypes to extensions
    const extMap: Record<string, string> = {
      'jpeg': 'jpg',
      'png': 'png',
      'webp': 'webp'
    };
    return `${nameWithoutExt}.${extMap[extension] || extension}`;
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    files.forEach(f => {
      if (f.compressedBlob) {
        const filename = outputFormat === 'original' ? f.file.name : getNewFilename(f.file.name, f.compressedBlob);
        zip.file(filename, f.compressedBlob);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compressed_images.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="./LSCG_LOGO_B&W.png" 
              alt="LSCG Logo" 
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Batch Image Resizer</h1>
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Professional Image Optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {files.length > 0 && (
              <button 
                onClick={clearAll}
                className="text-sm font-medium text-stone-500 hover:text-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Settings Panel */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
              <div className="flex items-center gap-2 mb-6">
                <Settings2 size={20} className="text-emerald-600" />
                <h2 className="font-bold text-lg">Compression Settings</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-stone-700">Target Max Size (MB)</label>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="10" 
                    step="0.1" 
                    value={maxSizeMB}
                    onChange={(e) => setMaxSizeMB(parseFloat(e.target.value))}
                    className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs font-mono mt-2 text-stone-500">
                    <span>0.1MB</span>
                    <span className="text-emerald-700 font-bold">{maxSizeMB}MB</span>
                    <span>10MB</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-sm font-bold text-stone-500 hover:text-emerald-600 transition-colors py-2"
                  >
                    <span>Advanced Settings</span>
                    {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-6 pt-4"
                      >
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-stone-700">Image Quality</label>
                          <input 
                            type="range" 
                            min="0.1" 
                            max="1.0" 
                            step="0.05" 
                            value={quality}
                            onChange={(e) => setQuality(parseFloat(e.target.value))}
                            className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                          <div className="flex justify-between text-xs font-mono mt-2 text-stone-500">
                            <span>Low</span>
                            <span className="text-emerald-700 font-bold">{Math.round(quality * 100)}%</span>
                            <span>High</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-stone-700">Output Format</label>
                          <select 
                            value={outputFormat}
                            onChange={(e) => setOutputFormat(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          >
                            <option value="original">Original Format</option>
                            <option value="image/jpeg">JPEG (.jpg)</option>
                            <option value="image/png">PNG (.png)</option>
                            <option value="image/webp">WebP (.webp)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-stone-700">Max Dimension (px)</label>
                          <select 
                            value={maxWidthOrHeight}
                            onChange={(e) => setMaxWidthOrHeight(parseInt(e.target.value))}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          >
                            <option value={800}>800px (Small)</option>
                            <option value={1200}>1200px (Medium)</option>
                            <option value={1920}>1920px (Full HD)</option>
                            <option value={2560}>2560px (2K)</option>
                            <option value={3840}>3840px (4K)</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div>
                            <label className="block text-sm font-semibold text-stone-700">Preserve EXIF Data</label>
                            <p className="text-[10px] text-stone-400 leading-tight">Keep camera info, GPS, and metadata</p>
                          </div>
                          <button 
                            onClick={() => setPreserveExif(!preserveExif)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${preserveExif ? 'bg-emerald-600' : 'bg-stone-200'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preserveExif ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4">
                  <button
                    onClick={processFiles}
                    disabled={files.length === 0 || isProcessing}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200",
                      files.length === 0 || isProcessing 
                        ? "bg-stone-300 shadow-none cursor-not-allowed" 
                        : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ImageIcon size={20} />
                        Start Batch Conversion
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {files.some(f => f.status === 'completed') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200"
              >
                <h3 className="font-bold text-lg mb-2">Ready for Download</h3>
                <p className="text-emerald-50/80 text-sm mb-6">All processed images can be downloaded as a single ZIP archive.</p>
                <button 
                  onClick={downloadAll}
                  className="w-full bg-white text-emerald-700 py-4 rounded-2xl font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download All (ZIP)
                </button>
              </motion.div>
            )}
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Drop Zone */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group"
            >
              <input 
                type="file" 
                multiple 
                accept="image/*,.heic,.heif" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="text-stone-400 group-hover:text-emerald-600 transition-colors" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Drop your images here</h3>
              <p className="text-stone-500 text-sm max-w-xs mx-auto">
                Support for JPG, PNG, WebP, and HEIC. Batch process as many as you need.
              </p>
            </div>

            {/* File List */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {files.map((fileStatus) => (
                  <motion.div
                    key={fileStatus.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl p-4 border border-stone-200 flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 overflow-hidden">
                      <ImageIcon size={20} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-sm truncate pr-4">{fileStatus.file.name}</h4>
                        <span className="text-[10px] font-mono text-stone-400 uppercase">
                          {formatSize(fileStatus.originalSize)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${fileStatus.progress}%` }}
                            className={cn(
                              "h-full transition-all duration-300",
                              fileStatus.status === 'error' ? "bg-red-500" : "bg-emerald-500"
                            )}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-stone-500 w-8">
                          {Math.round(fileStatus.progress)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pl-2">
                      {fileStatus.status === 'completed' && (
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end">
                            <CheckCircle2 size={12} />
                            SAVED {Math.round((1 - (fileStatus.compressedSize! / fileStatus.originalSize)) * 100)}%
                          </div>
                          <div className="text-[10px] font-mono text-stone-400">
                            {formatSize(fileStatus.compressedSize!)}
                          </div>
                        </div>
                      )}
                      
                      {fileStatus.status === 'error' && (
                        <div className="text-red-500" title={fileStatus.error}>
                          <AlertCircle size={20} />
                        </div>
                      )}

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(fileStatus.id);
                        }}
                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {files.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-stone-400 text-sm italic">No files added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-stone-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-stone-400 text-sm">
          <p>© 2026 LSCG Batch Image Resizer. All processing happens in your browser.</p>
        </div>
      </footer>
    </div>
  );
}
