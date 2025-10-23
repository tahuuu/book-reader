import React from 'react';
import { Book } from '../types';
import { VolumeUpIcon } from './icons/VolumeUpIcon';

const ChevronLeftIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

const ChevronRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);


interface BookReaderProps {
  book: Book | null;
  currentPage: number;
  onPageChange: (newPage: number) => void;
}

const BookReader: React.FC<BookReaderProps> = ({ book, currentPage, onPageChange }) => {
    if (!book) {
        return (
          <div className="mt-4 text-center text-gray-500 dark:text-gray-400 min-h-[200px] flex flex-col items-center justify-center">
             <VolumeUpIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="font-semibold">Your book's text will appear here.</p>
            <p className="text-sm">Generate audio and select a track from the playlist below to begin.</p>
          </div>
        );
    }

    const pageText = book.pages[currentPage - 1] ?? 'Page not found.';
  
    return (
        <div className="mt-4 flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2" style={{maxHeight: 'calc(100vh - 480px)', minHeight: '200px'}}>
            <p className="whitespace-pre-wrap leading-relaxed text-base">{pageText}</p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
            >
                <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <span className="font-medium text-sm text-gray-600 dark:text-gray-400 w-28 text-center">
                Page {currentPage} of {book.pages.length}
            </span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= book.pages.length}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next Page"
            >
                <ChevronRightIcon className="w-6 h-6" />
            </button>
            </div>
        </div>
    );
};

export default BookReader;