import { tool as textDiff } from './text-diff';
import { tool as emojiPicker } from './emoji-picker';
import { tool as jsonMinify } from './json-minify';
import { tool as dateTimeConverter } from './date-time-converter';
import { tool as jsonViewer } from './json-viewer';
import { tool as jwtParser } from './jwt-parser';
import { tool as mathEvaluator } from './math-evaluator';
import { tool as qrCodeGenerator } from './qr-code-generator';
import { tool as regexTester } from './regex-tester';
import { tool as tokenGenerator } from './token-generator';
import type { ToolCategory } from './tools.types';
import { tool as uuidGenerator } from './uuid-generator';
import { tool as pdmCodeGenerator } from './pdm-code-generator';

export const toolsByCategory: ToolCategory[] = [
  {
    name: 'Development',
    components: [
      pdmCodeGenerator,
    ],
  },
  {
    name: 'Other',
    components: [
      tokenGenerator,
      uuidGenerator,
      dateTimeConverter,
      jwtParser,
      qrCodeGenerator,
      jsonViewer,
      jsonMinify,
      regexTester,
      mathEvaluator,
      emojiPicker,
      textDiff,
    ],
  },
];

export const tools = toolsByCategory.flatMap(({ components }) => components);
export const toolsWithCategory = toolsByCategory.flatMap(({ components, name }) =>
  components.map(tool => ({ category: name, ...tool })),
);
