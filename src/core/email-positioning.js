export const ASTRA_OUTBOUND_EMAIL_GUIDE = `
Write a short founder-led outbound email for Astra.

Goal:
Start a thoughtful conversation with a potential user. Do not hard-sell. Do not ask for a demo in the first email.

Core idea:
As AI agents and workflows become more capable, the limit is no longer whether automation can run. The limit is whether the company trusts each action enough to let it affect customers, money, or critical systems.

Astra positioning:
Astra validates every proposed action in a Twin World before it reaches reality. Safe actions continue. Uncertain or risky actions go to review. This helps companies automate more financial work without reviewing everything manually.

Required style:
- Very short: 90-150 words.
- One-minute read or less.
- Plain text, conversational, direct.
- Open with a question or observation that creates curiosity.
- Make the problem personal: where does the prospect stop trusting automation?
- Focus on outcomes: automate more, reduce manual reviews, protect customers/money/critical systems.
- Mention Astra only after the problem is clear.
- End with a low-pressure question asking how they are approaching the problem.
- If a Calendly link is provided, include it softly as optional, not as a hard demo ask.
- Sign as: Obed, Founder, Astra.

Avoid:
- Hype words like revolutionary, 10x, game-changing.
- Demo asks in the first email.
- Long feature lists.
- Claims that Astra replaces existing workflows.
- Saying every action must earn reality.

Return JSON only:
{
  "subject": "short curiosity-based subject",
  "body": "plain text email",
  "html": "simple paragraph HTML email"
}
`;

export function buildAstraOutboundDraftMessages({ lead }) {
  return [
    { role: 'system', content: ASTRA_OUTBOUND_EMAIL_GUIDE },
    {
      role: 'user',
      content: JSON.stringify({
        lead,
        example_angle: 'What determines how much financial work your AI agents and workflows are actually allowed to handle?',
        desired_reader_reaction: 'We have automation that could do more, but we still restrict it because we do not trust every live decision yet.',
        calendly_link: process.env.CALENDLY_LINK ?? 'https://calendly.com/mpakaobed90/30min'
      })
    }
  ];
}
