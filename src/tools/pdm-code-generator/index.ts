import { defineTool } from '../tool';

// eslint-disable-next-line import/no-named-default
import { default as PowerDesigner } from './powerDesigner';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.pdm-code-generator.title'),
  path: '/pdm-code-generator',
  description: translate('tools.pdm-code-generator.description'),
  keywords: ['domain', 'code', 'pdm', 'zip', 'ccframe'],
  component: () => import('./pdm-code-generator.vue'),
  icon: PowerDesigner,
  createdAt: new Date('2025-08-27'),
});
