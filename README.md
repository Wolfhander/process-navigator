# Process Navigator

## Commit 0025 — юридические лица на BPMN-дорожках

Сквозной процесс теперь хранит соответствие `дорожка → юридическое лицо → подразделение`. На схеме принадлежность показывается ненавязчивой подписью дорожки и в индикаторе активной роли; сама BPMN и её идентификаторы не изменяются.

## Commit 0024 — группа юридических лиц

Карта предприятия расширена до группы компаний: юридические лица имеют собственные направления, а один BPMN-процесс может быть отмечен как сквозной и связывать несколько организаций. Демонстрационная структура хранится отдельно от интерфейса в `Data/organization.json`.

## Commit 0023 — карта предприятия

Добавлен верхний уровень навигации: карта направлений деятельности и каталог доступных процессов. Возврат к карте выполняется через логотип, значок дома или название предприятия; выбор процесса открывает его привычное BPMN-рабочее место.

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

## Commit 0011 scope

- Local repository for process instructions, templates and other files.
- Immutable file versions with one current approved version per artifact.
- Upload directly from the BPMN element context editor.
- Stable `artifact:` references keep binary data outside BPMN and context JSON.
- Download of a selected artifact version from the normal context panel.
- 20 MB upload limit, safe repository paths and role-protected writes.

See [the artifact repository guide](docs/artifact-repository.md) for storage and
versioning rules.

## Commit 0012 scope

- Persistent local user directory for the offline installation.
- Administrator screen for assigning roles and enabling user accounts.
- Role-derived permissions remain read-only and consistent across the UI and API.
- Protection against disabling the current account or the last super-administrator.
- User identity headers replace the earlier role-only demonstration switch.

See [user administration](docs/user-administration.md) for the current offline
identity model and the future 1C integration boundary.

## Commit 0013 scope

- Real employees can be assigned to stable BPMN lane roles per process.
- Process owners, administrators and super-administrators manage assignments.
- The selected task context shows both its process role and assigned people.
- Assignments remain outside BPMN XML and survive diagram context changes.
- Server validation rejects unknown lanes, disabled users and unauthorized writes.

See [process participants](docs/process-participants.md) for assignment rules and
the planned mapping to 1C users and organizational units.

## Commit 0014 scope

- A prominent assigned-people section in every BPMN element context card.
- Personal **Мои шаги** view based on the current user's lane assignments.
- Personal lanes, tasks and connecting flows are emphasized without hiding the
  complete BPMN process.
- Switching process or user safely returns to the normal overview.
- Users without assignments receive an explanatory disabled personal-view action.

## Commit 0015 scope

- Persistent process instances separated from the BPMN definition.
- Start and reopen concrete executions of the published process version.
- Manual start and completion timestamps for every BPMN task.
- Executor identity recorded for each changed step.
- Live task-state coloring on the complete process canvas.

## Commit 0016 scope

- Execution analytics for every published process.
- Counts of active and completed instances plus the average process cycle.
- Average and maximum duration, active work and SLA violations per BPMN task.
- Duration norms support minutes, hours and working days (eight hours).
- Problem-first task list with direct navigation from analytics to the BPMN element.
- Analytics API and interface are protected by the `analytics.view` permission.

See [process analytics](docs/process-analytics.md) for calculation rules and the
current limits of the first analytics iteration.

## Commit 0017 scope

- Server-side execution of configured BPMN element actions.
- A stable adapter boundary for ERP, report, URL and file commands.
- Validation against the published process prevents arbitrary client commands.
- Every invocation records its process, element, user, instance and timestamp.
- The element context displays the adapter result and recent command journal.
- The included offline 1C adapter returns a traceable demonstration reference;
  it can later be replaced by the real 1C integration implementation.

See [process commands and ERP adapter](docs/process-commands.md) for the command
contract and integration boundary.

## Commit 0018 scope

- Global search across all published process models.
- Results cover processes, BPMN elements, responsible roles, artifacts and actions.
- Relevance ranking prefers exact and title matches over contextual matches.
- Selecting a result switches processes when necessary and focuses the target BPMN element.
- Search is available offline and protected by the normal process-view permission.
- The duplicated command journal below the materials section was corrected.

See [global process search](docs/global-search.md) for indexing scope and navigation behavior.

## Commit 0019 scope

- Persistent discussions attached to every BPMN element.
- Comments record the authenticated author and server timestamp.
- All process participants can read and add practical clarifications.
- Discussion data remains outside BPMN XML and process-version files.
- Comments survive closing the context panel and restarting the local server.

See [element discussions](docs/element-discussions.md) for storage and usage rules.

## Commit 0020 scope

- Built-in help is available directly from the permanent application header.
- Quick start explains the process-first interaction model without technical terms.
- Role-aware guidance adapts to the current employee, manager, analyst, owner or administrator.
- The searchable capability catalog separates implemented features from the next integration contour and planned work.
- A maintained user manual and capability catalog are included with the source code.

See the [user manual](docs/user-manual.md) and [capability catalog](docs/capability-catalog.md).

## Commit 0021 scope

- Persistent personal notifications stored on the local Process Navigator server.
- Full-name mentions in element discussions create notifications for the addressed users.
- The discussion editor offers one-click mention insertion for active users.
- The header bell shows the unread counter and opens the personal notification center.
- Opening a notification marks it as read and navigates to the related BPMN element.
- Users can mark the entire notification inbox as read.

## Commit 0022 scope

- Configurable HTTP integration with an internal 1C:ERP server.
- Superadministrator interface for endpoint paths, credentials, timeout and demo/real mode.
- Passwords are protected server-side and are never returned to the browser.
- Connection diagnostics are available before enabling process commands.
- ERP command payloads include process, version, BPMN element, action, instance and user context.
- Failed HTTP calls and negative 1C responses remain visible in the command audit journal.

See the [1C integration contract](docs/one-c-integration.md) for the server-side HTTP service requirements.

## Commit 0026 scope

- Superadministrators can maintain the group name and description from the enterprise map.
- Legal entities and their business directions can be added, edited and removed without changing JSON files manually.
- Organization changes are validated and saved atomically by the local server.
- The enterprise map reloads immediately after a successful update.
- Referential validation protects legal entities already used by cross-company processes.

## Commit 0027 scope

- Legal entities now contain a separate multi-level hierarchy of organization units.
- The demo hierarchy is based on the supplied organization workbook: 76 units across the corporation, plant and communication center.
- Every unit keeps its parent, full name, short name and manager position.
- The enterprise map offers a collapsible organization-tree view with search by unit or manager.
- Server validation rejects missing parents, duplicate identifiers and circular reporting lines.
