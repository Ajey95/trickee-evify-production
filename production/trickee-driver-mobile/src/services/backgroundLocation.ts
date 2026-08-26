import type {MobileMe} from './types';

export async function startBackgroundLocation(_token: string, _me: MobileMe) {
  return false;
}

export async function stopBackgroundLocation() {
  return undefined;
}
