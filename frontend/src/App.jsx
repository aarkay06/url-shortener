import { useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');

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
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /></span>;
}

function App() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const domain = useMemo(() => {
    if (!result?.shortUrl) return '';
    try { return new URL(result.shortUrl).host; } catch { return ''; }
  }, [result]);

  async function shorten(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setCopied(false);

    let parsed;
    try {
      parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setError('Add a complete link starting with https:// or http://');
      return;
    }

    if (!API_BASE_URL) {
      setError('The API address is not configured yet. Add VITE_API_BASE_URL to your .env file.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/links`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: parsed.href }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'We couldn’t shorten that link. Please try again.');
      setResult(payload);
    } catch (err) {
      setError(err.message || 'Could not reach the service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Clipboard access was blocked. Select and copy the link instead.');
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="snip home"><BrandMark /><span>snip<span className="wordmark-dot">.</span></span></a>
        <div className="topbar-note"><span className="status-dot" /> tiny links, big possibilities</div>
        <span className="topbar-github">A little less link <Icon name="arrow" size={15} /></span>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span className="eyebrow-icon"><Icon name="spark" size={14} /></span> YOUR LINK, JUST A LITTLE LIGHTER</div>
          <h1 id="hero-title">Long link.<br /><span>Little link.</span></h1>
          <p className="hero-copy">The internet is long enough already.<br className="desktop-break" /> Give your links a shorter story to tell.</p>

          <div className="shortener-card">
            <div className="card-topline"><div className="card-label"><span className="label-spark"><Icon name="spark" size={15} /></span> Make it snip</div><span className="private-note"><Icon name="shield" size={14} /> no account needed</span></div>
            <form onSubmit={shorten} noValidate>
              <label className="input-label" htmlFor="long-url">Paste your long link</label>
              <div className={`url-input-wrap ${error ? 'has-error' : ''}`}>
                <Icon name="link" size={20} />
                <input id="long-url" type="url" value={url} onChange={(e) => { setUrl(e.target.value); if (error) setError(''); }} placeholder="https://that-very-long-link.com/and-so-on..." autoComplete="url" />
                {url && <button className="clear-button" type="button" onClick={() => { setUrl(''); setResult(null); setError(''); }} aria-label="Clear URL">×</button>}
              </div>
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Making your little link…</> : <>Make it shorter <Icon name="arrow" size={18} /></>}
              </button>
            </form>

            {result && <div className="result-card" aria-live="polite">
              <div className="result-check"><Icon name="check" size={17} /></div>
              <div className="result-content"><span className="result-caption">YOUR LITTLE LINK IS READY</span><a href={result.shortUrl} target="_blank" rel="noreferrer" className="result-link">{domain}<span>/{result.code}</span></a></div>
              <button className={`copy-button ${copied ? 'copied' : ''}`} type="button" onClick={copyLink}><Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? 'Copied!' : 'Copy'}</button>
            </div>}
            <div className="card-footnote"><span className="footnote-dot" /> Free to use <span className="footnote-divider">·</span> No account needed <span className="footnote-divider">·</span> Ready in a blink</div>
          </div>

          <div className="social-proof"><span className="proof-spark"><Icon name="spark" size={14} /></span><span>For every little thing worth sharing.</span></div>
        </section>

        <section className="benefits" aria-label="Why snip">
          <article className="benefit"><div className="benefit-icon lavender"><Icon name="bolt" size={19} /></div><div><h2>Quick as a click</h2><p>From long to lovely in a moment.</p></div></article>
          <article className="benefit"><div className="benefit-icon peach"><Icon name="shield" size={19} /></div><div><h2>Simple & secure</h2><p>Your links, handled with care.</p></div></article>
          <article className="benefit"><div className="benefit-icon mint"><Icon name="globe" size={19} /></div><div><h2>Share anywhere</h2><p>Fits in every little corner.</p></div></article>
        </section>

        <section className="bottom-note"><span className="note-line" /><p>Less link. <span>More room for everything else.</span></p><span className="note-line" /></section>
      </main>

      <footer className="footer"><a className="footer-brand" href="#top"><BrandMark /> snip.</a><span>Made for the things worth sharing <span className="heart">♥</span></span><span className="footer-year">© 2025 snip</span></footer>
    </div>
  );
}

export default App;
