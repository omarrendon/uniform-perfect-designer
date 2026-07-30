import Anthropic from '@anthropic-ai/sdk';
import type { CanvasElement, CanvasConfig } from '../types';
import type { UniformTemplate } from '../types';
import { optimizeLayoutAdvanced, type LayoutOptions, type LayoutResult } from './binPacking';

interface AgentLayoutOptions {
  bitmaps?: LayoutOptions['bitmaps'];
}

interface LayoutToolInput {
  heuristic: LayoutOptions['heuristic'];
  sortStrategy: LayoutOptions['sortStrategy'];
  elementGap: number;
}

const MAX_ITERATIONS = 5;
const VALID_HEURISTICS = ['BL', 'BSSF', 'BAF', 'BLSF'] as const;
const VALID_SORT_STRATEGIES = ['area', 'height', 'width', 'perimeter'] as const;

function buildSummary(elements: CanvasElement[], canvasConfig: CanvasConfig) {
  const jerseys = elements.filter(
    el => el.type === 'uniform' && (el as UniformTemplate).part === 'jersey',
  );
  const shorts = elements.filter(
    el => el.type === 'uniform' && (el as UniformTemplate).part === 'shorts',
  );

  const countBySize = (arr: CanvasElement[]) =>
    arr.reduce<Record<string, number>>((acc, el) => {
      const s = (el as UniformTemplate).size ?? 'unknown';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

  const avgDims = (arr: CanvasElement[]) => {
    if (!arr.length) return null;
    return {
      w: Math.round(arr.reduce((s, el) => s + el.dimensions.width,  0) / arr.length),
      h: Math.round(arr.reduce((s, el) => s + el.dimensions.height, 0) / arr.length),
    };
  };

  const cw = Math.round(canvasConfig.width  * canvasConfig.pixelsPerCm);
  const ch = Math.round(canvasConfig.height * canvasConfig.pixelsPerCm);

  return {
    totalPieces: elements.length,
    jerseys: { count: jerseys.length, bySizeCount: countBySize(jerseys), avgDimsPx: avgDims(jerseys) },
    shorts:  { count: shorts.length,  bySizeCount: countBySize(shorts),  avgDimsPx: avgDims(shorts)  },
    canvas:  { widthPx: cw, heightPx: ch, aspectRatio: (cw / ch).toFixed(2) },
  };
}

function sanitizeParams(input: LayoutToolInput): Partial<LayoutOptions> {
  return {
    heuristic:    (VALID_HEURISTICS as readonly string[]).includes(input.heuristic)
                    ? input.heuristic as LayoutOptions['heuristic']
                    : 'BL',
    sortStrategy: (VALID_SORT_STRATEGIES as readonly string[]).includes(input.sortStrategy)
                    ? input.sortStrategy as LayoutOptions['sortStrategy']
                    : 'area',
    elementGap:   Math.max(5, Math.min(30, input.elementGap ?? 5)),
  };
}

function isBetter(candidate: LayoutResult, current: LayoutResult | null): boolean {
  if (!current) return true;
  if (candidate.pagesUsed < current.pagesUsed) return true;
  if (candidate.pagesUsed === current.pagesUsed && candidate.efficiency > current.efficiency) return true;
  return false;
}

const LAYOUT_TOOL: Anthropic.Tool = {
  name: 'runLayout',
  description:
    'Runs the 2D bin-packing algorithm with the given strategy parameters and returns packing metrics. '
    + 'Call this up to 5 times with different combinations to find the best result.',
  input_schema: {
    type: 'object',
    properties: {
      heuristic: {
        type: 'string',
        enum: ['BL', 'BSSF', 'BAF', 'BLSF'],
        description:
          'BL=Bottom-Left (fills top-left first, uniform rows), '
          + 'BSSF=Best Short Side Fit (minimizes wasted edge), '
          + 'BAF=Best Area Fit (smallest adequate gap), '
          + 'BLSF=Best Long Side Fit (good for mixed aspect ratios)',
      },
      sortStrategy: {
        type: 'string',
        enum: ['area', 'height', 'width', 'perimeter'],
        description: 'Sort order applied to elements before placement (largest first)',
      },
      elementGap: {
        type: 'number',
        description: 'Gap in pixels between pieces for print bleed (5–30 px). Default: 5.',
      },
    },
    required: ['heuristic', 'sortStrategy', 'elementGap'],
  },
};

/**
 * Runs layout optimization using Claude as the strategy selector.
 * Claude iterates over parameter combinations using tool use and picks
 * the one that maximizes packing efficiency and minimizes pages.
 *
 * Falls back to the default layout if the API key is absent or the call fails.
 */
export async function runLayoutWithAgent(
  elements: CanvasElement[],
  canvasConfig: CanvasConfig,
  options: AgentLayoutOptions = {},
): Promise<LayoutResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

  if (!apiKey) {
    console.warn('[layoutAgent] VITE_ANTHROPIC_API_KEY not set — using default layout');
    return optimizeLayoutAdvanced(elements, canvasConfig, { bitmaps: options.bitmaps });
  }

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const summary = buildSummary(elements, canvasConfig);

    const systemPrompt =
      'You are a 2D bin-packing strategy optimizer for a uniform printing system.\n'
      + 'Your goal: minimize pages used, then maximize packing efficiency.\n'
      + `Run up to ${MAX_ITERATIONS} experiments via the runLayout tool, then stop.\n`
      + 'The geometric algorithm runs deterministically — you only choose strategy params.\n'
      + 'Constraints: elements cannot be rotated 90°/270° (only 0° and 180° are valid).';

    const userMessage =
      `Optimize layout for these uniform pieces:\n${JSON.stringify(summary, null, 2)}\n\n`
      + 'Try different heuristic + sortStrategy + elementGap combinations. '
      + `After ${MAX_ITERATIONS} experiments choose the best (fewest pages, highest efficiency).`;

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
    let bestResult: LayoutResult | null = null;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: [LAYOUT_TOOL],
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (iterations >= MAX_ITERATIONS) break;

        const params = sanitizeParams(block.input as LayoutToolInput);
        const result = optimizeLayoutAdvanced(elements, canvasConfig, {
          ...params,
          canvasMargin:  0,
          canvasMarginV: 0,
          allowRotation: false,
          bitmaps: options.bitmaps,
        });

        iterations++;

        if (isBetter(result, bestResult)) bestResult = result;

        console.info(
          `[layoutAgent] iter ${iterations}: heuristic=${params.heuristic} sort=${params.sortStrategy} `
          + `gap=${params.elementGap} → pages=${result.pagesUsed} efficiency=${result.efficiency.toFixed(1)}%`,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            efficiency:   parseFloat(result.efficiency.toFixed(1)),
            pagesUsed:    result.pagesUsed,
            wastedSpacePx2: result.wastedSpace,
          }),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    if (bestResult) {
      console.info(
        `[layoutAgent] best result: pages=${bestResult.pagesUsed} efficiency=${bestResult.efficiency.toFixed(1)}%`,
      );
      return bestResult;
    }
  } catch (err) {
    console.error('[layoutAgent] Claude API error, falling back to default layout:', err);
  }

  return optimizeLayoutAdvanced(elements, canvasConfig, {
    bitmaps: options.bitmaps,
    elementGap: 5,
    heuristic: 'BL',
    sortStrategy: 'area',
  });
}
