using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class ProcessExecutionService(IWebHostEnvironment environment)
{
    private readonly string root = Path.Combine(environment.ContentRootPath, "Data", "Executions");
    private readonly SemaphoreSlim writeLock = new(1, 1);

    public async Task<IReadOnlyList<ProcessInstanceModel>> ListAsync(string processId, CancellationToken cancellationToken) =>
        (await ReadAsync(processId, cancellationToken)).OrderByDescending(instance => instance.StartedAt).ToArray();

    public async Task<ProcessInstanceModel> StartAsync(ProcessModel process, string userId, string? name, CancellationToken cancellationToken)
    {
        var instance = new ProcessInstanceModel(Guid.NewGuid().ToString("N"), process.Id, process.Version,
            string.IsNullOrWhiteSpace(name) ? $"Выполнение от {DateTimeOffset.Now:dd.MM.yyyy HH:mm}" : name.Trim(), "Active",
            DateTimeOffset.UtcNow, null, userId, process.Nodes.Where(node => node.Type == "task")
                .Select(node => new StepExecutionModel(node.Id, "NotStarted", null, null, null)).ToArray());
        var instances = (await ReadAsync(process.Id, cancellationToken)).Append(instance).ToArray();
        await WriteAsync(process.Id, instances, cancellationToken); return instance;
    }

    public async Task<ProcessInstanceModel> UpdateStepAsync(ProcessModel process, string instanceId, string elementId, string status,
        string userId, CancellationToken cancellationToken)
    {
        if (status is not ("InProgress" or "Completed")) throw new InvalidDataException("Допустимы состояния InProgress и Completed.");
        if (!process.Nodes.Any(node => node.Id == elementId && node.Type == "task")) throw new KeyNotFoundException("BPMN element");
        var instances = (await ReadAsync(process.Id, cancellationToken)).ToArray();
        var index = Array.FindIndex(instances, item => item.Id == instanceId);
        if (index < 0) throw new KeyNotFoundException("Instance");
        var current = instances[index];
        if (current.Status != "Active") throw new InvalidDataException("Завершённый экземпляр нельзя изменять.");
        var now = DateTimeOffset.UtcNow;
        var steps = current.Steps.Select(step => step.ElementId != elementId ? step : status == "InProgress"
            ? step with { Status = status, StartedAt = step.StartedAt ?? now, UserId = userId }
            : step with { Status = status, StartedAt = step.StartedAt ?? now, CompletedAt = now, UserId = userId }).ToArray();
        var completed = steps.All(step => step.Status == "Completed");
        var updated = current with { Steps = steps, Status = completed ? "Completed" : "Active", CompletedAt = completed ? now : null };
        instances[index] = updated; await WriteAsync(process.Id, instances, cancellationToken); return updated;
    }

    private async Task<IReadOnlyList<ProcessInstanceModel>> ReadAsync(string processId, CancellationToken cancellationToken)
    {
        var path = PathFor(processId); if (!File.Exists(path)) return [];
        return JsonSerializer.Deserialize<List<ProcessInstanceModel>>(await File.ReadAllTextAsync(path, cancellationToken),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
    }

    private async Task WriteAsync(string processId, IReadOnlyList<ProcessInstanceModel> instances, CancellationToken cancellationToken)
    {
        await writeLock.WaitAsync(cancellationToken);
        try { Directory.CreateDirectory(root); var path = PathFor(processId); var temporary = path + ".tmp"; await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(instances, new JsonSerializerOptions { WriteIndented = true }), cancellationToken); File.Move(temporary, path, true); }
        finally { writeLock.Release(); }
    }

    private string PathFor(string processId)
    {
        if (processId.Length is < 1 or > 100 || processId.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.'))) throw new InvalidDataException("Недопустимый идентификатор процесса.");
        return Path.Combine(root, processId + ".json");
    }
}
