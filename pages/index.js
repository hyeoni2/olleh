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
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
        layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
        width: chartContainerRef.current.clientWidth,
        height: 500,
        localization: {
          priceFormatter: p => isDollar ? `$${p.toFixed(2)}` : `₩${Math.round(p).toLocaleString()}`,
        },
      });

      const candleSeries = chart.addCandlestickSeries();
      chartRef.current = chart;
      seriesRef.current = candleSeries;

      try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
        const data = await res.json();
        const m = isDollar ? 1 : exchangeRate;
        candleSeries.setData(data.map(d => ({
          time: d[0] / 1000, open: d[1] * m, high: d[2] * m, low: d[3] * m, close: d[4] * m,
        })));
      } catch (e) { console.error("차트 로딩 실패"); }
    };

    const timer = setInterval(() => { if (window.LightweightCharts) { initChart(); clearInterval(timer); } }, 100);
    return () => clearInterval(timer);
  }, [isDollar]);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch(`/api/receive?t=${Date.now()}`); // 캐시 방지
        const data = await res.json();
        if (Array.isArray(data)) {
          setSignals(data);
          
          // 차트 선 그리기 로직
          data.forEach(sig => {
            if (!priceLinesRef.current[sig.id] && seriesRef.current) {
              let p = parseFloat(sig.target_price);
              if (p > 1000000 && isDollar) p /= exchangeRate;
              if (p < 1000000 && !isDollar) p *= exchangeRate;
              priceLinesRef.current[sig.id] = seriesRef.current.createPriceLine({
                price: p, color: '#2962ff', title: `[${sig.user_name}] 진입`, lineWidth: 2, lineStyle: 2
              });
            }
          });

          // 사라진 신호 선 제거
          Object.keys(priceLinesRef.current).forEach(lineId => {
            if (!data.find(s => s.id === lineId) && seriesRef.current) {
              seriesRef.current.removePriceLine(priceLinesRef.current[lineId]);
              delete priceLinesRef.current[lineId];
            }
          });
        }
      } catch (err) { console.error("신호 동기화 실패", err); }
    };
    const loop = setInterval(fetchSignals, 8000); 
    fetchSignals();
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
    <div style={{ padding: '20px', backgroundColor: '#0b0e11', minHeight: '100vh', color: '#eaecef', fontFamily: 'sans-serif' }}>
      <Head><script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h2>📈 올레 실시간 대시보드 (Guri)</h2>
        <button onClick={() => setIsDollar(!isDollar)} style={{ backgroundColor: isDollar ? '#f0b90b' : '#2b2f36', color: isDollar ? '#000' : '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isDollar ? '💵 달러($) 모드' : '₩ 원화(₩) 모드'}
        </button>
      </div>
      <div ref={chartContainerRef} style={{ borderRadius: '12px', overflow: 'hidden', minHeight: '500px', backgroundColor: '#131722', border: '1px solid #2b2f36' }} />
      
      <div style={{ marginTop: '30px', backgroundColor: '#161a1e', borderRadius: '12px', padding: '24px', border: '1px solid #2b2f36' }}>
        <h3>📡 매매 신호 현황 (GitHub 장부)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr style={{ color: '#848e9c', borderBottom: '2px solid #2b2f36' }}><th style={{ padding: '12px' }}>시간</th><th style={{ padding: '12px' }}>이름</th><th style={{ padding: '12px' }}>진입가</th><th style={{ padding: '12px' }}>관리</th></tr></thead>
          <tbody>
            {signals.length > 0 ? (
              signals.map((sig) => (
                <tr key={sig.id} style={{ borderBottom: '1px solid #2b2f36' }}>
                  <td style={{ padding: '15px 12px', fontSize: '0.85rem' }}>{sig.timestamp}</td>
                  <td style={{ padding: '15px 12px' }}>{sig.user_name}</td>
                  <td style={{ padding: '15px 12px', fontWeight: 'bold' }}>{isDollar ? `$ ${(sig.target_price/exchangeRate).toFixed(2)}` : `₩ ${parseInt(sig.target_price).toLocaleString()}`}</td>
                  <td style={{ padding: '15px 12px' }}><button onClick={() => handleExit(sig.id)} style={{ backgroundColor: '#00c076', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>익절</button></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '50px', color: '#848e9c' }}>
                  아직 들어온 신호가 없쪄요. 👶
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}