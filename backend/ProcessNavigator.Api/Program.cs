using System.Text.Json;
using ProcessNavigator.Api.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

var app = builder.Build();
if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", service = "ProcessNavigator.Api" }));

app.MapGet("/api/processes/{processId}", async (string processId, IWebHostEnvironment environment) =>
{
    if (!string.Equals(processId, "purchase-materials", StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = $"Process '{processId}' was not found." });

    var path = Path.Combine(environment.ContentRootPath, "Data", "purchase-process.json");
    await using var stream = File.OpenRead(path);
    var process = await JsonSerializer.DeserializeAsync<ProcessModel>(stream,
        new JsonSerializerOptions(JsonSerializerDefaults.Web));
    return process is null ? Results.Problem("Process data is invalid.") : Results.Ok(process);
});

app.Run();

