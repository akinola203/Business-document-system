export function buildAllowedCorsOrigins(options: {
  corsOrigin?: string;
  frontendUrl?: string;
  appUrl?: string;
  nodeEnv?: string;
}): Set<string> {
  const isProduction = options.nodeEnv === 'production';
  const rawList: string[] = [];

  if (options.corsOrigin) {
    rawList.push(...options.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean));
  }
  if (options.frontendUrl) {
    rawList.push(options.frontendUrl.trim());
  }
  if (options.appUrl) {
    rawList.push(options.appUrl.trim());
  }

  if (!isProduction) {
    rawList.push(
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'capacitor://localhost',
      'tauri://localhost',
      'http://tauri.localhost',
    );
  }

  const normalized = new Set<string>();
  for (const entry of rawList) {
    if (!entry || entry === '*' || entry === 'null') {
      continue;
    }
    normalized.add(entry.replace(/\/+$/, ''));
  }

  return normalized;
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  isProduction: boolean,
): boolean {
  if (!origin) {
    return true;
  }
  if (origin === 'null' || origin === '*') {
    return false;
  }
  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.has(normalized)) {
    return true;
  }
  if (!isProduction && normalized.startsWith('file://')) {
    return true;
  }
  return false;
}

