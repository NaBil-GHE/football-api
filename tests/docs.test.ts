import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import app from '../src/app';
import { startTestServer } from './helpers/test-db';

describe('Phase 12 — API Documentation (Swagger / OpenAPI)', () => {
  let baseUrl = '';
  let closeServer: () => Promise<void>;

  before(async () => {
    const started = await startTestServer(app);
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  after(async () => {
    await closeServer();
  });

  it('serves OpenAPI JSON spec at GET /api/docs.json and Swagger UI at GET /api/docs', async () => {
    const jsonRes = await fetch(`${baseUrl}/api/docs.json`);
    const spec = (await jsonRes.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };

    assert.equal(jsonRes.status, 200);
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.info.title, 'Football API');
    assert.ok(spec.paths['/health']);
    assert.ok(spec.paths['/teams']);
    assert.ok(spec.paths['/leagues/{id}/standings']);
    assert.ok(spec.paths['/matches/{id}/events']);
    assert.ok(spec.paths['/dashboard/overview']);

    const uiRes = await fetch(`${baseUrl}/api/docs/`);
    const html = await uiRes.text();
    assert.equal(uiRes.status, 200);
    assert.match(html, /swagger-ui/i);
  });
});
