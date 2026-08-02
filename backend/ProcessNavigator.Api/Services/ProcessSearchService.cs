using ProcessNavigator.Api.Models;

namespace ProcessNavigator.Api.Services;

public sealed class ProcessSearchService(ProcessCatalogService catalog)
{
    public async Task<IReadOnlyList<SearchResultModel>> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var term = query.Trim();
        if (term.Length < 2) return [];
        if (term.Length > 120) throw new InvalidDataException("Поисковый запрос слишком длинный.");
        var results = new List<SearchResultModel>();
        foreach (var summary in await catalog.ListAsync(cancellationToken))
        {
            var process = await catalog.LoadAsync(summary.Id, false, cancellationToken);
            Add(results, "process", process.Name, process.Owner, process, null, term);
            foreach (var node in process.Nodes)
            {
                Add(results, "element", node.Name, Join(node.Description, node.Responsible), process, node, term);
                foreach (var artifact in node.Artifacts ?? [])
                    Add(results, "artifact", artifact.Name, Join(artifact.Kind, $"версия {artifact.Version}"), process, node, term);
                foreach (var action in node.Actions ?? [])
                    Add(results, "action", action.Label, Join(action.Kind, action.Target), process, node, term);
            }
        }
        return results.OrderByDescending(item => item.Score).ThenBy(item => item.ProcessName)
            .ThenBy(item => item.Label).Take(60).ToArray();
    }

    private static void Add(List<SearchResultModel> results, string kind, string label, string? description,
        ProcessModel process, NodeModel? node, string term)
    {
        var score = Score(label, term) * 3 + Score(description, term) + Score(node?.Responsible, term);
        if (score <= 0) return;
        results.Add(new(kind, label, description, process.Id, process.Name, node?.Id, node?.Name, score));
    }

    private static int Score(string? value, string term)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        if (value.Equals(term, StringComparison.CurrentCultureIgnoreCase)) return 100;
        if (value.StartsWith(term, StringComparison.CurrentCultureIgnoreCase)) return 50;
        return value.Contains(term, StringComparison.CurrentCultureIgnoreCase) ? 20 : 0;
    }

    private static string? Join(params string?[] values)
    {
        var result = string.Join(" · ", values.Where(value => !string.IsNullOrWhiteSpace(value)));
        return result.Length == 0 ? null : result;
    }
}
