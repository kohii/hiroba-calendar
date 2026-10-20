'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, Filter, Star, ExternalLink, MapPin, Clock, Users } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { DataSet, Event, Center } from '@/lib/schema';

// This would normally be imported from data/dataset.json
// For now, we'll use a placeholder
const MOCK_DATASET: DataSet = {
  centers: [],
  sourceDocuments: [],
  events: [],
  generatedAt: new Date().toISOString(),
  version: '1.0.0',
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [dataset, setDataset] = useState<DataSet>(MOCK_DATASET);
  const [selectedCenters, setSelectedCenters] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showFilters, setShowFilters] = useState(false);
  
  // Load data
  useEffect(() => {
    fetch('/data/dataset.json')
      .then(res => res.json())
      .then(data => setDataset(data))
      .catch(err => console.error('Failed to load dataset:', err));
  }, []);
  
  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('favorites');
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);
  
  // Load state from URL
  useEffect(() => {
    const centers = searchParams.get('centers');
    const month = searchParams.get('month');
    const view = searchParams.get('view');
    
    if (centers) {
      setSelectedCenters(new Set(centers.split(',')));
    } else if (favorites.size > 0) {
      // Default to favorites if no centers in URL and favorites are loaded
      setSelectedCenters(new Set(favorites));
    }
    
    if (month) {
      setSelectedMonth(month);
    } else {
      // Default to current month
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    
    if (view === 'calendar' || view === 'list') {
      setViewMode(view);
    }
  }, [searchParams, favorites]);
  
  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (selectedCenters.size > 0) {
      params.set('centers', Array.from(selectedCenters).join(','));
    }
    
    if (selectedMonth) {
      params.set('month', selectedMonth);
    }
    
    if (viewMode !== 'list') {
      params.set('view', viewMode);
    }
    
    const newUrl = params.toString() ? `/?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [selectedCenters, selectedMonth, viewMode, router]);
  
  // Toggle favorite
  const toggleFavorite = (centerId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(centerId)) {
      newFavorites.delete(centerId);
    } else {
      newFavorites.add(centerId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(Array.from(newFavorites)));
  };
  
  // Toggle center selection
  const toggleCenter = (centerId: string) => {
    const newSelection = new Set(selectedCenters);
    if (newSelection.has(centerId)) {
      newSelection.delete(centerId);
    } else {
      newSelection.add(centerId);
    }
    setSelectedCenters(newSelection);
  };
  
  // Filter events
  const filteredEvents = useMemo(() => {
    return dataset.events.filter(event => {
      // Filter by selected centers
      if (selectedCenters.size > 0 && !selectedCenters.has(event.centerId)) {
        return false;
      }
      
      // Filter by selected month
      if (selectedMonth && !event.date.startsWith(selectedMonth)) {
        return false;
      }
      
      return true;
    });
  }, [dataset.events, selectedCenters, selectedMonth]);
  
  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();
    for (const event of filteredEvents) {
      if (!grouped.has(event.date)) {
        grouped.set(event.date, []);
      }
      grouped.get(event.date)!.push(event);
    }
    return grouped;
  }, [filteredEvents]);
  
  // Calendar grid data
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days to start on Sunday
    const startDay = getDay(monthStart);
    const paddingDays = Array(startDay).fill(null);
    
    return [...paddingDays, ...days];
  }, [selectedMonth]);
  
  // Navigate month
  const goToPreviousMonth = () => {
    if (!selectedMonth) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = subMonths(new Date(year, month - 1), 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };
  
  const goToNextMonth = () => {
    if (!selectedMonth) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = addMonths(new Date(year, month - 1), 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };
  
  // Get center by ID
  const getCenterById = (id: string): Center | undefined => {
    return dataset.centers.find(c => c.id === id);
  };
  
  // Get source PDF URL for an event
  const getSourcePDF = (event: Event): string | undefined => {
    const doc = dataset.sourceDocuments.find(d => d.id === event.sourceDocumentId);
    return doc?.pdfUrl;
  };
  
  // Get color for center (consistent colors for each center)
  const getCenterColor = (centerId: string): string => {
    const colors: Record<string, string> = {
      'nishi': '#3b82f6',     // blue-500
      'kita': '#10b981',      // green-500
      'omiya': '#f59e0b',     // amber-500
      'minuma': '#ec4899',    // pink-500
      'yono': '#8b5cf6',      // violet-500
      'sakura': '#f43f5e',    // rose-500
      'urawa': '#06b6d4',     // cyan-500
      'minami': '#84cc16',    // lime-500
      'midori': '#14b8a6',    // teal-500
      'iwatsuki': '#a855f7',  // purple-500
    };
    return colors[centerId] || '#6b7280'; // gray-500 default
  };
  
  // Sort centers: favorites first, then alphabetically
  const sortedCenters = useMemo(() => {
    return [...dataset.centers].sort((a, b) => {
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.nameJa.localeCompare(b.nameJa, 'ja');
    });
  }, [dataset.centers, favorites]);
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-7 h-7" />
            さいたま市子育て支援センター イベントスケジュール
          </h1>
          <p className="text-blue-100 mt-1 text-sm">
            複数のセンターのスケジュールを一覧で確認できます
          </p>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
            >
              <Filter className="w-5 h-5" />
              フィルター
              {selectedCenters.size > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm">
                  {selectedCenters.size}
                </span>
              )}
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                リスト
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded ${
                  viewMode === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                カレンダー
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div className="space-y-4 border-t pt-4">
              {/* Month selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  月を選択
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2"
                />
              </div>
              
              {/* Center selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  センターを選択
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {sortedCenters.map(center => (
                    <div key={center.id} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(center.id)}
                        className={`p-1 rounded ${
                          favorites.has(center.id)
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
                        }`}
                        title={favorites.has(center.id) ? 'お気に入りから削除' : 'お気に入りに追加'}
                      >
                        <Star
                          className={`w-4 h-4 ${favorites.has(center.id) ? 'fill-current' : ''}`}
                        />
                      </button>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCenters.has(center.id)}
                          onChange={() => toggleCenter(center.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{center.nameJa}</span>
                      </label>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedCenters(new Set(dataset.centers.map(c => c.id)))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    すべて選択
                  </button>
                  <button
                    onClick={() => setSelectedCenters(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    クリア
                  </button>
                  <button
                    onClick={() => setSelectedCenters(favorites)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    お気に入りのみ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Events */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <p>表示するイベントがありません</p>
            <p className="text-sm mt-2">
              センターと月を選択してください
            </p>
          </div>
        ) : viewMode === 'calendar' ? (
          /* Calendar View */
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Month navigation */}
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
              <button
                onClick={goToPreviousMonth}
                className="px-3 py-1 rounded hover:bg-gray-200 text-gray-700"
              >
                ← 前月
              </button>
              <h2 className="font-bold text-lg text-gray-800">
                {selectedMonth && format(parseISO(selectedMonth + '-01'), 'yyyy年M月', { locale: ja })}
              </h2>
              <button
                onClick={goToNextMonth}
                className="px-3 py-1 rounded hover:bg-gray-200 text-gray-700"
              >
                次月 →
              </button>
            </div>
            
            {/* Calendar grid */}
            <div className="p-2 sm:p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                  <div
                    key={day}
                    className={`text-center font-bold text-sm py-2 ${
                      i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="aspect-square" />;
                  }
                  
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate.get(dateStr) || [];
                  const dayOfWeek = getDay(day);
                  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                  
                  return (
                    <div
                      key={dateStr}
                      className={`aspect-square border rounded overflow-hidden ${
                        isToday ? 'border-blue-500 border-2' : 'border-gray-200'
                      } ${
                        dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="h-full flex flex-col">
                        {/* Date number */}
                        <div
                          className={`text-center font-bold text-xs sm:text-sm py-0.5 sm:py-1 ${
                            dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          {format(day, 'd')}
                        </div>
                        
                        {/* Events */}
                        <div className="flex-1 overflow-y-auto px-0.5 sm:px-1 pb-0.5 sm:pb-1 space-y-0.5">
                          {dayEvents.map(event => {
                            const center = getCenterById(event.centerId);
                            return (
                              <div
                                key={event.id}
                                className="text-xs p-0.5 sm:p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: getCenterColor(event.centerId),
                                }}
                                title={`${center?.nameJa}: ${event.title}${event.startTime ? ` ${event.startTime}` : ''}`}
                              >
                                <div className="font-medium text-white truncate leading-tight">
                                  {center?.nameJa}
                                </div>
                                <div className="text-white truncate leading-tight opacity-90">
                                  {event.title}
                                </div>
                                {event.startTime && (
                                  <div className="text-white text-[10px] opacity-80">
                                    {event.startTime}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Legend */}
            <div className="border-t p-4 bg-gray-50">
              <h3 className="text-sm font-bold mb-2 text-gray-700">センター凡例</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {sortedCenters
                  .filter(c => selectedCenters.size === 0 || selectedCenters.has(c.id))
                  .map(center => (
                    <div key={center.id} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getCenterColor(center.id) }}
                      />
                      <span className="text-sm">{center.nameJa}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-6">
            {Array.from(eventsByDate.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, events]) => (
                <div key={date} className="bg-white rounded-lg shadow">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <h2 className="font-bold text-lg text-gray-800">
                      {format(parseISO(date), 'M月d日(E)', { locale: ja })}
                    </h2>
                  </div>
                  <div className="divide-y">
                    {events.map(event => {
                      const center = getCenterById(event.centerId);
                      const pdfUrl = getSourcePDF(event);
                      
                      return (
                        <div key={event.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded font-medium">
                                  {center?.nameJa}
                                </span>
                                {event.reservationRequired && (
                                  <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                                    要予約
                                  </span>
                                )}
                              </div>
                              
                              <h3 className="font-bold text-gray-900 mb-1">
                                {event.title}
                              </h3>
                              
                              <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                                {(event.startTime || event.endTime) && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {event.startTime || ''}
                                    {event.startTime && event.endTime && '〜'}
                                    {event.endTime || ''}
                                  </span>
                                )}
                                
                                {event.targetAge && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {event.targetAge}
                                  </span>
                                )}
                                
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {event.location}
                                  </span>
                                )}
                              </div>
                              
                              {event.description && (
                                <p className="text-sm text-gray-700 mb-2">
                                  {event.description}
                                </p>
                              )}
                              
                              {event.tags && event.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {event.tags.map(tag => (
                                    <span
                                      key={tag}
                                      className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {pdfUrl && (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm whitespace-nowrap"
                                title="元のPDFを確認"
                              >
                                <ExternalLink className="w-4 h-4" />
                                PDF
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{filteredEvents.length} 件のイベント</p>
          {dataset.generatedAt && (
            <p className="mt-1">
              データ更新: {format(parseISO(dataset.generatedAt), 'yyyy年M月d日 HH:mm', { locale: ja })}
            </p>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-12 py-6 bg-gray-100 text-center text-sm text-gray-600">
        <p>
          このサイトは各子育て支援センターの公開PDFから情報を収集しています。
        </p>
        <p className="mt-1">
          最新の情報は各センターのPDFリンクから元資料をご確認ください。
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
