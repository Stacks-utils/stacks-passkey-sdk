import { defineConfig } from 'vitest/config';
import { vitestSetupFilePath, getClarinetVitestsArgv } from '@stacks/clarinet-sdk/vitest';

export default defineConfig({
  test: {
    environment: 'clarinet',
    pool: 'threads',
    fileParallelism: false,
    setupFiles: [vitestSetupFilePath, './setup.ts'],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
        manifest: '../../contracts/Clarinet.toml',
      },
    },
  },
});
