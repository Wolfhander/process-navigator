using System.Text.RegularExpressions;
using System.Text.Json.Nodes;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed partial class ProcessCatalogService(BpmnProcessLoader loader)
{
    private const long MaximumFileSize = 2 * 1024 * 1024;
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
        return versions.OrderByDescending(item => item.CreatedAt).ToArray();
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

    private static IReadOnlyList<string> ContextWarnings(ProcessModel process)
    {
        var count = process.Nodes.Count(node => string.IsNullOrWhiteSpace(node.Description) &&
            string.IsNullOrWhiteSpace(node.Responsible) && (node.Actions?.Count ?? 0) == 0 && (node.Artifacts?.Count ?? 0) == 0);
        return count == 0 ? [] : [$"{count} element(s) have no Process Navigator context."];
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
