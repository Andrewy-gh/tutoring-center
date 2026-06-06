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

          export const submit = async () => {};
        `,
        `
          'use server';

          export const submit = async () => {};

          export { submit as submitSession };
        `,
        `
          'use server';

          export async function submit() {}

          export { submit as submitSession };
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

            export type { FormData } from './service';
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

            export * from './service';
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
      ],
    });
  });
});
