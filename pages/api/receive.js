const GITHUB_TOKEN = process.env.GH_TOKEN; 
const REPO_OWNER = 'hyeoni2'; 
const REPO_NAME = 'olleh'; 
const FILE_PATH = 'signals.md';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  async function getFileData() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
      }
    });
    if (response.status === 404) return { content: "", sha: null };
    const data = await response.json();
    return { 
      content: Buffer.from(data.content, 'base64').toString('utf-8'), 
      sha: data.sha 
    };
  }

  async function updateFile(newContent, sha, message) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    await fetch(url, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(newContent).toString('base64'),
        sha
      })
    });
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;
      const { content, sha } = await getFileData();
      const id = Date.now();
      const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const newRow = `| ${id} | ${time} | ${data.user_name || "가족"} | ${data.coin_symbol || "BTC"} | ${data.target_price} | active |\n`;
      const updatedContent = (content === "" || !content.includes('| ID |')) 
        ? `| ID | 시간 | 이름 | 코인 | 가격 | 상태 |\n| --- | --- | --- | --- | --- | --- |\n${newRow}`
        : content + newRow;
      await updateFile(updatedContent, sha, "👶 올레가 장부에 신호를 적었쪄요!");
      return res.status(200).json({ message: "Success" });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'GET') {
    try {
      const { content } = await getFileData();
      if (!content || content.trim() === "" || !content.includes('| ID |')) return res.status(200).json([]);
      const lines = content.trim().split('\n').slice(2);
      const signals = lines.map(line => {
        const cols = line.split('|').map(c => c.trim());
        if (cols.length < 6) return null;
        return { id: cols[1], timestamp: cols[2], user_name: cols[3], coin_symbol: cols[4], target_price: cols[5], status: cols[6] };
      }).filter(Boolean).reverse();
      return res.status(200).json(signals);
    } catch (err) { return res.status(200).json([]); }
  }

  // 💡 종료 처리 (익절/손절/취소)
  if (req.method === 'DELETE') {
    try {
      const { id, status, exitPrice } = req.query;
      const { content, sha } = await getFileData();
      const lines = content.split('\n');
      
      const targetLine = lines.find(l => l.includes(`| ${id} |`));
      if (!targetLine) return res.status(404).json({ error: "Not Found" });

      const cols = targetLine.split('|').map(c => c.trim());
      const entryPrice = parseFloat(cols[5]);
      const diff = status === 'canceled' ? "0" : ((parseFloat(exitPrice) - entryPrice) / entryPrice * 100).toFixed(2);

      const newContent = lines.filter(line => !line.includes(`| ${id} |`)).join('\n');
      const logMsg = status === 'canceled' ? `🚫 취소: ${id}` : `💰 ${status.toUpperCase()} (${diff}%)`;

      await updateFile(newContent, sha, logMsg);
      return res.status(200).json({ message: "Success", profit: diff });
    } catch (err) { return res.status(500).json({ error: "Failed" }); }
  }
}