/*
调用兼容 OpenAI 的聊天接口，给文章写一段摘要。
后台先检查密钥和正文，再进这里。
调用示例：
  const settings = aiSettings(savedAi, overrides, process.env.AI_API_KEY)
  const text = await callAI(settings, '用一句话概括这篇文章')
*/

const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
  },
  kimi: {
    url: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
  },
};

export function aiSettings(saved = {}, overrides = {}, envKey = '') {
  return {
    provider: overrides.provider || saved.provider,
    apiKey: overrides.apiKey || envKey || saved.apiKey, // 空字符串当没填，接着用环境变量或已保存的密钥
    model: overrides.model || saved.model,
    customUrl: overrides.customUrl || saved.customUrl,
  };
}

export async function callAI(settings, prompt) {
  const known = PROVIDERS[settings.provider];
  const url = known ? known.url : settings.customUrl;   // 未知提供方走自定义地址
  const model = settings.model || known?.model || 'gpt-3.5-turbo';
  if (!url) throw new Error('Invalid provider or missing custom URL');

  const parsedUrl = new URL(url);
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid API URL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 接口挂住时不要一直占着请求
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,                         // 摘要只要一两句
        temperature: 0.7,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = (await response.text()).slice(0, 500);
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
