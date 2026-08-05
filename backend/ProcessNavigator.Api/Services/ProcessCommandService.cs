using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class ProcessCommandService(IWebHostEnvironment environment, OneCIntegrationService oneC)
{
    private readonly string root = Path.Combine(environment.ContentRootPath, "Data", "Commands");
    private readonly SemaphoreSlim writeLock = new(1, 1);

    public async Task<CommandExecutionModel> ExecuteAsync(ProcessModel process, string elementId, string actionId,
        string? instanceId, string userId, CancellationToken cancellationToken)
    {
        var node = process.Nodes.FirstOrDefault(item => item.Id == elementId) ?? throw new KeyNotFoundException("Element");
        var action = node.Actions?.FirstOrDefault(item => item.Id == actionId) ?? throw new KeyNotFoundException("Action");
        var kind = action.Kind.Trim().ToUpperInvariant();
        if (kind is not ("ERP" or "REPORT" or "URL" or "FILE"))
            throw new InvalidDataException($"Тип команды '{action.Kind}' не поддерживается.");

        var oneCResult = kind == "ERP" ? await oneC.ExecuteAsync(new OneCCommandRequestModel(process.Id, process.Version,
            node.Id, node.Name, action.Id, action.Label, action.Target, instanceId, userId), cancellationToken) : null;
        var externalReference = oneCResult?.ExternalReference ?? action.Target;
        var message = kind switch
        {
            "ERP" => oneCResult!.Message,
            "REPORT" => "Отчёт подготовлен к открытию.",
            "URL" => "Ссылка проверена и подготовлена к открытию.",
            _ => "Файл подготовлен к открытию."
        };
        var result = new CommandExecutionModel(Guid.NewGuid().ToString("N"), process.Id, elementId, action.Id,
            action.Label, kind, action.Target, instanceId, userId, oneCResult?.Succeeded == false ? "Failed" : "Succeeded", message, externalReference, DateTimeOffset.UtcNow);
        await AppendAsync(result, cancellationToken);
        return result;
    }

    public async Task<IReadOnlyList<CommandExecutionModel>> ListAsync(string processId, string elementId, CancellationToken cancellationToken) =>
        (await ReadAsync(processId, cancellationToken)).Where(item => item.ElementId == elementId)
            .OrderByDescending(item => item.ExecutedAt).Take(20).ToArray();

    private async Task AppendAsync(CommandExecutionModel execution, CancellationToken cancellationToken)
    {
        await writeLock.WaitAsync(cancellationToken);
        try
        {
            var items = (await ReadAsync(execution.ProcessId, cancellationToken)).Append(execution).ToArray();
            Directory.CreateDirectory(root); var path = PathFor(execution.ProcessId); var temporary = path + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(items, new JsonSerializerOptions { WriteIndented = true }), cancellationToken);
            File.Move(temporary, path, true);
        }
        finally { writeLock.Release(); }
    }

    private async Task<IReadOnlyList<CommandExecutionModel>> ReadAsync(string processId, CancellationToken cancellationToken)
    {
        var path = PathFor(processId); if (!File.Exists(path)) return [];
        return JsonSerializer.Deserialize<List<CommandExecutionModel>>(await File.ReadAllTextAsync(path, cancellationToken),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
    }

    private string PathFor(string processId)
    {
        if (processId.Length is < 1 or > 100 || processId.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.')))
            throw new InvalidDataException("Недопустимый идентификатор процесса.");
        return Path.Combine(root, processId + ".json");
    }
}
