namespace ProcessNavigator.Api.Models;

public sealed record ProcessModel(
    string Id,
    string Name,
    string Version,
    string Owner,
    string Status,
    IReadOnlyList<LaneModel> Lanes,
    IReadOnlyList<NodeModel> Nodes,
    IReadOnlyList<EdgeModel> Edges);

public sealed record LaneModel(string Id, string Name, double Y, double Height);

public sealed record NodeModel(
    string Id,
    string Type,
    string Name,
    string LaneId,
    double X,
    double Y,
    double Width,
    double Height,
    string? Description,
    string? Responsible,
    string? Duration,
    IReadOnlyList<ArtifactModel>? Artifacts,
    IReadOnlyList<ActionModel>? Actions);

public sealed record EdgeModel(
    string Id,
    string SourceId,
    string TargetId,
    string? Label,
    IReadOnlyList<PointModel> Points);

public sealed record PointModel(double X, double Y);
public sealed record ArtifactModel(string Name, string Kind, string Version);
public sealed record ActionModel(string Id, string Label, string Kind);

public sealed record ProcessSummaryModel(
    string Id,
    string Name,
    string Version,
    string Owner,
    string Status,
    int NodeCount,
    int LaneCount);

public sealed record ProcessImportResultModel(
    ProcessSummaryModel Process,
    IReadOnlyList<string> Warnings);
