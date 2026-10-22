import { useMemo, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const STORAGE_KEY = 'snip_recent_links_v1';

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    bolt: <path d="m13 2-3 9h7L11 22l3-9H7l6-11Z" />,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></>,
    qr: <><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    sliders: <><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>,
    trash: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>,
    chart: <><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></>,
    refresh: <><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></>,
    x: <><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></>,
  };
  return <svg {...shared}>{paths[name] || null}</svg>;
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /></span>;
}

function formatExpiry(timestampSec) {
  if (!timestampSec) return '';
  const date = new Date(timestampSec * 1000);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(timestampSec) {
  if (!timestampSec) return 'Never';
  const diffSec = Math.floor(Date.now() / 1000) - timestampSec;
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function AnalyticsModal({ code, onClose, apiBaseUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/links/${code}/analytics`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load analytics.');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Could not fetch stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [code]);

  const deviceTotal = (data?.devices?.desktop || 0) + (data?.devices?.mobile || 0) + (data?.devices?.tablet || 0);
  const desktopPct = deviceTotal ? Math.round(((data.devices.desktop || 0) / deviceTotal) * 100) : 0;
  const mobilePct = deviceTotal ? Math.round(((data.devices.mobile || 0) / deviceTotal) * 100) : 0;
  const tabletPct = deviceTotal ? Math.max(0, 100 - desktopPct - mobilePct) : 0;

  const topReferrers = data?.referrers ? Object.entries(data.referrers).sort((a, b) => b[1] - a[1]) : [];
  const topCountries = data?.countries ? Object.entries(data.countries).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="analytics-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-header">
          <div className="analytics-title-group">
            <span className="analytics-eyebrow">
              <Icon name="chart" size={13} /> LINK ANALYTICS
            </span>
            <h3 className="analytics-code-title">/{code}</h3>
          </div>
          <div className="analytics-header-actions">
            <button
              className="analytics-refresh-btn"
              onClick={loadData}
              disabled={loading}
              title="Refresh stats"
            >
              <Icon name="refresh" size={14} />
            </button>
            <button
              className="analytics-close-btn"
              onClick={onClose}
              aria-label="Close analytics"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="analytics-loading">
            <span className="spinner analytics-spinner" />
            <span>Fetching live stats…</span>
          </div>
        )}

        {error && (
          <div className="analytics-error">
            <p>{error}</p>
            <button className="analytics-retry-btn" onClick={loadData}>Retry</button>
          </div>
        )}

        {data && !loading && (
          <div className="analytics-body">
            {/* KPI Cards */}
            <div className="analytics-metrics-grid">
              <div className="metric-card primary">
                <span className="metric-label">TOTAL CLICKS</span>
                <span className="metric-value">{data.totalClicks.toLocaleString()}</span>
                <span className="metric-footnote">
                  {data.lastClickedAt ? `Last active ${timeAgo(data.lastClickedAt)}` : 'No clicks yet'}
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-label">LINK STATUS</span>
                <div className="metric-status">
                  <span className={`status-pill ${data.isExpired ? 'expired' : 'active'}`}>
                    {data.isExpired ? 'Expired' : 'Active'}
                  </span>
                </div>
                <span className="metric-footnote">
                  {data.expiresAt ? `Expires ${formatExpiry(data.expiresAt)}` : 'No expiration set'}
                </span>
              </div>
            </div>

            {/* Target URL Info */}
            {data.longUrl && (
              <div className="analytics-target-box">
                <span className="target-label">Destination URL:</span>
                <a href={data.longUrl} target="_blank" rel="noreferrer" className="target-url">
                  <span>{data.longUrl}</span>
                  <Icon name="external" size={12} />
                </a>
              </div>
            )}

            {/* Device Distribution */}
            <div className="analytics-section">
              <div className="section-title-row">
                <span className="section-title">Device Breakdown</span>
                <span className="section-total">{deviceTotal} tracked</span>
              </div>
              {deviceTotal > 0 ? (
                <>
                  <div className="segmented-bar">
                    {desktopPct > 0 && <div className="bar-segment desktop" style={{ width: `${desktopPct}%` }} title={`Desktop: ${desktopPct}%`} />}
                    {mobilePct > 0 && <div className="bar-segment mobile" style={{ width: `${mobilePct}%` }} title={`Mobile: ${mobilePct}%`} />}
                    {tabletPct > 0 && <div className="bar-segment tablet" style={{ width: `${tabletPct}%` }} title={`Tablet: ${tabletPct}%`} />}
                  </div>
                  <div className="device-legend">
                    <span className="legend-item"><span className="legend-dot desktop" /> Desktop {desktopPct}% ({data.devices.desktop || 0})</span>
                    <span className="legend-item"><span className="legend-dot mobile" /> Mobile {mobilePct}% ({data.devices.mobile || 0})</span>
                    <span className="legend-item"><span className="legend-dot tablet" /> Tablet {tabletPct}% ({data.devices.tablet || 0})</span>
                  </div>
                </>
              ) : (
                <p className="empty-hint">Click breakdown will appear here once visitors open your link.</p>
              )}
            </div>

            {/* Top Referrers */}
            <div className="analytics-section">
              <span className="section-title">Top Referral Sources</span>
              {topReferrers.length > 0 ? (
                <div className="referrers-list">
                  {topReferrers.map(([source, count]) => (
                    <div key={source} className="referrer-row">
                      <span className="referrer-name">{source}</span>
                      <span className="referrer-count">{count} {count === 1 ? 'click' : 'clicks'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-hint">No referral sources recorded yet.</p>
              )}
            </div>

            {/* Top Countries */}
            <div className="analytics-section">
              <span className="section-title">Geographic Distribution</span>
              {topCountries.length > 0 ? (
                <div className="countries-grid">
                  {topCountries.map(([country, count]) => (
                    <div key={country} className="country-pill">
                      <span className="country-code">{country}</span>
                      <span className="country-count">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-hint">Regional telemetry will populate as visitors browse.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [url, setUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [showOptions, setShowOptions] = useState(false);

  const [result, setResult] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyCopiedCode, setHistoryCopiedCode] = useState(null);

  // Active analytics code for modal
  const [analyticsCode, setAnalyticsCode] = useState(null);

  // Local storage history of created links
  const [recentLinks, setRecentLinks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentLinks));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [recentLinks]);

  const domain = useMemo(() => {
    if (!result?.shortUrl) {
      if (API_BASE_URL) {
        try { return new URL(API_BASE_URL).host; } catch { return 'url.aarkay.tech'; }
      }
      return 'url.aarkay.tech';
    }
    try { return new URL(result.shortUrl).host; } catch { return 'url.aarkay.tech'; }
  }, [result]);

  async function shorten(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setShowQr(false);
    setCopied(false);

    let parsed;
    try {
      parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setError('Add a complete link starting with https:// or http://');
      return;
    }

    if (customSlug.trim()) {
      const slug = customSlug.trim();
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(slug)) {
        setError('Custom alias must be 3-32 characters and only use letters, numbers, hyphens, or underscores.');
        return;
      }
    }

    if (!API_BASE_URL) {
      setError('The API address is not configured yet. Add VITE_API_BASE_URL to your .env file.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        url: parsed.href,
        expiresInDays: Number(expiresInDays) || 30,
      };
      if (customSlug.trim()) {
        payload.customSlug = customSlug.trim();
      }

      const response = await fetch(`${API_BASE_URL}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'We couldn’t shorten that link. Please try again.');
      }

      const fullResult = {
        ...data,
        longUrl: parsed.href,
      };
      setResult(fullResult);

      // Append to recent links (keep top 6 unique by code)
      setRecentLinks((prev) => {
        const filtered = prev.filter((item) => item.code !== data.code);
        return [fullResult, ...filtered].slice(0, 6);
      });
    } catch (err) {
      setError(err.message || 'Could not reach the service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(linkToCopy, code) {
    if (!linkToCopy) return;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      if (code) {
        setHistoryCopiedCode(code);
        window.setTimeout(() => setHistoryCopiedCode(null), 2000);
      } else {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      setError('Clipboard access was blocked. Select and copy the link instead.');
    }
  }

  function downloadQrPng(code) {
    const svgEl = document.getElementById(`qr-svg-${code}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const size = 600;
    canvas.width = size;
    canvas.height = size;

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 40, 40, size - 80, size - 80);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `snip-${code}.png`;
      a.href = pngUrl;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

  function clearHistory() {
    setRecentLinks([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="snip home"><BrandMark /><span>snip<span className="wordmark-dot">.</span></span></a>
        <div className="topbar-note"><span className="status-dot" /> tiny links, big possibilities</div>
        <a className="topbar-github" href="https://github.com" target="_blank" rel="noreferrer">
          A little less link <Icon name="arrow" size={15} />
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span className="eyebrow-icon"><Icon name="spark" size={14} /></span> YOUR LINK, JUST A LITTLE LIGHTER</div>
          <h1 id="hero-title">Long link.<br /><span>Little link.</span></h1>
          <p className="hero-copy">The internet is long enough already.<br className="desktop-break" /> Give your links a shorter story to tell.</p>

          <div className="shortener-card">
            <div className="card-topline">
              <div className="card-label"><span className="label-spark"><Icon name="spark" size={15} /></span> Make it snip</div>
              <span className="private-note"><Icon name="shield" size={14} /> no account needed</span>
            </div>

            <form onSubmit={shorten} noValidate>
              <label className="input-label" htmlFor="long-url">Paste your long link</label>
              <div className={`url-input-wrap ${error && !customSlug ? 'has-error' : ''}`}>
                <Icon name="link" size={20} />
                <input
                  id="long-url"
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (error) setError(''); }}
                  placeholder="https://that-very-long-link.com/and-so-on..."
                  autoComplete="url"
                />
                {url && (
                  <button className="clear-button" type="button" onClick={() => { setUrl(''); setResult(null); setError(''); }} aria-label="Clear URL">×</button>
                )}
              </div>

              {/* Options Toggle */}
              <div className="options-toggle-row">
                <button
                  type="button"
                  className={`options-toggle-btn ${showOptions ? 'active' : ''}`}
                  onClick={() => setShowOptions(!showOptions)}
                  aria-expanded={showOptions}
                >
                  <Icon name="sliders" size={14} />
                  <span>Customize alias & expiration</span>
                  <span className="toggle-chevron">{showOptions ? '−' : '+'}</span>
                </button>
              </div>

              {/* Collapsible Options Drawer */}
              {showOptions && (
                <div className="options-drawer" aria-label="Custom settings">
                  <div className="option-field">
                    <label className="input-label" htmlFor="custom-slug">
                      Custom alias <span className="label-optional">(optional)</span>
                    </label>
                    <div className="slug-input-wrap">
                      <span className="slug-prefix">{domain}/</span>
                      <input
                        id="custom-slug"
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                        placeholder="my-custom-slug"
                        maxLength={32}
                      />
                    </div>
                    <span className="field-hint">3–32 characters (letters, numbers, hyphens, underscores)</span>
                  </div>

                  <div className="option-field">
                    <label className="input-label" htmlFor="expiry-select">
                      Link valid for
                    </label>
                    <div className="expiry-pills" role="radiogroup" aria-label="Expiry duration">
                      {[
                        { label: '7 days', value: '7' },
                        { label: '30 days', value: '30' },
                        { label: '90 days', value: '90' },
                        { label: '1 year', value: '365' },
                      ].map((pill) => (
                        <button
                          key={pill.value}
                          type="button"
                          role="radio"
                          aria-checked={expiresInDays === pill.value}
                          className={`expiry-pill ${expiresInDays === pill.value ? 'selected' : ''}`}
                          onClick={() => setExpiresInDays(pill.value)}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="error-message" role="alert">{error}</p>}

              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Making your little link…</> : <>Make it shorter <Icon name="arrow" size={18} /></>}
              </button>
            </form>

            {/* Result Card */}
            {result && (
              <div className="result-card-container">
                <div className="result-card" aria-live="polite">
                  <div className="result-check"><Icon name="check" size={17} /></div>
                  <div className="result-content">
                    <div className="result-top">
                      <span className="result-caption">YOUR LITTLE LINK IS READY</span>
                      {result.expiresAt && (
                        <span className="result-expiry-badge">
                          <Icon name="clock" size={11} /> Valid until {formatExpiry(result.expiresAt)}
                        </span>
                      )}
                    </div>
                    <a href={result.shortUrl} target="_blank" rel="noreferrer" className="result-link">
                      {domain}<span>/{result.code}</span>
                    </a>
                  </div>
                  <div className="result-actions">
                    <button
                      className={`copy-button ${copied ? 'copied' : ''}`}
                      type="button"
                      onClick={() => copyLink(result.shortUrl)}
                    >
                      <Icon name={copied ? 'check' : 'copy'} size={15} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      className="analytics-btn"
                      type="button"
                      onClick={() => setAnalyticsCode(result.code)}
                      title="View real-time analytics"
                    >
                      <Icon name="chart" size={15} />
                      <span>Stats</span>
                    </button>
                    <button
                      className={`qr-toggle-btn ${showQr ? 'active' : ''}`}
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      aria-label="Toggle QR code"
                      title="Show QR Code"
                    >
                      <Icon name="qr" size={16} />
                    </button>
                    <a
                      href={result.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="external-open-btn"
                      aria-label="Open short link"
                      title="Open short link"
                    >
                      <Icon name="external" size={15} />
                    </a>
                  </div>
                </div>

                {/* QR Code Tray */}
                {showQr && (
                  <div className="qr-tray" aria-label="QR Code">
                    <div className="qr-canvas-box">
                      <QRCodeSVG
                        id={`qr-svg-${result.code}`}
                        value={result.shortUrl}
                        size={150}
                        level="H"
                        includeMargin={false}
                        fgColor="#24233a"
                      />
                    </div>
                    <div className="qr-tray-content">
                      <div className="qr-heading">Scan to visit</div>
                      <p className="qr-desc">Instant mobile access to your shortened link.</p>
                      <button
                        type="button"
                        className="download-qr-btn"
                        onClick={() => downloadQrPng(result.code)}
                      >
                        <Icon name="download" size={14} /> Download PNG
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="card-footnote">
              <span className="footnote-dot" /> Free to use <span className="footnote-divider">·</span> Live analytics <span className="footnote-divider">·</span> Custom alias & QR ready
            </div>
          </div>

          {/* Recent Links History */}
          {recentLinks.length > 0 && (
            <div className="history-section" aria-label="Recent links history">
              <div className="history-header">
                <div className="history-title">
                  <Icon name="history" size={15} />
                  <span>Recent links on this device</span>
                  <span className="history-count">{recentLinks.length}</span>
                </div>
                <button
                  type="button"
                  className="history-clear-btn"
                  onClick={clearHistory}
                  title="Clear history"
                >
                  <Icon name="trash" size={13} /> Clear
                </button>
              </div>

              <div className="history-list">
                {recentLinks.map((item) => {
                  const isCopied = historyCopiedCode === item.code;
                  return (
                    <div key={item.code} className="history-item">
                      <div className="history-item-details">
                        <div className="history-short">
                          <a href={item.shortUrl} target="_blank" rel="noreferrer" className="history-code-link">
                            /{item.code}
                          </a>
                          {item.expiresAt && (
                            <span className="history-expiry">
                              exp: {formatExpiry(item.expiresAt)}
                            </span>
                          )}
                        </div>
                        {item.longUrl && (
                          <div className="history-destination" title={item.longUrl}>
                            {item.longUrl}
                          </div>
                        )}
                      </div>
                      <div className="history-item-actions">
                        <button
                          type="button"
                          className="history-stats-btn"
                          onClick={() => setAnalyticsCode(item.code)}
                          title="View stats"
                        >
                          <Icon name="chart" size={13} />
                          <span>Stats</span>
                        </button>
                        <button
                          type="button"
                          className={`history-copy-btn ${isCopied ? 'copied' : ''}`}
                          onClick={() => copyLink(item.shortUrl, item.code)}
                          title="Copy link"
                        >
                          <Icon name={isCopied ? 'check' : 'copy'} size={14} />
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="social-proof">
            <span className="proof-spark"><Icon name="spark" size={14} /></span>
            <span>For every little thing worth sharing.</span>
          </div>
        </section>

        <section className="benefits" aria-label="Why snip">
          <article className="benefit">
            <div className="benefit-icon lavender"><Icon name="bolt" size={19} /></div>
            <div>
              <h2>Custom & Instant</h2>
              <p>Pick memorable slugs and instant QR codes.</p>
            </div>
          </article>
          <article className="benefit">
            <div className="benefit-icon peach"><Icon name="shield" size={19} /></div>
            <div>
              <h2>Live Analytics</h2>
              <p>Track clicks, devices, and traffic sources in real time.</p>
            </div>
          </article>
          <article className="benefit">
            <div className="benefit-icon mint"><Icon name="globe" size={19} /></div>
            <div>
              <h2>Share anywhere</h2>
              <p>Scan, copy, and track on your favorite device.</p>
            </div>
          </article>
        </section>

        <section className="bottom-note">
          <span className="note-line" />
          <p>Less link. <span>More room for everything else.</span></p>
          <span className="note-line" />
        </section>
      </main>

      {/* Analytics Modal */}
      {analyticsCode && (
        <AnalyticsModal
          code={analyticsCode}
          onClose={() => setAnalyticsCode(null)}
          apiBaseUrl={API_BASE_URL}
        />
      )}

      <footer className="footer">
        <a className="footer-brand" href="#top"><BrandMark /> snip.</a>
        <span>Made for the things worth sharing <span className="heart">♥</span></span>
        <span className="footer-year">© 2026 snip</span>
      </footer>
    </div>
  );
}

export default App;
