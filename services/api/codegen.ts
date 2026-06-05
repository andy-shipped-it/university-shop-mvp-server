import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './src/schema/typeDefs.ts',
  generates: {
    './src/types/generated.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../middleware/auth#AuthContext',
        useIndexSignature: true,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
