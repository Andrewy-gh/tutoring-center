import { noInvalidUseServerExports } from '@/eslint-rules/no-invalid-use-server-exports';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    parser: tsParser,
    sourceType: 'module',
  },
});

describe('no-invalid-use-server-exports', () => {
  it('enforces Next server-action export rules for module-level use server files', () => {
    ruleTester.run('no-invalid-use-server-exports', noInvalidUseServerExports, {
      valid: [
        `
          'use server';

          import { service, type FormData } from './service';

          export async function submit(formData: FormData) {
            return service.submit(formData);
          }
        `,
        `
          'use server';

          export type { FormData } from './service';
        `,
        `
          'use server';

          export { type FormData } from './service';
        `,
        `
          'use server';

          export type * from './service';
        `,
        `
          'use server';

          export type * as ServiceTypes from './service';
        `,
        `
          'use server';

          type FormData = { id: number };
          const submit = async () => {};

          export { type FormData, submit };
        `,
        `
          'use server';

          export const saveMetrics = async () => {};
        `,
        `
          'use server';

          export let saveMetrics = async () => {};
        `,
        `
          'use server';

          export const sendProgressReport = async () => {};

          export { sendProgressReport as submitSession };
        `,
        `
          'use server';

          export async function approveSession() {}

          export { approveSession };
        `,
        `
          'use server';

          const submit = async () => {};

          export { submit };
        `,
        `
          'use server';

          const submit = async function () {};

          export { submit as submitSession };
        `,
        `
          'use server';

          const saveMetrics = async () => {};

          export default saveMetrics;
        `,
        `
          'use server';

          async function saveMetrics() {}

          export default saveMetrics;
        `,
        `
          'use server';

          async function action() {}

          export default action;

          action = 'not exported';
        `,
        `
          'use server';

          async function action() {}
          function reset() {
            action = 'not exported';
          }

          export default action;
        `,
        `
          'use server';

          async function action() {}
          const helper = {
            run() {
              helper.run();
            },
          };
          helper.run();

          export default action;
        `,
        `
          'use server';

          async function action() {}
          function helper() {
            let action = 'x';
            action = 'y';
          }

          export { action };
        `,
        `
          export async function login() {
            'use server';
          }
        `,
        `
          export type FormData = { id: number };
        `,
      ],
      invalid: [
        {
          code: `
            'use server';

            export async function* stream() {}
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            const stream = async function* () {};

            export { stream };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            export const actionName = 'submit';
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            export function submit() {}
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            const actionName = 'submit';

            export { actionName };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            let alias;
            alias = action = 'submit';

            export { action };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            const replace = {
              run() {
                action = 'submit';
              },
            };
            replace.run();

            export default action;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            const replace = () => {
              action = 'submit';
            };
            replace();

            export default action;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            function replace() {
              action = 'submit';
            }
            replace();

            export { action };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            ({ action } = { action: 'submit' });

            export { action };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            for (action of ['submit']) {}

            export { action };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            function replace() {
              action = 'submit';
            }
            replace();

            export default action;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            action = 'submit';

            export { action };
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            async function action() {}
            action = 'submit';

            export default action;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            export default action;

            const action = async () => {};
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            let action = async () => {};
            action = 'submit';

            export default action;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            const actionName = 'submit';

            export default actionName;
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
        {
          code: `
            'use server';

            export * from './service';
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
      ],
    });
  });
});
