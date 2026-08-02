using System.Text.Json;
using System.Text;
using ProcessNavigator.Api.Models;
using ProcessNavigator.Api.Services;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<BpmnProcessLoader>();
builder.Services.AddSingleton<ProcessCatalogService>();
builder.Services.AddSingleton<AccessControlService>();
builder.Services.AddSingleton<ArtifactRepositoryService>();
builder.Services.AddSingleton<ProcessAssignmentService>();
builder.Services.AddSingleton<ProcessExecutionService>();
builder.Services.AddSingleton<ProcessCommandService>();

var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", service = "ProcessNavigator.Api" }));

app.MapGet("/api/session", (HttpContext context, AccessControlService access) => Results.Ok(access.Session(context)));

app.MapGet("/api/admin/users", (HttpContext context, AccessControlService access) =>
    access.Has(context, ProcessPermissions.ManageUsers) ? Results.Ok(access.Directory()) : Forbidden(ProcessPermissions.ManageUsers));

app.MapPut("/api/admin/users/{userId}", async (string userId, UserUpdateModel update, HttpContext context, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.ManageUsers)) return Forbidden(ProcessPermissions.ManageUsers);
    try { return Results.Ok(await access.UpdateAsync(userId, update, access.CurrentUser(context).Id, cancellationToken)); }
    catch (KeyNotFoundException) { return Results.NotFound(new { message = $"Пользователь '{userId}' не найден." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "User validation failed"); }
});

app.MapGet("/api/artifacts", async (HttpContext context, ArtifactRepositoryService artifacts, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.View)) return Forbidden(ProcessPermissions.View);
    return Results.Ok(await artifacts.ListAsync(cancellationToken));
});

app.MapGet("/api/processes/{processId}/assignments", async (string processId, HttpContext context, ProcessCatalogService catalog,
    ProcessAssignmentService assignments, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.View)) return Forbidden(ProcessPermissions.View);
    try { return Results.Ok(await assignments.LoadAsync(await catalog.LoadAsync(processId, false, cancellationToken), access.Users(), cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
});

app.MapGet("/api/processes/{processId}/instances", async (string processId, HttpContext context, ProcessExecutionService executions,
    AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.View)) return Forbidden(ProcessPermissions.View);
    return Results.Ok(await executions.ListAsync(processId, cancellationToken));
});

app.MapGet("/api/processes/{processId}/analytics", async (string processId, HttpContext context, ProcessCatalogService catalog,
    ProcessExecutionService executions, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.ViewAnalytics)) return Forbidden(ProcessPermissions.ViewAnalytics);
    try { return Results.Ok(await executions.AnalyticsAsync(await catalog.LoadAsync(processId, false, cancellationToken), cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
});

app.MapGet("/api/processes/{processId}/elements/{elementId}/commands", async (string processId, string elementId,
    HttpContext context, ProcessCommandService commands, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.View)) return Forbidden(ProcessPermissions.View);
    return Results.Ok(await commands.ListAsync(processId, elementId, cancellationToken));
});

app.MapPost("/api/processes/{processId}/elements/{elementId}/actions/{actionId}/execute", async (string processId,
    string elementId, string actionId, ExecuteCommandRequestModel request, HttpContext context, ProcessCatalogService catalog,
    ProcessCommandService commands, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.Execute)) return Forbidden(ProcessPermissions.Execute);
    try { return Results.Ok(await commands.ExecuteAsync(await catalog.LoadAsync(processId, false, cancellationToken), elementId,
        actionId, request.InstanceId, access.CurrentUser(context).Id, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
    catch (KeyNotFoundException) { return Results.NotFound(new { message = "Элемент или команда процесса не найдены." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Command validation failed"); }
});

app.MapPost("/api/processes/{processId}/instances", async (string processId, StartProcessInstanceModel request, HttpContext context,
    ProcessCatalogService catalog, ProcessExecutionService executions, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.Execute)) return Forbidden(ProcessPermissions.Execute);
    try { return Results.Ok(await executions.StartAsync(await catalog.LoadAsync(processId, false, cancellationToken), access.CurrentUser(context).Id, request.Name, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
});

app.MapPut("/api/processes/{processId}/instances/{instanceId}/steps/{elementId}", async (string processId, string instanceId,
    string elementId, StepStatusUpdateModel request, HttpContext context, ProcessCatalogService catalog,
    ProcessExecutionService executions, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.Execute)) return Forbidden(ProcessPermissions.Execute);
    try { return Results.Ok(await executions.UpdateStepAsync(await catalog.LoadAsync(processId, false, cancellationToken), instanceId, elementId, request.Status, access.CurrentUser(context).Id, cancellationToken)); }
    catch (KeyNotFoundException) { return Results.NotFound(new { message = "Экземпляр или шаг процесса не найден." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Execution validation failed"); }
});

app.MapPut("/api/processes/{processId}/assignments", async (string processId, ProcessAssignmentsUpdateModel update, HttpContext context,
    ProcessCatalogService catalog, ProcessAssignmentService assignments, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.ManageAssignments)) return Forbidden(ProcessPermissions.ManageAssignments);
    try { return Results.Ok(await assignments.SaveAsync(await catalog.LoadAsync(processId, false, cancellationToken), update, access.Users(), cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Assignment validation failed"); }
});

app.MapPost("/api/artifacts", async (IFormFile file, [FromForm] string name, [FromForm] string kind,
    [FromForm] string version, [FromForm] string? artifactId,
    HttpContext context, ArtifactRepositoryService artifacts, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.EditContext)) return Forbidden(ProcessPermissions.EditContext);
    try { return Results.Ok(await artifacts.UploadAsync(file, name, kind, version, artifactId, cancellationToken)); }
    catch (ArtifactConflictException exception) { return Results.Conflict(new { message = exception.Message }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Artifact validation failed"); }
}).DisableAntiforgery();

app.MapGet("/api/artifacts/{artifactId}/content", async (string artifactId, string? version, HttpContext context,
    ArtifactRepositoryService artifacts, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.View)) return Forbidden(ProcessPermissions.View);
    try
    {
        var file = await artifacts.ResolveAsync(artifactId, version, cancellationToken);
        return Results.File(file.Path, file.ContentType, file.FileName, enableRangeProcessing: true);
    }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Artifact '{artifactId}' was not found." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Artifact validation failed"); }
});

app.MapGet("/api/processes", async (ProcessCatalogService catalog, CancellationToken cancellationToken) =>
    Results.Ok(await catalog.ListAsync(cancellationToken)));

app.MapGet("/api/processes/{processId}", async (string processId, bool? draft, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (draft == true && !CanOpenDraft(context, access)) return Forbidden("process.draft.view");
    try
    {
        return Results.Ok(await catalog.LoadAsync(processId, draft == true, cancellationToken));
    }
    catch (FileNotFoundException)
    {
        return Results.NotFound(new { message = $"Process '{processId}' was not found." });
    }
    catch (InvalidDataException exception)
    {
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status422UnprocessableEntity,
            title: "BPMN validation failed");
    }
});

app.MapGet("/api/processes/{processId}/versions", async (string processId, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    try
    {
        var versions = await catalog.VersionsAsync(processId, cancellationToken);
        return Results.Ok(CanOpenDraft(context, access) ? versions : versions.Where(version => version.Status != "Draft"));
    }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
});

app.MapGet("/api/processes/{processId}/versions/{version}", async (string processId, string version, ProcessCatalogService catalog, CancellationToken cancellationToken) =>
{
    try { return Results.Ok(await catalog.LoadArchivedAsync(processId, version, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Archived version '{version}' was not found." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Archived BPMN validation failed"); }
});

app.MapPost("/api/processes/{processId}/draft", async (string processId, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.CreateDraft)) return Forbidden(ProcessNavigator.Api.Models.ProcessPermissions.CreateDraft);
    try { return Results.Ok(await catalog.CreateDraftAsync(processId, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Process '{processId}' was not found." }); }
    catch (ProcessConflictException exception) { return Results.Conflict(new { message = exception.Message }); }
});

app.MapPut("/api/processes/{processId}/draft", async (
    string processId, IFormFile bpmnFile, IFormFile? contextFile, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.EditDiagram)) return Forbidden(ProcessNavigator.Api.Models.ProcessPermissions.EditDiagram);
    try { return Results.Ok(await catalog.ReplaceDraftAsync(processId, bpmnFile, contextFile, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Draft for process '{processId}' was not found." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Draft validation failed"); }
}).DisableAntiforgery();

app.MapPost("/api/processes/{processId}/publish", async (string processId, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.Publish)) return Forbidden(ProcessNavigator.Api.Models.ProcessPermissions.Publish);
    try { return Results.Ok(await catalog.PublishDraftAsync(processId, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Draft for process '{processId}' was not found." }); }
    catch (IOException exception) { return Results.Conflict(new { message = exception.Message }); }
});

app.MapGet("/api/processes/{processId}/bpmn", (string processId, BpmnProcessLoader loader) =>
{
    var path = loader.GetBpmnPath(processId);
    if (!File.Exists(path))
        return Results.NotFound(new { message = $"Process '{processId}' was not found." });
    return Results.File(path, "application/xml; charset=utf-8", enableRangeProcessing: true);
});

app.MapGet("/api/processes/{processId}/draft/bpmn", (string processId, HttpContext context, ProcessCatalogService catalog, AccessControlService access) =>
{
    if (!CanOpenDraft(context, access)) return Forbidden("process.draft.view");
    var path = catalog.GetBpmnSourcePath(processId, draft: true);
    return File.Exists(path)
        ? Results.File(path, "application/xml; charset=utf-8", enableRangeProcessing: true)
        : Results.NotFound(new { message = $"Draft for process '{processId}' was not found." });
});

app.MapPut("/api/processes/{processId}/draft/bpmn", async (string processId, HttpContext context, ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.EditDiagram)) return Forbidden(ProcessNavigator.Api.Models.ProcessPermissions.EditDiagram);
    using var reader = new StreamReader(context.Request.Body, Encoding.UTF8);
    var xml = await reader.ReadToEndAsync(cancellationToken);
    try { return Results.Ok(await catalog.SaveDraftXmlAsync(processId, xml, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Draft for process '{processId}' was not found." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "BPMN validation failed"); }
});

app.MapPut("/api/processes/{processId}/draft/elements/{elementId}/context", async (
    string processId, string elementId, ElementContextUpdateModel update, HttpContext context,
    ProcessCatalogService catalog, AccessControlService access, CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessPermissions.EditContext)) return Forbidden(ProcessPermissions.EditContext);
    try { return Results.Ok(await catalog.SaveDraftElementContextAsync(processId, elementId, update, cancellationToken)); }
    catch (FileNotFoundException) { return Results.NotFound(new { message = $"Draft for process '{processId}' was not found." }); }
    catch (KeyNotFoundException) { return Results.NotFound(new { message = $"BPMN element '{elementId}' was not found in the draft." }); }
    catch (InvalidDataException exception) { return Results.Problem(exception.Message, statusCode: 422, title: "Context validation failed"); }
});

app.MapPost("/api/processes/import", async (
    IFormFile bpmnFile,
    IFormFile? contextFile,
    HttpContext context,
    ProcessCatalogService catalog,
    AccessControlService access,
    CancellationToken cancellationToken) =>
{
    if (!access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.Import)) return Forbidden(ProcessNavigator.Api.Models.ProcessPermissions.Import);
    try
    {
        var result = await catalog.ImportAsync(bpmnFile, contextFile, cancellationToken);
        return Results.Created($"/api/processes/{result.Process.Id}", result);
    }
    catch (ProcessConflictException exception)
    {
        return Results.Conflict(new { message = exception.Message });
    }
    catch (InvalidDataException exception)
    {
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status422UnprocessableEntity,
            title: "BPMN import validation failed");
    }
}).DisableAntiforgery();

app.Run();

static IResult Forbidden(string permission) => Results.Json(new
{
    message = "У текущего пользователя нет прав для выполнения этой операции.",
    requiredPermission = permission
}, statusCode: StatusCodes.Status403Forbidden);

static bool CanOpenDraft(HttpContext context, AccessControlService access) =>
    access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.EditDiagram) ||
    access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.EditContext) ||
    access.Has(context, ProcessNavigator.Api.Models.ProcessPermissions.Publish);
