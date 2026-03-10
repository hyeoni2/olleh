import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

export default function App() {
  const chartContainerRef = useRef();
  const [isDollar, setIsDollar] = useState(true);
  const [lastProcessedTime, setLastProcessedTime] = useState(null); // 중복 처리 방지
  const exchangeRate = 1420;

  useEffect(() => {
    // 1. 차트 초기화
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 550,
      layout: { background: { color: '#0b0e11' }, textColor: '#92949a' },
      grid: { vertLines: { color: 'rgba(43, 43, 67, 0.5)' }, horzLines: { color: 'rgba(43, 43, 67, 0.5)' } },
      localization: {
        priceFormatter: p => isDollar ? `$${p.toLocaleString()}` : `₩${(p * exchangeRate).toLocaleString()}`
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00c076', downColor: '#ff3b30', borderVisible: false,
      wickUpColor: '#00c076', wickDownColor: '#ff3b30',
    });

    // 2. 초기 과거 데이터 로드
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=200')
      .then(res => res.json())
      .then(data => {
        const history = data.map(d => ({
          time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
        }));
        candleSeries.setData(history);
      });

    // 3. POST로 들어온 신호 데이터 감지 (5초마다 확인)
    const fetchSignal = async () => {
      try {
        const res = await fetch('/api/receive');
        const data = await res.json();

        // 새로운 데이터가 있고, 타임스탬프가 이전과 다를 때만 선을 그림
        if (data && data.timestamp !== lastProcessedTime) {
          const entryPrice = parseFloat(data.action.split('_')[1]);
          const user = data.user;
          
          // 기존 선 제거 대신 새로운 선 추가 (필요 시 chart.removePriceLine 사용)
          const lineStyle = { lineWidth: 2, lineStyle: 2, axisLabelVisible: true };
          candleSeries.createPriceLine({ ...lineStyle, price: entryPrice, color: '#2962ff', title: `[${user}] ENTRY` });
          candleSeries.createPriceLine({ ...lineStyle, price: entryPrice * 1.03, color: '#00c076', title: `TP (익절)` });
          candleSeries.createPriceLine({ ...lineStyle, price: entryPrice * 0.98, color: '#f23645', title: `SL (손절)` });

          setLastProcessedTime(data.timestamp); // 처리 완료 기록
        }
      } catch (err) {
        console.error("Signal fetch error:", err);
      }
    };

    const signalInterval = setInterval(fetchSignal, 5000);

    // 4. 실시간 웹소켓 연결
    const socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
    socket.onmessage = (e) => {
      const k = JSON.parse(e.data).k;
      candleSeries.update({
        time: k.t / 1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c)
      });
    };

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      socket.close();
      clearInterval(signalInterval);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDollar, lastProcessedTime]);

  return (
    <div style={{ backgroundColor: '#0b0e11', minHeight: '100vh', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderLeft: '4px solid #f0b90b', paddingLeft: '15px' }}>
          <h1 style={{ color: '#eaecef', margin: 0 }}>Olle Insight Live</h1>
          <button onClick={() => setIsDollar(!isDollar)} style={{ backgroundColor: '#2b2f36', color: '#eaecef', border: '1px solid #474d57', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            {isDollar ? 'USD ⇄ KRW' : 'KRW ⇄ USD'}
          </button>
        </header>
        <div style={{ backgroundColor: '#161a1e', borderRadius: '16px', padding: '20px', border: '1px solid #2b2f36' }}>
          <div ref={chartContainerRef} />
        </div>
      </div>
    </div>
  );
}