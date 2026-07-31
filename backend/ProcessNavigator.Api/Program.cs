using System.Text.Json;
using ProcessNavigator.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<BpmnProcessLoader>();
builder.Services.AddSingleton<ProcessCatalogService>();

var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", service = "ProcessNavigator.Api" }));

app.MapGet("/api/processes", async (ProcessCatalogService catalog, CancellationToken cancellationToken) =>
    Results.Ok(await catalog.ListAsync(cancellationToken)));

app.MapGet("/api/processes/{processId}", async (string processId, BpmnProcessLoader loader, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await loader.LoadAsync(processId, cancellationToken));
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

app.MapGet("/api/processes/{processId}/bpmn", (string processId, BpmnProcessLoader loader) =>
{
    var path = loader.GetBpmnPath(processId);
    if (!File.Exists(path))
        return Results.NotFound(new { message = $"Process '{processId}' was not found." });
    return Results.File(path, "application/xml; charset=utf-8", enableRangeProcessing: true);
});

app.MapPost("/api/processes/import", async (
    IFormFile bpmnFile,
    IFormFile? contextFile,
    ProcessCatalogService catalog,
    CancellationToken cancellationToken) =>
{
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
