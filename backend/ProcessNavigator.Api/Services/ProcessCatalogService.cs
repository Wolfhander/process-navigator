using System.Text.RegularExpressions;
using System.Text.Json.Nodes;
using System.Text;
using System.Text.Json;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed partial class ProcessCatalogService(BpmnProcessLoader loader)
{
    private const long MaximumFileSize = 2 * 1024 * 1024;
    private readonly SemaphoreSlim contextWriteLock = new(1, 1);
    private string DraftRoot => Path.Combine(loader.DataRoot, "Drafts");
    private string VersionRoot => Path.Combine(loader.DataRoot, "Versions");

    public async Task<IReadOnlyList<ProcessSummaryModel>> ListAsync(CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(loader.DataRoot)) return [];
        var summaries = new List<ProcessSummaryModel>();
        foreach (var bpmnPath in Directory.EnumerateFiles(loader.DataRoot, "*.bpmn", SearchOption.TopDirectoryOnly))
        {
            var contextPath = Path.ChangeExtension(bpmnPath, ".context.json");
            if (!File.Exists(contextPath)) continue;
            try
            {
                var process = await loader.LoadFilesAsync(bpmnPath, contextPath, cancellationToken: cancellationToken);
                var draft = await TryLoadDraftAsync(process.Id, cancellationToken);
                summaries.Add(ToSummary(process, draft));
            }
            catch (Exception exception) when (exception is InvalidDataException or IOException or UnauthorizedAccessException or System.Xml.XmlException or System.Text.Json.JsonException)
            {
                // Invalid source files are not exposed as usable catalog entries.
            }
        }
        return summaries.OrderBy(process => process.Name, StringComparer.CurrentCultureIgnoreCase).ToArray();
    }

    public async Task<ProcessImportResultModel> ImportAsync(
        IFormFile bpmnFile,
        IFormFile? contextFile,
        CancellationToken cancellationToken = default)
    {
        ValidateUpload(bpmnFile, ".bpmn", "BPMN");
        if (contextFile is not null) ValidateUpload(contextFile, ".json", "context");

        var temporaryDirectory = Directory.CreateTempSubdirectory("process-navigator-");
        try
        {
            var temporaryBpmn = Path.Combine(temporaryDirectory.FullName, "process.bpmn");
            var temporaryContext = Path.Combine(temporaryDirectory.FullName, "process.context.json");
            await SaveUploadAsync(bpmnFile, temporaryBpmn, cancellationToken);
            if (contextFile is not null)
                await SaveUploadAsync(contextFile, temporaryContext, cancellationToken);
            else
                await File.WriteAllTextAsync(temporaryContext,
                    "{\"version\":\"0.1\",\"owner\":\"Не назначен\",\"status\":\"Draft\",\"elements\":{}}",
                    cancellationToken);

            var process = await loader.LoadFilesAsync(temporaryBpmn, temporaryContext, cancellationToken: cancellationToken);
            if (!SafeProcessId().IsMatch(process.Id))
                throw new InvalidDataException("Process ID may contain only Latin letters, digits, dots, underscores and hyphens.");

            if (File.Exists(loader.GetBpmnPath(process.Id)))
                throw new ProcessConflictException($"Process '{process.Id}' already exists.");

            Directory.CreateDirectory(loader.DataRoot);
            var destinationBpmn = Path.Combine(loader.DataRoot, $"{process.Id}.bpmn");
            var destinationContext = Path.Combine(loader.DataRoot, $"{process.Id}.context.json");
            File.Copy(temporaryBpmn, destinationBpmn, overwrite: false);
            try
            {
                File.Copy(temporaryContext, destinationContext, overwrite: false);
            }
            catch
            {
                File.Delete(destinationBpmn);
                throw;
            }

            var warnings = new List<string>();
            var elementsWithoutContext = process.Nodes.Count(node =>
                string.IsNullOrWhiteSpace(node.Description) &&
                string.IsNullOrWhiteSpace(node.Responsible) &&
                (node.Actions?.Count ?? 0) == 0 &&
                (node.Artifacts?.Count ?? 0) == 0);
            if (elementsWithoutContext > 0)
                warnings.Add($"{elementsWithoutContext} element(s) have no Process Navigator context.");

            return new ProcessImportResultModel(ToSummary(process), warnings);
        }
        finally
        {
            temporaryDirectory.Delete(recursive: true);
        }
    }

    public async Task<ProcessModel> LoadAsync(string processId, bool draft, CancellationToken cancellationToken = default)
    {
        if (!draft) return await loader.LoadAsync(processId, cancellationToken);
        var (bpmnPath, contextPath) = DraftPaths(processId);
        if (!File.Exists(bpmnPath) || !File.Exists(contextPath))
            throw new FileNotFoundException($"Draft for process '{processId}' was not found.");
        return await loader.LoadFilesAsync(bpmnPath, contextPath, processId, cancellationToken);
    }

    public async Task<ProcessModel> LoadArchivedAsync(string processId, string version, CancellationToken cancellationToken = default)
    {
        var directory = Path.Combine(VersionRoot, processId, SafeFilePart(version));
        var bpmnPath = Path.Combine(directory, "process.bpmn");
        var contextPath = Path.Combine(directory, "process.context.json");
        if (!File.Exists(bpmnPath) || !File.Exists(contextPath))
            throw new FileNotFoundException($"Archived version '{version}' of process '{processId}' was not found.");
        return await loader.LoadFilesAsync(bpmnPath, contextPath, processId, cancellationToken);
    }

    public string GetBpmnSourcePath(string processId, bool draft)
    {
        if (!draft) return loader.GetBpmnPath(processId);
        var path = DraftPaths(processId).Bpmn;
        return File.Exists(path) ? path : Path.Combine(DraftRoot, "__missing__.bpmn");
    }

    public async Task<ProcessImportResultModel> SaveDraftXmlAsync(string processId, string xml, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(xml)) throw new InvalidDataException("BPMN XML is empty.");
        if (Encoding.UTF8.GetByteCount(xml) > MaximumFileSize) throw new InvalidDataException("The BPMN file exceeds the 2 MB limit.");
        var paths = DraftPaths(processId);
        if (!File.Exists(paths.Bpmn) || !File.Exists(paths.Context))
            throw new FileNotFoundException($"Draft for process '{processId}' was not found.");

        var temporaryPath = Path.Combine(Path.GetTempPath(), $"process-navigator-{Guid.NewGuid():N}.bpmn");
        try
        {
            await File.WriteAllTextAsync(temporaryPath, xml, new UTF8Encoding(false), cancellationToken);
            var validated = await loader.LoadFilesAsync(temporaryPath, paths.Context, processId, cancellationToken);
            File.Copy(temporaryPath, paths.Bpmn, overwrite: true);
            return new ProcessImportResultModel(ToSummary(validated), ContextWarnings(validated));
        }
        finally
        {
            File.Delete(temporaryPath);
        }
    }

    public async Task<NodeModel> SaveDraftElementContextAsync(
        string processId,
        string elementId,
        ElementContextUpdateModel update,
        CancellationToken cancellationToken = default)
    {
        if (!SafeProcessId().IsMatch(processId)) throw new FileNotFoundException();
        if (string.IsNullOrWhiteSpace(elementId) || elementId.Length > 200)
            throw new InvalidDataException("The BPMN element ID is invalid.");
        var normalized = NormalizeContext(update);
        var paths = DraftPaths(processId);
        if (!File.Exists(paths.Bpmn) || !File.Exists(paths.Context))
            throw new FileNotFoundException($"Draft for process '{processId}' was not found.");

        await contextWriteLock.WaitAsync(cancellationToken);
        string? temporaryPath = null;
        try
        {
            var current = await loader.LoadFilesAsync(paths.Bpmn, paths.Context, processId, cancellationToken);
            if (current.Nodes.All(node => !string.Equals(node.Id, elementId, StringComparison.Ordinal)))
                throw new KeyNotFoundException(elementId);

            var root = JsonNode.Parse(await File.ReadAllTextAsync(paths.Context, cancellationToken))?.AsObject()
                ?? throw new InvalidDataException("Process context JSON is empty.");
            var elements = root["elements"] as JsonObject ?? new JsonObject();
            root["elements"] = elements;
            elements[elementId] = JsonSerializer.SerializeToNode(normalized,
                new JsonSerializerOptions(JsonSerializerDefaults.Web));

            temporaryPath = Path.Combine(Path.GetDirectoryName(paths.Context)!, $".{Guid.NewGuid():N}.context.tmp");
            await File.WriteAllTextAsync(temporaryPath,
                root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }), new UTF8Encoding(false), cancellationToken);
            var validated = await loader.LoadFilesAsync(paths.Bpmn, temporaryPath, processId, cancellationToken);
            File.Move(temporaryPath, paths.Context, overwrite: true);
            temporaryPath = null;
            return validated.Nodes.Single(node => string.Equals(node.Id, elementId, StringComparison.Ordinal));
        }
        finally
        {
            if (temporaryPath is not null) File.Delete(temporaryPath);
            contextWriteLock.Release();
        }
    }

    public async Task<ProcessSummaryModel> CreateDraftAsync(string processId, CancellationToken cancellationToken = default)
    {
        var published = await loader.LoadAsync(processId, cancellationToken);
        var (draftBpmn, draftContext) = DraftPaths(processId);
        if (File.Exists(draftBpmn) || File.Exists(draftContext))
            throw new ProcessConflictException($"Process '{processId}' already has a draft.");

        Directory.CreateDirectory(DraftRoot);
        File.Copy(loader.GetBpmnPath(processId), draftBpmn, overwrite: false);
        try
        {
            File.Copy(Path.ChangeExtension(loader.GetBpmnPath(processId), ".context.json"), draftContext, overwrite: false);
            await UpdateContextAsync(draftContext, NextVersion(published.Version), "Draft", cancellationToken);
            var draft = await loader.LoadFilesAsync(draftBpmn, draftContext, processId, cancellationToken);
            return ToSummary(published, draft);
        }
        catch
        {
            File.Delete(draftBpmn);
            File.Delete(draftContext);
            throw;
        }
    }

    public async Task<ProcessImportResultModel> ReplaceDraftAsync(
        string processId,
        IFormFile bpmnFile,
        IFormFile? contextFile,
        CancellationToken cancellationToken = default)
    {
        ValidateUpload(bpmnFile, ".bpmn", "BPMN");
        if (contextFile is not null) ValidateUpload(contextFile, ".json", "context");
        var existingDraft = await LoadAsync(processId, draft: true, cancellationToken);
        var temporaryDirectory = Directory.CreateTempSubdirectory("process-navigator-draft-");
        try
        {
            var temporaryBpmn = Path.Combine(temporaryDirectory.FullName, "process.bpmn");
            var temporaryContext = Path.Combine(temporaryDirectory.FullName, "process.context.json");
            await SaveUploadAsync(bpmnFile, temporaryBpmn, cancellationToken);
            if (contextFile is null)
                File.Copy(DraftPaths(processId).Context, temporaryContext);
            else
                await SaveUploadAsync(contextFile, temporaryContext, cancellationToken);
            await UpdateContextAsync(temporaryContext, existingDraft.Version, "Draft", cancellationToken);
            var validated = await loader.LoadFilesAsync(temporaryBpmn, temporaryContext, processId, cancellationToken);
            var paths = DraftPaths(processId);
            File.Copy(temporaryBpmn, paths.Bpmn, overwrite: true);
            File.Copy(temporaryContext, paths.Context, overwrite: true);
            return new ProcessImportResultModel(ToSummary(validated), ContextWarnings(validated));
        }
        finally
        {
            temporaryDirectory.Delete(recursive: true);
        }
    }

    public async Task<ProcessSummaryModel> PublishDraftAsync(string processId, CancellationToken cancellationToken = default)
    {
        var published = await loader.LoadAsync(processId, cancellationToken);
        var draft = await LoadAsync(processId, draft: true, cancellationToken);
        var publishedBpmn = loader.GetBpmnPath(processId);
        var publishedContext = Path.ChangeExtension(publishedBpmn, ".context.json");
        var archiveDirectory = Path.Combine(VersionRoot, processId, SafeFilePart(published.Version));
        Directory.CreateDirectory(archiveDirectory);
        File.Copy(publishedBpmn, Path.Combine(archiveDirectory, "process.bpmn"), overwrite: false);
        File.Copy(publishedContext, Path.Combine(archiveDirectory, "process.context.json"), overwrite: false);

        var draftPaths = DraftPaths(processId);
        await UpdateContextAsync(draftPaths.Context, draft.Version, "Published", cancellationToken);
        File.Copy(draftPaths.Bpmn, publishedBpmn, overwrite: true);
        File.Copy(draftPaths.Context, publishedContext, overwrite: true);
        File.Delete(draftPaths.Bpmn);
        File.Delete(draftPaths.Context);
        return ToSummary(await loader.LoadAsync(processId, cancellationToken));
    }

    public async Task<IReadOnlyList<ProcessVersionModel>> VersionsAsync(string processId, CancellationToken cancellationToken = default)
    {
        var versions = new List<ProcessVersionModel>();
        var published = await loader.LoadAsync(processId, cancellationToken);
        versions.Add(new ProcessVersionModel(published.Version, "Published", File.GetLastWriteTimeUtc(loader.GetBpmnPath(processId))));
        var processArchive = Path.Combine(VersionRoot, processId);
        if (Directory.Exists(processArchive))
        {
            foreach (var contextPath in Directory.EnumerateFiles(processArchive, "process.context.json", SearchOption.AllDirectories))
            {
                var bpmnPath = Path.Combine(Path.GetDirectoryName(contextPath)!, "process.bpmn");
                var archived = await loader.LoadFilesAsync(bpmnPath, contextPath, processId, cancellationToken);
                versions.Add(new ProcessVersionModel(archived.Version, "Archived", File.GetLastWriteTimeUtc(contextPath)));
            }
        }
        var draft = await TryLoadDraftAsync(processId, cancellationToken);
        if (draft is not null)
            versions.Add(new ProcessVersionModel(draft.Version, "Draft", File.GetLastWriteTimeUtc(DraftPaths(processId).Context)));
        return versions
            .OrderBy(item => item.Status switch { "Draft" => 0, "Published" => 1, _ => 2 })
            .ThenByDescending(item => VersionSortKey(item.Version))
            .ToArray();
    }

    private static ProcessSummaryModel ToSummary(ProcessModel process, ProcessModel? draft = null) => new(
        process.Id,
        process.Name,
        process.Version,
        process.Owner,
        process.Status,
        process.Nodes.Count,
        process.Lanes.Count,
        draft is not null,
        draft?.Version);

    private async Task<ProcessModel?> TryLoadDraftAsync(string processId, CancellationToken cancellationToken)
    {
        var paths = DraftPaths(processId);
        if (!File.Exists(paths.Bpmn) || !File.Exists(paths.Context)) return null;
        return await loader.LoadFilesAsync(paths.Bpmn, paths.Context, processId, cancellationToken);
    }

    private (string Bpmn, string Context) DraftPaths(string processId) => (
        Path.Combine(DraftRoot, $"{processId}.bpmn"),
        Path.Combine(DraftRoot, $"{processId}.context.json"));

    private static async Task UpdateContextAsync(string path, string version, string status, CancellationToken cancellationToken)
    {
        var root = JsonNode.Parse(await File.ReadAllTextAsync(path, cancellationToken))?.AsObject()
            ?? throw new InvalidDataException("Process context JSON is empty.");
        root["version"] = version;
        root["status"] = status;
        await File.WriteAllTextAsync(path, root.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }), cancellationToken);
    }

    private static string NextVersion(string version)
    {
        var parts = version.Split('.');
        return parts.Length >= 2 && int.TryParse(parts[1], out var minor)
            ? $"{parts[0]}.{minor + 1}"
            : $"{version}.1";
    }

    private static string SafeFilePart(string value) => Regex.Replace(value, "[^A-Za-z0-9._-]", "_");

    private static long VersionSortKey(string value)
    {
        var parts = value.Split('.');
        long result = 0;
        for (var index = 0; index < Math.Min(parts.Length, 4); index++)
        {
            result = result * 10_000 + (int.TryParse(parts[index], out var part) ? Math.Clamp(part, 0, 9_999) : 0);
        }
        for (var index = parts.Length; index < 4; index++) result *= 10_000;
        return result;
    }

    private static IReadOnlyList<string> ContextWarnings(ProcessModel process)
    {
        var count = process.Nodes.Count(node => string.IsNullOrWhiteSpace(node.Description) &&
            string.IsNullOrWhiteSpace(node.Responsible) && (node.Actions?.Count ?? 0) == 0 && (node.Artifacts?.Count ?? 0) == 0);
        return count == 0 ? [] : [$"{count} element(s) have no Process Navigator context."];
    }

    private static ElementContextUpdateModel NormalizeContext(ElementContextUpdateModel update)
    {
        static string? Text(string? value, int maximum, string field)
        {
            var result = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
            if (result?.Length > maximum) throw new InvalidDataException($"{field} exceeds {maximum} characters.");
            return result;
        }

        var artifacts = (update.Artifacts ?? []).Take(21).Select(item => new ArtifactModel(
            Text(item.Name, 200, "Artifact name") ?? throw new InvalidDataException("Artifact name is required."),
            Text(item.Kind, 80, "Artifact kind") ?? throw new InvalidDataException("Artifact kind is required."),
            Text(item.Version, 40, "Artifact version") ?? throw new InvalidDataException("Artifact version is required."),
            Text(item.Reference, 500, "Artifact reference"))).ToArray();
        if (artifacts.Length > 20) throw new InvalidDataException("An element cannot contain more than 20 artifacts.");

        var actions = (update.Actions ?? []).Take(21).Select(item => new ActionModel(
            Text(item.Id, 100, "Action ID") ?? throw new InvalidDataException("Action ID is required."),
            Text(item.Label, 200, "Action label") ?? throw new InvalidDataException("Action label is required."),
            Text(item.Kind, 50, "Action kind") ?? throw new InvalidDataException("Action kind is required."),
            Text(item.Target, 500, "Action target"))).ToArray();
        if (actions.Length > 20) throw new InvalidDataException("An element cannot contain more than 20 actions.");
        if (actions.Select(item => item.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != actions.Length)
            throw new InvalidDataException("Action IDs must be unique within an element.");

        return new ElementContextUpdateModel(
            Text(update.Description, 4000, "Description"),
            Text(update.Responsible, 200, "Responsible"),
            Text(update.Duration, 100, "Duration"),
            artifacts,
            actions);
    }

    private static void ValidateUpload(IFormFile file, string extension, string label)
    {
        if (file.Length == 0) throw new InvalidDataException($"The {label} file is empty.");
        if (file.Length > MaximumFileSize) throw new InvalidDataException($"The {label} file exceeds the 2 MB limit.");
        if (!string.Equals(Path.GetExtension(file.FileName), extension, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"The {label} file must have the '{extension}' extension.");
    }

    private static async Task SaveUploadAsync(IFormFile file, string destination, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await file.CopyToAsync(stream, cancellationToken);
    }

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeProcessId();
}

public sealed class ProcessConflictException(string message) : Exception(message);
