using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class ElementCommentService(IWebHostEnvironment environment)
{
    private readonly string root = Path.Combine(environment.ContentRootPath, "Data", "Comments");
    private readonly SemaphoreSlim writeLock = new(1, 1);

    public async Task<IReadOnlyList<ElementCommentModel>> ListAsync(string processId, string elementId, CancellationToken cancellationToken) =>
        (await ReadAsync(processId, cancellationToken)).Where(item => item.ElementId == elementId)
            .OrderBy(item => item.CreatedAt).ToArray();

    public async Task<ElementCommentModel> AddAsync(ProcessModel process, string elementId, UserProfileModel user,
        string text, CancellationToken cancellationToken)
    {
        if (!process.Nodes.Any(node => node.Id == elementId)) throw new KeyNotFoundException("Element");
        text = text.Trim();
        if (text.Length is < 1 or > 2000) throw new InvalidDataException("Комментарий должен содержать от 1 до 2000 символов.");
        var comment = new ElementCommentModel(Guid.NewGuid().ToString("N"), process.Id, elementId, user.Id,
            user.DisplayName, text, DateTimeOffset.UtcNow);
        await writeLock.WaitAsync(cancellationToken);
        try
        {
            var items = (await ReadAsync(process.Id, cancellationToken)).Append(comment).ToArray();
            Directory.CreateDirectory(root); var path = PathFor(process.Id); var temporary = path + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(items, new JsonSerializerOptions { WriteIndented = true }), cancellationToken);
            File.Move(temporary, path, true);
        }
        finally { writeLock.Release(); }
        return comment;
    }

    private async Task<IReadOnlyList<ElementCommentModel>> ReadAsync(string processId, CancellationToken cancellationToken)
    {
        var path = PathFor(processId); if (!File.Exists(path)) return [];
        return JsonSerializer.Deserialize<List<ElementCommentModel>>(await File.ReadAllTextAsync(path, cancellationToken),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
    }

    private string PathFor(string processId)
    {
        if (processId.Length is < 1 or > 100 || processId.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.')))
            throw new InvalidDataException("Недопустимый идентификатор процесса.");
        return Path.Combine(root, processId + ".json");
    }
}
