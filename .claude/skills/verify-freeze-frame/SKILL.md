---
name: verify-freeze-frame
description: The runnable definition of done for FreezeFrame — typecheck, lint, test, build both projects and confirm the local loop serves the API.
---
# Verify FreezeFrame

Run and confirm all green:

    cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
    cd ../api && npm run typecheck && npm run lint && npm run test && npm run build

Then the local loop (see `docs/conventions/local-dev.md`):

1. Start Azurite (Table emulator).
2. `swa start` (serves frontend, proxies `/api`, emulates auth — provides `x-ms-client-principal`).
3. `curl http://localhost:4280/api/freeze-candidates` returns a JSON array.

Done = both suites green AND the endpoint responds. Check the result against the spec's Success/Failure criteria.
