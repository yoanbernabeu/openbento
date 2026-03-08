import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Users,
  MousePointerClick,
  Clock,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  Calendar,
  Eye,
  Target,
  Zap,
} from 'lucide-react';

type AnalyticsEvent = {
  id: string;
  created_at: string;
  site_id: string;
  event_type: string;
  block_id: string | null;
  destination_url: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  user_agent: string | null;
  language: string | null;
  screen_w: number | null;
  screen_h: number | null;
  viewport_w?: number | null;
  viewport_h?: number | null;
  visitor_id: string | null;
  session_id: string | null;
  duration_seconds: number | null;
  scroll_depth: number | null;
  engaged: boolean;
  block_title: string | null;
  timezone: string | null;
};

const AnalyticsPage: React.FC = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [dbPassword, setDbPassword] = useState(() => {
    // Load from sessionStorage if available
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('openbento_db_password') || '';
    }
    return '';
  });
  const [projectUrl, setProjectUrl] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Save password to sessionStorage when it changes
  useEffect(() => {
    if (dbPassword) {
      sessionStorage.setItem('openbento_db_password', dbPassword);
    }
  }, [dbPassword]);

  // Load config on mount and auto-fetch if password is saved
  useEffect(() => {
    fetch('/__openbento/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.config?.projectUrl) {
          setProjectUrl(data.config.projectUrl);
          // If we have both URL and saved password, auto-fetch
          const savedPassword = sessionStorage.getItem('openbento_db_password');
          if (savedPassword) {
            setDbPassword(savedPassword);
          }
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const fetchAnalytics = useCallback(
    async (customDays?: number) => {
      const daysToFetch = customDays ?? days;
      if (!projectUrl || !dbPassword) {
        setError('Please enter your Supabase URL and database password');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/__openbento/analytics/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectUrl, dbPassword, days: daysToFetch }),
        });

        const data = await res.json();
        if (data.ok) {
          setEvents(data.events || []);
          setIsConfigured(true);
        } else {
          setError(data.error || 'Failed to fetch analytics');
        }
      } catch (e) {
        setError('Network error: ' + (e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [days, dbPassword, projectUrl]
  );

  // Auto-fetch when config is ready
  useEffect(() => {
    if (!initialLoading && projectUrl && dbPassword && !isConfigured) {
      fetchAnalytics();
    }
  }, [dbPassword, fetchAnalytics, initialLoading, isConfigured, projectUrl]);

  // Auto-refresh when days change (if already configured)
  useEffect(() => {
    if (isConfigured && projectUrl && dbPassword) {
      fetchAnalytics(days);
    }
  }, [days, dbPassword, fetchAnalytics, isConfigured, projectUrl]);

  // Compute analytics stats
  const stats = useMemo(() => {
    const pageViews = events.filter((e) => e.event_type === 'page_view');
    const clicks = events.filter((e) => e.event_type === 'click');
    const sessions = events.filter((e) => e.event_type === 'session_end');

    const uniqueVisitors = new Set(events.map((e) => e.visitor_id).filter(Boolean)).size;
    const totalPageViews = pageViews.length;
    const totalClicks = clicks.length;

    // Average session duration
    const durations = sessions
      .map((s) => s.duration_seconds)
      .filter((d): d is number => d !== null);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    // Average scroll depth
    const scrolls = sessions.map((s) => s.scroll_depth).filter((d): d is number => d !== null);
    const avgScroll =
      scrolls.length > 0 ? Math.round(scrolls.reduce((a, b) => a + b, 0) / scrolls.length) : 0;

    // Engagement rate
    const engagedSessions = sessions.filter((s) => s.engaged).length;
    const engagementRate =
      sessions.length > 0 ? Math.round((engagedSessions / sessions.length) * 100) : 0;

    // Click-through rate
    const ctr = totalPageViews > 0 ? Math.round((totalClicks / totalPageViews) * 100) : 0;

    // Traffic sources
    const sources: Record<string, number> = {};
    pageViews.forEach((e) => {
      let source = 'Direct';
      if (e.utm_source) source = e.utm_source;
      else if (e.referrer) {
        try {
          source = new URL(e.referrer).hostname.replace('www.', '');
        } catch {
          source = e.referrer;
        }
      }
      sources[source] = (sources[source] || 0) + 1;
    });

    // Top clicks
    const clicksByBlock: Record<string, { count: number; title: string; url: string }> = {};
    clicks.forEach((e) => {
      const key = e.block_id || 'unknown';
      if (!clicksByBlock[key]) {
        clicksByBlock[key] = {
          count: 0,
          title: e.block_title || key,
          url: e.destination_url || '',
        };
      }
      clicksByBlock[key].count++;
    });

    // Device breakdown
    const devices = { desktop: 0, tablet: 0, mobile: 0 };
    pageViews.forEach((e) => {
      const w = e.screen_w || e.viewport_w || 0;
      if (w >= 1024) devices.desktop++;
      else if (w >= 768) devices.tablet++;
      else devices.mobile++;
    });

    // Browser breakdown (from user agent)
    const browsers: Record<string, number> = {};
    pageViews.forEach((e) => {
      const ua = e.user_agent || '';
      let browser = 'Other';
      if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edg')) browser = 'Edge';
      browsers[browser] = (browsers[browser] || 0) + 1;
    });

    // Views by day
    const viewsByDay: Record<string, number> = {};
    pageViews.forEach((e) => {
      const day = e.created_at.split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    });

    // Languages
    const languages: Record<string, number> = {};
    pageViews.forEach((e) => {
      const lang = (e.language || 'unknown').split('-')[0];
      languages[lang] = (languages[lang] || 0) + 1;
    });

    return {
      uniqueVisitors,
      totalPageViews,
      totalClicks,
      avgDuration,
      avgScroll,
      engagementRate,
      ctr,
      sources: Object.entries(sources)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topClicks: Object.entries(clicksByBlock)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10),
      devices,
      browsers: Object.entries(browsers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      viewsByDay: Object.entries(viewsByDay).sort((a, b) => a[0].localeCompare(b[0])),
      languages: Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [events]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Show loading while checking config
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // If not configured, show setup
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-lg mx-auto">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8"
          >
            <ArrowLeft size={20} />
            Back to Builder
          </a>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <BarChart3 size={24} className="text-violet-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-gray-500">
                  {projectUrl ? 'Enter your database password' : 'Enter your credentials'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {!projectUrl && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                    placeholder="https://xxxxx.supabase.co"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              )}

              {projectUrl && (
                <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 flex items-center gap-2">
                  <Globe size={16} className="text-gray-400" />
                  <span className="truncate">{projectUrl}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database Password
                </label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Your Supabase DB password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  autoFocus={!!projectUrl}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stored in session only (cleared when browser closes)
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={() => fetchAnalytics()}
                disabled={loading || !dbPassword}
                className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <BarChart3 size={18} />
                    View Analytics
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const periodOptions = [
    { value: 1, label: 'Today' },
    { value: 7, label: '7d' },
    { value: 14, label: '14d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
  ];

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <a href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                <ArrowLeft size={20} className="text-gray-600" />
              </a>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Analytics</h1>
                <p className="text-xs sm:text-sm text-gray-500">{events.length} events</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Period selector - quick buttons */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDays(option.value)}
                    className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                      days === option.value
                        ? 'bg-white text-violet-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchAnalytics()}
                disabled={loading}
                className="p-2 sm:px-4 sm:py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Refresh"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<Users size={20} />}
            label="Unique Visitors"
            value={stats.uniqueVisitors.toLocaleString()}
            color="violet"
          />
          <MetricCard
            icon={<Eye size={20} />}
            label="Page Views"
            value={stats.totalPageViews.toLocaleString()}
            color="blue"
          />
          <MetricCard
            icon={<MousePointerClick size={20} />}
            label="Total Clicks"
            value={stats.totalClicks.toLocaleString()}
            subValue={`${stats.ctr}% CTR`}
            color="green"
          />
          <MetricCard
            icon={<Clock size={20} />}
            label="Avg. Time on Page"
            value={formatDuration(stats.avgDuration)}
            subValue={`${stats.avgScroll}% scroll`}
            color="orange"
          />
        </div>

        {/* Engagement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <MetricCard
            icon={<Target size={20} />}
            label="Engagement Rate"
            value={`${stats.engagementRate}%`}
            subValue="Visitors who scrolled >25% and stayed >10s"
            color="pink"
            large
          />
          <MetricCard
            icon={<TrendingUp size={20} />}
            label="Avg. Scroll Depth"
            value={`${stats.avgScroll}%`}
            color="cyan"
            large
          />
          <MetricCard
            icon={<Zap size={20} />}
            label="Click-Through Rate"
            value={`${stats.ctr}%`}
            color="yellow"
            large
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Traffic Sources */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Globe size={20} className="text-gray-400" />
              Traffic Sources
            </h2>
            <div className="space-y-3">
              {stats.sources.length === 0 ? (
                <p className="text-gray-400 text-sm">No traffic data yet</p>
              ) : (
                stats.sources.map(([source, count]) => (
                  <div key={source} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{source}</span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${(count / stats.totalPageViews) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Clicks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MousePointerClick size={20} className="text-gray-400" />
              Top Clicked Links
            </h2>
            <div className="space-y-3">
              {stats.topClicks.length === 0 ? (
                <p className="text-gray-400 text-sm">No clicks yet</p>
              ) : (
                stats.topClicks.map(([blockId, data]) => (
                  <div key={blockId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{data.title}</p>
                      {data.url && <p className="text-xs text-gray-400 truncate">{data.url}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-violet-600">{data.count}</span>
                      <span className="text-xs text-gray-400">clicks</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Devices */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Monitor size={20} className="text-gray-400" />
              Devices
            </h2>
            <div className="space-y-4">
              <DeviceBar
                icon={<Monitor size={18} />}
                label="Desktop"
                value={stats.devices.desktop}
                total={stats.totalPageViews}
              />
              <DeviceBar
                icon={<Tablet size={18} />}
                label="Tablet"
                value={stats.devices.tablet}
                total={stats.totalPageViews}
              />
              <DeviceBar
                icon={<Smartphone size={18} />}
                label="Mobile"
                value={stats.devices.mobile}
                total={stats.totalPageViews}
              />
            </div>
          </div>

          {/* Browsers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Browsers</h2>
            <div className="space-y-3">
              {stats.browsers.map(([browser, count]) => (
                <div key={browser} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{browser}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {count} ({Math.round((count / stats.totalPageViews) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Languages</h2>
            <div className="space-y-3">
              {stats.languages.map(([lang, count]) => (
                <div key={lang} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{lang.toUpperCase()}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {count} ({Math.round((count / stats.totalPageViews) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Views Over Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-gray-400" />
            Page Views Over Time
          </h2>
          <div className="h-48 flex items-end gap-1">
            {stats.viewsByDay.length === 0 ? (
              <p className="text-gray-400 text-sm">No data yet</p>
            ) : (
              stats.viewsByDay.map(([day, count]) => {
                const maxCount = Math.max(...stats.viewsByDay.map(([, c]) => c));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div
                    key={day}
                    className="flex-1 bg-violet-500 rounded-t-lg hover:bg-violet-600 transition-colors cursor-pointer group relative"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day}: ${count} views`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                      {day}: {count}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{stats.viewsByDay[0]?.[0] || ''}</span>
            <span>{stats.viewsByDay[stats.viewsByDay.length - 1]?.[0] || ''}</span>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Event</th>
                  <th className="pb-3 font-medium">Visitor</th>
                  <th className="pb-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 20).map((event) => (
                  <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-gray-500">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          event.event_type === 'page_view'
                            ? 'bg-blue-100 text-blue-700'
                            : event.event_type === 'click'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {event.event_type}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-gray-400">
                      {event.visitor_id?.slice(0, 12) || '—'}
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">
                      {event.event_type === 'click'
                        ? event.block_title || event.destination_url || '—'
                        : event.event_type === 'session_end'
                          ? `${event.duration_seconds}s, ${event.scroll_depth}% scroll`
                          : event.referrer || 'Direct'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  large?: boolean;
}> = ({ icon, label, value, subValue, color, large }) => {
  const colors: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    pink: 'bg-pink-100 text-pink-600',
    cyan: 'bg-cyan-100 text-cyan-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-${large ? '6' : '5'}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}
      >
        {icon}
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`font-bold text-gray-900 ${large ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </motion.div>
  );
};

// Device Bar Component
const DeviceBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number;
}> = ({ icon, label, value, total }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">{percent}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
