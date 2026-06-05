import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { noInvalidUseServerExports } from '@/eslint-rules/no-invalid-use-server-exports';

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

            export * from './service';
          `,
          errors: [{ messageId: 'invalidExport' }],
        },
      ],
    });
  });
});
