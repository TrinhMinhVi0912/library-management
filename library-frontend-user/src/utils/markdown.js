/**
 * Render Markdown cơ bản và an toàn XSS.
 * Nguyên tắc: Escape toàn bộ thẻ HTML trước, sau đó mới parse cú pháp Markdown được phép.
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(content) {
  if (!content) return '';

  // Bước 1: Escape HTML triệt để để chống XSS
  let text = escapeHtml(content.trim());

  // Bước 2: Xử lý code block (fenced)
  const codeBlocks = [];
  text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="bg-light p-3 rounded border my-2 overflow-auto"><code class="text-dark small">${code.trim()}</code></pre>`);
    return placeholder;
  });

  // Bước 3: Inline code
  text = text.replace(/`([^`\n]+)`/g, '<code class="bg-light border text-danger px-1 py-0.5 rounded small font-monospace">$1</code>');

  // Bước 4: Blockquote
  text = text.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-start border-3 border-primary ps-3 my-2 text-muted fst-italic">$1</blockquote>');

  // Bước 5: Tiêu đề H1 - H4
  text = text.replace(/^####\s+(.+)$/gm, '<h6 class="fw-bold mt-3 mb-2 text-dark">$1</h6>');
  text = text.replace(/^###\s+(.+)$/gm, '<h5 class="fw-bold mt-3 mb-2 text-dark">$1</h5>');
  text = text.replace(/^##\s+(.+)$/gm, '<h4 class="fw-bold mt-3 mb-2 text-dark">$1</h4>');
  text = text.replace(/^#\s+(.+)$/gm, '<h3 class="fw-bold mt-3 mb-2 text-dark">$1</h3>');

  // Bước 6: In đậm, in nghiêng, gạch ngang
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
  text = text.replace(/~~(.+?)~~/g, '<del class="text-muted">$1</del>');

  // Bước 7: Liên kết an toàn (chỉ cho phép http, https hoặc đường dẫn nội bộ bắt đầu bằng /)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s'")]+|\/[^\s'")]+)\)/g, (_match, label, url) => {
    const isInternal = url.startsWith('/');
    const target = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a href="${url}" class="text-primary text-decoration-underline fw-medium"${target}>${label}</a>`;
  });

  // Bước 8: Danh sách gạch đầu dòng
  text = text.replace(/^[*-]\s+(.+)$/gm, '<li class="ms-3 mb-1">$1</li>');
  text = text.replace(/(<li class="ms-3 mb-1">.*<\/li>\n?)+/g, '<ul class="mb-2 ps-3">$0</ul>');

  // Bước 9: Chuyển đổi dòng ngắt
  text = text.replace(/\n\n+/g, '</p><p class="mb-2">');
  text = text.replace(/\n/g, '<br>');

  // Bọc vào thẻ paragraph nếu chưa có
  if (!text.startsWith('<p>') && !text.startsWith('<h') && !text.startsWith('<pre') && !text.startsWith('<ul') && !text.startsWith('<blockquote')) {
    text = `<p class="mb-2">${text}</p>`;
  }

  // Khôi phục code blocks
  codeBlocks.forEach((block, index) => {
    text = text.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return text;
}

