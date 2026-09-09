// @ts-ignore - bun:test types resolve under bun; tsc under node skips this line
import { describe, expect, it } from "bun:test";
import app from "./index";

async function call(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await app.handle(
    new Request(`http://localhost${path}`, init)
  );
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers };
}

describe("legacy routes (backwards compat)", () => {
  it("GET / returns ok", async () => {
    const { status, body } = await call("/");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("GET /health returns healthy + timestamp", async () => {
    const { status, body } = await call("/health");
    expect(status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(typeof body.timestamp).toBe("string");
  });

  it("POST /echo validation error returns 400 JSON", async () => {
    const { status, body } = await call("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrong: "field" }),
    });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("POST /echo valid body echoes", async () => {
    const { status, body } = await call("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(status).toBe(200);
    expect(body.message).toBe("hello");
  });
});

describe("versioned api", () => {
  it("GET /v1/health returns version + timestamp", async () => {
    const { status, body } = await call("/v1/health");
    expect(status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(typeof body.version).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  it("unknown route returns JSON 404", async () => {
    const { status, body } = await call("/v1/nope-missing");
    expect(status).toBe(404);
    expect(body.error).toMatch(/Not Found/i);
  });
});

describe("projects CRUD roundtrip", () => {
  it("create -> get -> list -> delete -> 404", async () => {
    // create
    const created = await call("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test-project" }),
    });
    expect(created.status).toBe(201);
    expect(created.body.data.id).toBeDefined();
    expect(created.body.data.name).toBe("test-project");
    const id = created.body.data.id as string;

    // get single
    const fetched = await call(`/v1/projects/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(id);

    // list contains it
    const listed = await call("/v1/projects");
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.data)).toBe(true);
    expect(listed.body.data.some((p: any) => p.id === id)).toBe(true);

    // delete
    const deleted = await call(`/v1/projects/${id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toBe(true);

    // get after delete -> 404
    const after = await call(`/v1/projects/${id}`);
    expect(after.status).toBe(404);
    expect(after.body.error).toMatch(/Not Found/i);
  });
});
