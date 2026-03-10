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

  useEffect(() => {
    const initChart = async () => {
      if (!window.LightweightCharts || !chartContainerRef.current) return;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        priceLinesRef.current = {}; 
      }

      const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
        layout: { 
          background: { color: '#161a1e' }, 
          textColor: '#9ea3ae',
          fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
        },
        grid: {
          vertLines: { color: 'rgba(43, 47, 54, 0.5)' },
          horzLines: { color: 'rgba(43, 47, 54, 0.5)' },
        },
        crosshair: { mode: 0 },
        width: chartContainerRef.current.clientWidth,
        height: 450,
        localization: {
          priceFormatter: p => isDollar ? `$${p.toFixed(2)}` : `₩${Math.round(p).toLocaleString()}`,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00c076', downColor: '#ff3b30',
        borderUpColor: '#00c076', borderDownColor: '#ff3b30',
        wickUpColor: '#00c076', wickDownColor: '#ff3b30',
      });

      chartRef.current = chart;
      seriesRef.current = candleSeries;

      try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
        const data = await res.json();
        const m = isDollar ? 1 : exchangeRate;
        candleSeries.setData(data.map(d => ({
          time: d[0] / 1000, open: d[1] * m, high: d[2] * m, low: d[3] * m, close: d[4] * m,
        })));
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
          
          priceLinesRef.current[sig.id] = seriesRef.current.createPriceLine({
            price: p, color: '#3b82f6', title: `${sig.user_name}`,
            lineWidth: 2, lineStyle: 2, axisLabelVisible: true,
          });
        });
      }
    } catch (err) { console.error("장부 동기화 에러", err); }
  };

  useEffect(() => {
    const loop = setInterval(fetchSignals, 8000);
    return () => clearInterval(loop);
  }, [isDollar]);

  const handleExit = async (id) => {
    const res = await fetch(`/api/receive?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (priceLinesRef.current[id] && seriesRef.current) {
        seriesRef.current.removePriceLine(priceLinesRef.current[id]);
        delete priceLinesRef.current[id];
      }
      setSignals(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div style={{ padding: '40px 20px', backgroundColor: '#0b0e11', minHeight: '100vh', color: '#ffffff', fontFamily: 'Pretendard, sans-serif' }}>
      <Head>
        <title>Olleh Dashboard</title>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
      </Head>
      
      {/* Header */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '32px' }}>📊</span> 올레 실시간 보드
          </h1>
          <p style={{ color: '#848e9c', margin: 0 }}>Guri Sweet Home Dashboard</p>
        </div>
        <button 
          onClick={() => setIsDollar(!isDollar)} 
          style={{ 
            backgroundColor: isDollar ? '#f0b90b' : '#2b2f36', 
            color: isDollar ? '#000' : '#fff', 
            border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold',
            transition: 'all 0.2s', boxShadow: isDollar ? '0 4px 15px rgba(240, 185, 11, 0.3)' : 'none'
          }}
        >
          {isDollar ? '💵 USD Mode' : '₩ KRW Mode'}
        </button>
      </div>
      
      {/* Chart Section */}
      <div style={{ 
        maxWidth: '1000px', margin: '0 auto 40px auto', backgroundColor: '#161a1e', 
        borderRadius: '24px', padding: '20px', border: '1px solid #2b2f36',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>
        <div ref={chartContainerRef} style={{ borderRadius: '16px', overflow: 'hidden' }} />
      </div>

      {/* Signal Cards Section */}
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#f0b90b' }}>●</span> 현재 활성 신호
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {signals.length > 0 ? (
            signals.map((sig) => (
              <div key={sig.id} style={{ 
                backgroundColor: '#1e2329', borderRadius: '20px', padding: '20px', 
                border: '1px solid #2b2f36', transition: 'transform 0.2s',
                display: 'flex', flexDirection: 'column', gap: '15px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#848e9c', fontSize: '12px' }}>{sig.timestamp}</span>
                  <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>Active</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#2b2f36', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '20px' }}>👶</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{sig.user_name}</div>
                    <div style={{ fontSize: '14px', color: '#f0b90b' }}>BTC/USDT</div>
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
                  {isDollar 
                    ? `$ ${(parseFloat(sig.target_price) > 1000000 ? parseFloat(sig.target_price)/exchangeRate : parseFloat(sig.target_price)).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                    : `₩ ${parseInt(sig.target_price < 1000000 ? sig.target_price * exchangeRate : sig.target_price).toLocaleString()}`
                  }
                </div>
                <button 
                  onClick={() => handleExit(sig.id)} 
                  style={{ 
                    width: '100%', backgroundColor: '#00c076', color: '#fff', border: 'none', 
                    padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#00a364'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#00c076'}
                >
                  익절 완료
                </button>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', backgroundColor: '#161a1e', borderRadius: '24px', border: '1px dashed #2b2f36' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>💤</div>
              <div style={{ color: '#848e9c' }}>아직 들어온 신호가 없쪄요. 올레는 자는 중!</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}