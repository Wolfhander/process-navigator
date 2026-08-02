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

## Commit 0004 scope

- Standard BPMN 2.0 XML as the source of process structure and geometry.
- Server-side BPMN parser built on the .NET XML stack without external packages.
- Separate context JSON keyed by immutable BPMN element IDs.
- Validation of lanes, nodes, sequence flows, bounds and waypoints.
- API endpoint for downloading the original BPMN source.

See [the BPMN import contract](docs/bpmn-import.md) for supported elements and
validation rules.

## Commit 0005 scope

- Process catalog endpoint and process selector in the application header.
- BPMN upload from the user interface with an optional context JSON file.
- Server-side validation before a process is accepted into the catalog.
- Clear import results with warnings for elements that lack contextual data.
- Imported processes start as drafts and become immediately available for viewing.

## Commit 0006 scope

- Published and draft editions remain separate until publication.
- New revisions are created from the current published BPMN and context.
- Draft BPMN can be replaced and validated without affecting employees.
- Publication archives the previous version and promotes the draft atomically.
- Version history is available from the process toolbar.

## Commit 0007 scope

- Version history is ordered by lifecycle state and semantic version.
- Archived BPMN editions can be opened directly from the history dialog.
- Archive view is explicitly marked read-only and keeps the full process canvas.
- One action returns the user to the currently published process.

## Commit 0008 scope

- Six demonstration users represent executor, manager, analyst, process owner,
  administrator and super-administrator responsibilities.
- A server-side permission matrix protects import, draft editing and publication.
- The current user can be switched from the application header for role testing.
- Process and context commands adapt to the active user's permissions.
- Direct API calls cannot bypass the same permission checks used by the UI.

See [access control](docs/access-control.md) for the current role matrix.

## Commit 0009 scope

- Embedded BPMN editor based on a locally bundled `bpmn-js` runtime.
- Offline creation and editing of lanes, tasks, events, gateways and flows.
- Direct label editing plus the standard BPMN palette and context pad.
- Draft-only editing protected by the `process.diagram.edit` permission.
- Server-side validation before the edited XML replaces the stored draft.
- Lazy loading keeps the larger modelling runtime out of the normal viewer path.

See [the embedded BPMN editor guide](docs/bpmn-editor.md) for the editing and
publication workflow.

## Commit 0010 scope

- In-place context editing for every BPMN element in a draft edition.
- Descriptions, responsible roles and duration norms remain outside BPMN XML.
- Versioned instructions, templates and other artifacts support a repository
  reference for future 1C storage integration.
- ERP, report, file and URL actions support stable IDs and configurable targets.
- Server-side authorization, field limits and atomic context-file replacement.
- The interface no longer requests web fonts and remains fully offline.

See [context editing](docs/context-editor.md) for the data model and workflow.
