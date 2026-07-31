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

## Commit 0002 scope

- Cursor-centered wheel zoom from 100% to 400%.
- Canvas panning with pointer capture while preserving the selected element.
- Working toolbar controls for zooming and fitting the complete process.
- Interactive minimap with the current viewport and selected task.
- Double-click shortcut to restore the complete process view.

## Commit 0003 scope

- Graph-based focus for the selected element and its adjacent route.
- Persistent current-lane indicator while zooming and panning.
- Collapsed context rail when no BPMN element is selected.
- Capability provider registry for ERP actions and process artifacts.
- Progressive capability badges at detailed zoom levels.
