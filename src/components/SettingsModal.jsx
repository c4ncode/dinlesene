import React, { useRef } from 'react';
import {
  X,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  FolderSync,
  Sliders,
  Eye,
  Database,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../utils/storage';

const ACCENT_THEMES = {
  indigo: {
    name: 'İndigo',
    swatch: 'bg-indigo-400',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
    bgSoft: 'bg-indigo-500/15',
  },
  emerald: {
    name: 'Adaçayı',
    swatch: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bgSoft: 'bg-emerald-500/15',
  },
  amber: {
    name: 'Kehribar',
    swatch: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    bgSoft: 'bg-amber-500/15',
  },
  sky: {
    name: 'Buz Mavisi',
    swatch: 'bg-sky-400',
    text: 'text-sky-300',
    border: 'border-sky-500/40',
    bgSoft: 'bg-sky-500/15',
  },
};

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  onExportBackup,
  onImportBackup,
  onClearAllData,
  dirHandleConnected,
}) {
  const importInputRef = useRef(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800/90 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6"
      >
        {/* Üst Başlık */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
          <div>
            <h2 className="text-lg font-light text-white tracking-tight">Ayarlar</h2>
            <p className="text-xs text-zinc-500 font-light mt-0.5">
              Oynatma, klasör gruplama ve görünüm tercihleri
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* 1. OYNATMA AYARLARI */}
        <section className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <Sliders className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Oynatma ve Zamanlayıcı</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/45 border border-zinc-800/70 divide-y divide-zinc-800/60">
            {/* Varsayılan Hız */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Varsayılan Hız</p>
                <p className="text-xs text-zinc-500 font-light">
                  Yeni açılan kayıtların başlangıç hızı
                </p>
              </div>
              <select
                value={settings.defaultSpeed}
                onChange={(e) =>
                  onUpdateSettings({ defaultSpeed: parseFloat(e.target.value) })
                }
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {[0.8, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0].map((spd) => (
                  <option key={spd} value={spd}>
                    {spd}x
                  </option>
                ))}
              </select>
            </div>

            {/* Sarma Süresi */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">İleri / Geri Sarma</p>
                <p className="text-xs text-zinc-500 font-light">
                  Tek dokunuşta atlanacak saniye süresi
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[5, 10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => onUpdateSettings({ skipSeconds: sec })}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      settings.skipSeconds === sec
                        ? 'bg-white text-zinc-950 border-white font-medium'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    {sec}sn
                  </button>
                ))}
              </div>
            </div>

            {/* Akıllı Geri Sarma */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Akıllı Geri Sarma</p>
                <p className="text-xs text-zinc-500 font-light">
                  30 sn+ duraklatma sonrası {settings.smartRewindAmountSec} sn geriden başlatır
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ smartRewind: !settings.smartRewind })}
                className={`w-11 h-6 rounded-full transition p-0.5 ${
                  settings.smartRewind ? 'bg-zinc-200' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.smartRewind
                      ? 'translate-x-5 bg-zinc-950'
                      : 'translate-x-0 bg-zinc-500'
                  }`}
                />
              </button>
            </div>

            {/* Varsayılan Uyku Süresi */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Varsayılan Uyku / Odak Süresi</p>
                <p className="text-xs text-zinc-500 font-light">
                  Zamanlayıcı menüsünde öne çıkan süre
                </p>
              </div>
              <select
                value={settings.defaultSleepMinutes}
                onChange={(e) =>
                  onUpdateSettings({ defaultSleepMinutes: parseInt(e.target.value, 10) })
                }
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {[10, 15, 20, 25, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} dakika
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 2. OTOMATİK KLASÖRLEME VE TARAMA */}
        <section className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <FolderSync className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Otomatik Tarih Gruplama ve Klasör</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/45 border border-zinc-800/70 divide-y divide-zinc-800/60">
            {/* Tarihe Göre Otomatik Gruplama */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">
                  Tarihe Göre Otomatik Klasörle
                </p>
                <p className="text-xs text-zinc-500 font-light">
                  Kayıtları Bugün, Dün ve tarih başlıkları altında otomatik gruplar
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({ autoGroupByDate: !settings.autoGroupByDate })
                }
                className={`w-11 h-6 rounded-full transition p-0.5 ${
                  settings.autoGroupByDate ? 'bg-zinc-200' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.autoGroupByDate
                      ? 'translate-x-5 bg-zinc-950'
                      : 'translate-x-0 bg-zinc-500'
                  }`}
                />
              </button>
            </div>

            {/* Tarih Formatı */}
            {settings.autoGroupByDate && (
              <div className="p-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-normal text-zinc-200">Tarih Başlık Formatı</p>
                  <p className="text-xs text-zinc-500 font-light">
                    Klasör başlıklarının görünüm biçimi
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onUpdateSettings({ dateFormat: 'tr-long' })}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      settings.dateFormat === 'tr-long'
                        ? 'bg-white text-zinc-950 border-white font-medium'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    22 Kas 2026
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ dateFormat: 'tr-numeric' })}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      settings.dateFormat === 'tr-numeric'
                        ? 'bg-white text-zinc-950 border-white font-medium'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    22.11.2026
                  </button>
                </div>
              </div>
            )}

            {/* Otomatik Tarama Sıklığı */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Klasör Tarama Sıklığı</p>
                <p className="text-xs text-zinc-500 font-light">
                  {dirHandleConnected
                    ? 'Bağlı klasörde yeni kayıt kontrol aralığı'
                    : 'Klasör bağlandığında geçerli olur'}
                </p>
              </div>
              <select
                value={settings.autoSyncIntervalSec}
                onChange={(e) =>
                  onUpdateSettings({ autoSyncIntervalSec: parseInt(e.target.value, 10) })
                }
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value={0}>Kapalı (Manuel)</option>
                <option value={15}>Her 15 saniye</option>
                <option value={30}>Her 30 saniye</option>
                <option value={60}>Her 60 saniye</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. GÖRÜNÜM VE İNCE TİPOGRAFİ */}
        <section className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Görünüm ve Tipografi</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/45 border border-zinc-800/70 divide-y divide-zinc-800/60">
            {/* Yazı Boyutu */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Metin Ölçeği</p>
                <p className="text-xs text-zinc-500 font-light">
                  İnce arayüz yazı boyutunu ayarlar
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'compact', label: 'Sıkı' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'large', label: 'Büyük' },
                ].map((sz) => (
                  <button
                    key={sz.id}
                    onClick={() => onUpdateSettings({ fontScale: sz.id })}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      settings.fontScale === sz.id
                        ? 'bg-white text-zinc-950 border-white font-medium'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vurgu Rengi */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Vurgu Rengi</p>
                <p className="text-xs text-zinc-500 font-light">
                  Aktif göstergeler ve ilerleme çizgisi tonu
                </p>
              </div>
              <div className="flex items-center gap-2">
                {Object.entries(ACCENT_THEMES).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateSettings({ accentColor: key })}
                    title={theme.name}
                    className={`w-6 h-6 rounded-full ${theme.swatch} transition ${
                      settings.accentColor === key
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110'
                        : 'opacity-55 hover:opacity-90'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Orijinal Dosya Adını Göster */}
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-normal text-zinc-200">Orijinal Dosya Adı</p>
                <p className="text-xs text-zinc-500 font-light">
                  Özel ad verilmiş kayıtlarda orijinal dosya adını altta göster
                </p>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({ showOriginalFilename: !settings.showOriginalFilename })
                }
                className={`w-11 h-6 rounded-full transition p-0.5 ${
                  settings.showOriginalFilename ? 'bg-zinc-200' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.showOriginalFilename
                      ? 'translate-x-5 bg-zinc-950'
                      : 'translate-x-0 bg-zinc-500'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* 4. YEDEKLEME VE VERİ YÖNETİMİ */}
        <section className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <Database className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Yedekleme ve Sıfırlama</span>
          </div>

          <div className="rounded-2xl bg-zinc-900/45 border border-zinc-800/70 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onExportBackup}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Notları & İsimleri Yedekle (JSON)</span>
              </button>

              <button
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition"
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Yedek Geri Yükle</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    onImportBackup(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />

              <button
                onClick={() => {
                  if (
                    JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
                  ) {
                    onResetSettings();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Ayarları Sıfırla</span>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-light">
                Tüm ses dosyalarını ve ilerlemeyi sil
              </span>
              <button
                onClick={onClearAllData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs text-rose-300 transition"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Tüm Verileri Temizle</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}