const config = require('../config');

async function classify(content) {
  const settings = config.forumModeration;
  if (!settings.serviceUrl) return { state: 'pending', score: null, model: '', reason: 'Chưa cấu hình dịch vụ AI' };
  try {
    const response = await fetch(`${settings.serviceUrl.replace(/\/$/, '')}/moderate`, {
      method: 'POST',
      signal: AbortSignal.timeout(settings.timeoutMs),
      headers: {
        'content-type': 'application/json',
        ...(settings.apiKey ? { 'x-api-key': settings.apiKey } : {}),
      },
      body: JSON.stringify({ text: content }),
    });
    if (!response.ok) throw new Error(`Dịch vụ AI trả về HTTP ${response.status}`);
    const result = await response.json();
    if (!Number.isFinite(result?.toxicityScore) || result.toxicityScore < 0 || result.toxicityScore > 1) {
      throw new Error('Kết quả phân loại không hợp lệ');
    }
    const pending = result.toxicityScore >= settings.threshold;
    return {
      state: pending ? 'pending' : 'approved',
      score: result.toxicityScore,
      model: String(result.model || ''),
      reason: pending ? 'Nội dung có điểm rủi ro cao, cần nhân viên xem xét' : '',
    };
  } catch (error) {
    // Fail closed: bài độc giả không công khai nếu dịch vụ AI không phản hồi.
    return { state: 'pending', score: null, model: '', reason: 'Không thể kiểm tra tự động; cần nhân viên xem xét' };
  }
}

function staffBypass(user) {
  return ['staff', 'admin'].includes(user?.role);
}

async function assess(user, content) {
  if (staffBypass(user)) return { state: 'bypassed', score: null, model: '', reason: '' };
  return classify(content);
}

module.exports = { assess };
