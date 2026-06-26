/**
 * Starts Expo with REACT_NATIVE_PACKAGER_HOSTNAME automatically set
 * to the hostname from EXPO_PUBLIC_API_URL in .env.
 * This allows the phone to connect to Metro via Tailscale from any network.
 */
import { config } from 'dotenv';
import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  console.error('Error: EXPO_PUBLIC_API_URL is not set in apps/mobile/.env');
  process.exit(1);
}

const hostname = new URL(apiUrl).hostname;
console.log(`Starting Metro with packager host: ${hostname}`);

const expoBin = resolve(__dirname, '../node_modules/.bin/expo');
execFileSync(expoBin, ['start', '--clear'], {
  stdio: 'inherit',
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: hostname },
});
