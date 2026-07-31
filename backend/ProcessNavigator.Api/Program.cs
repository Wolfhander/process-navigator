using System.Text.Json;
using System.Text;
using ProcessNavigator.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<BpmnProcessLoader>();
builder.Services.AddSingleton<ProcessCatalogService>();
builder.Services.AddSingleton<AccessControlService>();

var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", service = "ProcessNavigator.Api" }));

app.MapGet("/api/session", (HttpContext context, AccessControlService access) => Results.Ok(access.Session(context)));

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
