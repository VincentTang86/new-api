/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { LandingCodeSample } from '../types'

/** Shown verbatim in the snippet; the visitor swaps them after signing up. */
const API_KEY_PLACEHOLDER = 'YOUR_API_KEY'
const MODEL_ID_PLACEHOLDER = 'MODEL_ID'

/**
 * The base URL is resolved at render time from /api/status so a self-hosted
 * deployment shows its own endpoint rather than ours.
 */
export function buildLandingCodeSamples(
  baseUrl: string
): readonly LandingCodeSample[] {
  return [
    {
      language: 'python',
      label: 'Python',
      snippet: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${API_KEY_PLACEHOLDER}",
)

response = client.chat.completions.create(
    model="${MODEL_ID_PLACEHOLDER}",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)`,
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      snippet: `import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${API_KEY_PLACEHOLDER}",
})

const response = await client.chat.completions.create({
  model: "${MODEL_ID_PLACEHOLDER}",
  messages: [{ role: "user", content: "Hello" }],
})

console.log(response.choices[0].message.content)`,
    },
    {
      language: 'curl',
      label: 'cURL',
      snippet: `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}" \\
  -d '{
    "model": "${MODEL_ID_PLACEHOLDER}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`,
    },
  ]
}
