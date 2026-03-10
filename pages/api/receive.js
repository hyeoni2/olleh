const GITHUB_TOKEN = process.env.GH_TOKEN; // Vercel에 등록한 환경변수 이름
const REPO_OWNER = 'hyeoni2'; // 본인 깃허브 아이디 확인 필요
const REPO_NAME = 'olleh'; // 생성한 저장소 이름 확인 필요
const FILE_PATH = 'signals.md';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 💡 GitHub에서 파일 내용과 SHA(버전 식별자)를 가져오는 함수
  async function getFileData() {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (response.status === 404) return { content: "", sha: null };
    const data = await response.json();
    return { 
      content: Buffer.from(data.content, 'base64').toString('utf-8'), 
      sha: data.sha 
    };
  }

  // 💡 GitHub 파일을 업데이트(커밋)하는 함수
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

  // POST: 신호 수신 및 깃허브 기록
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const { content, sha } = await getFileData();
      
      const id = Date.now();
      const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const newRow = `| ${id} | ${time} | ${data.user_name || "가족"} | ${data.coin_symbol || "BTC"} | ${data.target_price} | active |\n`;
      
      const updatedContent = content === "" 
        ? `| ID | 시간 | 이름 | 코인 | 가격 | 상태 |\n| --- | --- | --- | --- | --- | --- |\n${newRow}`
        : content + newRow;

      await updateFile(updatedContent, sha, "👶 올레가 장부에 신호를 적었쪄요!");
      return res.status(200).json({ message: "GitHub 저장 성공" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET: 깃허브에서 목록 읽기
  if (req.method === 'GET') {
    try {
      const { content } = await getFileData();
      if (!content) return res.status(200).json([]);
      
      const lines = content.trim().split('\n').slice(2);
      const signals = lines.map(line => {
        const cols = line.split('|').map(c => c.trim());
        if (cols.length < 6) return null;
        return { id: cols[1], timestamp: cols[2], user_name: cols[3], coin_symbol: cols[4], target_price: cols[5], status: cols[6] };
      }).filter(Boolean).reverse();
      
      return res.status(200).json(signals);
    } catch (err) {
      return res.status(200).json([]);
    }
  }

  // DELETE: 익절 시 줄 삭제
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      const { content, sha } = await getFileData();
      const lines = content.split('\n');
      const newContent = lines.filter((line, index) => {
        if (index < 2) return true;
        return !line.includes(`| ${id} |`);
      }).join('\n');

      await updateFile(newContent, sha, `💰 익절 완료! 올레가 ${id}번 신호를 지웠쪄요!`);
      return res.status(200).json({ message: "GitHub 삭제 성공" });
    } catch (err) {
      return res.status(500).json({ error: "Delete Failed" });
    }
  }
}