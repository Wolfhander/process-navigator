using System.Text.RegularExpressions;
using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed partial class ProcessCatalogService(BpmnProcessLoader loader)
{
    private const long MaximumFileSize = 2 * 1024 * 1024;

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
                summaries.Add(ToSummary(process));
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

    private static ProcessSummaryModel ToSummary(ProcessModel process) => new(
        process.Id,
        process.Name,
        process.Version,
        process.Owner,
        process.Status,
        process.Nodes.Count,
        process.Lanes.Count);

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
