import React, { useState, useRef, useEffect } from 'react';
import { Book, AudioSegment } from '../types';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData, concatAudioBuffers, formatTime } from '../utils/audioUtils';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { NowPlayingIcon } from './icons/NowPlayingIcon';
import { PlaylistIcon } from './icons/PlaylistIcon';

const MAX_CHARS_PER_REQUEST = 4500;
const SECONDS_PER_CHUNK = 1.2; // Estimated time per API call for countdown

interface AudioControllerProps {
  book: Book;
  audioSegments: AudioSegment[];
  setAudioSegments: React.Dispatch<React.SetStateAction<AudioSegment[]>>;
  currentSegment: AudioSegment | null;
  isPlaying: boolean;
  handlePlaybackRequest: (segment: AudioSegment) => void;
  setError: (error: string | null) => void;
  onAutoplayFirstSegment: (segment: AudioSegment) => void;
  // Player props
  duration: number;
  currentTime: number;
  playbackRate: number;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const AudioController: React.FC<AudioControllerProps> = ({
  book,
  audioSegments,
  setAudioSegments,
  currentSegment,
  isPlaying,
  handlePlaybackRequest,
  setError,
  onAutoplayFirstSegment,
  duration,
  currentTime,
  playbackRate,
  onPlaybackStateChange,
  onSeek,
  onPlaybackRateChange
}) => {
  const [fromPage, setFromPage] = useState<number | ''>(1);
  const [toPage, setToPage] = useState<number | ''>(Math.min(10, book.pages.length));
  const [generationStatus, setGenerationStatus] = useState({
    isGenerating: false,
    progress: 0,
    total: 0,
    message: '',
    estimatedTime: 0,
  });
  const [isHoveringStop, setIsHoveringStop] = useState(false);
  
  const isSeekingRef = useRef(false);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (generationStatus.isGenerating && generationStatus.estimatedTime > 0) {
      const timer = setInterval(() => {
        setGenerationStatus(prev => ({
          ...prev,
          estimatedTime: Math.max(0, prev.estimatedTime - 1)
        }));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [generationStatus.isGenerating, generationStatus.estimatedTime]);


  const handlePageInputChange = (
    value: string, 
    setter: React.Dispatch<React.SetStateAction<number | ''>>
  ) => {
      if (value === '') {
          setter('');
          return;
      }
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) {
          setter(num);
      }
  };

  const getSentencesFromText = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    const sentences = text.split(/(?<=[.!?\n\r]+)\s*/);
    return sentences.filter(s => s && s.trim().length > 0);
  };

  const calculateChunks = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const sentences = getSentencesFromText(text);
    const textChunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if (sentence.length > MAX_CHARS_PER_REQUEST) {
            if (currentChunk) {
                textChunks.push(currentChunk);
                currentChunk = '';
            }
            for (let i = 0; i < sentence.length; i += MAX_CHARS_PER_REQUEST) {
                textChunks.push(sentence.substring(i, i + MAX_CHARS_PER_REQUEST));
            }
        } else if ((currentChunk + sentence).length > MAX_CHARS_PER_REQUEST) {
            textChunks.push(currentChunk);
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    if (currentChunk) {
        textChunks.push(currentChunk);
    }
    return textChunks;
  };

  const formatCountdown = (seconds: number): string => {
    const totalSeconds = Math.ceil(seconds);
    if (totalSeconds <= 0) return '';
    if (totalSeconds < 5) return 'Finishing up...';
    if (totalSeconds < 60) return `About ${totalSeconds} seconds remaining`;
    
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (remainingSeconds === 0) {
      return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
    }
    
    return `About ${minutes} minute${minutes > 1 ? 's' : ''}, ${remainingSeconds} seconds remaining`;
  };

  const handleStop = () => {
    isCancelledRef.current = true;
    setGenerationStatus(prev => ({...prev, message: 'Cancelling generation...'}));
  };

  const handleGenerate = async () => {
    const from = Number(fromPage);
    const to = Number(toPage);

    if (isNaN(from) || isNaN(to) || from > to || from < 1 || to > book.pages.length) {
      setError('Invalid page range.');
      return;
    }

    isCancelledRef.current = false;
    setError(null);

    // Pre-calculate total chunks for estimation
    let totalChunks = 0;
    for (let i = from; i <= to; i++) {
        const pageText = book.pages[i - 1];
        totalChunks += calculateChunks(pageText).length;
    }
    const initialEstimate = totalChunks * SECONDS_PER_CHUNK;

    setGenerationStatus({
      isGenerating: true,
      progress: 0,
      total: to - from + 1,
      message: 'Starting generation...',
      estimatedTime: initialEstimate,
    });

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      for (let pageNum = from; pageNum <= to; pageNum++) {
        if (isCancelledRef.current) break;

        const pageIndex = pageNum - 1;
        const textToProcess = book.pages[pageIndex];

        setGenerationStatus(prev => ({ ...prev, message: `Processing page ${pageNum}...` }));

        if (!textToProcess.trim()) {
          setGenerationStatus(prev => ({ ...prev, progress: prev.progress + 1 }));
          continue;
        }

        const textChunks = calculateChunks(textToProcess);
        
        const base64AudioChunks = await Promise.all(
          textChunks.map(chunk => generateSpeech(chunk))
        );
        
        const audioBuffers = await Promise.all(
          base64AudioChunks.map(base64 => decodeAudioData(decode(base64), outputAudioContext))
        );

        if (isCancelledRef.current) break;

        if (audioBuffers.length === 0) {
          setGenerationStatus(prev => ({ ...prev, progress: prev.progress + 1 }));
          continue;
        }

        const combinedAudioBuffer = audioBuffers.length > 1
          ? concatAudioBuffers(audioBuffers, outputAudioContext)
          : audioBuffers[0];

        const newSegment: AudioSegment = {
          id: `segment-${Date.now()}-${pageNum}`,
          text: textToProcess,
          audio: combinedAudioBuffer,
          pageRange: { from: pageNum, to: pageNum },
        };

        setAudioSegments(prev => [...prev, newSegment]);

        if (pageNum === from) {
          onAutoplayFirstSegment(newSegment);
        }
        
        setGenerationStatus(prev => ({ ...prev, progress: prev.progress + 1 }));
      }
    } catch (err) {
      if (!isCancelledRef.current) {
        console.error("Audio generation failed:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred during audio generation.');
      }
    } finally {
      if (isCancelledRef.current) {
        setError("Audio generation was cancelled by the user.");
      }
      isCancelledRef.current = false;
      setGenerationStatus({ isGenerating: false, progress: 0, total: 0, message: '', estimatedTime: 0 });
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSeekingRef.current) return;
    const newTime = parseFloat(event.target.value);
    onSeek(newTime); 
  };

  const handleRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPlaybackRateChange(parseFloat(event.target.value));
  };
  
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getSegmentTitle = (segment: AudioSegment) => {
    if (segment.pageRange.from === segment.pageRange.to) {
      return `Page ${segment.pageRange.from}`;
    }
    return `Pages ${segment.pageRange.from} - ${segment.pageRange.to}`;
  };

  return (
    <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-lg border border-border-light dark:border-border-dark">
      {/* --- Generator --- */}
      <div>
        <h3 className="text-lg font-bold mb-4">Generate Audio</h3>
        <div className="flex items-end gap-4 mb-4">
          <div className="flex-1">
            <label htmlFor="fromPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Page</label>
            <input type="number" id="fromPage" value={fromPage} onChange={(e) => handlePageInputChange(e.target.value, setFromPage)} min="1" max={book.pages.length} className="mt-1 block w-full rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:border-primary focus:bg-white dark:focus:bg-gray-800 focus:ring-0" disabled={generationStatus.isGenerating} />
          </div>
          <div className="flex-1">
            <label htmlFor="toPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To Page</label>
            <input type="number" id="toPage" value={toPage} onChange={(e) => handlePageInputChange(e.target.value, setToPage)} min="1" max={book.pages.length} className="mt-1 block w-full rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:border-primary focus:bg-white dark:focus:bg-gray-800 focus:ring-0" disabled={generationStatus.isGenerating} />
          </div>
        </div>
        <button
            onClick={() => {
                if (generationStatus.isGenerating) {
                    if (isHoveringStop) handleStop();
                } else {
                    handleGenerate();
                }
            }}
            onMouseEnter={() => setIsHoveringStop(true)}
            onMouseLeave={() => setIsHoveringStop(false)}
            className={`w-full font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors duration-200 ease-in-out
                ${generationStatus.isGenerating
                    ? (isHoveringStop
                        ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                        : 'bg-primary text-white cursor-wait')
                    : 'bg-primary text-white hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-focus cursor-pointer'
                }
            `}
        >
            {generationStatus.isGenerating ? (
                isHoveringStop ? (
                    'Stop Generating'
                ) : (
                    <>
                        <SpinnerIcon className="w-5 h-5 mr-2" />
                        Generating...
                    </>
                )
            ) : (
                'Generate Audio'
            )}
        </button>
        {generationStatus.isGenerating && (
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 truncate">{generationStatus.message}</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${generationStatus.total > 0 ? (generationStatus.progress / generationStatus.total) * 100 : 0}%`, transition: 'width 0.2s ease-in-out' }}></div>
            </div>
            <div className="flex justify-between items-center mt-1">
                 <p className="text-xs text-gray-500 dark:text-gray-400 text-left min-h-[16px]">
                  {formatCountdown(generationStatus.estimatedTime)}
                 </p>
                 <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {`Page ${generationStatus.progress} of ${generationStatus.total}`}
                 </p>
            </div>
          </div>
        )}
      </div>

      {/* --- Player & Playlist --- */}
      {audioSegments.length > 0 && (
        <>
            <hr className="my-6 border-border-light dark:border-border-dark" />
            
            {/* --- Player --- */}
            <div className="flex flex-col items-center justify-center gap-4 mb-6">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {currentSegment ? `Now Playing: ${getSegmentTitle(currentSegment)}` : 'Select a track to play'}
                </p>
                <button onClick={() => onPlaybackStateChange(!isPlaying)} className="bg-primary text-white rounded-full p-4 hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-focus dark:focus:ring-offset-card-dark transition-transform active:scale-95">
                    {isPlaying && currentSegment ? <PauseIcon className="w-8 h-8"/> : <PlayIcon className="w-8 h-8"/>}
                </button>
                <div className="w-full flex flex-col gap-2">
                  <div className="w-full flex items-center gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-mono w-12 text-center">{formatTime(currentTime)}</span>
                      <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full group">
                          <input
                              type="range"
                              min="0"
                              max={duration}
                              step="0.1"
                              value={currentTime}
                              onMouseDown={() => isSeekingRef.current = true}
                              onChange={handleSeek}
                              onMouseUp={() => {
                                  isSeekingRef.current = false;
                                  onSeek(parseFloat((event?.target as HTMLInputElement)?.value));
                              }}
                              className="absolute w-full h-full top-0 left-0 appearance-none bg-transparent cursor-pointer"
                          />
                          <div className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none" style={{width: `${progressPercent}%`}}></div>
                          <div className="absolute top-1/2 left-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-300 rounded-full shadow-md border-2 border-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{left: `${progressPercent}%`}}></div>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 font-mono w-12 text-center">{formatTime(duration)}</span>
                  </div>
                   {/* --- Speed Control --- */}
                  <div className="w-full flex items-center gap-3 text-sm mt-1 px-1">
                      <label htmlFor="speed-control" className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap text-xs">Speed</label>
                      <input
                          id="speed-control"
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={playbackRate}
                          onChange={handleRateChange}
                          className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer speed-control-slider"
                          style={{ flexGrow: 1 }}
                      />
                      <span className="text-gray-600 dark:text-gray-300 font-mono w-12 text-center text-xs">{playbackRate.toFixed(1)}x</span>
                  </div>
                </div>
            </div>

            {/* --- Playlist --- */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <PlaylistIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <h4 className="font-bold">Playlist</h4>
                </div>
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {audioSegments.map((segment) => {
                        const isActive = currentSegment?.id === segment.id;
                        return (
                            <li key={segment.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                               <div className="flex items-center gap-2 overflow-hidden">
                                    {isActive && isPlaying && <NowPlayingIcon className="w-4 h-4 text-primary flex-shrink-0"/>}
                                    <span className={`font-medium text-sm truncate ${isActive ? 'text-primary' : ''}`}>
                                        {getSegmentTitle(segment)}
                                    </span>
                                </div>
                                <button onClick={() => handlePlaybackRequest(segment)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0">
                                    {isActive && isPlaying ? <PauseIcon className="w-5 h-5 text-primary"/> : <PlayIcon className="w-5 h-5 text-primary"/>}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </>
      )}
       <style>{`
            /* This generic style makes the thumb transparent for sliders where we use a custom div for the thumb (like the main seek bar) */
            input[type=range].appearance-none::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                cursor: pointer;
                background: transparent;
            }
             input[type=range].appearance-none::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                cursor: pointer;
                border: 0;
                background: transparent;
            }
            
            /* These specific styles make the speed slider's thumb visible */
            .speed-control-slider::-webkit-slider-thumb {
              background: #4f46e5;
              margin-top: -5px; /* Vertically center thumb on track */
            }
            .speed-control-slider::-moz-range-thumb {
              background: #4f46e5;
            }
      `}</style>
    </div>
  );
};

export default AudioController;