// src/utils/storage.js

const METADATA_KEY = 'dinlesene_track_metadata_v1';
const SETTINGS_KEY = 'dinlesene_settings_v1';
const DB_NAME = 'DinleseneAudioDB';
const STORE_NAME = 'audioFiles';

export const DEFAULT_SETTINGS = {
  defaultSpeed: 1.0,
  skipSeconds: 10,
  smartRewind: true,
  smartRewindThresholdSec: 30,
  smartRewindAmountSec: 4,
  defaultSleepMinutes: 25,
  autoGroupByDate: true,
  dateFormat: 'tr-long', // 'tr-long' | 'tr-numeric'
  autoSyncIntervalSec: 15, // 0 = kapalı, 15, 30, 60
  showOriginalFilename: true,
  accentColor: 'indigo', // 'indigo' | 'emerald' | 'amber' | 'sky'
  fontScale: 'normal', // 'compact' | 'normal' | 'large'
};

export const getSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (partial) => {
  const updated = { ...getSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
};

export const resetSettingsToDefault = () => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS };
};

// --- 1. LocalStorage: Kayıt Meta Verileri ---
export const getAllMetadata = () => {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const replaceAllMetadata = (newMetaObj) => {
  localStorage.setItem(METADATA_KEY, JSON.stringify(newMetaObj || {}));
};

export const getTrackMetadata = (trackId) => {
  const all = getAllMetadata();
  const settings = getSettings();
  return (
    all[trackId] || {
      customTitle: null,
      currentTime: 0,
      duration: 0,
      playbackRate: settings.defaultSpeed || 1.0,
      status: 'new', // 'new' | 'in_progress' | 'completed'
      bookmarks: [], // { id, time, note }
      lastPlayedAt: null,
      lastPausedAt: null,
    }
  );
};

export const saveTrackMetadata = (trackId, partialData) => {
  const all = getAllMetadata();
  const current = getTrackMetadata(trackId);
  all[trackId] = {
    ...current,
    ...partialData,
  };
  localStorage.setItem(METADATA_KEY, JSON.stringify(all));
  return all[trackId];
};

// --- 2. IndexedDB: Ses Dosyaları ---
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveAudioFileToDB = async (fileObj) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(fileObj);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAllAudioFilesFromDB = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

export const deleteAudioFileFromDB = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllAudioFilesFromDB = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- 3. Tarih Gruplama ve Zaman Yardımcıları ---
export const getDateGroupKey = (timestamp, dateFormat = 'tr-long') => {
  const date = new Date(timestamp || Date.now());
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfTarget.getTime() === startOfToday.getTime()) {
    return 'Bugün';
  }
  if (startOfTarget.getTime() === startOfYesterday.getTime()) {
    return 'Dün';
  }

  if (dateFormat === 'tr-numeric') {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const calculateRemainingAdjusted = (duration, currentTime, rate) => {
  if (!duration || duration <= 0) return 'Süre hesaplanıyor...';
  const rawRemaining = Math.max(0, duration - currentTime);
  if (rawRemaining < 2) return 'Tamamlandı';
  const adjustedSeconds = rawRemaining / (rate || 1);
  const mins = Math.ceil(adjustedSeconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} sa ${m} dk kaldı`;
  }
  return `${mins} dk kaldı`;
};