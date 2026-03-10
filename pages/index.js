import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

export default function App() {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef({});
  
  const [signals, setSignals] = useState([]); 
  const [isDollar, setIsDollar] = useState(true); 
  const exchangeRate = 1420;

  const getUserTheme = (name) => {
    const themes = {
      '아빠': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', emoji: '👨‍💻' },
      '엄마': { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', emoji: '👩‍🎨' },
      '여울': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', emoji: '👶' },
      '여름': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', emoji: '👶' },
    };
    return themes[name] || { color: '#848e9c', bg: 'rgba(132, 142, 156, 0.1)', emoji: '👤' };
  };

  useEffect(() => {
    const initChart = async () => {
      if (!window.LightweightCharts || !chartContainerRef.current) return;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; priceLinesRef.current = {}; }

      const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
        layout: { background: { color: '#161a1e' }, textColor: '#9ea3ae', fontFamily: 'Pretendard, sans-serif' },
        grid: { vertLines: { color: 'rgba(43, 47, 54, 0.5)' }, horzLines: { color: 'rgba(43, 47, 54, 0.5)' } },
        width: chartContainerRef.current.clientWidth, height: 450,
        localization: { priceFormatter: p => isDollar ? `$${p.toFixed(2)}` : `₩${Math.round(p).toLocaleString()}` },
      });

      const candleSeries = chart.addCandlestickSeries({ upColor: '#00c076', downColor: '#ff3b30', borderUpColor: '#00c076', borderDownColor: '#ff3b30', wickUpColor: '#00c076', wickDownColor: '#ff3b30' });
      chartRef.current = chart; seriesRef.current = candleSeries;

      try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
        const data = await res.json();
        const m = isDollar ? 1 : exchangeRate;
        candleSeries.setData(data.map(d => ({ time: d[0] / 1000, open: d[1] * m, high: d[2] * m, low: d[3] * m, close: d[4] * m })));
        fetchSignals(); 
      } catch (e) { console.error("차트 로드 실패"); }
    };
    const timer = setInterval(() => { if (window.LightweightCharts) { initChart(); clearInterval(timer); } }, 100);
    return () => clearInterval(timer);
  }, [isDollar]);

  const fetchSignals = async () => {
    try {
      const res = await fetch(`/api/receive?t=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSignals(data);
        if (!seriesRef.current) return;
        data.forEach(sig => {
          if (priceLinesRef.current[sig.id]) return;
          let p = parseFloat(sig.target_price);
          if (p > 1000000 && isDollar) p /= exchangeRate;
          if (p < 1000000 && !isDollar) p *= exchangeRate;
          const theme = getUserTheme(sig.user_name);
          priceLinesRef.current[sig.id] = seriesRef.current.createPriceLine({ price: p, color: theme.color, title: `${sig.user_name}`, lineWidth: 2, lineStyle: 2, axisLabelVisible: true });
        });
        Object.keys(priceLinesRef.current).forEach(id => { if (!data.find(s => s.id === id)) { seriesRef.current.removePriceLine(priceLinesRef.current[id]); delete priceLinesRef.current[id]; }});
      }
    } catch (err) { console.error("동기화 에러", err); }
  };

  useEffect(() => { const loop = setInterval(fetchSignals, 8000); return () => clearInterval(loop); }, [isDollar]);

  // 💡 종료 핸들러 (익절/손절/취소)
  const handleTerminate = async (id, status, entryPrice) => {
    let exitPrice = 0;
    if (status !== 'canceled') {
      const label = status === 'profit' ? '익절' : '손절';
      const defaultVal = isDollar ? (entryPrice / exchangeRate).toFixed(2) : entryPrice;
      const input = prompt(`${label} 가격을 입력하세요 (${isDollar ? '$' : '₩'}):`, defaultVal);
      if (input === null) return;
      exitPrice = isDollar ? parseFloat(input) * exchangeRate : parseFloat(input);
    }

    const res = await fetch(`/api/receive?id=${id}&status=${status}&exitPrice=${exitPrice}`, { method: 'DELETE' });
    if (res.ok) {
      const result = await res.json();
      if (status === 'profit') {
        window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f0b90b', '#00c076', '#ffffff'] });
        alert(`🎉 익절 성공! 수익률: ${result.profit}%`);
      } else if (status === 'loss') {
        alert(`📉 손절 완료. 다음 기회를 노려봐요! 손실률: ${result.profit}%`);
      }
      setSignals(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div style={{ padding: '40px 20px', backgroundColor: '#0b0e11', minHeight: '100vh', color: '#ffffff', fontFamily: 'Pretendard, sans-serif' }}>
      <Head>
        <title>Olleh Dashboard</title>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
      </Head>
      
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px 0' }}>📊 올레 실시간 보드</h1>
          <p style={{ color: '#848e9c', margin: 0 }}>Guri Sweet Home Dashboard</p>
        </div>
        <button onClick={() => setIsDollar(!isDollar)} style={{ backgroundColor: isDollar ? '#f0b90b' : '#2b2f36', color: isDollar ? '#000' : '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: isDollar ? '0 4px 15px rgba(240, 185, 11, 0.3)' : 'none' }}>
          {isDollar ? '💵 USD Mode' : '₩ KRW Mode'}
        </button>
      </div>
      
      <div style={{ maxWidth: '1000px', margin: '0 auto 40px auto', backgroundColor: '#161a1e', borderRadius: '24px', padding: '20px', border: '1px solid #2b2f36', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div ref={chartContainerRef} style={{ borderRadius: '16px', overflow: 'hidden' }} />
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#f0b90b' }}>●</span> 현재 활성 신호</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {signals.map((sig) => {
            const theme = getUserTheme(sig.user_name);
            const entry = parseFloat(sig.target_price);
            return (
              <div key={sig.id} style={{ backgroundColor: '#1e2329', borderRadius: '24px', padding: '24px', border: `1px solid ${theme.color}44`, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#848e9c', fontSize: '12px' }}>{sig.timestamp}</span>
                  <span style={{ backgroundColor: theme.bg, color: theme.color, padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>Active</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', backgroundColor: '#2b2f36', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{theme.emoji}</div>
                  <div><div style={{ fontSize: '17px', fontWeight: 'bold' }}>{sig.user_name}</div><div style={{ fontSize: '13px', color: '#f0b90b' }}>{sig.coin_symbol || 'BTC'}/USDT</div></div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', margin: '10px 0' }}>
                  {isDollar ? `$ ${(entry/exchangeRate).toFixed(2)}` : `₩ ${entry.toLocaleString()}`}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleTerminate(sig.id, 'profit', entry)} style={{ flex: 2, backgroundColor: '#00c076', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>익절</button>
                  <button onClick={() => handleTerminate(sig.id, 'loss', entry)} style={{ flex: 1.2, backgroundColor: '#ff3b30', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>손절</button>
                  <button onClick={() => handleTerminate(sig.id, 'canceled', entry)} style={{ flex: 1, backgroundColor: '#2b2f36', color: '#848e9c', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>취소</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}