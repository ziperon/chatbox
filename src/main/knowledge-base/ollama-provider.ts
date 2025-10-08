export async function getOllamaEmbedding(
  input: string[], 
  model: string = 'dengcao/Qwen3-Embedding-4B:Q8_0',
  apiHost: string = 'http://llm:11435'
): Promise<number[][]> {
  const vectors: number[][] = [];

  for (const text of input) {
    const resp = await fetch(`${apiHost}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model, input: text })    });

    if (!resp.ok) throw new Error(`Ollama error: ${resp.statusText}`);

    const data: OllamaEmbedResponse = await resp.json();

    // Ollama может вернуть либо number[] (одиночный ввод), либо number[][] (батч).
    const e = (data as any).embeddings;
    const vector: number[] = Array.isArray(e?.[0]) ? (e[0] as number[]) : (e as number[]);

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Ollama не вернул embedding или он пустой');
    }

    vectors.push(vector);
  }

  return vectors;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[] | number[][];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
}