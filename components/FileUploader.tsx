
import React, { useState, useCallback } from 'react';
import { Book } from '../types';
import { parseBookFile } from '../services/bookParser';
import { UploadIcon } from './icons/UploadIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface FileUploaderProps {
  onBookParsed: (book: Book) => void;
  setError: (error: string | null) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onBookParsed, setError }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && file.type !== 'application/epub+zip') {
        setError('Invalid file type. Please upload a PDF or EPUB file.');
        return;
    }

    setIsParsing(true);
    setError(null);
    try {
      const book = await parseBookFile(file);
      onBookParsed(book);
    } catch (err) {
      console.error('File parsing error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during file parsing.');
    } finally {
      setIsParsing(false);
    }
  }, [onBookParsed, setError]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  }, [handleFile]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="flex items-center justify-center">
        <div className="w-full max-w-2xl">
            <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer bg-card-light dark:bg-card-dark transition-colors duration-300 ${isDragging ? 'border-primary' : 'border-border-light dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'}`}
            >
            {isParsing ? (
                <div className="flex flex-col items-center justify-center">
                    <SpinnerIcon className="w-12 h-12 text-primary" />
                    <p className="mt-4 text-lg font-semibold">Parsing your book...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This may take a moment.</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <UploadIcon className="w-10 h-10 mb-4 text-gray-500 dark:text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF or EPUB files</p>
                    <input id="dropzone-file" type="file" className="hidden" accept=".pdf,.epub" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : null)} />
                    <label htmlFor="dropzone-file" className="absolute inset-0 cursor-pointer"></label>
                </div>
            )}
            </div>
        </div>
    </div>
  );
};

export default FileUploader;
