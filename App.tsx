import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Theme, Book, AudioSegment } from './types';
import FileUploader from './components/FileUploader';
import AudioController from './components/AudioController';
import BookReader from './components/BookReader';
import ThemeToggle from './components/ThemeToggle';
import { BookIcon } from './components/icons/BookIcon';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [book, setBook] = useState<Book | null>(null);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<AudioSegment | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Audio Playback State and Refs
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startOffsetRef = useRef(0);
  const contextStartTimeRef = useRef(0);
  
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  
  // Refs to hold latest state for callbacks, preventing stale closures
  const audioSegmentsRef = useRef(audioSegments);
  audioSegmentsRef.current = audioSegments;
  const currentSegmentRef = useRef(currentSegment);
  currentSegmentRef.current = currentSegment;


  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
  }, [theme]);
  
  // --- Audio Logic ---

  const cleanupAudio = useCallback(() => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null;
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Initialize AudioContext
    if (!audioContextRef.current) {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        gainNodeRef.current = context.createGain();
        gainNodeRef.current.connect(context.destination);
    }
    const context = audioContextRef.current;
    return () => {
        // Cleanup on component unmount
        cleanupAudio();
        if (context && context.state !== 'closed') {
            context.close();
        }
    };
  }, [cleanupAudio]);

  const handleTrackEnd = useCallback(() => {
    const segments = audioSegmentsRef.current;
    const current = currentSegmentRef.current;
    const currentIndex = segments.findIndex(s => s.id === current?.id);
    
    if (currentIndex !== -1 && currentIndex < segments.length - 1) {
      setCurrentSegment(segments[currentIndex + 1]);
      // isPlaying remains true, the effect for currentSegment change will handle playback
    } else {
      setIsPlaying(false);
    }
  }, []); // Empty dependency array makes this function stable

  // Effect to handle live playback rate changes
  useEffect(() => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  // Main effect to handle playback
  useEffect(() => {
      if (!currentSegment || !audioContextRef.current || !gainNodeRef.current) {
          cleanupAudio();
          setDuration(0);
          setCurrentTime(0);
          return;
      }
      const context = audioContextRef.current;
      
      const tick = () => {
          if (context) {
              const currentRate = playbackRateRef.current;
              const playbackTime = (context.currentTime - contextStartTimeRef.current) * currentRate;
              setCurrentTime(Math.min(startOffsetRef.current + playbackTime, duration));
          }
          animationFrameRef.current = requestAnimationFrame(tick);
      };

      if (isPlaying) {
          cleanupAudio(); 
          if (context.state === 'suspended') {
              context.resume();
          }
          const source = context.createBufferSource();
          source.buffer = currentSegment.audio;
          source.playbackRate.value = playbackRate;
          source.connect(gainNodeRef.current);
          source.start(0, startOffsetRef.current);
          sourceNodeRef.current = source;
          contextStartTimeRef.current = context.currentTime;
          animationFrameRef.current = requestAnimationFrame(tick);
          source.onended = () => {
              if (sourceNodeRef.current === source) {
                  // Ensure currentTime is accurate before checking for completion
                  const finalTime = startOffsetRef.current + ((context.currentTime - contextStartTimeRef.current) * playbackRateRef.current);
                  const hasCompleted = finalTime >= duration - 0.1;

                  if (hasCompleted) {
                    handleTrackEnd();
                  } else {
                    setIsPlaying(false);
                  }
              }
          };
      } else {
          if (sourceNodeRef.current) {
              const currentRate = playbackRateRef.current;
              const elapsed = (context.currentTime - contextStartTimeRef.current) * currentRate;
              startOffsetRef.current = Math.min(startOffsetRef.current + elapsed, duration);
              cleanupAudio();
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegment, isPlaying, cleanupAudio, duration, handleTrackEnd]);

  // Effect to handle segment changes
  useEffect(() => {
    if (currentSegment) {
        setDuration(currentSegment.audio.duration);
        setCurrentTime(0);
        startOffsetRef.current = 0;
        setCurrentPage(currentSegment.pageRange.from);
    }
  }, [currentSegment]);

  // --- UI Handlers ---

  const handlePlaybackRequest = (segmentToPlay: AudioSegment) => {
    if (currentSegment?.id === segmentToPlay.id) {
      setIsPlaying((prev) => !prev);
    } else {
      setCurrentSegment(segmentToPlay);
      setIsPlaying(true);
    }
  };

  const handleMainPlayPause = (newIsPlayingState: boolean) => {
    if(currentSegment) {
        setIsPlaying(newIsPlayingState);
    } else if (audioSegments.length > 0) {
        // If no track is selected, play the first one
        setCurrentSegment(audioSegments[0]);
        setIsPlaying(true);
    }
  };

  const handleAutoplayFirstSegment = useCallback((segment: AudioSegment) => {
    // Only autoplay if nothing is playing right now.
    if (!isPlaying && !currentSegment) {
        setCurrentSegment(segment);
        setIsPlaying(true);
    }
  }, [isPlaying, currentSegment]);

  const handleSeek = (newTime: number) => {
      if (!audioContextRef.current) return;
      setCurrentTime(newTime);
      startOffsetRef.current = newTime;
      // Trigger the effect to restart playback from the new position
      if (isPlaying) {
          setIsPlaying(false);
          setTimeout(() => setIsPlaying(true), 0);
      }
  };

  const handlePlaybackRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
  };

  const resetState = () => {
    setBook(null);
    setAudioSegments([]);
    setCurrentSegment(null);
    setError(null);
    setIsPlaying(false);
    setCurrentPage(1);
  };

  const handleBookParsed = (parsedBook: Book) => {
    resetState();
    setBook(parsedBook);
  };

  const getDynamicTitleClass = (title: string): string => {
    const len = title.length;
    if (len <= 25) return 'text-3xl';
    if (len <= 50) return 'text-2xl';
    if (len <= 80) return 'text-xl';
    return 'text-lg';
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans transition-colors duration-300">
      <div className="container mx-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <BookIcon className="w-8 h-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-200">
              AudioBook Creator
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {book && <button onClick={resetState} className="text-sm font-medium text-primary hover:underline">New Book</button>}
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </header>

        <main>
          {error && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!book ? (
            <FileUploader onBookParsed={handleBookParsed} setError={setError} />
          ) : (
            <div className="flex flex-col gap-8">
              {/* Part 1: Book View */}
              <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-lg border border-border-light dark:border-border-dark">
                  <h2 className={`${getDynamicTitleClass(book.title)} font-bold mb-1 text-gray-800 dark:text-gray-200`}>{book.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{book.pages.length} pages</p>
                  <hr className="border-border-light dark:border-border-dark" />
                  <BookReader 
                    book={book}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                  />
              </div>

              {/* Part 2: Controls View */}
              <AudioController 
                  book={book} 
                  setAudioSegments={setAudioSegments}
                  audioSegments={audioSegments}
                  currentSegment={currentSegment}
                  isPlaying={isPlaying}
                  handlePlaybackRequest={handlePlaybackRequest}
                  setError={setError}
                  onAutoplayFirstSegment={handleAutoplayFirstSegment}
                  // Player Props
                  duration={duration}
                  currentTime={currentTime}
                  playbackRate={playbackRate}
                  onPlaybackStateChange={handleMainPlayPause}
                  onSeek={handleSeek}
                  onPlaybackRateChange={handlePlaybackRateChange}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;