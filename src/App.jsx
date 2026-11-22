import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FolderPlus,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Bookmark,
  Moon,
  Edit3,
  Check,
  Trash2,
  Headphones,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Settings,
  ChevronDown,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  resetSettingsToDefault,
  getAllMetadata,
  replaceAllMetadata,
  getTrackMetadata,
  saveTrackMetadata,
  saveAudioFileToDB,
  getAllAudioFilesFromDB,
  deleteAudioFileFromDB,
  clearAllAudioFilesFromDB,
  getDateGroupKey,
  formatTime,
  calculateRemainingAdjusted,
} from './utils/storage';
import SettingsModal from './components/SettingsModal';

const SPEED_OPTIONS = [0.8, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];

const ACCENT_MAP = {
  indigo: {
    bar: '#818cf8',
    text: 'text-indigo-400',
    softText: 'text-indigo-300',
    border: 'border-indigo-500/40',
    bgSoft: 'bg-indigo-500/15',
    btnActive: 'bg-indigo-500 text-white',
    iconBox: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-400',
  },
  emerald: {
    bar: '#34d399',
    text: 'text-emerald-400',
    softText: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bgSoft: 'bg-emerald-500/15',
    btnActive: 'bg-emerald-500 text-zinc-950',
    iconBox: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
  },
  amber: {
    bar: '#fbbf24',
    text: 'text-amber-400',
    softText: 'text-amber-300',
    border: 'border-amber-500/40',
    bgSoft: 'bg-amber-500/15',
    btnActive: 'bg-amber-500 text-zinc-950',
    iconBox: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  },
  sky: {
    bar: '#38bdf8',
    text: 'text-sky-400',
    softText: 'text-sky-300',
    border: 'border-sky-500/40',
    bgSoft: 'bg-sky-500/15',
    btnActive: 'bg-sky-500 text-zinc-950',
    iconBox: 'from-sky-500/20 to-cyan-500/20 border-sky-500/30 text-sky-400',
  },
};

export default function App() {
  const [settings, setSettings] = useState(() => getSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [tracks, setTracks] = useState([]);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(() => getSettings().defaultSpeed || 1.0);

  // Özel isim düzenleme
  const [editingId, setEditingId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Yer imleri
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');

  // Uyku / Odak zamanlayıcısı
  const [sleepTimerMode, setSleepTimerMode] = useState(0); // 0: kapalı, >0: dakika, -1: kayıt bitince
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  // Klasör izleme ve tarih grupları
  const [dirHandle, setDirHandle] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const audioRef = useRef(new Audio());
  const fileInputRef = useRef(null);
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;
  const accent = ACCENT_MAP[settings.accentColor] || ACCENT_MAP.indigo;

  const sleepOptions = useMemo(
    () => [
      { label: 'Kapalı', minutes: 0 },
      { label: `${settings.defaultSleepMinutes} dk (Varsayılan)`, minutes: settings.defaultSleepMinutes },
      { label: '15 dk', minutes: 15 },
      { label: '30 dk', minutes: 30 },
      { label: '45 dk', minutes: 45 },
      { label: 'Kayıt Bitince', minutes: -1 },
    ].filter(
      (item, idx, arr) =>
        arr.findIndex((x) => x.minutes === item.minutes) === idx
    ),
    [settings.defaultSleepMinutes]
  );

  // 1. Kayıtları yükle
  const loadSavedTracks = useCallback(async () => {
    const savedFiles = await getAllAudioFilesFromDB();
    const enriched = savedFiles
      .map((item) => ({
        ...item,
        meta: getTrackMetadata(item.id),
      }))
      .sort((a, b) => (b.recordDate || b.addedAt || 0) - (a.recordDate || a.addedAt || 0));
    setTracks(enriched);
  }, []);

  useEffect(() => {
    loadSavedTracks();
  }, [loadSavedTracks]);

  // 2. Dosya / Klasör işleme ve otomatik çekme
  const processIncomingFiles = async (fileList) => {
    setIsSyncing(true);
    const validExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.webm', '.opus'];
    const existingFiles = await getAllAudioFilesFromDB();
    const existingIds = new Set(existingFiles.map((f) => f.id));

    for (const file of fileList) {
      const lowerName = file.name.toLowerCase();
      const isAudio =
        file.type.startsWith('audio/') ||
        validExtensions.some((ext) => lowerName.endsWith(ext));

      if (!isAudio) continue;

      const id = `${file.name}_${file.size}`;
      if (!existingIds.has(id)) {
        const recordTimestamp = file.lastModified || Date.now();
        await saveAudioFileToDB({
          id,
          originalName: file.name,
          size: file.size,
          addedAt: Date.now(),
          recordDate: recordTimestamp,
          blob: file,
        });
      }
    }

    await loadSavedTracks();
    setIsSyncing(false);
  };

  const handleSelectFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        setDirHandle(handle);
        await syncFromDirectoryHandle(handle);
      } catch (err) {
        if (err.name !== 'AbortError') {
          fileInputRef.current?.click();
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const syncFromDirectoryHandle = useCallback(
    async (handle = dirHandle) => {
      if (!handle) return;
      setIsSyncing(true);
      const files = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          files.push(file);
        }
      }
      await processIncomingFiles(files);
      setIsSyncing(false);
    },
    [dirHandle]
  );

  useEffect(() => {
    if (!dirHandle || !settings.autoSyncIntervalSec) return;
    const interval = setInterval(() => {
      syncFromDirectoryHandle(dirHandle);
    }, settings.autoSyncIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [dirHandle, settings.autoSyncIntervalSec, syncFromDirectoryHandle]);

  // 3. Oynatma, Kaldığı Yer ve Akıllı Geri Sarma
  const handleSelectTrack = (track) => {
    const audio = audioRef.current;

    if (activeTrackId === track.id) {
      togglePlayPause();
      return;
    }

    const meta = getTrackMetadata(track.id);
    const speedToUse = meta.playbackRate || settings.defaultSpeed || 1.0;
    const objectUrl = URL.createObjectURL(track.blob);

    audio.src = objectUrl;
    audio.playbackRate = speedToUse;

    setActiveTrackId(track.id);
    setPlaybackRate(speedToUse);
    setCurrentTime(meta.currentTime || 0);
    setDuration(meta.duration || 0);

    audio.onloadedmetadata = () => {
      const realDuration = audio.duration;
      setDuration(realDuration);

      let resumeTime =
        meta.currentTime && meta.currentTime < realDuration - 3 ? meta.currentTime : 0;

      if (settings.smartRewind && resumeTime > 0 && meta.lastPausedAt) {
        const pausedElapsedSec = (Date.now() - meta.lastPausedAt) / 1000;
        if (pausedElapsedSec >= settings.smartRewindThresholdSec) {
          resumeTime = Math.max(0, resumeTime - settings.smartRewindAmountSec);
        }
      }

      audio.currentTime = resumeTime;
      setCurrentTime(resumeTime);

      saveTrackMetadata(track.id, {
        duration: realDuration,
        playbackRate: speedToUse,
        status: meta.status === 'new' ? 'in_progress' : meta.status,
        lastPlayedAt: Date.now(),
      });
      loadSavedTracks();

      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!activeTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      saveTrackMetadata(activeTrack.id, {
        currentTime: audio.currentTime,
        lastPausedAt: Date.now(),
      });
    } else {
      let targetTime = audio.currentTime;
      const meta = getTrackMetadata(activeTrack.id);
      if (settings.smartRewind && meta.lastPausedAt) {
        const pausedElapsedSec = (Date.now() - meta.lastPausedAt) / 1000;
        if (pausedElapsedSec >= settings.smartRewindThresholdSec && targetTime > 0) {
          targetTime = Math.max(0, targetTime - settings.smartRewindAmountSec);
          audio.currentTime = targetTime;
          setCurrentTime(targetTime);
        }
      }
      audio.volume = 1;
      audio.play().then(() => setIsPlaying(true));
    }
  };

  const skipTime = (seconds) => {
    const audio = audioRef.current;
    if (!activeTrack) return;
    const nextTime = Math.min(
      Math.max(0, audio.currentTime + seconds),
      duration || audio.duration
    );
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    saveTrackMetadata(activeTrack.id, { currentTime: nextTime });
  };

  const handleChangeSpeed = (newRate) => {
    setPlaybackRate(newRate);
    audioRef.current.playbackRate = newRate;
    if (activeTrack) {
      saveTrackMetadata(activeTrack.id, { playbackRate: newRate });
      loadSavedTracks();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    let lastSavedSecond = 0;

    const onTimeUpdate = () => {
      const now = audio.currentTime;
      setCurrentTime(now);

      if (activeTrackId && Math.abs(now - lastSavedSecond) >= 2) {
        lastSavedSecond = now;
        saveTrackMetadata(activeTrackId, {
          currentTime: now,
          status: 'in_progress',
        });
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (activeTrackId) {
        saveTrackMetadata(activeTrackId, {
          currentTime: 0,
          status: 'completed',
        });
        loadSavedTracks();
      }
      if (sleepTimerMode === -1) {
        setSleepTimerMode(0);
        setSleepSecondsLeft(null);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [activeTrackId, loadSavedTracks, sleepTimerMode]);

  // 4. Kilit Ekranı / Arka Plan Medya Kontrolleri
  useEffect(() => {
    if (!('mediaSession' in navigator) || !activeTrack) return;
    const displayTitle =
      activeTrack.meta.customTitle || activeTrack.originalName.replace(/\.[^/.]+$/, '');

    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle,
      artist: 'Dinlesene • Ders Kaydı',
      album: `${playbackRate}x`,
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current.play();
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current.pause();
      setIsPlaying(false);
      saveTrackMetadata(activeTrack.id, {
        currentTime: audioRef.current.currentTime,
        lastPausedAt: Date.now(),
      });
    });
    navigator.mediaSession.setActionHandler('seekbackward', () =>
      skipTime(-settings.skipSeconds)
    );
    navigator.mediaSession.setActionHandler('seekforward', () =>
      skipTime(settings.skipSeconds)
    );
  }, [activeTrack, playbackRate, settings.skipSeconds]);

  // 5. Uyku Zamanlayıcısı
  const startSleepTimer = (minutes) => {
    setSleepTimerMode(minutes);
    setShowSleepMenu(false);
    if (minutes > 0) {
      setSleepSecondsLeft(minutes * 60);
    } else {
      setSleepSecondsLeft(null);
    }
  };

  useEffect(() => {
    if (!isPlaying || sleepSecondsLeft === null || sleepSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSleepSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 4 && prev > 1) {
          audioRef.current.volume = Math.max(0.1, (prev - 1) / 4);
        }
        if (prev <= 1) {
          audioRef.current.pause();
          audioRef.current.volume = 1;
          setIsPlaying(false);
          setSleepTimerMode(0);
          if (activeTrackId) {
            saveTrackMetadata(activeTrackId, {
              currentTime: audioRef.current.currentTime,
              lastPausedAt: Date.now(),
            });
            loadSavedTracks();
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, sleepSecondsLeft, activeTrackId, loadSavedTracks]);

  // 6. Özel Ad ve Yer İmleri
  const startEditingTitle = (e, track) => {
    e.stopPropagation();
    setEditingId(track.id);
    setEditTitleValue(
      track.meta.customTitle || track.originalName.replace(/\.[^/.]+$/, '')
    );
  };

  const saveCustomTitle = (e, trackId) => {
    e.stopPropagation();
    const trimmed = editTitleValue.trim();
    saveTrackMetadata(trackId, { customTitle: trimmed || null });
    setEditingId(null);
    loadSavedTracks();
  };

  const handleAddBookmark = (e) => {
    e.preventDefault();
    if (!activeTrack) return;
    const meta = getTrackMetadata(activeTrack.id);
    const newBookmark = {
      id: Date.now().toString(),
      time: Math.floor(currentTime),
      note: bookmarkNote.trim() || 'Önemli Nokta',
    };
    const updated = [...(meta.bookmarks || []), newBookmark].sort((a, b) => a.time - b.time);
    saveTrackMetadata(activeTrack.id, { bookmarks: updated });
    setBookmarkNote('');
    setShowBookmarkModal(false);
    loadSavedTracks();
  };

  const handleDeleteBookmark = (bookmarkId) => {
    if (!activeTrack) return;
    const meta = getTrackMetadata(activeTrack.id);
    const updated = (meta.bookmarks || []).filter((b) => b.id !== bookmarkId);
    saveTrackMetadata(activeTrack.id, { bookmarks: updated });
    loadSavedTracks();
  };

  const jumpToBookmark = (seconds) => {
    const audio = audioRef.current;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true));
    }
  };

  const handleDeleteTrack = async (e, trackId) => {
    e.stopPropagation();
    if (activeTrackId === trackId) {
      audioRef.current.pause();
      setIsPlaying(false);
      setActiveTrackId(null);
    }
    await deleteAudioFileFromDB(trackId);
    loadSavedTracks();
  };

  // 7. Ayarlar & Yedekleme İşlemleri
  const handleUpdateSettings = (partial) => {
    const updated = saveSettings(partial);
    setSettings(updated);
  };

  const handleResetSettings = () => {
    const reset = resetSettingsToDefault();
    setSettings(reset);
  };

  const handleExportBackup = () => {
    const payload = {
      app: 'dinlesene',
      exportedAt: new Date().toISOString(),
      settings,
      metadata: getAllMetadata(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dinlesene-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.metadata) {
        replaceAllMetadata(parsed.metadata);
      }
      if (parsed.settings) {
        const merged = saveSettings(parsed.settings);
        setSettings(merged);
      }
      await loadSavedTracks();
    } catch {
      alert('Geçersiz yedek dosyası.');
    }
  };

  const handleClearAllData = async () => {
    audioRef.current.pause();
    setIsPlaying(false);
    setActiveTrackId(null);
    await clearAllAudioFilesFromDB();
    replaceAllMetadata({});
    setTracks([]);
    setShowSettings(false);
  };

  // 8. Filtreleme ve Tarihe Göre Otomatik Gruplama
  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (filterStatus === 'all') return true;
      return t.meta.status === filterStatus;
    });
  }, [tracks, filterStatus]);

  const groupedTracks = useMemo(() => {
    if (!settings.autoGroupByDate) {
      return [{ groupName: null, items: filteredTracks }];
    }

    const map = new Map();
    for (const track of filteredTracks) {
      const key = getDateGroupKey(track.recordDate || track.addedAt, settings.dateFormat);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(track);
    }

    return Array.from(map.entries()).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [filteredTracks, settings.autoGroupByDate, settings.dateFormat]);

  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-2 py-0.5 text-[11px] font-normal rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
            Yeni
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 text-[11px] font-normal rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
            Dinleniyor
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-[11px] font-normal rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
            Bitti
          </span>
        );
      default:
        return null;
    }
  };

  const fontScaleClass =
    settings.fontScale === 'large'
      ? 'text-[16px]'
      : settings.fontScale === 'compact'
      ? 'text-[13px]'
      : 'text-[14.5px]';

  const renderTrackCard = (track) => {
    const isCurrent = track.id === activeTrackId;
    const meta = track.meta;
    const title = meta.customTitle || track.originalName.replace(/\.[^/.]+$/, '');
    const progressPercent =
      meta.duration > 0
        ? Math.min(
            100,
            ((isCurrent ? currentTime : meta.currentTime) / meta.duration) * 100
          )
        : 0;

    return (
      <div
        key={track.id}
        onClick={() => handleSelectTrack(track)}
        className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
          isCurrent
            ? `bg-zinc-900/90 ${accent.border} shadow-lg`
            : 'bg-zinc-900/35 hover:bg-zinc-900/70 border-zinc-800/60'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingId === track.id ? (
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCustomTitle(e, track.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none"
                  placeholder="Ders adı girin..."
                />
                <button
                  onClick={(e) => saveCustomTitle(e, track.id)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2
                  className={`truncate font-normal ${
                    isCurrent ? 'text-white' : 'text-zinc-200'
                  }`}
                >
                  {title}
                </h2>
                <button
                  onClick={(e) => startEditingTitle(e, track)}
                  title="Kayda özel ad ver"
                  className="opacity-60 sm:opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            )}

            {meta.customTitle && settings.showOriginalFilename && (
              <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-light">
                Dosya: {track.originalName}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-zinc-400 font-light">
              {renderStatusBadge(meta.status)}

              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-500" strokeWidth={1.5} />
                {calculateRemainingAdjusted(
                  isCurrent ? duration : meta.duration,
                  isCurrent ? currentTime : meta.currentTime,
                  meta.playbackRate
                )}
              </span>

              {meta.playbackRate !== 1.0 && (
                <span className={`${accent.text} font-normal`}>
                  {meta.playbackRate}x
                </span>
              )}

              {meta.bookmarks?.length > 0 && (
                <span className="flex items-center gap-1 text-zinc-400">
                  <Bookmark className={`w-3 h-3 ${accent.text}`} strokeWidth={1.5} />
                  {meta.bookmarks.length} not
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => handleDeleteTrack(e, track.id)}
              title="Listeden kaldır"
              className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 transition"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                isCurrent && isPlaying
                  ? accent.btnActive
                  : 'bg-zinc-800/80 text-zinc-300 group-hover:bg-zinc-700'
              }`}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Play className="w-4 h-4 ml-0.5" strokeWidth={1.75} />
              )}
            </div>
          </div>
        </div>

        {progressPercent > 0 && (
          <div className="w-full h-[2px] bg-zinc-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progressPercent}%`, backgroundColor: accent.bar }}
            />
          </div>
        )}

        {isCurrent && meta.bookmarks?.length > 0 && (
          <div
            className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {meta.bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/90 border border-zinc-800 text-xs text-zinc-300 transition"
              >
                <button
                  onClick={() => jumpToBookmark(bm.time)}
                  className="flex items-center gap-1.5"
                >
                  <span className={`${accent.text} font-mono text-[11px]`}>
                    {formatTime(bm.time)}
                  </span>
                  <span className="font-light truncate max-w-[140px]">{bm.note}</span>
                </button>
                <button
                  onClick={() => handleDeleteBookmark(bm.id)}
                  className="text-zinc-600 hover:text-rose-400 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen bg-zinc-950 text-zinc-100 flex flex-col max-w-2xl mx-auto px-4 sm:px-6 pb-48 ${fontScaleClass}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            processIncomingFiles(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {/* --- ÜST BAŞLIK --- */}
      <header className="pt-8 pb-6 flex items-center justify-between border-b border-zinc-900">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${accent.iconBox} border flex items-center justify-center`}
            >
              <Headphones className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-light tracking-tight text-white">dinlesene</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-light">
            Kaldığın yerden devam eden sade ders arşivin
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dirHandle && (
            <button
              onClick={() => syncFromDirectoryHandle()}
              title="Klasörü şimdi tara"
              className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-white transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? `animate-spin ${accent.text}` : ''}`}
                strokeWidth={1.5}
              />
            </button>
          )}

          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition shadow-sm"
          >
            <FolderPlus className="w-4 h-4" strokeWidth={1.75} />
            <span>{dirHandle ? 'Klasör Bağlı' : 'Kayıt Çek'}</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            title="Ayarlar"
            className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-white transition"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* --- FİLTRELER --- */}
      <div className="flex items-center gap-2 py-4 overflow-x-auto">
        {[
          { id: 'all', label: `Tümü (${tracks.length})` },
          { id: 'in_progress', label: 'Yarım Kalanlar' },
          { id: 'new', label: 'Yeni' },
          { id: 'completed', label: 'Tamamlanan' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-light transition whitespace-nowrap ${
              filterStatus === tab.id
                ? 'bg-zinc-800/90 text-white border border-zinc-700/70'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- LİSTE (OTOMATİK TARİH KLASÖRLÜ VEYA DÜZ) --- */}
      <main className="flex-1 space-y-5 mt-1">
        {filteredTracks.length === 0 ? (
          <div className="mt-16 text-center px-6 py-12 rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-900/20">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-3" strokeWidth={1.25} />
            <h3 className="text-sm font-normal text-zinc-300">
              Henüz ders kaydı eklenmedi
            </h3>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto leading-relaxed font-light">
              Sağ üstteki <strong className="font-normal text-zinc-300">Kayıt Çek</strong>{' '}
              butonuna basarak ses kayıtlarını içe aktar.
            </p>
          </div>
        ) : (
          groupedTracks.map((group) => {
            const isCollapsed = group.groupName ? !!collapsedGroups[group.groupName] : false;

            return (
              <div key={group.groupName || 'ungrouped'} className="space-y-2.5">
                {group.groupName && (
                  <button
                    onClick={() => toggleGroupCollapse(group.groupName)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-zinc-900/50 text-left transition group"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <Calendar className={`w-3.5 h-3.5 ${accent.text}`} strokeWidth={1.5} />
                      <span className="text-xs font-normal tracking-wide text-zinc-300">
                        {group.groupName}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-light">
                        ({group.items.length})
                      </span>
                    </div>
                  </button>
                )}

                {!isCollapsed && (
                  <div className="space-y-2.5">
                    {group.items.map((track) => renderTrackCard(track))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* --- ALT SABİT OYNATICI --- */}
      {activeTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 px-4 pt-3 pb-5 z-40">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-300 font-normal truncate max-w-[60%]">
                {activeTrack.meta.customTitle ||
                  activeTrack.originalName.replace(/\.[^/.]+$/, '')}
              </span>

              <div className="flex items-center gap-3 text-zinc-400 font-light">
                {sleepSecondsLeft !== null && (
                  <span className="flex items-center gap-1 text-amber-300 text-[11px]">
                    <Moon className="w-3 h-3" />
                    {formatTime(sleepSecondsLeft)}
                  </span>
                )}
                {sleepTimerMode === -1 && (
                  <span className="text-amber-300 text-[11px]">Kayıt bitince duracak</span>
                )}
                <span>
                  {calculateRemainingAdjusted(duration, currentTime, playbackRate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-zinc-500 w-10 text-right">
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    audioRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="w-full h-1 bg-zinc-800 rounded-lg"
                  style={{
                    background: `linear-gradient(to right, ${accent.bar} ${
                      duration ? (currentTime / duration) * 100 : 0
                    }%, #27272a ${duration ? (currentTime / duration) * 100 : 0}%)`,
                  }}
                />
              </div>

              <span className="text-[11px] font-mono text-zinc-500 w-10">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => {
                  const idx = SPEED_OPTIONS.indexOf(playbackRate);
                  const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
                  handleChangeSpeed(next);
                }}
                title="Oynatma hızı (Kayda özel kaydedilir)"
                className={`px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-normal ${accent.softText} transition min-w-[52px]`}
              >
                {playbackRate}x
              </button>

              <div className="flex items-center gap-5">
                <button
                  onClick={() => skipTime(-settings.skipSeconds)}
                  className="p-2 text-zinc-400 hover:text-white transition"
                  title={`${settings.skipSeconds} saniye geri`}
                >
                  <RotateCcw className="w-5 h-5" strokeWidth={1.5} />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-12 h-12 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 flex items-center justify-center shadow-md transition active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" strokeWidth={2} />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" strokeWidth={2} />
                  )}
                </button>

                <button
                  onClick={() => skipTime(settings.skipSeconds)}
                  className="p-2 text-zinc-400 hover:text-white transition"
                  title={`${settings.skipSeconds} saniye ileri`}
                >
                  <RotateCw className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 relative">
                <button
                  onClick={() => setShowBookmarkModal(true)}
                  title="Yer imi ekle"
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
                >
                  <Bookmark className="w-4 h-4" strokeWidth={1.5} />
                </button>

                <button
                  onClick={() => setShowSleepMenu((prev) => !prev)}
                  title="Uyku / Odak Zamanlayıcısı"
                  className={`p-2 rounded-xl border transition ${
                    sleepTimerMode !== 0
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <Moon className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {showSleepMenu && (
                  <div className="absolute bottom-12 right-0 w-44 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-2xl z-50">
                    <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
                      Odak / Uyku Sayacı
                    </div>
                    {sleepOptions.map((opt) => (
                      <button
                        key={opt.minutes}
                        onClick={() => startSleepTimer(opt.minutes)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                          sleepTimerMode === opt.minutes
                            ? `${accent.bgSoft} ${accent.softText}`
                            : 'text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YER İMİ MODALI --- */}
      {showBookmarkModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowBookmarkModal(false)}
        >
          <form
            onSubmit={handleAddBookmark}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-normal text-white flex items-center gap-2">
                <Bookmark className={`w-4 h-4 ${accent.text}`} />
                Yer İmi Ekle ({formatTime(currentTime)})
              </span>
              <button
                type="button"
                onClick={() => setShowBookmarkModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={bookmarkNote}
              onChange={(e) => setBookmarkNote(e.target.value)}
              placeholder="Örn: Vizede çıkacak formül..."
              autoFocus
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowBookmarkModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- AYARLAR EKRANI --- */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onClearAllData={handleClearAllData}
        dirHandleConnected={!!dirHandle}
      />
    </div>
  );
}