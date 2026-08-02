# Context editing

Process Navigator keeps the visual BPMN model clean. Instructions, roles,
norms, artifacts and ERP commands are stored in a separate context document,
keyed by the immutable BPMN element ID.

## Workflow

1. Open a draft as an analyst, process owner, administrator or
   super-administrator with the `process.context.edit` permission.
2. Select any task, event or gateway on the process canvas.
3. Select the pencil button in the context panel.
4. Edit the description, responsible role and duration norm.
5. Add, update or remove materials and configured actions.
6. Save the context. The diagram remains selected and immediately displays the
   updated information.

Published and archived editions remain read-only. Context changes become
visible to regular employees only after the draft is published.

## Artifacts

Each artifact has:

- a display name;
- a kind, such as instruction, regulation or template;
- a version;
- an optional repository reference.

The reference is intentionally storage-neutral. A later 1C adapter can resolve
it to a value-storage object, attached file, approved template or another
internal repository without changing the BPMN model.

## Actions

Each action has a stable ID, display label, kind and optional target. Supported
configuration kinds are currently ERP, report, file and URL. The target may
contain a future adapter command such as `Document.SupplierOrder` or another
configuration-independent identifier.

## API and validation

Context is saved through:

`PUT /api/processes/{processId}/draft/elements/{elementId}/context`

The API requires `process.context.edit`, verifies that the draft and BPMN
element exist, limits field and collection sizes, requires unique action IDs,
validates the complete process against a temporary context file and replaces
the stored context atomically only after validation succeeds.
