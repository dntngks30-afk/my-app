import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

type AppVersionSource =
  | 'vercel_git_commit_sha'
  | 'next_public_app_version'
  | 'vercel_git_commit_ref'
  | 'fallback';

function resolveAppVersion(): { version: string; source: AppVersionSource } {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commitSha && commitSha.trim().length > 0) {
    return {
      version: commitSha.trim(),
      source: 'vercel_git_commit_sha',
    };
  }

  const publicVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  if (publicVersion && publicVersion.trim().length > 0) {
    return {
      version: publicVersion.trim(),
      source: 'next_public_app_version',
    };
  }

  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef && commitRef.trim().length > 0) {
    return {
      version: commitRef.trim(),
      source: 'vercel_git_commit_ref',
    };
  }

  return {
    version: 'local',
    source: 'fallback',
  };
}

function resolveEnvironment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
}

function resolveDeployedAt(): string | null {
  const raw = process.env.VERCEL_DEPLOYMENT_CREATED_AT;

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();
  const numeric = Number(trimmed);
  const date = Number.isFinite(numeric)
    ? new Date(numeric)
    : new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function GET() {
  const { version, source } = resolveAppVersion();

  return NextResponse.json(
    {
      ok: true,
      version,
      source,
      environment: resolveEnvironment(),
      deployedAt: resolveDeployedAt(),
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );
}
