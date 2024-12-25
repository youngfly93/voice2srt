"use client";

import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Upload, Music, FileAudio, Download, Loader2, Copy } from "lucide-react";

interface TranscriptionResult {
  text: string;
  startTime: number;
  endTime: number;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [srtContent, setSrtContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError("");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        setError("");
      } else {
        setError("Please upload an audio file");
      }
    }
  };

  const convertToSRT = async () => {
    if (!audioFile) return;
    setLoading(true);
    setError("");

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convert audio file to base64
      const base64Audio = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioFile);
      });

      // Send audio to Gemini API with improved prompt
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: audioFile.type,
            data: base64Audio
          }
        },
        { text: `Please transcribe this audio and segment it into natural phrases or sentences. For each segment:
1. Provide the start time and end time in seconds
2. Keep segments between 2-4 seconds long
3. Format each segment as: "[start_seconds]-[end_seconds]: [text]"
4. Make sure segments don't overlap
5. Start from the beginning of the audio (0 seconds)` }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Parse the response into segments
      const segments = parseTranscriptionResponse(text);
      
      if (segments.length === 0) {
        throw new Error("Failed to parse transcription segments");
      }
      
      // Format as SRT
      const srtFormatted = formatToSRT(segments);
      setSrtContent(srtFormatted);
    } catch (error) {
      console.error("Error processing audio:", error);
      setError("Failed to process audio. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const parseTranscriptionResponse = (text: string): TranscriptionResult[] => {
    const segments: TranscriptionResult[] = [];
    const lines = text.split("\n").filter(line => line.trim());

    for (const line of lines) {
      // Match pattern like "1.5-4.2: Some text" or "1-4: Some text"
      const match = line.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*:\s*(.+)/);
      if (match) {
        const startTime = parseFloat(match[1]);
        const endTime = parseFloat(match[2]);
        const text = match[3].trim();
        
        // Validate times
        if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
          segments.push({
            startTime,
            endTime,
            text
          });
        }
      }
    }

    // Sort segments by start time
    return segments.sort((a, b) => a.startTime - b.startTime);
  };

  const formatToSRT = (transcriptions: TranscriptionResult[]): string => {
    return transcriptions
      .map((trans, index) => {
        const startTime = formatTimestamp(trans.startTime);
        const endTime = formatTimestamp(trans.endTime);
        return `${index + 1}\n${startTime} --> ${endTime}\n${trans.text}\n`;
      })
      .join("\n");
  };

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(srtContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSRT = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-400 via-rose-200 to-lime-200 animate-fade-in">
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        </div>
      </div>
      <div className="relative min-h-screen backdrop-blur-[2px]">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16 space-y-6">
              <div className="flex items-center justify-center mb-8">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-75 blur-2xl group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-75 blur-xl group-hover:blur-3xl transition-all duration-500"></div>
                  <Music className="h-20 w-20 text-white relative z-10 animate-bounce" />
                </div>
              </div>
              <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mb-4 tracking-tight animate-fade-in">
                Audio to SRT Converter
              </h1>
              <p className="text-gray-700 text-xl max-w-2xl mx-auto leading-relaxed animate-fade-in-up">
                Transform your audio files into perfectly timed SRT subtitles using AI-powered transcription
              </p>
            </div>

            {/* Main Content */}
            <div className="space-y-8">
              {/* Upload Section */}
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/50 
                transform hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl animate-fade-in-up">
                <div 
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-500 ease-in-out group
                    ${dragActive 
                      ? 'border-pink-400 bg-gradient-to-br from-pink-50 to-purple-50 scale-[1.02]' 
                      : audioFile 
                        ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50' 
                        : 'border-gray-300 hover:border-purple-300 bg-gradient-to-br from-gray-50 to-white group-hover:from-purple-50 group-hover:to-pink-50'}`}
                >
                  {dragActive && (
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-400/10 to-purple-400/10 rounded-2xl animate-pulse"></div>
                  )}
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="audio-input"
                  />
                  <label
                    htmlFor="audio-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-6 relative z-10"
                  >
                    {audioFile ? (
                      <>
                        <FileAudio className="h-20 w-20 text-purple-500 animate-pulse" />
                        <div className="text-center">
                          <span className="text-purple-600 font-medium text-lg block">{audioFile.name}</span>
                          <span className="text-purple-400 text-sm">Click to change file</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="h-20 w-20 text-gray-400 group-hover:text-purple-400 transition-colors duration-300" />
                        <div className="text-center space-y-2">
                          <div>
                            <span className="text-purple-600 font-medium">Click to upload</span>
                            <span className="text-gray-600"> or drag and drop</span>
                          </div>
                          <p className="text-sm text-gray-500">
                            Supported formats: WAV, MP3, AIFF, AAC, OGG, FLAC
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
                    <p className="text-red-600 text-center text-sm">
                      {error}
                    </p>
                  </div>
                )}

                <button
                  onClick={convertToSRT}
                  disabled={!audioFile || loading}
                  className={`mt-8 w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-medium text-lg
                    transition-all duration-500 transform hover:scale-[1.02] relative group overflow-hidden
                    ${!audioFile || loading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 hover:from-purple-400 hover:via-purple-300 hover:to-pink-400 text-white shadow-lg hover:shadow-purple-200"
                    }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 -skew-x-12"></div>
                  {loading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Music className="h-6 w-6" />
                      Convert to SRT
                    </>
                  )}
                </button>
              </div>

              {/* Result Section */}
              {srtContent && (
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-white/50 space-y-6
                  animate-fade-in-up transform hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl">
                  <div className="relative">
                    <pre className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl overflow-x-auto max-h-96 text-sm font-mono text-gray-700">
                      {srtContent}
                    </pre>
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={handleCopy}
                        className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-110 ${
                          copied 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-600'
                        }`}
                        title="Copy to clipboard"
                      >
                        <Copy className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={downloadSRT}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-medium text-lg
                      bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                      text-white transition-all duration-500 shadow-lg hover:shadow-emerald-200
                      transform hover:scale-[1.02] relative group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 -skew-x-12"></div>
                    <Download className="h-6 w-6" />
                    Download SRT
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}