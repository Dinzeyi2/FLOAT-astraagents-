const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

/**
 * Small dependency-free OpenAI Responses API client. The API key remains on
 * Railway; browser clients never receive it.
 */
export function createOpenAIClient({ apiKey = process.env.OPENAI_API_KEY, baseUrl = process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL, model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required to generate live X content.');
  const endpoint = `${baseUrl.replace(/\/$/, '')}/responses`;

  return {
    async draftReply({ post, path, recommendation }) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          instructions: [
            'You write one helpful reply to an X post for Astra.',
            'Teach a concrete next step before mentioning Astra.',
            'Mention Astra only when recommendation.mention_astra is true.',
            'Never use links, hashtags, hype, pressure, fake claims, or repeated marketing language.',
            'Be specific to the post, respectful, and under 280 characters.',
            'Return only the reply text.'
          ].join(' '),
          input: JSON.stringify({
            source_post: post.text,
            author: post.author_username,
            diagnosed_path: path,
            recommendation
          })
        })
      });
      if (!response.ok) throw new Error(`OpenAI drafting failed with ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      const text = extractOutputText(payload);
      if (!text) throw new Error('OpenAI did not return reply text.');
      return { text: text.trim().replace(/^['"]|['"]$/g, ''), model, response_id: payload.id };
    }
  };
}

export function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('');
}
