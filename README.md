# Process Navigator

Reference implementation of a BPMN-first process workspace for 1C:ERP integration.

## Prerequisites

- .NET SDK 9
- Node.js 22+

## Run

```powershell
dotnet run --project backend/ProcessNavigator.Api
```

In another terminal:

```powershell
cd frontend/process-navigator-ui
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend proxies `/api` to the API at
`http://localhost:5080`.

## Commit 0001 scope

- ASP.NET Core 9 minimal Web API with a versioned process endpoint.
- React, TypeScript and Vite client.
- Full-process SVG view with BPMN lanes, tasks, gateway and labelled flows.
- Element selection and contextual instructions, artifacts and ERP actions.
- Fit-to-screen, zoom controls, responsive layout and loading/error states.

