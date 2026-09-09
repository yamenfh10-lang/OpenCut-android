import { Elysia, t } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const ProjectCreateSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
});

const ProjectUpdateSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  description: t.Optional(t.String({ maxLength: 2000 })),
});

const EchoSchema = t.Object({
  message: t.String({ minLength: 1, maxLength: 5000 }),
});

// In-memory stub store. Single-worker / dev only — replaced by D1/KV in prod.
const projects = new Map<string, Project>();

// ---------------------------------------------------------------------------
// Helpers (no secrets; env access is optional so tsc passes without bindings)
// ---------------------------------------------------------------------------

function getEnvValue(env: unknown, key: string): string | undefined {
  try {
    // @ts-ignore - optional env access; vars/bindings may not exist locally
    const v = (env as any)?.[key];
    if (typeof v === "string" && v.length > 0) return v;
  } catch {
    // ignore
  }
  try {
    const proc = (globalThis as any)?.process;
    if (typeof proc !== "undefined") {
      const fallback = proc?.env?.[key];
      if (typeof fallback === "string" && fallback.length > 0) return fallback;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function getVersion(env: unknown): string {
  return getEnvValue(env, "API_VERSION") ?? "0.0.1";
}

function getEnv(envHolder: unknown): unknown {
  // @ts-ignore - `env` is injected by CloudflareAdapter at runtime only
  return (envHolder as any)?.env ?? undefined;
}

// Optional KV passthrough (best-effort; no-op when binding is absent).
async function kvGet(env: unknown, key: string): Promise<unknown> {
  try {
    // @ts-ignore - OPENCUT_KV only exists when the KV binding is configured
    const kv = (env as any)?.OPENCUT_KV;
    if (!kv || typeof kv.get !== "function") return undefined;
    return await kv.get(key, "json");
  } catch {
    return undefined;
  }
}

async function kvPut(env: unknown, key: string, value: unknown): Promise<void> {
  try {
    // @ts-ignore - OPENCUT_KV only exists when the KV binding is configured
    const kv = (env as any)?.OPENCUT_KV;
    if (!kv || typeof kv.put !== "function") return;
    await kv.put(key, JSON.stringify(value));
  } catch {
    // best-effort only
  }
}

async function kvDel(env: unknown, key: string): Promise<void> {
  try {
    // @ts-ignore - OPENCUT_KV only exists when the KV binding is configured
    const kv = (env as any)?.OPENCUT_KV;
    if (!kv || typeof kv.delete !== "function") return;
    await kv.delete(key);
  } catch {
    // best-effort only
  }
}

// Optional R2 passthrough probe (best-effort; no-op when binding is absent).
async function r2Head(env: unknown, key: string): Promise<unknown> {
  try {
    // @ts-ignore - OPENCUT_R2 only exists when the R2 binding is configured
    const bucket = (env as any)?.OPENCUT_R2;
    if (!bucket || typeof bucket.head !== "function") return undefined;
    return await bucket.head(key);
  } catch {
    return undefined;
  }
}

function jsonError(
  set: { status?: number | string; headers: Record<string, string> },
  status: number,
  error: string,
  message: string,
  requestId: string,
  path: string
) {
  set.status = status;
  return {
    error,
    message,
    requestId,
    path,
    timestamp: new Date().toISOString(),
  };
}

function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Elysia({ adapter: CloudflareAdapter })
  .use(
    cors({
      origin: [
        "https://new.opencut.app",
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposeHeaders: ["X-Request-Id"],
      credentials: false,
      maxAge: 86400,
    })
  )
  .use(openapi())
  // Request id + simple logging. `derive` runs per request so handlers can use
  // `requestId`; onRequest/onAfterHandle emit minimal access logs.
  .onRequest(({ request }) => {
    console.log(`-> ${request.method} ${requestPath(request)}`);
  })
  .derive(({ set }) => {
    const requestId = crypto.randomUUID();
    set.headers["X-Request-Id"] = requestId;
    return { requestId };
  })
  .onAfterHandle(({ request, set, requestId }) => {
    const status = typeof set.status === "number" ? set.status : 200;
    const id =
      typeof requestId === "string" ? requestId : "unknown";
    console.log(
      `<- ${request.method} ${requestPath(request)} ${status} rid=${id}`
    );
  })
  .onError(({ code, error, set, request }) => {
    const path = request ? requestPath(request as Request) : "/";
    const method = (request as Request | undefined)?.method ?? "UNKNOWN";
    const requestId =
      (set.headers as Record<string, string>)?.["X-Request-Id"] ??
      "unknown";
    const timestamp = new Date().toISOString();
    console.error(`!! ${method} ${path} code=${code} rid=${requestId}`, error);

    if (code === "VALIDATION") {
      const message =
        (error as any)?.message ?? "Validation failed";
      return jsonError(
        set as any,
        400,
        "Bad Request",
        String(message),
        requestId,
        path
      );
    }
    if (code === "NOT_FOUND") {
      return jsonError(
        set as any,
        404,
        "Not Found",
        `Route not found: ${path}`,
        requestId,
        path
      );
    }
    const status =
      typeof set.status === "number" && set.status >= 400
        ? set.status
        : 500;
    const message =
      (error as any)?.message ?? "Internal Server Error";
    return {
      error:
        status === 500 ? "Internal Server Error" : "Request Failed",
      message: String(message),
      requestId,
      path,
      timestamp,
    };
  })
  // -- Backwards compat (legacy stub) ---------------------------------------
  .get("/", () => ({ status: "ok" }))
  .get("/health", () => ({
    healthy: true,
    timestamp: new Date().toISOString(),
  }))
  .post("/echo", ({ body }) => body, {
    body: EchoSchema,
  })
  // -- Versioned API ---------------------------------------------------------
  .get("/v1/health", ({ requestId, ...rest }) => {
    const env = getEnv(rest);
    return {
      healthy: true,
      version: getVersion(env),
      timestamp: new Date().toISOString(),
      requestId,
    };
  })
  .post(
    "/v1/echo",
    ({ body, requestId }) => ({
      ...(body as Record<string, unknown>),
      timestamp: new Date().toISOString(),
      requestId,
    }),
    { body: EchoSchema }
  )
  // Projects CRUD stub (in-memory Map + optional KV/R2 passthrough).
  .get("/v1/projects", async ({ requestId, ...rest }) => {
    const env = getEnv(rest);
    // Best-effort R2 probe so the binding is referenced without failing
    // when unconfigured (compiles without bindings via @ts-ignore above).
    await r2Head(env, "projects/.probe");
    return {
      data: [...projects.values()],
      count: projects.size,
      timestamp: new Date().toISOString(),
      requestId,
    };
  })
  .post(
    "/v1/projects",
    async ({ body, set, requestId, ...rest }) => {
      const env = getEnv(rest);
      const now = new Date().toISOString();
      const project: Project = {
        id: crypto.randomUUID(),
        name: (body as { name: string }).name,
        description: (body as { description?: string }).description,
        createdAt: now,
        updatedAt: now,
      };
      projects.set(project.id, project);
      await kvPut(env, `project:${project.id}`, project);
      (set as any).status = 201;
      return { data: project, requestId, timestamp: now };
    },
    { body: ProjectCreateSchema }
  )
  .get(
    "/v1/projects/:id",
    async ({ params, set, requestId, ...rest }) => {
      const env = getEnv(rest);
      const cached = (await kvGet(
        env,
        `project:${params.id}`
      )) as Project | undefined;
      if (cached && typeof cached === "object" && (cached as any).id) {
        return { data: cached, requestId };
      }
      const project = projects.get(params.id);
      if (!project) {
        return jsonError(
          set as any,
          404,
          "Not Found",
          `Project not found: ${params.id}`,
          requestId as string,
          `/v1/projects/${params.id}`
        );
      }
      return { data: project, requestId };
    },
    { params: t.Object({ id: t.String({ minLength: 1 }) }) }
  )
  .put(
    "/v1/projects/:id",
    async ({ params, body, set, requestId, ...rest }) => {
      const env = getEnv(rest);
      const existing = projects.get(params.id);
      if (!existing) {
        return jsonError(
          set as any,
          404,
          "Not Found",
          `Project not found: ${params.id}`,
          requestId as string,
          `/v1/projects/${params.id}`
        );
      }
      const patch = body as Partial<Pick<Project, "name" | "description">>;
      const updated: Project = {
        ...existing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      projects.set(params.id, updated);
      await kvPut(env, `project:${params.id}`, updated);
      return { data: updated, requestId };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      body: ProjectUpdateSchema,
    }
  )
  .delete(
    "/v1/projects/:id",
    async ({ params, set, requestId, ...rest }) => {
      const env = getEnv(rest);
      const existing = projects.get(params.id);
      if (!existing) {
        return jsonError(
          set as any,
          404,
          "Not Found",
          `Project not found: ${params.id}`,
          requestId as string,
          `/v1/projects/${params.id}`
        );
      }
      projects.delete(params.id);
      await kvDel(env, `project:${params.id}`);
      (set as any).status = 200;
      return {
        data: { id: params.id, deleted: true },
        requestId,
        timestamp: new Date().toISOString(),
      };
    },
    { params: t.Object({ id: t.String({ minLength: 1 }) }) }
  )
  // Explicit JSON 404 fallback (onError NOT_FOUND covers this too).
  .all("*", ({ set, request, requestId }) =>
    jsonError(
      set as any,
      404,
      "Not Found",
      `Route not found: ${requestPath(request)}`,
      (requestId as string) ?? "unknown",
      requestPath(request)
    )
  )
  // .compile() triggers AoT compilation at startup (required for CF workers)
  .compile();

export default app;
