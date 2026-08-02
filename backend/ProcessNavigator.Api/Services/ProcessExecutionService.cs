using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class ProcessExecutionService(IWebHostEnvironment environment)
{
    private readonly string root = Path.Combine(environment.ContentRootPath, "Data", "Executions");
    private readonly SemaphoreSlim writeLock = new(1, 1);

    public async Task<IReadOnlyList<ProcessInstanceModel>> ListAsync(string processId, CancellationToken cancellationToken) =>
        (await ReadAsync(processId, cancellationToken)).OrderByDescending(instance => instance.StartedAt).ToArray();

    public async Task<ProcessAnalyticsModel> AnalyticsAsync(ProcessModel process, CancellationToken cancellationToken)
    {
        var instances = await ReadAsync(process.Id, cancellationToken); var now = DateTimeOffset.UtcNow;
        var completedCycles = instances.Where(item => item.CompletedAt.HasValue).Select(item => (item.CompletedAt!.Value - item.StartedAt).TotalMinutes).ToArray();
        var lanes = process.Lanes.ToDictionary(lane => lane.Id, lane => lane.Name);
        var steps = process.Nodes.Where(node => node.Type == "task").Select(node =>
        {
            var facts = instances.SelectMany(instance => instance.Steps).Where(step => step.ElementId == node.Id).ToArray();
            var durations = facts.Where(step => step.StartedAt.HasValue && step.CompletedAt.HasValue).Select(step => (step.CompletedAt!.Value - step.StartedAt!.Value).TotalMinutes).ToArray();
            var norm = ParseNormMinutes(node.Duration);
            var overdue = norm.HasValue ? facts.Count(step => step.StartedAt.HasValue && ((step.CompletedAt ?? now) - step.StartedAt.Value).TotalMinutes > norm.Value) : 0;
            return new StepAnalyticsModel(node.Id, node.Name, lanes.GetValueOrDefault(node.LaneId, node.Responsible ?? "Без дорожки"), node.Duration,
                facts.Count(step => step.Status == "Completed"), facts.Count(step => step.Status == "InProgress"),
                durations.Length > 0 ? Math.Round(durations.Average(), 1) : null, durations.Length > 0 ? Math.Round(durations.Max(), 1) : null, overdue);
        }).ToArray();
        return new(process.Id, instances.Count, instances.Count(item => item.Status == "Active"), instances.Count(item => item.Status == "Completed"),
            completedCycles.Length > 0 ? Math.Round(completedCycles.Average(), 1) : null, steps);
    }

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

    private static double? ParseNormMinutes(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var numberText = new string(value.TakeWhile(character => char.IsDigit(character) || character is ',' or '.').ToArray()).Replace(',', '.');
        if (!double.TryParse(numberText, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var number)) return null;
        var text = value.ToLowerInvariant();
        if (text.Contains("мин")) return number;
        if (text.Contains("час")) return number * 60;
        if (text.Contains("дн") || text.Contains("день")) return number * 8 * 60;
        return null;
    }
}
