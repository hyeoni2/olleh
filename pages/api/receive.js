// 서버 메모리에 신호를 저장할 배열 (파일 대신 사용)
let signalsMemory = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST: 신호 수신 및 메모리 저장
  if (req.method === 'POST') {
    try {
      const data = req.body;
      if (data && data.target_price) {
        console.log("👶 꾸물꾸물... 새로운 신호가 도착해서 메모리에 적고 있어용!");
        
        const newSignal = {
          ...data,
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          status: 'active'
        };
        
        signalsMemory.unshift(newSignal); // 최신 신호를 맨 앞으로
        if (signalsMemory.length > 20) signalsMemory = signalsMemory.slice(0, 20);
        
        return res.status(200).json({ message: "Saved to Memory" });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET: 목록 불러오기
  if (req.method === 'GET') {
    return res.status(200).json(signalsMemory);
  }

  // DELETE: 익절 및 메모리에서 삭제
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      signalsMemory = signalsMemory.filter(sig => sig.id !== id);
      console.log(`💰 익절 성공! 올레가 메모리에서 ${id}번 신호를 지웠쪄요!`);
      return res.status(200).json({ message: "Deleted from Memory" });
    } catch (err) {
      return res.status(500).json({ error: "Delete Failed" });
    }
  }
}