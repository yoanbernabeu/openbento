import path from 'path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const execFileAsync = promisify(execFile);

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const readJsonBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
};

const parseMaybeJson = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some CLIs may print extra logs even with --output json. Try extracting the JSON slice.
    const firstBrace = Math.min(
      ...[trimmed.indexOf('{'), trimmed.indexOf('[')].filter((n) => n >= 0)
    );
    if (!Number.isFinite(firstBrace)) return null;
    const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (lastBrace <= firstBrace) return null;
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
};

const parseProjectRefFromSupabaseUrl = (supabaseUrl: string): string | null => {
  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith('.supabase.co')) return null;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
};

const pickOrgId = (orgs: any[]): string | null => {
  for (const o of orgs) {
    const id = o?.id ?? o?.org_id ?? o?.organization_id ?? o?.slug;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
};

const extractProjectRef = (maybe: any): string | null => {
  const candidates = [
    maybe?.id,
    maybe?.ref,
    maybe?.project_ref,
    maybe?.projectRef,
    maybe?.project?.id,
    maybe?.project?.ref,
    maybe?.project?.project_ref,
    maybe?.project?.projectRef,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
};

const extractServiceRoleKey = (maybe: any): string | null => {
  const list = Array.isArray(maybe)
    ? maybe
    : (maybe?.keys ?? maybe?.data ?? maybe?.api_keys ?? null);
  if (!Array.isArray(list)) return null;

  for (const k of list) {
    const name = String(k?.name ?? k?.role ?? k?.type ?? '').toLowerCase();
    const key = k?.key ?? k?.api_key ?? k?.apiKey ?? k?.secret ?? k?.value;
    if (typeof key === 'string' && key.trim() && name.includes('service')) return key.trim();
  }
  return null;
};

const randomToken = () => crypto.randomBytes(24).toString('base64url');

const randomPassword = () => {
  // 24 chars, mixed (safe for CLI args)
  return crypto.randomBytes(18).toString('base64url') + 'A1!';
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const normalizeLinktreeUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://linktr.ee/${trimmed.replace(/^@/, '')}`);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'linktr.ee' && hostname !== 'www.linktr.ee') return null;
    const username = parsed.pathname.split('/').filter(Boolean)[0];
    if (!username) return null;
    return `https://linktr.ee/${username}`;
  } catch {
    return null;
  }
};

const extractNextData = (html: string) => {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
};

// Simple setup using just DB password (no CLI login needed)
const simpleSupabaseSetupPlugin = (): Plugin => {
  return {
    name: 'openbento-supabase-simple-setup',
    apply: 'serve',
    configureServer(server) {
      const configPath = path.join(server.config.root, '.supabase-config.json');

      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next();

          // Get saved config
          if (req.method === 'GET' && req.url === '/__openbento/config') {
            try {
              const data = fs.readFileSync(configPath, 'utf8');
              json(res, 200, { ok: true, config: JSON.parse(data) });
            } catch {
              json(res, 200, { ok: true, config: null });
            }
            return;
          }

          // Save config
          if (req.method === 'POST' && req.url === '/__openbento/config') {
            const body = await readJsonBody(req);
            fs.writeFileSync(configPath, JSON.stringify(body, null, 2));
            json(res, 200, { ok: true });
            return;
          }

          if (req.method === 'GET' && req.url.startsWith('/__openbento/import/linktree')) {
            const requestUrl = new URL(req.url, 'http://localhost');
            const sourceUrl = normalizeLinktreeUrl(requestUrl.searchParams.get('url') || '');

            if (!sourceUrl) {
              json(res, 400, { ok: false, error: 'Invalid Linktree URL.' });
              return;
            }

            try {
              const upstream = await fetch(sourceUrl, {
                headers: {
                  'user-agent': 'OpenBento Linktree Import',
                  accept: 'text/html,application/xhtml+xml',
                },
              });

              if (!upstream.ok) {
                json(res, upstream.status, {
                  ok: false,
                  error: `Linktree returned ${upstream.status}.`,
                });
                return;
              }

              const html = await upstream.text();
              const nextData = extractNextData(html);
              const pageProps = nextData?.props?.pageProps;

              if (!pageProps?.account) {
                json(res, 422, {
                  ok: false,
                  error: 'Unable to extract importable data from this Linktree page.',
                });
                return;
              }

              json(res, 200, { ok: true, pageProps, sourceUrl });
            } catch (error) {
              json(res, 500, {
                ok: false,
                error: `Failed to fetch Linktree page: ${(error as Error).message}`,
              });
            }
            return;
          }

          // Fetch analytics data (dev only)
          if (req.method === 'POST' && req.url === '/__openbento/analytics/fetch') {
            const body = (await readJsonBody(req)) as any;
            const projectUrl = body?.projectUrl?.trim();
            const dbPassword = body?.dbPassword?.trim();
            const siteId = body?.siteId?.trim();

            // SECURITY: Validate days as strict integer within bounds
            const daysRaw = parseInt(body?.days, 10);
            const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 365 ? daysRaw : 30;

            // SECURITY: Validate siteId format (alphanumeric, hyphens, underscores only)
            const siteIdValid = siteId && /^[a-zA-Z0-9_-]+$/.test(siteId);

            if (!projectUrl || !dbPassword) {
              json(res, 400, { ok: false, error: 'Missing projectUrl or dbPassword' });
              return;
            }

            const projectRef = parseProjectRefFromSupabaseUrl(projectUrl);
            if (!projectRef) {
              json(res, 400, { ok: false, error: 'Invalid Supabase URL' });
              return;
            }

            const dbHost = `db.${projectRef}.supabase.co`;

            try {
              // Fetch all analytics data - using validated parameters only
              const query = siteIdValid
                ? `SELECT * FROM public.openbento_analytics_events WHERE site_id = '${siteId.replace(/'/g, "''")}' AND created_at > NOW() - INTERVAL '${days} days' ORDER BY created_at DESC LIMIT 10000`
                : `SELECT * FROM public.openbento_analytics_events WHERE created_at > NOW() - INTERVAL '${days} days' ORDER BY created_at DESC LIMIT 10000`;

              const { stdout } = await execFileAsync(
                'psql',
                [
                  '-h',
                  dbHost,
                  '-p',
                  '5432',
                  '-U',
                  'postgres',
                  '-d',
                  'postgres',
                  '-t',
                  '-A',
                  '-F',
                  '|',
                  '-c',
                  query,
                ],
                {
                  env: { ...process.env, PGPASSWORD: dbPassword },
                  timeout: 30000,
                }
              );

              // Parse the pipe-delimited output
              const lines = stdout
                .trim()
                .split('\n')
                .filter((l) => l.trim());
              const events = lines.map((line) => {
                const parts = line.split('|');
                return {
                  id: parts[0],
                  created_at: parts[1],
                  site_id: parts[2],
                  event_type: parts[3],
                  block_id: parts[4] || null,
                  destination_url: parts[5] || null,
                  page_url: parts[6] || null,
                  referrer: parts[7] || null,
                  utm_source: parts[8] || null,
                  utm_medium: parts[9] || null,
                  utm_campaign: parts[10] || null,
                  utm_term: parts[11] || null,
                  utm_content: parts[12] || null,
                  user_agent: parts[13] || null,
                  language: parts[14] || null,
                  screen_w: parts[15] ? parseInt(parts[15]) : null,
                  screen_h: parts[16] ? parseInt(parts[16]) : null,
                  visitor_id: parts[17] || null,
                  session_id: parts[18] || null,
                  viewport_w: parts[19] ? parseInt(parts[19]) : null,
                  viewport_h: parts[20] ? parseInt(parts[20]) : null,
                  timezone: parts[21] || null,
                  duration_seconds: parts[22] ? parseInt(parts[22]) : null,
                  scroll_depth: parts[23] ? parseInt(parts[23]) : null,
                  engaged: parts[24] === 't',
                  block_title: parts[25] || null,
                };
              });

              json(res, 200, { ok: true, events, count: events.length });
            } catch (e: any) {
              json(res, 500, {
                ok: false,
                error: 'Failed to fetch analytics: ' + (e.message || 'Unknown error'),
              });
            }
            return;
          }

          // Simple setup with just DB password
          if (req.method === 'POST' && req.url === '/__openbento/supabase/simple-setup') {
            const body = (await readJsonBody(req)) as any;
            const projectUrl = body?.projectUrl?.trim();
            const dbPassword = body?.dbPassword?.trim();
            const anonKey = body?.anonKey?.trim();

            if (!projectUrl || !dbPassword) {
              json(res, 400, { ok: false, error: 'Missing projectUrl or dbPassword' });
              return;
            }

            // Extract project ref from URL
            const projectRef = parseProjectRefFromSupabaseUrl(projectUrl);
            if (!projectRef) {
              json(res, 400, { ok: false, error: 'Invalid Supabase URL' });
              return;
            }

            const dbHost = `db.${projectRef}.supabase.co`;
            const logs: string[] = [];

            // Run SQL migration via psql
            const migrationSql = `
              create extension if not exists "pgcrypto";

              create table if not exists public.openbento_analytics_events (
                id uuid primary key default gen_random_uuid(),
                created_at timestamptz not null default now(),
                site_id text not null,
                event_type text not null check (event_type in ('page_view', 'click')),
                block_id text,
                destination_url text,
                page_url text,
                referrer text,
                utm_source text,
                utm_medium text,
                utm_campaign text,
                utm_term text,
                utm_content text,
                user_agent text,
                language text,
                screen_w integer,
                screen_h integer
              );

              create index if not exists openbento_analytics_events_site_time_idx
                on public.openbento_analytics_events (site_id, created_at desc);

              alter table public.openbento_analytics_events enable row level security;

              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_policies WHERE tablename = 'openbento_analytics_events' AND policyname = 'Allow public inserts'
                ) THEN
                  CREATE POLICY "Allow public inserts" ON public.openbento_analytics_events FOR INSERT WITH CHECK (true);
                END IF;
              END $$;

              -- Note: No SELECT policy for anon users = more secure
              -- Only service_role key can read analytics data
            `;

            try {
              logs.push('Connecting to database...');
              const { stdout, stderr: _stderr } = await execFileAsync(
                'psql',
                [
                  '-h',
                  dbHost,
                  '-p',
                  '5432',
                  '-U',
                  'postgres',
                  '-d',
                  'postgres',
                  '-c',
                  migrationSql,
                ],
                {
                  env: { ...process.env, PGPASSWORD: dbPassword },
                  timeout: 30000,
                }
              );
              logs.push('Migration applied successfully!');
              if (stdout) logs.push(stdout);
            } catch (e: any) {
              json(res, 500, {
                ok: false,
                error: 'Failed to run migration: ' + (e.message || 'Unknown error'),
                logs,
                stderr: e.stderr,
              });
              return;
            }

            // Save config
            const config = {
              projectUrl,
              projectRef,
              anonKey: anonKey || null,
              setupAt: new Date().toISOString(),
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            logs.push('Config saved to .supabase-config.json');

            json(res, 200, {
              ok: true,
              logs,
              config,
            });
            return;
          }

          return next();
        } catch (e) {
          json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Internal error' });
          return;
        }
      });
    },
  };
};

const openbentoSupabaseDevPlugin = (): Plugin => {
  return {
    name: 'openbento-supabase-dev',
    apply: 'serve',
    configureServer(server) {
      const cwd = server.config.root;

      const runSupabase = async (args: string[]) => {
        return execFileAsync('supabase', args, {
          cwd,
          env: process.env,
          maxBuffer: 10 * 1024 * 1024,
        });
      };

      const verifyState = async (params: {
        projectRef: string;
        adminToken?: string;
        serviceRoleKey: string;
      }) => {
        const supabaseUrl = `https://${params.projectRef}.supabase.co`;
        const checks: Record<string, { ok: boolean; details?: string }> = {};

        // Table exists?
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/openbento_analytics_events?select=id&limit=1`,
            {
              headers: {
                apikey: params.serviceRoleKey,
                Authorization: `Bearer ${params.serviceRoleKey}`,
              },
            }
          );
          checks.table = { ok: res.ok, details: `${res.status} ${res.statusText}` };
        } catch (e) {
          checks.table = { ok: false, details: e instanceof Error ? e.message : 'Request failed' };
        }

        // Functions deployed?
        const checkFn = async (name: string) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, { method: 'OPTIONS' });
            checks[`fn:${name}`] = { ok: res.ok, details: `${res.status} ${res.statusText}` };
          } catch (e) {
            checks[`fn:${name}`] = {
              ok: false,
              details: e instanceof Error ? e.message : 'Request failed',
            };
          }
        };

        await checkFn('openbento-analytics-track');
        await checkFn('openbento-analytics-admin');

        // Admin token works?
        if (!params.adminToken) {
          checks.adminAuth = { ok: false, details: 'missing adminToken' };
        } else {
          try {
            const res = await fetch(
              `${supabaseUrl}/functions/v1/openbento-analytics-admin?siteId=${encodeURIComponent('openbento_dev')}&days=7`,
              {
                headers: { 'x-openbento-admin-token': params.adminToken },
              }
            );
            checks.adminAuth = { ok: res.ok, details: `${res.status} ${res.statusText}` };
          } catch (e) {
            checks.adminAuth = {
              ok: false,
              details: e instanceof Error ? e.message : 'Request failed',
            };
          }
        }

        return { supabaseUrl, checks };
      };

      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next();

          if (req.method === 'POST' && req.url === '/__openbento/supabase/setup') {
            const body = (await readJsonBody(req)) as any;
            const mode: 'existing' | 'create' = body?.mode === 'create' ? 'create' : 'existing';

            const logs: string[] = [];
            const pushLog = (line: string) => logs.push(line);

            const adminToken =
              typeof body?.adminToken === 'string' && body.adminToken.trim()
                ? body.adminToken.trim()
                : randomToken();
            const region =
              typeof body?.region === 'string' && body.region.trim()
                ? body.region.trim()
                : 'eu-west-1';

            let projectRef: string | null = null;
            let createdDbPassword: string | null = null;

            // Ensure CLI exists + login
            {
              const { stdout } = await runSupabase(['--version']);
              pushLog(`supabase ${stdout.trim()}`);
            }

            let orgs: any[] = [];
            try {
              const { stdout } = await runSupabase(['orgs', 'list', '--output', 'json']);
              const parsed = parseMaybeJson(stdout);
              orgs = Array.isArray(parsed) ? parsed : [];
            } catch {
              json(res, 401, {
                ok: false,
                error:
                  'Supabase CLI is not logged in. Run `supabase login` in your terminal, then retry.',
              });
              return;
            }

            if (mode === 'create') {
              const orgId =
                typeof body?.orgId === 'string' && body.orgId.trim()
                  ? body.orgId.trim()
                  : pickOrgId(orgs);
              if (!orgId) {
                json(res, 400, {
                  ok: false,
                  error: 'No Supabase organization found. Create one first, then retry.',
                });
                return;
              }

              const projectName =
                typeof body?.projectName === 'string' && body.projectName.trim()
                  ? body.projectName.trim()
                  : `openbento-analytics-${Date.now()}`;

              const dbPassword =
                typeof body?.dbPassword === 'string' && body.dbPassword.trim()
                  ? body.dbPassword.trim()
                  : randomPassword();

              if (!body?.dbPassword) createdDbPassword = dbPassword;

              pushLog(`Creating Supabase project "${projectName}" (${region})…`);
              const { stdout } = await runSupabase([
                'projects',
                'create',
                projectName,
                '--org-id',
                orgId,
                '--db-password',
                dbPassword,
                '--region',
                region,
                '--output',
                'json',
              ]);

              const parsed = parseMaybeJson(stdout);
              projectRef = extractProjectRef(parsed);
              if (!projectRef) {
                json(res, 500, {
                  ok: false,
                  error: 'Project created, but could not read project ref from CLI output.',
                  logs,
                  raw: stdout,
                });
                return;
              }

              pushLog(`Project ref: ${projectRef}`);

              // Wait for API keys to be available (project warm-up)
              pushLog('Waiting for project to be ready…');
              let ready = false;
              for (let i = 0; i < 20; i++) {
                try {
                  await runSupabase([
                    'projects',
                    'api-keys',
                    '--project-ref',
                    projectRef,
                    '--output',
                    'json',
                  ]);
                  ready = true;
                  break;
                } catch {
                  await sleep(6000);
                }
              }
              if (!ready) {
                json(res, 504, {
                  ok: false,
                  error: 'Project is taking too long to become ready. Wait a bit and try again.',
                  logs,
                  projectRef,
                });
                return;
              }

              // Fill dbPassword for later steps
              body.dbPassword = dbPassword;
            } else {
              projectRef =
                (typeof body?.projectRef === 'string' && body.projectRef.trim()
                  ? body.projectRef.trim()
                  : null) ??
                (typeof body?.supabaseUrl === 'string' && body.supabaseUrl.trim()
                  ? parseProjectRefFromSupabaseUrl(body.supabaseUrl.trim())
                  : null);

              if (!projectRef) {
                json(res, 400, {
                  ok: false,
                  error:
                    'Missing project ref. Provide a Supabase URL (https://<ref>.supabase.co) or a project ref.',
                });
                return;
              }
            }

            const dbPassword =
              typeof body?.dbPassword === 'string' && body.dbPassword.trim()
                ? body.dbPassword.trim()
                : null;
            if (!dbPassword) {
              json(res, 400, {
                ok: false,
                error: 'Database password is required to apply migrations (db push).',
              });
              return;
            }

            pushLog('Linking project…');
            await runSupabase(['link', '--project-ref', projectRef, '--password', dbPassword]);

            pushLog('Applying migrations (db push)…');
            await runSupabase(['db', 'push', '--password', dbPassword]);

            pushLog('Fetching service role key…');
            const apiKeysRaw = await runSupabase([
              'projects',
              'api-keys',
              '--project-ref',
              projectRef,
              '--output',
              'json',
            ]);
            const apiKeysJson = parseMaybeJson(apiKeysRaw.stdout);
            const serviceRoleKey = extractServiceRoleKey(apiKeysJson);
            if (!serviceRoleKey) {
              json(res, 500, {
                ok: false,
                error: 'Could not find service_role key for this project.',
                logs,
              });
              return;
            }

            pushLog('Setting Edge Function secrets…');
            await runSupabase([
              'secrets',
              'set',
              `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
              `OPENBENTO_ANALYTICS_ADMIN_TOKEN=${adminToken}`,
            ]);

            pushLog('Deploying Edge Functions…');
            await runSupabase([
              'functions',
              'deploy',
              'openbento-analytics-track',
              '--project-ref',
              projectRef,
              '--use-api',
              '--no-verify-jwt',
            ]);
            await runSupabase([
              'functions',
              'deploy',
              'openbento-analytics-admin',
              '--project-ref',
              projectRef,
              '--use-api',
              '--no-verify-jwt',
            ]);

            pushLog('Verifying…');
            const verified = await verifyState({ projectRef, adminToken, serviceRoleKey });

            json(res, 200, {
              ok: true,
              logs,
              projectRef,
              supabaseUrl: verified.supabaseUrl,
              adminToken,
              generatedDbPassword: createdDbPassword,
              checks: verified.checks,
            });
            return;
          }

          if (req.method === 'GET' && req.url.startsWith('/__openbento/supabase/status')) {
            const u = new URL(req.url, 'http://localhost');
            const projectRef =
              u.searchParams.get('projectRef')?.trim() ||
              (u.searchParams.get('supabaseUrl')?.trim()
                ? parseProjectRefFromSupabaseUrl(u.searchParams.get('supabaseUrl')!.trim())
                : null);

            const adminToken = u.searchParams.get('adminToken')?.trim();
            if (!projectRef) {
              json(res, 400, { ok: false, error: 'Missing projectRef or supabaseUrl' });
              return;
            }

            const apiKeysRaw = await runSupabase([
              'projects',
              'api-keys',
              '--project-ref',
              projectRef,
              '--output',
              'json',
            ]);
            const apiKeysJson = parseMaybeJson(apiKeysRaw.stdout);
            const serviceRoleKey = extractServiceRoleKey(apiKeysJson);
            if (!serviceRoleKey) {
              json(res, 500, {
                ok: false,
                error: 'Could not find service_role key for this project.',
              });
              return;
            }

            const verified = await verifyState({
              projectRef,
              adminToken: adminToken || undefined,
              serviceRoleKey,
            });

            json(res, 200, {
              ok: true,
              projectRef,
              supabaseUrl: verified.supabaseUrl,
              checks: verified.checks,
              note: adminToken ? undefined : 'adminAuth check skipped (missing adminToken)',
            });
            return;
          }

          return next();
        } catch (e) {
          json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Internal error' });
          return;
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Base URL pour GitHub Pages (utilise le nom du repo)
    base: process.env.GITHUB_ACTIONS ? '/openbento/' : '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      // MDX plugin must come before React plugin
      mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeHighlight],
      }),
      react(),
      simpleSupabaseSetupPlugin(),
      openbentoSupabaseDevPlugin(),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
